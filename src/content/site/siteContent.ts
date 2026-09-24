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
  introduction: "I move between design, code, and AI to explore, prototype, and ship.",
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
    displayLines: ["Craft, taste", "& code."],
    accessibleHeading: "Craft, taste and code.",
    lead: "I design interfaces and ship the production code behind them.",
    scrollLabel: "Scroll to enter",
    planeGroupLabel: "Featured project previews",
  },
  work: {
    displayHeading: "Selected work",
    lead: "Products, systems and experiments — designed and built end to end.",
    corridorLabel: "Selected work corridor",
    corridorHint: "Scroll sideways to explore",
    viewLabel: "View case study",
  },
  statement: {
    heading: "How I work",
    paragraphs: [
      "I like figuring out how things work, then finding ways to make them better.",
      "I move between design, code, and AI to explore, prototype, and ship.",
    ],
    /** Stage 4 attaches per-word reveals to these terms. */
    emphasis: ["design", "code", "AI", "ship"],
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
