# Case study workspace

## Architecture

The `/work/[slug]` route remains a statically generated Next.js App Router page. It loads one project record on the server, resolves its stages, and passes serializable content into a focused client component.

- `CaseStudyWorkspace` lays the cover and every story out as one scrolling page, follows the reader's place for the chapter rail, and keeps the URL hash on the stage being read.
- `StoryVisualView` renders images, videos, labeled screen sequences, image groups, code artifacts, and before/after comparisons without knowing any project names.
- `ProjectFacts` filters optional metadata before rendering, so missing values never leave empty labels.
- `getCaseStudyStages` returns authored stages unchanged. It also adapts the original block records while they are migrated.
- `project.types.ts` is the content contract. Content records cannot supply CSS, component names, or raw HTML.

## Authoring stages

New and migrated projects should add `caseStudy.info` and `caseStudy.stages` to their project record. Stage labels and order always come from that record.

```ts
caseStudy: {
  info: {
    timeline: "Timeline pending",
    company: "Company pending",
    team: "Team pending",
    responsibilities: ["Responsibility pending"],
    tools: ["Tool pending"],
    platform: "Platform pending",
    projectType: "Project type pending",
    externalUrl: "https://example.com",
    externalLabel: "View live project",
  },
  stages: [
    {
      id: "context",
      label: "Context",
      stories: [
        {
          id: "starting-point",
          eyebrow: "Context",
          title: "Approved heading pending",
          description: "Approved project copy pending.",
          visual: {
            type: "image",
            media: projectImage,
            fit: "contain",
          },
          durationSeconds: 6,
        },
      ],
    },
  ],
},
```

Use three to seven stages. Each stage needs at least one story. A single-story stage has no carousel controls or progress strip.

## Visual types

- `image`: one image, with `contain` as the default fit.
- `video`: a native video player with a poster and accessible title.
- `group`: several related images displayed together.
- `comparison`: labeled before and after images.
- `sequence`: a labeled set of real project screens in a row, overview board, or product mosaic; each screen opens its source at full size.
- `palette`: labelled hex color swatches.
- `typography`: a Helvetica Neue specimen using named examples.
- `assets`: original exported icons or components with descriptive labels and full-size links.
- `spacing`: labelled positive pixel values for an explicit spacing guideline.
- `code`: a scrollable engineering artifact with an optional language and label.
- no visual: a text-led stage with no empty media placeholder.

Use `cover` only for photography or presentation imagery where cropping is intentional.

Set `zoomable: true` on a wide image to provide a full-size link beneath the viewer. A story may also supply `supportingVideo` to link to a prototype recording without displacing its primary visual.

## Story behavior

The case study reads top to bottom: the cover, then every story of every stage. On desktop each story's evidence stays in view beside its copy; on phones the evidence sits above the copy. A story's copy and evidence arrive the first time it scrolls into view.

The chapter rail stays along the bottom and follows the reader. Its gold segments mark the story being read within the current stage. Choosing a stage scrolls to it; the previous and next buttons and the left and right arrow keys scroll one story back or on. At the end of the last story the rail offers the next case study.

`caseStudy.storyPlayback` is no longer read; nothing advances on a timer.

`caseStudy.info.timelineLabel` optionally clarifies what a timeline represents (for example, "Internship"); other projects default to "Timeline".

Stage navigation scrolls horizontally when labels do not fit.

Reduced-motion mode scrolls without smoothing and shows content without transitions.

## Direct links

The stage being read is stored as a clean URL hash, for example `/work/project-slug#context`, and a link with a hash opens on that stage. Scrolling replaces the hash without adding history; choosing a stage in the rail adds a history entry, so back and forward return to it.
