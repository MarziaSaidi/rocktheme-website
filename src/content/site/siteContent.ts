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
    /** Three connected thoughts; line breaks belong to the editorial composition. */
    passages: [
      {
        moment: "thought",
        title: "I have a habit of\nturning questions\ninto things.",
        body: "",
        aside: "",
      },
      {
        moment: "possibilities",
        title:
          "Sometimes it's a prototype.\nSometimes it's a product.\nSometimes it's an entire world you can explore.",
        body: "",
        aside: "",
      },
      {
        moment: "person",
        title:
          "I'm Marzia,\na design engineer who loves figuring out how things should feel, how they should work, and how to bring them to life.",
        body: "I studied computer science, but I've always been drawn to the space where design meets engineering.",
        aside:
          "I like getting my hands into the details, from the first rough idea to the moment something actually works.",
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
