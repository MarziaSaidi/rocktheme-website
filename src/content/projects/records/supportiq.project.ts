import type { ImageMedia, Project } from "../project.types";
import { createNextProjectBlock, createPlaceholderImage, PLACEHOLDER_FIELDS } from "./placeholder";

/**
 * SupportIQ.
 *
 * Structure is final; the words and the media are not. Every string below is a
 * marked placeholder, and nothing claims a result, a measurement, a research
 * finding or a quotation, because none has been approved.
 *
 * Replace the copy and the media, then clear `placeholderFields` and set
 * `contentStatus` to `final`.
 */

const homepageImage = createPlaceholderImage("supportiq", "SupportIQ");

const caseImage = (file: string, label: string, width: number, height: number): ImageMedia => ({
  kind: "image",
  src: `/images/projects/supportiq/${file}`,
  alt: `Placeholder ${label} for the SupportIQ case study. Final media and alternative text pending.`,
  width,
  height,
  isPlaceholder: true,
});

export const supportIqProject = {
  slug: "supportiq",
  title: "SupportIQ",
  order: 3,
  year: 2026,
  category: "AI support",
  role: ["Design", "Build"],
  featured: false,
  enabled: true,
  contentStatus: "placeholder",
  placeholderFields: PLACEHOLDER_FIELDS,
  homepageImage,
  shortDescription: "Placeholder description for SupportIQ. Final project summary pending.",
  accentColor: "#715A92",
  seo: {
    title: "SupportIQ case study",
    description: "Placeholder SEO description for the SupportIQ case study.",
    pathname: "/work/supportiq",
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
          "Placeholder introduction for SupportIQ. This paragraph will carry the opening framing once the copy is approved.",
          "Placeholder second introduction paragraph. Final case-study copy pending.",
        ],
        isPlaceholder: true,
      },
      {
        id: "context",
        type: "text",
        heading: "Context",
        body: [
          "Placeholder context paragraph 1 for SupportIQ. Final approved copy pending.",
          "Placeholder context paragraph 2 for SupportIQ. Final approved copy pending.",
        ],
        isPlaceholder: true,
      },
      {
        id: "approach",
        type: "split-text-media",
        heading: "Approach",
        body: [
          "Placeholder approach paragraph for SupportIQ. Final approved copy pending.",
          "Placeholder second approach paragraph. Final approved copy pending.",
        ],
        media: caseImage("case-split-placeholder.svg", "approach image", 1200, 1400),
        mediaPosition: "right",
        isPlaceholder: true,
      },
      {
        id: "surfaces",
        type: "gallery",
        images: [
          caseImage("gallery-01-placeholder.svg", "gallery image one", 1200, 900),
          caseImage("gallery-02-placeholder.svg", "gallery image two", 1200, 900),
        ],
        caption: "Placeholder gallery caption. Final caption pending.",
        columns: "two",
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
        /* No quotation has been given, so none is written here. */
        id: "reflection",
        type: "quote",
        quote: "Placeholder quotation. No approved quotation is available yet.",
        attribution: { name: "Attribution pending" },
        isPlaceholder: true,
      },
      {
        id: "closing",
        type: "text",
        heading: "Closing",
        body: ["Placeholder closing paragraph for SupportIQ. Final approved copy pending."],
        tone: "lead",
        isPlaceholder: true,
      },
      createNextProjectBlock("get-campus"),
    ],
  },
  nextProjectSlug: "get-campus",
} satisfies Project;
