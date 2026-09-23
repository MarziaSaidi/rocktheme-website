import type { ImageMedia, Project, VideoMedia } from "../project.types";
import { createNextProjectBlock, createPlaceholderImage, PLACEHOLDER_FIELDS } from "./placeholder";

/**
 * Wildwood.
 *
 * Structure is final; the words and the media are not. Every string below is a
 * marked placeholder, and nothing claims a result, a measurement, a research
 * finding or a quotation, because none has been approved.
 *
 * Replace the copy and the media, then clear `placeholderFields` and set
 * `contentStatus` to `final`.
 */

const homepageImage = createPlaceholderImage("wildwood", "Wildwood");

const caseImage = (file: string, label: string, width: number, height: number): ImageMedia => ({
  kind: "image",
  src: `/images/projects/wildwood/${file}`,
  alt: `Placeholder ${label} for the Wildwood case study. Final media and alternative text pending.`,
  width,
  height,
  isPlaceholder: true,
});

const interactionVideo: VideoMedia = {
  kind: "video",
  src: "/media/projects/wildwood/interaction-placeholder.mp4",
  title: "Placeholder interaction recording for Wildwood. Final capture pending.",
  poster: caseImage("video-poster-placeholder.svg", "video poster", 1600, 900),
  isPlaceholder: true,
};

export const wildwoodProject = {
  slug: "wildwood",
  title: "Wildwood",
  order: 7,
  year: 2026,
  category: "Digital experience",
  role: ["Design"],
  featured: false,
  enabled: true,
  contentStatus: "placeholder",
  placeholderFields: PLACEHOLDER_FIELDS,
  homepageImage,
  shortDescription: "Placeholder description for Wildwood. Final project summary pending.",
  accentColor: "#715A92",
  seo: {
    title: "Wildwood case study",
    description: "Placeholder SEO description for the Wildwood case study.",
    pathname: "/work/wildwood",
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
          "Placeholder introduction for Wildwood. This paragraph will carry the opening framing once the copy is approved.",
          "Placeholder second introduction paragraph. Final case-study copy pending.",
        ],
        isPlaceholder: true,
      },
      {
        id: "context",
        type: "text",
        heading: "Context",
        body: [
          "Placeholder context paragraph 1 for Wildwood. Final approved copy pending.",
          "Placeholder context paragraph 2 for Wildwood. Final approved copy pending.",
        ],
        isPlaceholder: true,
      },
      {
        id: "environment",
        type: "image",
        media: caseImage("case-wide-placeholder.svg", "full width image", 2000, 1000),
        caption: "Placeholder caption. Final caption pending.",
        width: "full",
        isPlaceholder: true,
      },
      {
        id: "interaction",
        type: "video",
        media: interactionVideo,
        caption: "Placeholder video caption. Final caption pending.",
        width: "wide",
        isPlaceholder: true,
      },
      {
        id: "surfaces",
        type: "gallery",
        images: [
          caseImage("gallery-01-placeholder.svg", "gallery image one", 1200, 900),
          caseImage("gallery-02-placeholder.svg", "gallery image two", 1200, 900),
          caseImage("gallery-03-placeholder.svg", "gallery image three", 1200, 900),
        ],
        caption: "Placeholder gallery caption. Final caption pending.",
        columns: "three",
        isPlaceholder: true,
      },
      {
        id: "process",
        type: "process",
        heading: "Process",
        steps: [
          {
            title: "Placeholder step one",
            description: "Placeholder description of stage one. Final copy pending.",
            isPlaceholder: true,
          },
          {
            title: "Placeholder step two",
            description: "Placeholder description of stage two. Final copy pending.",
            isPlaceholder: true,
          },
          {
            title: "Placeholder step three",
            description: "Placeholder description of stage three. Final copy pending.",
            isPlaceholder: true,
          },
        ],
        isPlaceholder: true,
      },
      {
        id: "closing",
        type: "text",
        heading: "Closing",
        body: ["Placeholder closing paragraph for Wildwood. Final approved copy pending."],
        tone: "lead",
        isPlaceholder: true,
      },
      createNextProjectBlock("survue"),
    ],
  },
  nextProjectSlug: "survue",
} satisfies Project;
