# Case study workspace

## Architecture

The `/work/[slug]` route remains a statically generated Next.js App Router page. It loads one project record on the server, resolves its stages, and passes serializable content into a focused client component.

- `CaseStudyWorkspace` lays the cover and every story out as one scrolling page and keeps the URL hash on the stage being read.
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
- `comparison`: two labeled screens side by side, at the shared phone size.
- `sequence`: a labeled set of real project screens in one row at the shared phone size; a row longer than its space becomes a filmstrip. Each screen opens its source at full size. The `layout` value (`row`, `board`, `mosaic`) is kept in content but no longer changes the presentation.
- `palette`: labelled hex color swatches.
- `typography`: a Helvetica Neue specimen using named examples.
- `assets`: original exported icons or components with descriptive labels and full-size links.
- `spacing`: labelled positive pixel values for an explicit spacing guideline.
- `code`: a scrollable engineering artifact with an optional language and label.
- no visual: a text-led stage with no empty media placeholder.

Use `cover` only for photography or presentation imagery where cropping is intentional.

Set `zoomable: true` on a wide image to provide a full-size link beneath the viewer. A story may also supply `supportingVideo` to link to a prototype recording without displacing its primary visual.

## Page composition

Each stage is a chapter. It opens with its number (for example `03 / 06`) on a gold rule and its label set large in the display face.

A story is composed from the shape of its evidence; content never chooses the layout except for pairs:

- **Wide** (landscape images and videos, code, and sequences of more than three screens): the eyebrow and title on the left, the description and notes on the right, then the evidence across the page. Evidence never grows taller than the window, and a long sequence runs to the window's edge.
- **Tall** (portrait images and videos, comparisons, sequences of up to three screens, and the palette, type, asset and spacing sheets): the copy holds still on the left while the evidence sits on the right.
- **Pair**: set `layout: "pair"` on a stage with exactly two stories to show them side by side, staggered, as two states of one step. The validator rejects a pair stage without exactly two stories.

Decision, constraint and outcome are set as notes under one rule. A caption and the full-size link share a ruled line beneath the evidence. The first story's evidence is not repeated when the cover already shows it. The page ends with the next case study, set large.

Every phone screen on the page stands at one height (`--device-h`), whatever the layout and however many screens there are. A row of screens longer than its space becomes a filmstrip: the next screen peeks in at the edge, the strip snaps screen by screen, and it can be swiped, scrolled with a trackpad, dragged with a mouse, moved with its arrow buttons, or moved with the arrow keys once focused. A counter and a progress line show which screens are in view.

Palette, typography, asset and spacing visuals are set as spec sheets: each part near its own size on a dot-grid canvas only as large as its contents. Icons sit at their own size in small tiles, components near their on-phone size, and spacing as a ruler drawn at four times scale.

Spacing follows one scale: 8, 16, 24, 32, 48, 64, 96 and 160 px, on a 12-column grid.

## Story behavior

The case study reads top to bottom: the cover, then every story of every stage. On desktop each story's evidence stays in view beside its copy; on phones the evidence sits above the copy. A story's copy and evidence arrive the first time it scrolls into view.

There is no fixed navigation over the page: the chapter openers are the signposts, and the site's progress line shows how far along the reader is. The left and right arrow keys scroll one story back or on.

`caseStudy.storyPlayback` is no longer read; nothing advances on a timer.

`caseStudy.info.timelineLabel` optionally clarifies what a timeline represents (for example, "Internship"); other projects default to "Timeline".

Reduced-motion mode scrolls without smoothing and shows content without transitions.

## Direct links

The stage being read is stored as a clean URL hash, for example `/work/project-slug#context`, and a link with a hash opens on that stage. Scrolling replaces the hash without adding history. Following a link to another stage's hash adds a history entry, so back and forward return to it.
