# How to add or replace a project

> Case studies now use the stage-and-story workspace documented in [case-study-workspace.md](case-study-workspace.md). Existing block records remain supported through a temporary generic adapter, but new projects should add `caseStudy.info` and `caseStudy.stages` directly.

Project content is data, not component code. All project records live in `src/content/projects/records`, are imported once by `projectRegistry.ts`, and are accessed through `projectLoader.ts`.

## Add a project

1. Choose a lowercase kebab-case slug, for example `project-name`.
2. Create `public/images/projects/project-name/` for images. Create `public/media/projects/project-name/` only if the case study includes video.
3. Add the homepage image and any case-study media. Use descriptive filenames and record their exact intrinsic dimensions.
4. Copy an existing record into `src/content/projects/records/project-name.project.ts`.
5. Replace every field, including `slug`, `title`, `order`, `year`, `category`, `role`, `featured`, `enabled`, `homepageImage`, `shortDescription`, `accentColor`, `seo`, `caseStudy`, and `nextProjectSlug`.
6. Keep `contentStatus: "placeholder"` and list unfinished fields in `placeholderFields` until the content is approved. Use `draft` during real copy development and `final` only after review.
7. Ensure `seo.pathname` is exactly `/work/project-name`.
8. Add exactly one `next-project` block and make its `projectSlug` match `nextProjectSlug`.
9. Import the new record in `src/content/projects/projectRegistry.ts` and add it to `projectRegistry`.
10. Update the previous project's `nextProjectSlug` and `next-project` block if the new project belongs inside the existing sequence.
11. Run `npm run validate`.

No React component, page template, motion file, or WebGL file should change.

## Remove a project

The safest reversible option is to set `enabled: false` in its record. Disabled projects are excluded from normal loader results but remain available through loader calls using `includeDisabled: true`.

For permanent removal:

1. Remove the record import and entry from `projectRegistry.ts`.
2. Delete or archive the record file.
3. Update any `nextProjectSlug` or `next-project` block that points to the removed slug.
4. Delete its media only after confirming no remaining project references those files.
5. Add a redirect before launch if the removed project previously had a public route.
6. Run `npm run validate`.

No UI component should change.

## Reorder projects

1. Edit the numeric `order` field in the affected project records.
2. Keep every order value unique and positive.
3. Update next-project relationships if the narrative sequence should follow the new order.
4. Run `npm run validate:content`.

Do not reorder components or create a homepage array. The loader always sorts by project data.

## Replace a homepage image

1. Add the replacement file under `public/images/projects/<slug>/`.
2. Update `homepageImage.src` in the project record.
3. Update `homepageImage.alt` to describe the actual image and its purpose.
4. Update `width` and `height` to the file's intrinsic dimensions.
5. Remove `isPlaceholder: true` when the image is approved.
6. Remove `homepageImage` from `placeholderFields` when it is no longer temporary.
7. Delete the old file only after confirming no case-study block uses it.
8. Run `npm run validate:content`.

## Replace a complete project

To preserve the existing URL, edit the current record in place and keep its slug. Replace the title, metadata, media, SEO, blocks, and next-project relationship, then remove all obsolete files.

To use a new URL:

1. Create a new record and media folder using the add-project procedure.
2. Remove or disable the old record.
3. Update inbound next-project relationships.
4. Plan a redirect from the old pathname to the new pathname before launch.
5. Run `npm run validate`.

Replacing a project never requires a new page template or slug-specific rendering branch.

## Create a case study

Build `caseStudy.blocks` in reading order. Each block needs a unique stable `id`
and one supported `type`. The shared renderer in
`src/components/work/CaseStudyBlocks.tsx` draws every block. Changing content
never means changing the renderer.

The page header is built from the record itself: `title` becomes the `h1`, and
`category`, `role` and `year` become the metadata line. No block repeats them.

```ts
caseStudy: {
  blocks: [
    { id: "hero", type: "hero", media: heroImage },
    { id: "introduction", type: "introduction", body: ["Opening paragraph."] },
    { id: "context", type: "text", heading: "Context", body: ["Paragraph."] },
    { id: "next-project", type: "next-project", projectSlug: "next-slug" },
  ],
},
```

### Block reference

| Type               | Required                         | Optional             |
| ------------------ | -------------------------------- | -------------------- |
| `hero`             | `media` (image)                  | `caption`            |
| `introduction`     | `body` (non-empty array)         | —                    |
| `text`             | `body`                           | `heading`, `tone`    |
| `image`            | `media` (image)                  | `caption`, `width`   |
| `video`            | `media` (video)                  | `caption`, `width`   |
| `gallery`          | `images` (non-empty)             | `caption`, `columns` |
| `split-text-media` | `body`, `media`, `mediaPosition` | `heading`            |
| `metrics`          | `metrics` (non-empty)            | `heading`, `columns` |
| `quote`            | `quote`, `attribution.name`      | `attribution.role`   |
| `process`          | `steps` (non-empty)              | `heading`            |
| `next-project`     | `projectSlug`                    | —                    |

`hero` is the block that morphs out of the Selected Work corridor during
navigation, so a case study should open with one.

### Layout variants

Content picks a documented name. It can never supply CSS. There is no
`className`, `style` or raw-HTML field anywhere in the schema, the validator
rejects one if it appears, and the renderer maps each name to a data attribute
that only its own stylesheet reads.

The allowed values live in `BLOCK_LAYOUT` in `project.types.ts`.

| Variant         | Applies to           | Values                   | Default                                | Meaning                                                               |
| --------------- | -------------------- | ------------------------ | -------------------------------------- | --------------------------------------------------------------------- |
| `width`         | `image`, `video`     | `column`, `wide`, `full` | `column`                               | Inside the reading measure, broken out past the text, or edge to edge |
| `columns`       | `gallery`, `metrics` | `two`, `three`, `four`   | `two` for gallery, `three` for metrics | Grid columns on desktop; all collapse on narrow viewports             |
| `mediaPosition` | `split-text-media`   | `left`, `right`          | required                               | Which side the media takes                                            |
| `tone`          | `text`               | `body`, `lead`           | `body`                                 | Running copy, or a larger opening or closing passage                  |

To add a variant, add the value to `BLOCK_LAYOUT`, add a rule to
`CaseStudyBlocks.module.css`, and add a row to the table above. Never let a
record describe its own appearance.

### Rules

- Images require a valid local source, alt text, width, and height.
- Videos require a local source, title, and poster image.
- Text arrays, gallery images, metrics, and process steps cannot be empty.
- Do not publish unverified metrics, outcomes, research findings, or quotations.
  An invented number in a portfolio is a false claim. Use a clearly marked
  placeholder and `isPlaceholder: true` until the real value is approved.
- End with exactly one next-project block.
- Keep `nextProjectSlug` synchronized with that block.

### SEO

Metadata comes from the record's `seo` object and nothing else. `seo.title` and
`seo.description` populate the document title and meta description, and
`seo.pathname` becomes the canonical URL. It must be exactly
`/work/<slug>`.

### Case-study media

Put case-study images beside the homepage image in
`public/images/projects/<slug>/` and videos in
`public/media/projects/<slug>/`. Record each file's intrinsic dimensions.
Placeholder media should say so in its own artwork and carry
`isPlaceholder: true`.

## Validate content

Use the focused validator while editing:

```bash
npm run validate:content
```

It checks duplicate slugs, duplicate order values, missing fields, invalid block
types, invalid layout variants, styling or raw markup smuggled into content,
missing alt text, invalid routes, missing media files, duplicate block IDs, and
invalid next-project references.

Every error names the exact path it came from, for example:

```text
- projects.qalin.caseStudy.blocks[4].width: must be one of: column, wide, full (received enormous)
- projects.qalin.caseStudy.blocks[0].media.alt: must be a non-empty string
- projects.qalin.caseStudy.blocks[0].media.src: references missing media: /images/projects/qalin/missing.svg
- projects[0].caseStudy.blocks[11].projectSlug: references unknown project: no-such-project
```

Before handing off a content change, run the complete pipeline:

```bash
npm run validate
```

This adds formatting, linting, type checking, and a production build to the content checks.
