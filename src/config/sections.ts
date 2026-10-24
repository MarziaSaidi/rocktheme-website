/**
 * Stable homepage chapter identities.
 *
 * The identity is semantic and independent from the public anchor. Navigation,
 * document sections, scroll orchestration, and WebGL all consume this registry
 * so there is no second list of chapter names to keep in sync.
 */
export const SECTION_IDS = ["hero", "selected-work", "about", "footer"] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export const sectionAnchors = {
  hero: "index",
  "selected-work": "selected-work",
  about: "about",
  footer: "contact",
} as const satisfies Readonly<Record<SectionId, string>>;

export const pageLandmarkIds = {
  top: "top",
  main: "main",
} as const;

/**
 * A link to a section. The Work index is the home page; the bio and the
 * contact are on the About page, and a link to them lands on them there.
 */
export function sectionHref(sectionId: SectionId): string {
  if (sectionId === "hero" || sectionId === "selected-work") return "/";
  return `/about#${sectionAnchors[sectionId]}`;
}

export function isSectionId(value: string | undefined): value is SectionId {
  return SECTION_IDS.includes(value as SectionId);
}
