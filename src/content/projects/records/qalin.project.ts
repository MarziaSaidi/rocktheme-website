import type { ImageMedia, Project, VideoMedia } from "../project.types";
import { createPlaceholderImage, PLACEHOLDER_FIELDS } from "./placeholder";

/**
 * Qalin — pilot case study.
 *
 * This record is the pilot for the reusable stage-and-story case-study model.
 * The interaction structure is representative; the words and media are not.
 *
 * Every string below is a marked placeholder. Nothing here claims a result, a
 * research finding, a metric or a quotation, because none has been approved.
 * Replace the copy and the media, then clear `placeholderFields` and set
 * `contentStatus` to `final`.
 */

const homepageImage = createPlaceholderImage("qalin", "Qalin");

const caseImage = (file: string, label: string, width: number, height: number): ImageMedia => ({
  kind: "image",
  src: `/images/projects/qalin/${file}`,
  alt: `Placeholder ${label} for the Qalin case study. Final media and alternative text pending.`,
  width,
  height,
  isPlaceholder: true,
});

const interactionVideo: VideoMedia = {
  kind: "video",
  src: "/media/projects/qalin/interaction-placeholder.mp4",
  title: "Placeholder interaction recording for Qalin. Final capture pending.",
  poster: caseImage("video-poster-placeholder.svg", "video poster", 1600, 900),
  isPlaceholder: true,
};

export const qalinProject = {
  id: "qalin",
  slug: "qalin",
  title: "Qalin",
  order: 1,
  year: 2026,
  category: "E-commerce",
  role: ["Design", "Build"],
  featured: false,
  enabled: true,
  contentStatus: "placeholder",
  placeholderFields: PLACEHOLDER_FIELDS,
  homepageImage,
  caseStudyUrl: "/work/qalin",
  visualEmphasis: "standard",
  scenePlacement: "near",
  accentBehavior: "project",
  shortDescription: "Placeholder description for Qalin. Final project summary pending.",
  accentColor: "#A8C947",
  seo: {
    title: "Qalin case study",
    description: "Placeholder SEO description for the Qalin case study.",
  },
  caseStudy: {
    info: {
      projectType: "E-commerce",
    },
    stages: [
      {
        id: "context",
        label: "Context",
        stories: [
          {
            id: "opening",
            eyebrow: "Project overview",
            title: "Qalin",
            description: "Placeholder opening context for Qalin. Final approved copy pending.",
            visual: {
              type: "image",
              media: caseImage("case-hero-placeholder.svg", "hero image", 1600, 1000),
            },
          },
          {
            id: "brief",
            eyebrow: "Context",
            title: "Framing the work",
            description:
              "Placeholder introduction for Qalin. This story will explain the project brief once the copy is approved.",
            constraint: "Placeholder constraint. Final project constraint pending.",
          },
        ],
      },
      {
        id: "direction",
        label: "Direction",
        stories: [
          {
            id: "approach",
            eyebrow: "Design direction",
            title: "Defining the approach",
            description: "Placeholder approach paragraph for Qalin. Final approved copy pending.",
            visual: {
              type: "image",
              media: caseImage("case-split-placeholder.svg", "approach image", 1200, 1400),
            },
            supportingPoints: [
              "Placeholder supporting point one.",
              "Placeholder supporting point two.",
            ],
          },
        ],
      },
      {
        id: "artifacts",
        label: "Artifacts",
        stories: [
          {
            id: "wide-artifact",
            eyebrow: "System view",
            title: "Seeing the complete surface",
            description:
              "Placeholder explanation for the wide project artifact. Final copy pending.",
            visual: {
              type: "image",
              media: caseImage("case-wide-placeholder.svg", "wide project artifact", 2000, 1000),
            },
          },
          {
            id: "surface-group",
            eyebrow: "Design exploration",
            title: "Comparing related surfaces",
            description: "Placeholder explanation for this related set of project artifacts.",
            visual: {
              type: "group",
              images: [
                caseImage("gallery-01-placeholder.svg", "gallery image one", 1200, 900),
                caseImage("gallery-02-placeholder.svg", "gallery image two", 1200, 900),
                caseImage("gallery-03-placeholder.svg", "gallery image three", 1200, 900),
              ],
            },
          },
        ],
      },
      {
        id: "interaction",
        label: "Interaction",
        stories: [
          {
            id: "prototype",
            eyebrow: "Prototype",
            title: "Testing the interaction",
            description: "Placeholder prototype explanation. Final supporting copy pending.",
            visual: { type: "video", media: interactionVideo },
          },
          {
            id: "process",
            eyebrow: "Process",
            title: "Connecting the decisions",
            description: "Placeholder process overview. Final supporting copy pending.",
            supportingPoints: [
              "Placeholder step one: final description pending.",
              "Placeholder step two: final description pending.",
              "Placeholder step three: final description pending.",
            ],
          },
        ],
      },
      {
        id: "outcome",
        label: "Outcome",
        stories: [
          {
            id: "signals",
            eyebrow: "Outcome",
            title: "What changed",
            description: "No result claims or measurements are approved yet.",
            metric: { value: "—", label: "Approved measurement pending" },
            outcome: "Placeholder outcome. Final approved result pending.",
          },
          {
            id: "reflection",
            eyebrow: "Reflection",
            title: "What the work clarified",
            description: "Placeholder reflection. Final approved reflection pending.",
            quote: { text: "No approved quotation is available yet." },
          },
        ],
      },
      {
        id: "closing",
        label: "Closing",
        stories: [
          {
            id: "closing-note",
            eyebrow: "Closing",
            title: "The complete project story",
            description: "Placeholder closing paragraph for Qalin. Final approved copy pending.",
          },
        ],
      },
    ],
  },
  nextProjectSlug: "relay",
} satisfies Project;
