import type { ImageMedia, Project } from "../project.types";
import { createNextProjectBlock, createPlaceholderImage, PLACEHOLDER_FIELDS } from "./placeholder";

/**
 * Get Campus.
 *
 * Structure is final; the words and the media are not. Every string below is a
 * marked placeholder, and nothing claims a result, a measurement, a research
 * finding or a quotation, because none has been approved.
 *
 * Replace the copy and the media, then clear `placeholderFields` and set
 * `contentStatus` to `final`.
 */

const homepageImage = createPlaceholderImage("get-campus", "Get Campus");

const caseImage = (file: string, label: string, width: number, height: number): ImageMedia => ({
  kind: "image",
  src: `/images/projects/get-campus/${file}`,
  alt: `Placeholder ${label} for the Get Campus case study. Final media and alternative text pending.`,
  width,
  height,
  isPlaceholder: true,
});

export const getCampusProject = {
  slug: "get-campus",
  title: "Get Campus",
  order: 4,
  year: 2026,
  category: "Student platform",
  role: ["Product design"],
  featured: false,
  enabled: true,
  contentStatus: "placeholder",
  placeholderFields: PLACEHOLDER_FIELDS,
  homepageImage,
  shortDescription: "Placeholder description for Get Campus. Final project summary pending.",
  accentColor: "#E6B84A",
  seo: {
    title: "Get Campus case study",
    description: "Placeholder SEO description for the Get Campus case study.",
    pathname: "/work/get-campus",
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
          "Placeholder introduction for Get Campus. This paragraph will carry the opening framing once the copy is approved.",
          "Placeholder second introduction paragraph. Final case-study copy pending.",
        ],
        isPlaceholder: true,
      },
      {
        id: "context",
        type: "text",
        heading: "Context",
        body: [
          "Placeholder context paragraph 1 for Get Campus. Final approved copy pending.",
          "Placeholder context paragraph 2 for Get Campus. Final approved copy pending.",
        ],
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
        id: "approach",
        type: "split-text-media",
        heading: "Approach",
        body: [
          "Placeholder approach paragraph for Get Campus. Final approved copy pending.",
          "Placeholder second approach paragraph. Final approved copy pending.",
        ],
        media: caseImage("case-split-placeholder.svg", "approach image", 1200, 1400),
        mediaPosition: "left",
        isPlaceholder: true,
      },
      {
        /*
         * No measurement has been approved. An invented number in a portfolio
         * is a false claim, so the values stay empty until one is.
         */
        id: "signals",
        type: "metrics",
        heading: "Signals",
        columns: "three",
        metrics: [
          {
            label: "Metric label pending",
            value: "—",
            context: "No measurement approved yet.",
            isPlaceholder: true,
          },
          {
            label: "Metric label pending",
            value: "—",
            context: "No measurement approved yet.",
            isPlaceholder: true,
          },
          {
            label: "Metric label pending",
            value: "—",
            context: "No measurement approved yet.",
            isPlaceholder: true,
          },
        ],
        isPlaceholder: true,
      },
      {
        id: "closing",
        type: "text",
        heading: "Closing",
        body: ["Placeholder closing paragraph for Get Campus. Final approved copy pending."],
        tone: "lead",
        isPlaceholder: true,
      },
      createNextProjectBlock("new-start-mobile"),
    ],
  },
  nextProjectSlug: "new-start-mobile",
} satisfies Project;
