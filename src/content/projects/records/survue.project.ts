import type { ImageMedia, Project, VideoMedia } from "../project.types";
import { createPlaceholderImage } from "./placeholder";

const image = (file: string, alt: string, width = 430, height = 932): ImageMedia => ({
  kind: "image",
  src: `/images/projects/survue/story/${file}`,
  alt,
  width,
  height,
});

const media = {
  flow: image(
    "user-flow.png",
    "Full Survue user flow through pairing, recording, detection, gallery, settings, and exit.",
    1536,
    1024,
  ),
  wireWelcome: image(
    "wireframe-welcome.png",
    "Early Welcome wireframe with device discovery action.",
  ),
  wirePair: image(
    "wireframe-pair.png",
    "Early Pair wireframe with Connect and Not My Device actions.",
  ),
  wireReady: image(
    "wireframe-ready.svg",
    "Reconstructed low-fidelity Ready screen based on the supplied finished screen.",
  ),
  wireHome: image(
    "wireframe-home.png",
    "Early Home wireframe with Gallery, Detection, and Settings destinations.",
  ),
  wireDetection: image(
    "wireframe-detection.png",
    "Early Detection wireframe with road view and ride controls.",
  ),
  wireGallery: image(
    "wireframe-gallery.svg",
    "Reconstructed low-fidelity Gallery screen based on the supplied finished Gallery.",
  ),
  wireSettings: image(
    "wireframe-settings.png",
    "Early Settings wireframe with theme, sound, warnings, and help.",
  ),
  distance: image(
    "idea-distance.png",
    "First detection concept showing distance behind the cyclist.",
  ),
  risk: image(
    "idea-risk-level.png",
    "Second detection concept showing a large numeric risk level.",
  ),
  position: image(
    "idea-position-warning.png",
    "Third detection concept showing vehicle position in a simplified road.",
  ),
  welcome: image(
    "connection-page.png",
    "Finished device welcome screen inviting the rider to discover Survue.",
  ),
  found: image(
    "pairing-found.png",
    "Finished pairing screen confirming that the Survue device was found.",
  ),
  ready: image("pairing-ready.png", "Finished pairing screen confirming that Survue is ready."),
  clear: image("detection-clear.png", "Finished clear detection state with green road guides."),
  yellow: image(
    "detection-level-one.png",
    "Finished yellow detection state with a vehicle in the road view.",
  ),
  red: image(
    "detection-level-two.png",
    "Finished red detection state with a vehicle in the road view.",
  ),
  gallery: image("gallery.png", "Finished Gallery separating automatic and personal recordings."),
  automatic: image(
    "automatic-recordings.png",
    "Finished Automatic Recordings list of saved clips.",
    430,
    1097,
  ),
  settings: image(
    "settings-theme.png",
    "Finished Settings with Theme expanded and Sound and User Warnings visible.",
  ),
  home: image(
    "welcome-dark.png",
    "Finished Survue home with cycling imagery and Gallery, Detection, and Settings navigation.",
  ),
  contextPoster: image(
    "context-video-poster.jpg",
    "Still from the Survue interaction prototype showing the app in use.",
    720,
    1456,
  ),
} as const;

const prototype: VideoMedia = {
  kind: "video",
  src: "/media/projects/survue/interaction-prototype.mp4",
  title: "Survue interaction prototype showing the ride and changing detection states",
  poster: media.contextPoster,
};

const item = (label: string, screen: ImageMedia) => ({ label, media: screen });

export const survueProject = {
  id: "survue",
  slug: "survue",
  title: "Survue",
  order: 8,
  year: 2024,
  category: "Cycling safety app",
  role: ["Founding Product Designer"],
  featured: true,
  enabled: true,
  contentStatus: "draft",
  placeholderFields: ["homepageImage", "unprovidedProductStates"],
  homepageImage: createPlaceholderImage("survue", "Survue"),
  caseStudyUrl: "/work/survue",
  visualEmphasis: "standard",
  scenePlacement: "mid",
  accentBehavior: "project",
  shortDescription:
    "A cycling safety app that pairs with a rear-facing smart device to help riders understand approaching traffic and capture what happens behind them.",
  accentColor: "#F50B46",
  seo: {
    title: "Survue cycling safety app",
    description:
      "A product story covering Survue's user flow, early wireframes, detection iterations, and finished mobile experience.",
  },
  caseStudy: {
    info: {
      timeline: "September–December 2024",
      responsibilities: [
        "Product design",
        "UX/UI",
        "Interaction design",
        "User flows",
        "Prototyping",
        "Design system",
        "C# implementation",
      ],
      tools: ["Figma", "C#", ".NET"],
      platform: "Mobile · iOS",
      projectType: "Cycling safety app",
    },
    stages: [
      {
        id: "context",
        label: "Context",
        stories: [
          {
            id: "second-pair-of-eyes",
            eyebrow: "01 · Context",
            title: "Designing a second pair of eyes for cyclists.",
            description:
              "Survue pairs a rear-facing device with a mobile app to show approaching vehicles and capture recordings during a ride. The design challenge was making that information quick to understand while riders stay focused on the road.",
            supportingPoints: [
              "Glanceable information for the ride",
              "Clear device and pairing feedback",
              "Warnings with distinct levels of urgency",
            ],
            visual: { type: "video", media: prototype, fit: "contain", playback: "silent-loop" },
          },
        ],
      },
      {
        id: "structure",
        label: "Structure",
        stories: [
          {
            id: "complete-flow",
            eyebrow: "02 · Structure",
            title: "Mapping the experience around the ride.",
            description:
              "The flow connects first-time device setup, recording choice, live detection, and review. It gave each important system state a clear place in the app.",
            supportingPoints: [
              "Setup: discover, connect, and confirm the device",
              "Ride: keep detection visible",
              "Review: distinguish automatic and personal recordings",
            ],
            visual: { type: "image", media: media.flow, fit: "contain", zoomable: true },
          },
        ],
      },
      {
        id: "wireframes",
        label: "Wireframes",
        stories: [
          {
            id: "whole-system",
            eyebrow: "03 · Wireframes",
            title: "The whole app, before visual polish.",
            description:
              "The first board puts setup, the ride, and review in one view. The missing low-fidelity Gallery state is reconstructed from the supplied finished screen so the flow can be read as a whole.",
            visual: {
              type: "sequence",
              heading: "Setup → Ride → Review",
              tone: "paper",
              layout: "board",
              items: [
                item("Welcome", media.wireWelcome),
                item("Pair", media.wirePair),
                item("Home", media.wireHome),
                item("Gallery*", media.wireGallery),
                item("Detection", media.wireDetection),
                item("Settings", media.wireSettings),
              ],
            },
            caption:
              "* Gallery is a low-fidelity reconstruction based on the supplied finished screen.",
          },
          {
            id: "setup-detail",
            eyebrow: "03 · Wireframes",
            title: "Making setup feel predictable.",
            description:
              "The early setup screens separate the invitation to pair from device confirmation. The Ready wireframe is reconstructed from the supplied finished state.",
            visual: {
              type: "sequence",
              heading: "Welcome → Pair → Ready",
              tone: "paper",
              items: [
                item("Welcome", media.wireWelcome),
                item("Pair", media.wirePair),
                item("Ready*", media.wireReady),
              ],
            },
            caption:
              "* Ready is a low-fidelity reconstruction based on the supplied finished screen.",
          },
          {
            id: "ride-detail",
            eyebrow: "03 · Wireframes",
            title: "Separating riding from reviewing.",
            description:
              "The home screen gives the ride a clear entry point. Detection and recordings remain separate destinations so review does not compete with live awareness.",
            visual: {
              type: "sequence",
              heading: "Home → Detection → Gallery",
              tone: "paper",
              items: [
                item("Home", media.wireHome),
                item("Detection", media.wireDetection),
                item("Gallery*", media.wireGallery),
              ],
            },
            caption:
              "* Gallery is a low-fidelity reconstruction based on the supplied finished screen.",
          },
        ],
      },
      {
        id: "detection",
        label: "Detection",
        stories: [
          {
            id: "distance",
            eyebrow: "04 · Detection",
            title: "First, I tried showing distance.",
            description:
              "The first concept located an approaching vehicle relative to the cyclist. Distance was precise, but it still asked the rider to interpret what the number meant.",
            decision: "Keep spatial awareness while reducing interpretation.",
            visual: { type: "image", media: media.distance },
          },
          {
            id: "risk-level",
            eyebrow: "04 · Detection",
            title: "Then I reduced it to risk.",
            description:
              "A simple risk level made urgency easier to scan. Without the road context, it was harder to see where the vehicle was.",
            decision: "Risk should complement position, not replace it.",
            visual: { type: "image", media: media.risk },
          },
          {
            id: "position-warning",
            eyebrow: "04 · Detection",
            title: "Position brought the context back.",
            description:
              "The vehicle returned to a simplified road view. This kept the warning connected to the space behind the cyclist.",
            decision: "Keep one spatial model throughout the ride.",
            visual: { type: "image", media: media.position },
          },
          {
            id: "final-direction",
            eyebrow: "04 · Detection",
            title: "One interface. Increasing urgency.",
            description:
              "The finished direction keeps the same road model across clear, yellow, and red states. Position and color communicate the change together.",
            supportingPoints: [
              "Position shows where a vehicle appears",
              "Color differentiates warning states",
              "The structure stays familiar as urgency changes",
            ],
            visual: {
              type: "sequence",
              heading: "One spatial model · Progressive warning",
              items: [
                item("Clear", media.clear),
                item("Level 1", media.yellow),
                item("High risk", media.red),
              ],
            },
          },
        ],
      },
      {
        id: "final",
        label: "Final",
        stories: [
          {
            id: "pairing",
            eyebrow: "05 · Final experience",
            title: "From device to ride without uncertainty.",
            description:
              "The supplied finished screens show welcome, device-found, and ready states. Searching and connecting screens were not included in this asset set.",
            visual: {
              type: "sequence",
              heading: "Discover → Found → Ready",
              items: [
                item("Discover", media.welcome),
                item("Device found", media.found),
                item("Ready", media.ready),
              ],
            },
          },
          {
            id: "ride-states",
            eyebrow: "05 · Final experience",
            title: "Awareness changes with the situation.",
            description:
              "The road view holds its structure while green, yellow, and red make changing detection states visible.",
            visual: {
              type: "sequence",
              heading: "Clear → Yellow → Red",
              items: [
                item("Clear", media.clear),
                item("Level 1", media.yellow),
                item("High risk", media.red),
              ],
            },
            supportingVideo: { media: prototype, label: "Watch the 27-second prototype" },
          },
          {
            id: "recording",
            eyebrow: "05 · Final experience",
            title: "Record during the ride. Review afterward.",
            description:
              "The ride screen keeps Record within reach. Automatic clips then appear in their own review list.",
            visual: {
              type: "sequence",
              heading: "Ride controls → Saved captures",
              items: [item("Ride controls", media.clear), item("Automatic clips", media.automatic)],
            },
          },
          {
            id: "gallery",
            eyebrow: "05 · Final experience",
            title: "A clear record of what happened.",
            description:
              "Gallery distinguishes automatic captures from personal recordings. The supplied detail screen shows the automatic list; a separate personal-recordings detail was not provided.",
            visual: {
              type: "sequence",
              heading: "Gallery → Automatic recordings",
              items: [item("Gallery", media.gallery), item("Automatic clips", media.automatic)],
            },
          },
          {
            id: "settings",
            eyebrow: "05 · Final experience",
            title: "Controls stay out of the way until needed.",
            description:
              "The finished Theme screen also shows Sound and User Warnings. Expanded Sound and warning views were not included in the supplied assets.",
            visual: {
              type: "sequence",
              heading: "Theme · Sound · User Warnings",
              items: [item("Settings", media.settings)],
            },
          },
          {
            id: "whole-product",
            eyebrow: "05 · Final experience",
            title: "One connected experience, from setup to review.",
            description:
              "These finished screens bring the main experience together: entry, pairing, the changing road view, recordings, and settings.",
            visual: {
              type: "sequence",
              heading: "The Survue product system",
              layout: "mosaic",
              items: [
                item("Home", media.home),
                item("Device found", media.found),
                item("Ready", media.ready),
                item("Clear", media.clear),
                item("Yellow", media.yellow),
                item("Red", media.red),
                item("Gallery", media.gallery),
                item("Settings", media.settings),
              ],
            },
          },
        ],
      },
    ],
  },
  nextProjectSlug: "qalin",
} satisfies Project;
