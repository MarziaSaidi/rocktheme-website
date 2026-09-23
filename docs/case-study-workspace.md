# Case study workspace

## Architecture

The `/work/[slug]` route remains a statically generated Next.js App Router page. It loads one project record on the server, resolves its stages, and passes serializable content into a focused client component.

- `CaseStudyWorkspace` owns stage selection, story selection, timers, keyboard input, touch input, pausing, and URL hash state.
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
- `code`: a scrollable engineering artifact with an optional language and label.
- no visual: a text-led stage with no empty media placeholder.

Use `cover` only for photography or presentation imagery where cropping is intentional.

Set `zoomable: true` on a wide image to provide a full-size link beneath the viewer. A story may also supply `supportingVideo` to link to a prototype recording without displacing its primary visual.

## Story behavior

Desktop stories advance after six seconds unless a story supplies `durationSeconds`. Progress pauses on hover, keyboard focus, touch interaction, or when the document is hidden. A story never advances into the next stage.

Mobile stories never auto-advance. People can tap the left or right side, swipe, or use a keyboard. Stage navigation scrolls horizontally when labels do not fit.

Reduced-motion mode disables automatic progression and content transitions.

## Direct links

The selected stage is stored as a clean URL hash, for example `/work/project-slug#context`. Stage changes use browser history, and back or forward navigation restores the stage.
