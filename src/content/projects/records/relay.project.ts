import type { ImageMedia, Project, VideoMedia } from "../project.types";
import { createNextProjectBlock, createPlaceholderImage, PLACEHOLDER_FIELDS } from "./placeholder";

/**
 * Relay.
 *
 * Structure is final; the words and the media are not. Every string below is a
 * marked placeholder, and nothing claims a result, a measurement, a research
 * finding or a quotation, because none has been approved.
 *
 * Replace the copy and the media, then clear `placeholderFields` and set
 * `contentStatus` to `final`.
 */

const homepageImage = createPlaceholderImage("relay", "Relay");

const caseImage = (file: string, label: string, width: number, height: number): ImageMedia => ({
  kind: "image",
  src: `/images/projects/relay/${file}`,
  alt: `Placeholder ${label} for the Relay case study. Final media and alternative text pending.`,
  width,
  height,
  isPlaceholder: true,
});

const interactionVideo: VideoMedia = {
  kind: "video",
  src: "/media/projects/relay/interaction-placeholder.mp4",
  title: "Placeholder interaction recording for Relay. Final capture pending.",
  poster: caseImage("video-poster-placeholder.svg", "video poster", 1600, 900),
  isPlaceholder: true,
};

export const relayProject = {
  id: "relay",
  slug: "relay",
  title: "Relay",
  order: 2,
  year: 2026,
  category: "Logistics platform",
  role: ["Product", "Code"],
  featured: false,
  enabled: true,
  contentStatus: "placeholder",
  placeholderFields: PLACEHOLDER_FIELDS,
  homepageImage,
  caseStudyUrl: "/work/relay",
  visualEmphasis: "standard",
  scenePlacement: "mid",
  accentBehavior: "project",
  shortDescription: "Placeholder description for Relay. Final project summary pending.",
  accentColor: "#B793D2",
  seo: {
    title: "Relay case study",
    description: "Placeholder SEO description for the Relay case study.",
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
          "Placeholder introduction for Relay. This paragraph will carry the opening framing once the copy is approved.",
          "Placeholder second introduction paragraph. Final case-study copy pending.",
        ],
        isPlaceholder: true,
      },
      {
        id: "context",
        type: "text",
        heading: "Context",
        body: [
          "Placeholder context paragraph 1 for Relay. Final approved copy pending.",
          "Placeholder context paragraph 2 for Relay. Final approved copy pending.",
        ],
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
        id: "approach",
        type: "split-text-media",
        heading: "Approach",
        body: [
          "Placeholder approach paragraph for Relay. Final approved copy pending.",
          "Placeholder second approach paragraph. Final approved copy pending.",
        ],
        media: caseImage("case-split-placeholder.svg", "approach image", 1200, 1400),
        mediaPosition: "left",
        isPlaceholder: true,
      },
      {
        id: "operations",
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
        body: ["Placeholder closing paragraph for Relay. Final approved copy pending."],
        tone: "lead",
        isPlaceholder: true,
      },
      createNextProjectBlock("supportiq"),
    ],
  },
  nextProjectSlug: "supportiq",
} satisfies Project;
