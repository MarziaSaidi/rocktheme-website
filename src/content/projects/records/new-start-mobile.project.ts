import type { ImageMedia, Project, VideoMedia } from "../project.types";
import { createNextProjectBlock, createPlaceholderImage, PLACEHOLDER_FIELDS } from "./placeholder";

/**
 * New Start Mobile.
 *
 * Structure is final; the words and the media are not. Every string below is a
 * marked placeholder, and nothing claims a result, a measurement, a research
 * finding or a quotation, because none has been approved.
 *
 * Replace the copy and the media, then clear `placeholderFields` and set
 * `contentStatus` to `final`.
 */

const homepageImage = createPlaceholderImage("new-start-mobile", "New Start Mobile");

const caseImage = (file: string, label: string, width: number, height: number): ImageMedia => ({
  kind: "image",
  src: `/images/projects/new-start-mobile/${file}`,
  alt: `Placeholder ${label} for the New Start Mobile case study. Final media and alternative text pending.`,
  width,
  height,
  isPlaceholder: true,
});

const interactionVideo: VideoMedia = {
  kind: "video",
  src: "/media/projects/new-start-mobile/interaction-placeholder.mp4",
  title: "Placeholder interaction recording for New Start Mobile. Final capture pending.",
  poster: caseImage("video-poster-placeholder.svg", "video poster", 1600, 900),
  isPlaceholder: true,
};

export const newStartMobileProject = {
  slug: "new-start-mobile",
  title: "New Start Mobile",
  order: 5,
  year: 2026,
  category: "Mobile product",
  role: ["Product design"],
  featured: false,
  enabled: true,
  contentStatus: "placeholder",
  placeholderFields: PLACEHOLDER_FIELDS,
  homepageImage,
  shortDescription: "Placeholder description for New Start Mobile. Final project summary pending.",
  accentColor: "#F4EEFA",
  seo: {
    title: "New Start Mobile case study",
    description: "Placeholder SEO description for the New Start Mobile case study.",
    pathname: "/work/new-start-mobile",
  },
  caseStudy: {
    blocks: [
      {
        id: "hero",
        type: "hero",
        media: caseImage("case-hero-placeholder.svg", "hero image", 1600, 1000),
        isPlaceholder: true,
      },
      {
        id: "introduction",
        type: "introduction",
        body: [
          "Placeholder introduction for New Start Mobile. This paragraph will carry the opening framing once the copy is approved.",
          "Placeholder second introduction paragraph. Final case-study copy pending.",
        ],
        isPlaceholder: true,
      },
      {
        id: "context",
        type: "text",
        heading: "Context",
        body: [
          "Placeholder context paragraph 1 for New Start Mobile. Final approved copy pending.",
          "Placeholder context paragraph 2 for New Start Mobile. Final approved copy pending.",
        ],
        isPlaceholder: true,
      },
      {
        id: "screens",
        type: "gallery",
        images: [
          caseImage("gallery-01-placeholder.svg", "gallery image one", 900, 1600),
          caseImage("gallery-02-placeholder.svg", "gallery image two", 900, 1600),
          caseImage("gallery-03-placeholder.svg", "gallery image three", 900, 1600),
        ],
        caption: "Placeholder gallery caption. Final caption pending.",
        columns: "three",
        isPlaceholder: true,
      },
      {
        id: "approach",
        type: "split-text-media",
        heading: "Approach",
        body: [
          "Placeholder approach paragraph for New Start Mobile. Final approved copy pending.",
          "Placeholder second approach paragraph. Final approved copy pending.",
        ],
        media: caseImage("case-split-placeholder.svg", "approach image", 1200, 1400),
        mediaPosition: "right",
        isPlaceholder: true,
      },
      {
        id: "interaction",
        type: "video",
        media: interactionVideo,
        caption: "Placeholder video caption. Final caption pending.",
        width: "column",
        isPlaceholder: true,
      },
      {
        id: "closing",
        type: "text",
        heading: "Closing",
        body: ["Placeholder closing paragraph for New Start Mobile. Final approved copy pending."],
        tone: "lead",
        isPlaceholder: true,
      },
      createNextProjectBlock("quill-and-pigeon"),
    ],
  },
  nextProjectSlug: "quill-and-pigeon",
} satisfies Project;
