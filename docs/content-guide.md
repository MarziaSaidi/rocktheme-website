# Content guide

## Content ownership

All editable site facts live under `src/content`. UI, motion, WebGL, and sound code must never contain project names, project order, social URLs, or slug-specific presentation conditions.

## Site content

`src/content/site/siteContent.ts` owns:

- Name and role
- Introduction and availability
- Email, LinkedIn, and GitHub links
- Navigation labels and routes
- Footer statement, copyright, and back-to-top label

Fields marked `isPlaceholder: true` must be replaced before launch.

## Project content

Each project has one file in `src/content/projects/records`. A record owns its homepage metadata, case-study SEO, case-study stages, and next-project relationship. Every record uses `satisfies Project` so missing or invalid fields fail type checking.

`projectRegistry.ts` is the single import boundary. `projectLoader.ts` provides ordered and enabled project collections, featured projects, slug lookup, next-project lookup, routes, and static route parameters.

The loader sorts by `order`. File order and registry order do not control presentation.

## Content status

- `placeholder`: representative structure only; `placeholderFields` must list unfinished fields.
- `draft`: real content is in progress and not ready for publication review.
- `final`: approved content and media.

Placeholder copy must say that it is placeholder content. Do not invent outcomes, metrics, testimonials, dates, or responsibilities.

## Media

- Images belong under `public/images/projects/<slug>/`.
- Videos belong under `public/media/projects/<slug>/`.
- Reference images in `design/references` are not production media.
- Every image requires non-empty alt text and explicit width and height.
- Every video requires a title and poster image. Add a transcript when speech or essential audio is present.
- `isPlaceholder: true` identifies temporary media.

## Case-study stages

The interactive workspace is authored with `caseStudy.info` and `caseStudy.stages`. Stage labels are project content, not component constants. Each stage contains one or more stories, and each story combines its visual with the explanation of why that artifact matters.

See [case-study-workspace.md](case-study-workspace.md) for the complete model, supported media, interaction rules, and an authoring example.

## Legacy case-study blocks

- `hero`
- `introduction`
- `text`
- `image`
- `video`
- `gallery`
- `split-text-media`
- `metrics`
- `quote`
- `process`
- `next-project`

The original records still use these blocks. A generic adapter groups them for the new workspace during migration. New projects should author stages directly. Legacy blocks require unique IDs and exactly one `next-project` block matching `nextProjectSlug`.

Layout is chosen from documented variant names in `BLOCK_LAYOUT`, never from CSS. Content carries no `className`, `style` or raw markup, and the validator rejects any such field. See [how-to-add-or-replace-project.md](how-to-add-or-replace-project.md) for the block reference and the variant table.

## Validation

Run content validation alone:

```bash
npm run validate:content
```

Run the complete project validation pipeline:

```bash
npm run validate
```

See [how-to-add-or-replace-project.md](how-to-add-or-replace-project.md) for exact editing procedures.
