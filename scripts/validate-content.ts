import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { projectRegistry } from "../src/content/projects/projectRegistry";
import {
  BLOCK_LAYOUT,
  PROJECT_ACCENT_BEHAVIORS,
  PROJECT_BLOCK_TYPES,
  PROJECT_SCENE_PLACEMENTS,
  PROJECT_VISUAL_EMPHASIS,
  type CaseStudyBlock,
  type CaseStudyStage,
  type ImageMedia,
  type Project,
  type ProjectMedia,
  type VideoMedia,
} from "../src/content/projects/project.types";
import { SECTION_IDS, sectionAnchors } from "../src/config/sections";
import { siteContent } from "../src/content/site/siteContent";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(repositoryRoot, "public");
const errors: string[] = [];
const projects: readonly Project[] = projectRegistry;

function addError(location: string, message: string): void {
  errors.push(`${location}: ${message}`);
}

function validateRequiredString(value: unknown, location: string): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(location, "must be a non-empty string");
    return false;
  }

  return true;
}

function validateStringArray(value: unknown, location: string): value is readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    addError(location, "must contain at least one value");
    return false;
  }

  value.forEach((item, index) => validateRequiredString(item, `${location}[${index}]`));
  return true;
}

/**
 * Layout variants are a closed set. A record may only choose a documented name,
 * which is what stops content from describing its own appearance.
 */
function validateVariant(
  value: unknown,
  allowed: readonly string[],
  location: string,
  optional = true,
): void {
  if (value === undefined) {
    if (!optional) {
      addError(location, `is required and must be one of: ${allowed.join(", ")}`);
    }
    return;
  }

  if (typeof value !== "string" || !allowed.includes(value)) {
    addError(location, `must be one of: ${allowed.join(", ")} (received ${String(value)})`);
  }
}

function validateMediaRoute(src: unknown, location: string): src is string {
  if (!validateRequiredString(src, location)) {
    return false;
  }

  const hasAllowedRoot = src.startsWith("/images/projects/") || src.startsWith("/media/projects/");

  if (!hasAllowedRoot || src.includes("..")) {
    addError(
      location,
      "must be a safe project-media route under /images/projects/ or /media/projects/",
    );
    return false;
  }

  const mediaPath = resolve(publicRoot, `.${src}`);
  const relativePath = relative(publicRoot, mediaPath);

  if (relativePath.startsWith("..") || !existsSync(mediaPath)) {
    addError(location, `references missing media: ${src}`);
    return false;
  }

  return true;
}

function validateImage(media: ImageMedia, location: string): void {
  if (!media || media.kind !== "image") {
    addError(location, "must be an image media object");
    return;
  }

  validateMediaRoute(media.src, `${location}.src`);
  validateRequiredString(media.alt, `${location}.alt`);

  if (!Number.isInteger(media.width) || media.width <= 0) {
    addError(`${location}.width`, "must be a positive integer");
  }

  if (!Number.isInteger(media.height) || media.height <= 0) {
    addError(`${location}.height`, "must be a positive integer");
  }
}

function validateVideo(media: VideoMedia, location: string): void {
  if (!media || media.kind !== "video") {
    addError(location, "must be a video media object");
    return;
  }

  validateMediaRoute(media.src, `${location}.src`);
  validateRequiredString(media.title, `${location}.title`);
  validateImage(media.poster, `${location}.poster`);
}

function validateMedia(media: ProjectMedia, location: string): void {
  if (media?.kind === "image") {
    validateImage(media, location);
    return;
  }

  if (media?.kind === "video") {
    validateVideo(media, location);
    return;
  }

  addError(location, "has an invalid media kind");
}

/** Fields that would let content style itself. None of these may ever appear. */
const FORBIDDEN_BLOCK_FIELDS = [
  "className",
  "class",
  "style",
  "css",
  "html",
  "dangerouslySetInnerHTML",
] as const;

function validateBlock(block: CaseStudyBlock, project: Project, index: number): void {
  const location = `projects.${project.slug}.caseStudy.blocks[${index}]`;
  const runtimeBlock = block as CaseStudyBlock & Record<string, unknown>;

  validateRequiredString(block?.id, `${location}.id`);

  FORBIDDEN_BLOCK_FIELDS.forEach((field) => {
    if (runtimeBlock && field in runtimeBlock) {
      addError(`${location}.${field}`, "content may not carry styling or raw markup");
    }
  });

  if (
    typeof runtimeBlock?.type !== "string" ||
    !PROJECT_BLOCK_TYPES.includes(runtimeBlock.type as (typeof PROJECT_BLOCK_TYPES)[number])
  ) {
    addError(`${location}.type`, `invalid block type: ${String(runtimeBlock?.type)}`);
    return;
  }

  switch (block.type) {
    case "hero":
      validateImage(block.media, `${location}.media`);
      break;
    case "introduction":
      validateStringArray(block.body, `${location}.body`);
      break;
    case "text":
      validateStringArray(block.body, `${location}.body`);
      validateVariant(block.tone, BLOCK_LAYOUT.tone, `${location}.tone`);
      break;
    case "image":
      validateImage(block.media, `${location}.media`);
      validateVariant(block.width, BLOCK_LAYOUT.width, `${location}.width`);
      break;
    case "video":
      validateVideo(block.media, `${location}.media`);
      validateVariant(block.width, BLOCK_LAYOUT.width, `${location}.width`);
      break;
    case "gallery":
      if (!Array.isArray(block.images) || block.images.length === 0) {
        addError(`${location}.images`, "must contain at least one image");
      } else {
        block.images.forEach((image, imageIndex) =>
          validateImage(image, `${location}.images[${imageIndex}]`),
        );
      }
      validateVariant(block.columns, BLOCK_LAYOUT.columns, `${location}.columns`);
      break;
    case "split-text-media":
      validateStringArray(block.body, `${location}.body`);
      validateMedia(block.media, `${location}.media`);
      validateVariant(
        block.mediaPosition,
        BLOCK_LAYOUT.mediaPosition,
        `${location}.mediaPosition`,
        false,
      );
      break;
    case "metrics":
      if (!Array.isArray(block.metrics) || block.metrics.length === 0) {
        addError(`${location}.metrics`, "must contain at least one metric");
      } else {
        block.metrics.forEach((metric, metricIndex) => {
          validateRequiredString(metric.label, `${location}.metrics[${metricIndex}].label`);
          validateRequiredString(metric.value, `${location}.metrics[${metricIndex}].value`);
        });
      }
      validateVariant(block.columns, BLOCK_LAYOUT.columns, `${location}.columns`);
      break;
    case "quote":
      validateRequiredString(block.quote, `${location}.quote`);
      validateRequiredString(block.attribution?.name, `${location}.attribution.name`);
      break;
    case "process":
      if (!Array.isArray(block.steps) || block.steps.length === 0) {
        addError(`${location}.steps`, "must contain at least one process step");
      } else {
        block.steps.forEach((step, stepIndex) => {
          validateRequiredString(step.title, `${location}.steps[${stepIndex}].title`);
          validateRequiredString(step.description, `${location}.steps[${stepIndex}].description`);
        });
      }
      break;
    case "next-project":
      validateRequiredString(block.projectSlug, `${location}.projectSlug`);
      break;
  }
}

function validateStages(stages: readonly CaseStudyStage[], location: string): void {
  if (stages.length < 3 || stages.length > 7) {
    addError(`${location}.stages`, "must contain between 3 and 7 stages");
  }
  const stageIds = new Set<string>();
  stages.forEach((stage, stageIndex) => {
    const stageLocation = `${location}.stages[${stageIndex}]`;
    validateRequiredString(stage.id, `${stageLocation}.id`);
    validateRequiredString(stage.label, `${stageLocation}.label`);
    if (stageIds.has(stage.id)) addError(`${stageLocation}.id`, `duplicate stage id: ${stage.id}`);
    stageIds.add(stage.id);
    if (!Array.isArray(stage.stories) || stage.stories.length === 0) {
      addError(`${stageLocation}.stories`, "must contain at least one story");
      return;
    }
    const storyIds = new Set<string>();
    stage.stories.forEach((story, storyIndex) => {
      const storyLocation = `${stageLocation}.stories[${storyIndex}]`;
      validateRequiredString(story.id, `${storyLocation}.id`);
      validateRequiredString(story.title, `${storyLocation}.title`);
      validateRequiredString(story.description, `${storyLocation}.description`);
      if (storyIds.has(story.id))
        addError(`${storyLocation}.id`, `duplicate story id: ${story.id}`);
      storyIds.add(story.id);
      if (story.visual?.type === "image" || story.visual?.type === "video") {
        validateMedia(story.visual.media, `${storyLocation}.visual.media`);
      } else if (story.visual?.type === "group") {
        if (!story.visual.images.length)
          addError(`${storyLocation}.visual.images`, "must contain at least one image");
        story.visual.images.forEach((image: ImageMedia, imageIndex: number) =>
          validateImage(image, `${storyLocation}.visual.images[${imageIndex}]`),
        );
      } else if (story.visual?.type === "comparison") {
        validateImage(story.visual.before, `${storyLocation}.visual.before`);
        validateImage(story.visual.after, `${storyLocation}.visual.after`);
      } else if (story.visual?.type === "sequence") {
        if (story.visual.items.length < 1 || story.visual.items.length > 10) {
          addError(`${storyLocation}.visual.items`, "must contain 1 to 10 screens");
        }
        story.visual.items.forEach(
          (item: { label: string; media: ImageMedia }, itemIndex: number) => {
            validateRequiredString(item.label, `${storyLocation}.visual.items[${itemIndex}].label`);
            validateImage(item.media, `${storyLocation}.visual.items[${itemIndex}].media`);
          },
        );
      } else if (story.visual?.type === "code" && !story.visual.code.trim()) {
        addError(`${storyLocation}.visual.code`, "is required");
      }
      if (
        story.durationSeconds !== undefined &&
        (story.durationSeconds < 2 || story.durationSeconds > 30)
      ) {
        addError(`${storyLocation}.durationSeconds`, "must be between 2 and 30 seconds");
      }
      if (story.supportingVideo) {
        validateRequiredString(
          story.supportingVideo.label,
          `${storyLocation}.supportingVideo.label`,
        );
        validateMedia(story.supportingVideo.media, `${storyLocation}.supportingVideo.media`);
      }
    });
  });
}

function validateProject(project: Project, index: number): void {
  const location = `projects[${index}]`;
  validateRequiredString(project.id, `${location}.id`);
  const slugIsPresent = validateRequiredString(project.slug, `${location}.slug`);

  if (slugIsPresent && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) {
    addError(`${location}.slug`, "must use lowercase kebab-case");
  }

  validateRequiredString(project.title, `${location}.title`);
  validateRequiredString(project.category, `${location}.category`);
  validateStringArray(project.role, `${location}.role`);
  validateRequiredString(project.shortDescription, `${location}.shortDescription`);
  validateRequiredString(project.nextProjectSlug, `${location}.nextProjectSlug`);

  if (!Number.isInteger(project.order) || project.order < 1) {
    addError(`${location}.order`, "must be a positive integer");
  }

  if (!Number.isInteger(project.year) || project.year < 1900 || project.year > 2100) {
    addError(`${location}.year`, "must be a four-digit year");
  }

  if (typeof project.featured !== "boolean") {
    addError(`${location}.featured`, "must be a boolean");
  }

  if (typeof project.enabled !== "boolean") {
    addError(`${location}.enabled`, "must be a boolean");
  }

  if (!["placeholder", "draft", "final"].includes(project.contentStatus)) {
    addError(`${location}.contentStatus`, "must be placeholder, draft, or final");
  }

  if (!Array.isArray(project.placeholderFields)) {
    addError(`${location}.placeholderFields`, "must be an array");
  }

  if (!/^#[0-9a-f]{6}$/i.test(project.accentColor)) {
    addError(`${location}.accentColor`, "must be a six-digit hexadecimal color");
  }

  if (project.contentStatus === "placeholder" && project.placeholderFields.length === 0) {
    addError(`${location}.placeholderFields`, "must identify placeholder fields");
  }

  validateImage(project.homepageImage, `${location}.homepageImage`);
  validateRequiredString(project.caseStudyUrl, `${location}.caseStudyUrl`);
  validateVariant(
    project.visualEmphasis,
    PROJECT_VISUAL_EMPHASIS,
    `${location}.visualEmphasis`,
    false,
  );
  validateVariant(
    project.scenePlacement,
    PROJECT_SCENE_PLACEMENTS,
    `${location}.scenePlacement`,
    false,
  );
  validateVariant(
    project.accentBehavior,
    PROJECT_ACCENT_BEHAVIORS,
    `${location}.accentBehavior`,
    false,
  );
  validateRequiredString(project.seo?.title, `${location}.seo.title`);
  validateRequiredString(project.seo?.description, `${location}.seo.description`);

  const expectedPathname = `/work/${project.slug}`;
  if (project.caseStudyUrl !== expectedPathname) {
    addError(`${location}.caseStudyUrl`, `must equal ${expectedPathname}`);
  }
  const blocks = project.caseStudy?.blocks;
  const stages = project.caseStudy?.stages;
  if (
    (!Array.isArray(blocks) || blocks.length === 0) &&
    (!Array.isArray(stages) || stages.length === 0)
  ) {
    addError(`${location}.caseStudy`, "must contain stages or legacy blocks");
    return;
  }

  if (stages?.length) validateStages(stages, `${location}.caseStudy`);
  if (!blocks?.length) return;

  const blockIds = new Set<string>();
  const nextBlocks: { projectSlug: string }[] = [];

  blocks.forEach((block, blockIndex) => {
    validateBlock(block, project, blockIndex);

    if (blockIds.has(block.id)) {
      addError(`${location}.caseStudy.blocks[${blockIndex}].id`, `duplicate block id: ${block.id}`);
    }
    blockIds.add(block.id);

    if (block.type === "next-project") {
      nextBlocks.push(block);
    }
  });

  if (nextBlocks.length !== 1) {
    addError(`${location}.caseStudy.blocks`, "must contain exactly one next-project block");
  } else if (nextBlocks[0]?.projectSlug !== project.nextProjectSlug) {
    addError(`${location}.nextProjectSlug`, "must match the next-project block reference");
  }
}

function validateSiteContent(): void {
  validateRequiredString(siteContent.name, "site.name");
  validateRequiredString(siteContent.role, "site.role");
  validateRequiredString(siteContent.introduction, "site.introduction");
  validateRequiredString(siteContent.availability.label, "site.availability.label");
  validateRequiredString(siteContent.skipLinkLabel, "site.skipLinkLabel");
  validateRequiredString(siteContent.footer.copyright, "site.footer.copyright");
  validateRequiredString(siteContent.footer.backToTopLabel, "site.footer.backToTopLabel");

  validateStringArray(siteContent.hero.displayLines, "site.hero.displayLines");
  validateRequiredString(siteContent.hero.accessibleHeading, "site.hero.accessibleHeading");
  validateRequiredString(siteContent.hero.lead, "site.hero.lead");
  validateRequiredString(siteContent.hero.scrollLabel, "site.hero.scrollLabel");
  validateRequiredString(siteContent.hero.planeGroupLabel, "site.hero.planeGroupLabel");

  validateRequiredString(siteContent.work.displayHeading, "site.work.displayHeading");
  for (const key of [
    "galleryLabel",
    "viewLabel",
    "scrollLabel",
    "previousLabel",
    "nextLabel",
    "continueLabel",
  ] as const) {
    validateRequiredString(siteContent.work[key], `site.work.${key}`);
  }

  validateRequiredString(siteContent.statement.heading, "site.statement.heading");
  validateStringArray(siteContent.statement.paragraphs, "site.statement.paragraphs");
  validateStringArray(siteContent.statement.emphasis, "site.statement.emphasis");

  validateStringArray(siteContent.contact.displayLines, "site.contact.displayLines");
  validateRequiredString(siteContent.contact.accessibleHeading, "site.contact.accessibleHeading");
  validateRequiredString(siteContent.contact.lead, "site.contact.lead");
  validateRequiredString(siteContent.contact.primaryLabel, "site.contact.primaryLabel");
  validateRequiredString(siteContent.contact.planeLabel, "site.contact.planeLabel");

  const links = [siteContent.email, siteContent.linkedIn, siteContent.github];
  links.forEach((link, index) => {
    validateRequiredString(link.label, `site.links[${index}].label`);
    if (validateRequiredString(link.href, `site.links[${index}].href`)) {
      const isValid = link.href.startsWith("mailto:") || /^https:\/\//.test(link.href);
      if (!isValid) {
        addError(`site.links[${index}].href`, "must be a mailto or HTTPS route");
      }
    }
  });

  const knownSectionIds = new Set<string>(Object.values(sectionAnchors));

  siteContent.navigation.forEach((item, index) => {
    validateRequiredString(item.label, `site.navigation[${index}].label`);

    if (!validateRequiredString(item.href, `site.navigation[${index}].href`)) {
      return;
    }

    if (!/^(?:\/[a-z0-9/_-]*)?(?:#[a-z0-9_-]+)?$/i.test(item.href) || item.href.length === 0) {
      addError(`site.navigation[${index}].href`, "must be a valid internal route or anchor");
      return;
    }

    const anchor = item.href.split("#")[1];

    if (anchor && !knownSectionIds.has(anchor)) {
      addError(`site.navigation[${index}].href`, `references unknown section anchor: #${anchor}`);
    }
  });
}

function validateRegistry(): void {
  const ids = new Map<string, number>();
  const slugs = new Map<string, number>();
  const orders = new Map<number, number>();

  projects.forEach((project, index) => {
    validateProject(project, index);

    if (ids.has(project.id)) {
      addError(`projects[${index}].id`, `duplicates projects[${ids.get(project.id)}].id`);
    } else {
      ids.set(project.id, index);
    }

    if (slugs.has(project.slug)) {
      addError(`projects[${index}].slug`, `duplicates projects[${slugs.get(project.slug)}].slug`);
    } else {
      slugs.set(project.slug, index);
    }

    if (orders.has(project.order)) {
      addError(
        `projects[${index}].order`,
        `duplicates projects[${orders.get(project.order)}].order`,
      );
    } else {
      orders.set(project.order, index);
    }
  });

  projects.forEach((project, index) => {
    if (!slugs.has(project.nextProjectSlug)) {
      addError(
        `projects[${index}].nextProjectSlug`,
        `references unknown project: ${project.nextProjectSlug}`,
      );
    }

    (project.caseStudy.blocks ?? []).forEach((block, blockIndex) => {
      if (block.type === "next-project" && !slugs.has(block.projectSlug)) {
        addError(
          `projects[${index}].caseStudy.blocks[${blockIndex}].projectSlug`,
          `references unknown project: ${block.projectSlug}`,
        );
      }
    });
  });
}

function validateSections(): void {
  const identities = new Set<string>();
  const anchors = new Set<string>();
  SECTION_IDS.forEach((sectionId, index) => {
    if (identities.has(sectionId)) {
      addError(`sections[${index}]`, `duplicate section id: ${sectionId}`);
    }
    identities.add(sectionId);
    const anchor = sectionAnchors[sectionId];
    if (!validateRequiredString(anchor, `sections.${sectionId}.anchor`)) return;
    if (anchors.has(anchor)) {
      addError(`sections.${sectionId}.anchor`, `duplicate section anchor: ${anchor}`);
    }
    anchors.add(anchor);
  });
}

validateSections();
validateSiteContent();
validateRegistry();

if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  const blockCount = projects.reduce(
    (total, project) => total + (project.caseStudy.blocks?.length ?? 0),
    0,
  );
  const stageCount = projects.reduce(
    (total, project) => total + (project.caseStudy.stages?.length ?? 0),
    0,
  );
  const placeholderCount = projects.filter(
    (project) => project.contentStatus === "placeholder",
  ).length;

  console.log(
    `Content validation passed: ${projects.length} projects, ${stageCount} authored stages, ${blockCount} legacy blocks, ${placeholderCount} placeholder records.`,
  );
}
