export type SiteLink = Readonly<{
  label: string;
  href: string;
  isPlaceholder?: boolean;
}>;

export type NavigationItem = SiteLink &
  Readonly<{
    key: SectionId;
  }>;

export const siteContent = {
  name: "Marzia Saidi",
  role: "Design engineer and product designer",
  introduction: "I design product experiences and build the interfaces behind them.",
  availability: {
    label: "Available 2026",
    isPlaceholder: true,
  },
  email: {
    label: "Email",
    href: "mailto:marzia.saidi67@gmail.com",
  },
  linkedIn: {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/marzia-saidisoftwareengineer/",
  },
  github: {
    label: "GitHub",
    href: "https://github.com/MarziaSaidi",
  },
  navigation: [
    { key: "hero", label: "Index", href: sectionHref("hero") },
    { key: "selected-work", label: "Work", href: sectionHref("selected-work") },
    { key: "about", label: "About", href: sectionHref("about") },
  ] satisfies readonly NavigationItem[],
  skipLinkLabel: "Skip to main content",
  hero: {
    displayLines: ["Craft,", "Taste &", "Code."],
    accessibleHeading: "Craft, taste and code.",
    lead: "I design interfaces and ship the production code behind them.",
    scrollLabel: "Scroll to enter",
    planeGroupLabel: "Featured project previews",
  },
  work: {
    displayHeading: "Selected work",
    galleryLabel: "Selected projects",
    viewLabel: "View case study",
  },
  statement: {
    /**
     * Three passages that take turns beside the rift. `emphasis` settles in
     * lavender as it is read. `signature` is each passage's one moment: a title
     * word that snaps together ("snap") or is printed ("print"), or a body word
     * that light passes through ("sweep").
     */
    passages: [
      {
        title: "I’m Marzia.\nI make ideas real.",
        body: "I’m a design engineer working between an idea and a real product.",
        aside: "I’m most useful when things are still a little unclear.",
        emphasis: ["design", "engineer"],
        signature: { word: "real.", motion: "snap" },
      },
      {
        title: "From the first question to the final detail.",
        body: "I figure out what a product should do, design how it should feel, and get close enough to the code to make sure the idea survives implementation.",
        aside: "I care about the small interaction details, and whether the thing actually works.",
        emphasis: ["small", "interaction", "details"],
        signature: { word: "detail.", motion: "print" },
      },
      {
        title: "Curiosity usually becomes a prototype.",
        body: "Lately, I’m exploring what changes when AI becomes part of the product itself, and how people and AI make decisions together.",
        aside: "Mostly, I like making things. If an idea stays with me, I build it.",
        emphasis: ["AI"],
        signature: { word: "AI", motion: "sweep" },
      },
    ],
  },
  contact: {
    displayLines: ["Let’s create", "the unexpected."],
    accessibleHeading: "Let’s create the unexpected.",
    lead: "Have an idea worth building? I would love to hear it.",
    primaryLabel: "Email Marzia",
    planeLabel: "Start a conversation",
  },
  footer: {
    copyright: "Marzia Saidi © 2026",
    backToTopLabel: "Back to top",
  },
} as const;
import { sectionHref, type SectionId } from "@/config/sections";
