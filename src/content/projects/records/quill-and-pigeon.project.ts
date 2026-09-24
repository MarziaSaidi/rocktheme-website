import type { ImageMedia, Project, VideoMedia } from "../project.types";

const image = (file: string, alt: string, width: number, height: number): ImageMedia => ({
  kind: "image",
  src: "/images/projects/quill-and-pigeon/story/" + file,
  alt,
  width,
  height,
});

const media = {
  recipients: image(
    "add-recipients.jpg",
    "Quill & Pigeon recipient setup with spreadsheet import alongside manual entry.",
    1252,
    687,
  ),
  select: image(
    "select-file.png",
    "Import Contacts dialog with a CSV or XLSX drop area and template download link.",
    1338,
    706,
  ),
  selected: image(
    "selected-file.png",
    "Import Contacts dialog showing the selected spreadsheet before upload.",
    1338,
    492,
  ),
  review: image(
    "review-contacts.png",
    "Editable review table showing two parsed contacts and an Import 2 Contacts action.",
    2048,
    722,
  ),
  errors: image(
    "validation-errors.png",
    "Review table with a 15-alert summary and duplicate-nickname errors beside affected fields.",
    2042,
    1190,
  ),
  success: image(
    "import-success.png",
    "Import-complete dialog listing two saved contacts and confirming that both were added.",
    2040,
    1008,
  ),
  videoPoster: image(
    "context-poster.jpg",
    "Frame of the Quill & Pigeon contact import workflow at spreadsheet selection.",
    1600,
    1000,
  ),
} as const;

const contextVideo: VideoMedia = {
  kind: "video",
  src: "/media/projects/quill-and-pigeon/context-import.mp4",
  title: "Quill & Pigeon contact import demonstration, from file selection to saved contacts",
  poster: media.videoPoster,
};

export const quillAndPigeonProject = {
  id: "quill-and-pigeon",
  slug: "quill-and-pigeon",
  title: "Quill & Pigeon",
  order: 6,
  year: 2025,
  category: "Web product",
  role: ["Design + Development Intern"],
  featured: true,
  enabled: true,
  contentStatus: "draft",
  placeholderFields: [],
  homepageImage: {
    kind: "image",
    src: "/images/projects/quill-and-pigeon/monolith-screen.jpg",
    alt: "Quill & Pigeon recipient setup: spreadsheet import, Google or Facebook import, and manual entry.",
    width: 640,
    height: 922,
  },
  caseStudyUrl: "/work/quill-and-pigeon",
  visualEmphasis: "standard",
  scenePlacement: "near",
  accentBehavior: "project",
  shortDescription:
    "A bulk contact import for a recipient and reminder product, with editable review, field-level validation, and clear confirmation.",
  accentColor: "#a8c947",
  seo: {
    title: "Quill & Pigeon bulk contact import",
    description:
      "A design engineering case study about Quill & Pigeon's spreadsheet-based contact import, review, validation, and completion flow.",
  },
  caseStudy: {
    info: {
      timeline: "January-August 2025",
      company: "Quill & Pigeon",
      responsibilities: [
        "Product design",
        "Frontend development",
        "Interaction design",
        "Import UX",
        "Validation states",
      ],
      platform: "Web",
      projectType: "Bulk contact import",
      externalUrl: "https://quillandpigeon.com/",
      externalLabel: "Visit site",
    },
    stages: [
      {
        id: "context",
        label: "Context",
        stories: [
          {
            id: "bulk-import",
            eyebrow: "Context",
            title: "Bulk recipient setup, without repeated entry.",
            description:
              "Quill & Pigeon helps people manage recipients and important dates. I designed and built a bulk import path that takes spreadsheet data through upload, review, correction, and confirmation.",
            supportingPoints: [
              "CSV and XLSX file selection",
              "Editable review before saving",
              "Specific feedback and a clear result",
            ],
            visual: {
              type: "video",
              media: contextVideo,
              fit: "contain",
              playback: "silent-loop",
            },
          },
        ],
      },
      {
        id: "problem",
        label: "Problem",
        stories: [
          {
            id: "recipient-setup",
            eyebrow: "Problem",
            title: "One-at-a-time entry did not suit larger lists.",
            description:
              "The recipient setup screen offered direct entry for an individual person. Bringing in an existing list called for a spreadsheet path, but users still needed to understand exactly what the file would add.",
            caption:
              "The recipient setup screen places spreadsheet import beside individual entry.",
            visual: { type: "image", media: media.recipients, fit: "contain", zoomable: true },
          },
        ],
      },
      {
        id: "workflow",
        label: "Workflow",
        stories: [
          {
            id: "review-before-import",
            eyebrow: "Workflow",
            title: "Review became the checkpoint before saving.",
            description:
              "A spreadsheet can parse successfully and still contain information that needs attention. Parsed rows become editable fields, so people can inspect and correct them inside the product before they commit the import.",
            decision: "Separate file upload from the action that saves contacts.",
            visual: { type: "image", media: media.review, fit: "contain", zoomable: true },
          },
        ],
      },
      {
        id: "validation",
        label: "Validation",
        stories: [
          {
            id: "clean-review",
            eyebrow: "Validation",
            title: "Make clean data easy to inspect.",
            description:
              "Names, addresses, and dates appear as editable rows. The user can check parsed values before importing them rather than trusting a file-upload success message alone.",
            visual: { type: "image", media: media.review, fit: "contain", zoomable: true },
            durationSeconds: 8,
          },
          {
            id: "inline-errors",
            eyebrow: "Validation",
            title: "Show the scale, then point to each field.",
            description:
              "The summary reports 15 alerts, while inline Duplicate labels identify affected nickname fields. The rest of the table stays visible so corrections retain their context.",
            visual: { type: "image", media: media.errors, fit: "contain", zoomable: true },
            durationSeconds: 10,
          },
        ],
      },
      {
        id: "import-states",
        label: "Import states",
        stories: [
          {
            id: "select",
            eyebrow: "Import states",
            title: "Select a spreadsheet.",
            description:
              "The entry state accepts CSV or XLSX files and offers a downloadable template for the expected structure.",
            visual: { type: "image", media: media.select, fit: "contain", zoomable: true },
            durationSeconds: 8,
          },
          {
            id: "ready",
            eyebrow: "Import states",
            title: "Confirm the file before upload.",
            description:
              "The selected file stays visible and removable, giving users a chance to catch a wrong choice before parsing begins.",
            visual: { type: "image", media: media.selected, fit: "contain", zoomable: true },
            durationSeconds: 8,
          },
          {
            id: "review",
            eyebrow: "Import states",
            title: "Review parsed contacts.",
            description:
              "Spreadsheet values become editable product data before any contacts are saved.",
            visual: { type: "image", media: media.review, fit: "contain", zoomable: true },
            durationSeconds: 8,
          },
          {
            id: "resolve",
            eyebrow: "Import states",
            title: "Resolve what needs attention.",
            description:
              "A page-level count and field-level labels make duplicate information visible without discarding other parsed rows.",
            visual: { type: "image", media: media.errors, fit: "contain", zoomable: true },
            durationSeconds: 10,
          },
          {
            id: "complete",
            eyebrow: "Import states",
            title: "Confirm what was saved.",
            description:
              "The completion state reports the result per contact and confirms the total added.",
            visual: { type: "image", media: media.success, fit: "contain", zoomable: true },
            durationSeconds: 8,
          },
        ],
      },
      {
        id: "outcome",
        label: "Outcome",
        stories: [
          {
            id: "controlled-import",
            eyebrow: "Outcome",
            title: "One controlled path for larger contact lists.",
            description:
              "The finished workflow combines file selection, editable review, validation, correction, import, and confirmation. It reduces repeated setup while keeping users in control of what is saved.",
            supportingPoints: [
              "Built for a product serving more than 100 users",
              "Imported data can be corrected before it is saved",
            ],
            visual: { type: "image", media: media.success, fit: "contain", zoomable: true },
          },
        ],
      },
    ],
  },
  nextProjectSlug: "wildwood",
} satisfies Project;
