import type {
  CaseStudyBlock,
  CaseStudyStage,
  CaseStudyStory,
  Project,
  StoryVisual,
} from "./project.types";

const sentence = (body: readonly string[] | undefined, fallback: string): string =>
  body?.find(Boolean) ?? fallback;

function visualFromBlock(block: CaseStudyBlock): StoryVisual | undefined {
  switch (block.type) {
    case "hero":
    case "image":
      return { type: "image", media: block.media, fit: "contain" };
    case "video":
      return { type: "video", media: block.media, fit: "contain" };
    case "gallery":
      return { type: "group", images: block.images, fit: "contain" };
    case "split-text-media":
      return block.media.kind === "image"
        ? { type: "image", media: block.media, fit: "contain" }
        : { type: "video", media: block.media, fit: "contain" };
    default:
      return undefined;
  }
}

function storyFromBlock(block: CaseStudyBlock, project: Project): CaseStudyStory | null {
  switch (block.type) {
    case "next-project":
      return null;
    case "hero":
      return {
        id: block.id,
        eyebrow: project.category,
        title: project.title,
        description: project.shortDescription,
        visual: visualFromBlock(block),
        caption: block.caption,
      };
    case "introduction":
      return {
        id: block.id,
        title: "Project overview",
        description: sentence(block.body, project.shortDescription),
      };
    case "text":
      return {
        id: block.id,
        title: block.heading ?? "Project story",
        description: sentence(block.body, project.shortDescription),
        supportingPoints: block.body.slice(1),
      };
    case "image":
    case "video":
      return {
        id: block.id,
        title: block.caption ?? "Project artifact",
        description: "This artifact is part of the project story. Final supporting copy pending.",
        visual: visualFromBlock(block),
        caption: block.caption,
      };
    case "gallery":
      return {
        id: block.id,
        title: block.caption ?? "Design exploration",
        description: "A set of related project artifacts. Final supporting copy pending.",
        visual: visualFromBlock(block),
        caption: block.caption,
      };
    case "split-text-media":
      return {
        id: block.id,
        title: block.heading ?? "Design decision",
        description: sentence(block.body, project.shortDescription),
        supportingPoints: block.body.slice(1),
        visual: visualFromBlock(block),
      };
    case "metrics":
      return {
        id: block.id,
        title: block.heading ?? "Outcomes",
        description: "Project signals and outcomes. Final approved measurements pending.",
        supportingPoints: block.metrics.map((metric) =>
          [metric.value, metric.label, metric.context].filter(Boolean).join(" - "),
        ),
      };
    case "quote":
      return {
        id: block.id,
        title: "Reflection",
        description: block.quote,
        quote: {
          text: block.quote,
          attribution: [block.attribution.name, block.attribution.role].filter(Boolean).join(", "),
        },
      };
    case "process":
      return {
        id: block.id,
        title: block.heading ?? "Process",
        description: "The project moved through these connected decisions.",
        supportingPoints: block.steps.map((step) => `${step.title}: ${step.description}`),
      };
  }
}

/**
 * New records author stages directly. Existing block records are grouped into
 * stages without any project-name or slug-specific conditions.
 */
export function getCaseStudyStages(project: Project): readonly CaseStudyStage[] {
  if (project.caseStudy.stages?.length) return project.caseStudy.stages;

  const stories = (project.caseStudy.blocks ?? [])
    .map((block) => storyFromBlock(block, project))
    .filter((story): story is CaseStudyStory => story !== null);

  const stageCount = Math.min(6, Math.max(3, stories.length));
  const size = Math.ceil(stories.length / stageCount);

  return Array.from({ length: stageCount }, (_, index) =>
    stories.slice(index * size, (index + 1) * size),
  )
    .filter((group) => group.length)
    .map((group) => ({ id: group[0]!.id, label: group[0]!.title, stories: group }));
}
