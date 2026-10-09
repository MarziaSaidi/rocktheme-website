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
    "Designing and building a spreadsheet import that lets people review and correct contact data before saving it.",
  accentColor: "#a8c947",
  seo: {
    title: "Quill & Pigeon bulk contact import",
    description:
      "A design engineering case study about Quill & Pigeon's spreadsheet-based contact import, review, validation, and completion flow.",
  },
  caseStudy: {
    storyPlayback: "manual",
    titleSignature: "ink",
    info: {
      timeline: "January-August 2025",
      timelineLabel: "Internship",
      company: "Quill & Pigeon",
      responsibilities: [
        "Product design",
        "Frontend development",
        "Spreadsheet import workflow",
        "Editable review and validation UI",
      ],
      platform: "Web",
      projectType: "Bulk contact import",
      externalUrl: "https://quillandpigeon.com/",
      externalLabel: "Visit site",
    },
    stages: [
      {
        id: "context",
        label: "Overview",
        stories: [
          {
            id: "bulk-import",
            eyebrow: "Design + development",
            title: "Import a list. Keep control of every contact.",
            description:
              "Quill & Pigeon helps people manage recipients and important dates. During my design and development internship, I designed and built the bulk contact import interface: file selection, editable review, validation feedback, and confirmation.",
            supportingPoints: [
              "CSV and XLSX spreadsheet input",
              "Review and correction before saving",
              "Confirmation for each imported contact",
            ],
            decision: "Make uploading a spreadsheet and saving its contacts two separate actions.",
            visual: {
              type: "video",
              media: contextVideo,
              fit: "contain",
              playback: "controls",
            },
          },
        ],
      },
      {
        id: "problem",
        label: "Challenge",
        stories: [
          {
            id: "recipient-setup",
            eyebrow: "The starting point",
            title: "A contact list needs more than an upload button.",
            description:
              "Entering contacts individually repeats work when a recipient list already exists in a spreadsheet. Bulk import avoids that repetition, but a readable file can still contain incorrect contact data. I designed a checkpoint where people can inspect and correct those values before saving.",
            constraint:
              "The file can contain values that need correction, even when its contents can be read.",
            decision:
              "Keep individual entry available and give spreadsheet imports their own review path.",
            visual: { type: "image", media: media.recipients, fit: "contain", zoomable: true },
          },
        ],
      },
      {
        id: "import-states",
        label: "File setup",
        stories: [
          {
            id: "select",
            eyebrow: "Decision / a clear entry point",
            title: "Make the expected file structure visible.",
            description:
              "The import dialog accepts CSV and XLSX files and offers a template download beside the file picker. The supported formats and example structure are available before the user commits to an upload.",
            decision:
              "Put file guidance at the point of selection, where it can help prevent a wrong input.",
            visual: { type: "image", media: media.select, fit: "contain", zoomable: true },
          },
          {
            id: "ready",
            eyebrow: "File setup / selected state",
            title: "Give the selected file a reversible step.",
            description:
              "The selected filename remains visible before upload, with an option to remove it. File selection does not immediately save contacts: users can check their choice, replace it, and then continue to review.",
            decision: "Keep the file choice explicit and reversible before parsing begins.",
            visual: { type: "image", media: media.selected, fit: "contain", zoomable: true },
          },
        ],
      },
      {
        id: "workflow",
        label: "Review",
        stories: [
          {
            id: "review-before-import",
            eyebrow: "Decision / review before saving",
            title: "Turn spreadsheet rows into editable contacts.",
            description:
              "I made the review table the checkpoint before import. Names, addresses, and dates appear as editable fields, with the contact count on the final action. People can inspect the parsed values and correct them in context before saving.",
            decision:
              "Allow corrections inside the product rather than requiring a new spreadsheet upload for every edit.",
            constraint:
              "Review adds a step to the happy path. That step gives people a chance to catch incorrect data before it becomes saved contacts.",
            visual: { type: "image", media: media.review, fit: "contain", zoomable: true },
          },
        ],
      },
      {
        id: "validation",
        label: "Validation",
        stories: [
          {
            id: "inline-errors",
            eyebrow: "Decision / actionable feedback",
            title: "Count the issues. Point to the correction.",
            emphasis: "the correction.",
            description:
              "I paired a page-level alert summary with feedback beside the affected fields. In this example, 15 alerts signal the scale of the review, while Duplicate labels identify the nickname fields that need attention. Other rows stay visible while the user works through the list.",
            decision:
              "Put the explanation next to the value that needs correction, rather than relying on a general upload error.",
            outcome:
              "The review preserves the surrounding contact data and shows where to focus next.",
            visual: { type: "image", media: media.errors, fit: "contain", zoomable: true },
          },
          {
            id: "frontend-boundary",
            eyebrow: "Design + development / interface responsibilities",
            title: "The review is a state, not a preview image.",
            description:
              "My frontend work connects the selected file, an editable contact table, field-level validation feedback, and a confirmation of saved contacts. The interface has to preserve the user's context across those states: uploading the file and saving the reviewed contacts are separate actions.",
            supportingPoints: [
              "Selected file → upload → editable review",
              "Review → field feedback → correction in context",
              "Final import action → saved-contact confirmation",
            ],
            decision:
              "Keep the review and correction steps inside the import workflow, before the final save.",
            visual: { type: "image", media: media.review, fit: "contain", zoomable: true },
          },
        ],
      },
      {
        id: "outcome",
        label: "Delivery",
        stories: [
          {
            id: "controlled-import",
            eyebrow: "Delivery / what the workflow demonstrates",
            title: "Close the loop with what was actually saved.",
            description:
              "The completed workflow connects file selection, review, correction, and import. The final dialog confirms each saved contact and the total added; this example shows two successful imports. My contribution combined product design and frontend development across that interface.",
            outcome:
              "A working bulk import interface with an explicit checkpoint before saving and a clear result afterward.",
            constraint:
              "Feature-level adoption and setup time are not reported here. The product served more than 100 users; that figure describes its audience, not use of this import.",
            supportingVideo: {
              media: contextVideo,
              label: "Watch the complete import workflow",
            },
            visual: { type: "image", media: media.success, fit: "contain", zoomable: true },
          },
        ],
      },
    ],
  },
  nextProjectSlug: "wildwood",
} satisfies Project;
