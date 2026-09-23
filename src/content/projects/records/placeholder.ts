import type {
  HeroBlock,
  ImageMedia,
  IntroductionBlock,
  NextProjectBlock,
  TextBlock,
} from "../project.types";

export const PLACEHOLDER_FIELDS = [
  "year",
  "category",
  "role",
  "homepageImage",
  "shortDescription",
  "seo",
  "caseStudy",
] as const;

export function createPlaceholderImage(slug: string, title: string): ImageMedia {
  return {
    kind: "image",
    src: `/images/projects/${slug}/homepage-placeholder.svg`,
    alt: `Placeholder homepage image for ${title}. Final project media pending.`,
    width: 1600,
    height: 1000,
    isPlaceholder: true,
  };
}

export function createPlaceholderHero(media: ImageMedia): HeroBlock {
  return {
    id: "hero",
    type: "hero",
    media,
    isPlaceholder: true,
  };
}

export function createPlaceholderIntroduction(title: string): IntroductionBlock {
  return {
    id: "introduction",
    type: "introduction",
    body: [`Placeholder introduction for ${title}. Final case-study copy pending.`],
    isPlaceholder: true,
  };
}

export function createPlaceholderText(title: string): TextBlock {
  return {
    id: "overview",
    type: "text",
    heading: "Project overview",
    body: [`Placeholder case-study content for ${title}. Final approved copy pending.`],
    isPlaceholder: true,
  };
}

export function createNextProjectBlock(projectSlug: string): NextProjectBlock {
  return {
    id: "next-project",
    type: "next-project",
    projectSlug,
  };
}
