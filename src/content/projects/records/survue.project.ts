import type { ImageMedia, Project, VideoMedia } from "../project.types";

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
    "Reconstructed low-fidelity Ready screen based on the final screen; not an original design artifact.",
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
    "Reconstructed low-fidelity Gallery screen based on the final Gallery; not an original design artifact.",
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

const foundationAsset = (name: string, alt: string, width: number, height: number): ImageMedia => ({
  kind: "image",
  src: `/images/projects/survue/foundations/${name}.png`,
  alt,
  width,
  height,
});

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
  placeholderFields: ["unprovidedProductStates"],
  homepageImage: {
    kind: "image",
    src: "/images/projects/survue/monolith-screen.jpg",
    alt: "Survue welcome screen beside a live detection state warning of a vehicle at risk level 1.",
    width: 640,
    height: 922,
  },
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
    storyPlayback: "manual",
    info: {
      timeline: "September-December 2024",
      responsibilities: [
        "Product design",
        "Interaction design",
        "App structure and user flows",
        "Prototyping",
        "Visual foundations and components",
        "C# implementation",
      ],
      tools: ["Figma", "C#", ".NET"],
      platform: "Mobile · iOS",
      projectType: "Cycling safety app",
    },
    stages: [
      {
        id: "context",
        label: "Overview",
        stories: [
          {
            id: "second-pair-of-eyes",
            eyebrow: "Founding product designer",
            title: "Make approaching traffic easier to interpret.",
            description:
              "Survue connects a rear-facing device with a cycling app for vehicle awareness and recordings. As founding product designer, I shaped the app structure, interaction flows, components, and prototype using the founder's palette and Helvetica Neue typography. The central design question was how to communicate changing traffic conditions without making the rider decode a new interface each time.",
            decision: "Keep the road view familiar while the warning state changes.",
            supportingPoints: [
              "Device discovery and pairing",
              "Vehicle position and warning states",
              "Recordings reviewed separately from the ride",
            ],
            visual: { type: "video", media: prototype, fit: "contain", playback: "controls" },
          },
        ],
      },
      {
        id: "structure",
        label: "Structure",
        stories: [
          {
            id: "complete-flow",
            eyebrow: "Decision / separate setup, ride, and review",
            title: "Give each part of the ride its own place.",
            description:
              "I mapped the experience from device setup through live detection to recordings. Pairing belongs before the ride; vehicle awareness is the main riding view; Gallery is a separate destination for reviewing captures. This structure keeps setup and review tasks out of the main detection screen.",
            decision:
              "Organize around the rider's task rather than putting every device capability on one screen.",
            constraint:
              "A visible connection state and a warning display serve different purposes. The interface needs to distinguish device readiness from traffic conditions.",
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
            eyebrow: "Original wireframes",
            title: "Establish the destinations before the visual system.",
            description:
              "The original wireframes cover Welcome, Pair, Home, Detection, and Settings. They show the app's entry points and task structure before the final visual treatment. Detection and Gallery are separate destinations in the Home navigation.",
            visual: {
              type: "sequence",
              heading: "Original design artifacts",
              layout: "board",
              items: [
                item("Welcome", media.wireWelcome),
                item("Pair", media.wirePair),
                item("Home", media.wireHome),
                item("Detection", media.wireDetection),
                item("Settings", media.wireSettings),
              ],
            },
          },
          {
            id: "setup-detail",
            eyebrow: "Decision / explicit device setup",
            title: "Separate discovery from the choice to connect.",
            description:
              "Welcome introduces device discovery. The Pair screen then offers Connect and Not My Device actions. Separating those steps makes the device choice explicit instead of treating discovery as confirmation.",
            decision: "Give the rider a way to reject the discovered device before connecting.",
            visual: {
              type: "sequence",
              heading: "Welcome → Pair",
              items: [item("Welcome", media.wireWelcome), item("Pair", media.wirePair)],
            },
          },
          {
            id: "retrospective-reference",
            eyebrow: "Retrospective reference",
            title: "Two explanatory reconstructions, shown separately.",
            description:
              "These Ready and Gallery wireframes were reconstructed from final screens to explain the flow. They are retrospective illustrations, not evidence of the original design process. The original wireframes appear separately in this section.",
            caption: "Retrospective reconstructions of Ready and Gallery from final screens.",
            visual: {
              type: "sequence",
              heading: "Retrospective illustrations",
              items: [
                item("Ready / reconstructed", media.wireReady),
                item("Gallery / reconstructed", media.wireGallery),
              ],
            },
          },
        ],
      },
      {
        id: "detection",
        label: "Detection",
        stories: [
          {
            id: "distance-and-risk",
            eyebrow: "Exploration / information versus interpretation",
            title: "Distance and risk each left a question unanswered.",
            description:
              "I explored distance behind the cyclist and a large numeric risk level. Distance shows proximity but leaves the rider to interpret urgency. A risk number emphasizes urgency but loses vehicle location. These were design tradeoffs, not conclusions from a measured riding test.",
            decision:
              "Combine a spatial reference with warning state instead of asking one number to explain both.",
            visual: {
              type: "comparison",
              before: media.distance,
              after: media.risk,
              beforeLabel: "Distance concept",
              afterLabel: "Numeric risk concept",
            },
          },
          {
            id: "position-warning",
            eyebrow: "Decision / a stable spatial reference",
            title: "Bring the vehicle back into the road view.",
            description:
              "The next concept places the vehicle in a simplified road behind the cyclist. That gives the warning a spatial reference instead of presenting an isolated value. It became the basis for the final detection direction.",
            decision: "Use the same road model across warning states.",
            visual: { type: "image", media: media.position, fit: "contain", zoomable: true },
          },
          {
            id: "final-direction",
            eyebrow: "Final direction / changing urgency",
            title: "Change the warning. Keep the structure.",
            description:
              "The final screens retain the road model across green, yellow, and red states. Vehicle position and warning color change within that familiar structure. This is the interface direction; it does not establish detection accuracy or how reliably cyclists understand it while riding.",
            decision:
              "Preserve the spatial layout as urgency changes, rather than replacing the riding view with a different warning screen.",
            caption:
              "The red screen still reads Level Risk 1. Severity naming needs to be made consistent before release.",
            visual: {
              type: "sequence",
              heading: "Same road view · Changing warning state",
              items: [
                item("Green state", media.clear),
                item("Yellow state", media.yellow),
                item("Red state", media.red),
              ],
            },
          },
        ],
      },
      {
        id: "foundations",
        label: "Foundations",
        stories: [
          {
            id: "color",
            eyebrow: "Visual foundations / founder-defined palette",
            title: "Apply the brand palette to interface roles.",
            description:
              "The founder defined the colors and typography. I applied those foundations to the app's surfaces, controls, and vehicle-awareness states. Black and off-white anchor the themes; green represents safe passage, mustard yellow marks level-one risk, and red marks the red warning state.",
            decision:
              "Use the founder-directed red for onboarding actions while keeping its warning meaning explicit in the road view.",
            visual: {
              type: "palette",
              colors: [
                { label: "Dark background", value: "#000000" },
                { label: "Dark options card", value: "#212020" },
                { label: "Light background", value: "#F2F2F2" },
                { label: "Light options card", value: "#FFFFFF" },
                { label: "Safe passage", value: "#0FA958" },
                { label: "Level-one risk", value: "#EAC234" },
                { label: "Red warning", value: "#E4002B" },
                { label: "Onboarding action", value: "#E4002B" },
              ],
            },
          },
          {
            id: "typography",
            eyebrow: "Typography / founder-defined family",
            title: "Build hierarchy within Helvetica Neue.",
            description:
              "Helvetica Neue was the founder's chosen typeface. I used it across navigation, controls, and status messaging. The examples show how the same family supports a screen title, an action, and a warning without introducing another typeface.",
            caption:
              "Typeset examples of the confirmed font family; not original size or weight specifications.",
            visual: {
              type: "typography",
              family: "Helvetica Neue",
              examples: [
                { label: "Screen title", text: "Automatic Recordings" },
                { label: "Primary action", text: "Discover Survue" },
                { label: "Status message", text: "A vehicle is approaching from behind" },
              ],
            },
          },
          {
            id: "components",
            eyebrow: "Components / original Figma exports",
            title: "Give actions and preferences distinct forms.",
            description:
              "The filled red onboarding button and outlined Not My Device action establish primary and secondary choices. Settings rows use the same rounded surface in collapsed and expanded states. The expanded Theme row reveals its control while retaining the parent label.",
            decision:
              "Keep the settings row recognizable when it expands, and distinguish the main onboarding action from its alternative.",
            visual: {
              type: "assets",
              layout: "components",
              items: [
                item(
                  "Primary onboarding action",
                  foundationAsset(
                    "primary-button",
                    "Red Discover Survue button with forward arrow.",
                    370,
                    50,
                  ),
                ),
                item(
                  "Secondary device action",
                  foundationAsset("ghost-button", "Outlined Not My Device button.", 370, 50),
                ),
                item(
                  "Theme / collapsed",
                  foundationAsset("theme-collapsed", "Collapsed Theme settings row.", 400, 80),
                ),
                item(
                  "Theme / expanded",
                  foundationAsset(
                    "theme-expanded",
                    "Expanded Theme row revealing Dark Mode and its toggle.",
                    400,
                    160,
                  ),
                ),
                item(
                  "Toggle / exported state",
                  foundationAsset(
                    "toggle",
                    "Red toggle switch with white thumb on the right.",
                    64,
                    32,
                  ),
                ),
              ],
            },
          },
          {
            id: "icons",
            eyebrow: "Iconography / original exports",
            title: "Pair recognizable symbols with clear labels.",
            description:
              "I selected icons through the Iconify Figma plugin for navigation and common actions. This board brings those exports together with the ride and device-status symbols. The app pairs icons with labels in navigation and settings so their meaning does not depend on the symbol alone.",
            caption:
              "Original exported assets. Icons span multiple collections; a single custom icon family is not claimed.",
            visual: {
              type: "assets",
              layout: "icons",
              items: [
                item("Detection", foundationAsset("road", "Road navigation icon.", 36, 36)),
                item("Settings", foundationAsset("settings", "Settings gear icon.", 36, 36)),
                item("Gallery", foundationAsset("gallery", "Gallery icon.", 36, 36)),
                item("Record", foundationAsset("record", "Record camera icon.", 36, 36)),
                item("Play", foundationAsset("play", "Circular play icon.", 32, 32)),
                item("Download", foundationAsset("download", "Download arrow icon.", 20, 20)),
                item("Delete", foundationAsset("delete", "Delete bin icon.", 20, 20)),
                item("Theme", foundationAsset("theme-icon", "Blue theme icon.", 24, 24)),
                item("Sound", foundationAsset("sound", "Red sound icon.", 24, 24)),
                item("Help", foundationAsset("help", "Green help icon.", 24, 24)),
                item("Warning", foundationAsset("warning", "Yellow warning triangle.", 24, 24)),
                item(
                  "Warning outline",
                  foundationAsset("warning-outline", "Small yellow warning triangle.", 21, 19),
                ),
                item("Battery", foundationAsset("battery", "Green battery status symbol.", 32, 29)),
                item("Cyclist", foundationAsset("cyclist", "White cyclist symbol.", 38, 44)),
                item("Vehicle", foundationAsset("vehicle", "Red overhead vehicle symbol.", 58, 95)),
              ],
            },
          },
          {
            id: "spacing",
            eyebrow: "Spacing / mobile guideline",
            title: "Use a small scale to separate related tasks.",
            description:
              "For documenting the mobile interface, I use a 4-point spacing scale. Smaller steps keep labels and controls related; larger steps separate groups and screen sections. This is a guideline added for the case study, not a claim about measurements in the original Figma file.",
            caption:
              "Proposed mobile spacing hierarchy. Original component exports remain unchanged.",
            visual: {
              type: "spacing",
              steps: [
                { value: 4, label: "Tightly related text" },
                { value: 8, label: "Icon and label" },
                { value: 12, label: "Related controls" },
                { value: 16, label: "Screen gutter and component padding" },
                { value: 24, label: "Between groups" },
                { value: 32, label: "Between sections" },
              ],
            },
          },
        ],
      },
      {
        id: "final",
        label: "Experience",
        stories: [
          {
            id: "pairing",
            eyebrow: "Device setup / final interface",
            title: "Make device readiness an explicit state.",
            description:
              "The final setup screens distinguish discovery, device found, and ready. Each screen represents a different point in the connection flow, rather than asking the rider to infer readiness from a single confirmation message.",
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
            id: "gallery",
            eyebrow: "Decision / review after the ride",
            title: "Keep saved recordings separate from live awareness.",
            description:
              "Gallery separates automatic captures from personal recordings. The automatic-recordings view provides a list of saved clips for later review. Keeping these tasks in Gallery preserves Detection as the destination for vehicle awareness.",
            decision: "Separate reviewing a recording from monitoring the road view.",
            visual: {
              type: "sequence",
              heading: "Gallery → Automatic recordings",
              items: [item("Gallery", media.gallery), item("Automatic clips", media.automatic)],
            },
          },
          {
            id: "settings",
            eyebrow: "Preferences / final interface",
            title: "Keep preferences outside the detection view.",
            description:
              "Settings groups Theme, Sound, User Warnings, and Help. The expanded Theme screen shows how preferences are organized without adding those controls to the live road display.",
            visual: { type: "image", media: media.settings, fit: "contain", zoomable: true },
          },
        ],
      },
      {
        id: "delivery",
        label: "Delivery",
        stories: [
          {
            id: "whole-product",
            eyebrow: "Delivery / evidence and next steps",
            title: "A connected interface, with validation still to establish.",
            description:
              "The final screen set and interaction prototype connect setup, detection, recordings, and settings. My contribution spans product design, prototyping, and C# implementation. This case study documents the interface work; it does not establish a production release, hardware detection performance, or a measured safety outcome.",
            outcome:
              "An app structure, original wireframes, detection explorations, final UI, and an interaction prototype.",
            constraint:
              "The next validation priorities are warning comprehension while riding, non-color cues, and connection-loss behavior. The C# implementation scope is not detailed in this case study.",
            supportingVideo: { media: prototype, label: "Watch the interaction prototype" },
            visual: {
              type: "sequence",
              heading: "The Survue interface",
              layout: "mosaic",
              items: [
                item("Home", media.home),
                item("Device found", media.found),
                item("Ready", media.ready),
                item("Green", media.clear),
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
