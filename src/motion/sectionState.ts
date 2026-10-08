import { sectionAnchors } from "@/config/sections";

/**
 * Which section of the home page the visitor is in, as the camera tells it.
 *
 * Not tied to page position: the scroll belongs to the camera, so this reads
 * only what the page already publishes (docs/typography-motion-system.md, §1):
 *
 *   - Selected Work once the camera has crossed into it, the moment its
 *     chapter title rises (`--arrival` ≥ WORK_AT);
 *   - About while a bio passage is shown (`data-on`), or while the bio holds
 *     the middle of the viewport;
 *   - none at the contact, while the invitation's ripple is playing or done
 *     (it resets to pending once the heading has left the screen);
 *   - otherwise the hero.
 *
 * Without the scene (no WebGL, reduced quality fallback) there is no
 * `--arrival`, and Selected Work holds the middle of the viewport instead.
 * Nothing here reads layout: one observer watches a line across the middle of
 * the viewport, the rest are attribute reads, made when the root's attributes
 * change (the scene writes `--arrival` there each frame it moves).
 */
export type HomeSection = "hero" | "selected-work" | "about" | null;

/** The chapter title begins to rise here (MonolithGallery.module.css). */
const WORK_AT = 0.62;

const listeners = new Set<(section: HomeSection) => void>();
let current: HomeSection = "hero";
let stop: (() => void) | null = null;

function start() {
  const root = document.documentElement;
  const middle = new Map<string, boolean>();
  const ids = [
    sectionAnchors.hero,
    sectionAnchors["selected-work"],
    sectionAnchors.about,
    sectionAnchors.footer,
  ];

  const compute = (): HomeSection => {
    const ripple = document.getElementById("contact-title")?.dataset.ripple;
    if (ripple === "playing" || ripple === "done") return null;
    if (document.querySelector("[data-bio-passage][data-on]") || middle.get(sectionAnchors.about)) {
      return "about";
    }
    const journey = root.dataset.journey !== undefined;
    const arrival = parseFloat(root.style.getPropertyValue("--arrival")) || 0;
    if (journey ? arrival >= WORK_AT : middle.get(sectionAnchors["selected-work"])) {
      return "selected-work";
    }
    if (middle.get(sectionAnchors.footer)) return null;
    return "hero";
  };

  const update = () => {
    const next = compute();
    if (next === current) return;
    current = next;
    listeners.forEach((listener) => listener(current));
  };

  // A line across the middle of the viewport: tall sections (the bio is
  // several screens) are "in the middle" for as long as they cover it.
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => middle.set(entry.target.id, entry.isIntersecting));
      update();
    },
    { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
  );
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element) io.observe(element);
  });

  const rootWatch = new MutationObserver(update);
  rootWatch.observe(root, { attributes: true, attributeFilter: ["style", "data-journey"] });
  const pageWatch = new MutationObserver(update);
  const bio = document.querySelector("[data-bio-story]");
  if (bio)
    pageWatch.observe(bio, { attributes: true, subtree: true, attributeFilter: ["data-on"] });
  const contact = document.getElementById("contact-title");
  if (contact) pageWatch.observe(contact, { attributes: true, attributeFilter: ["data-ripple"] });

  update();
  return () => {
    io.disconnect();
    rootWatch.disconnect();
    pageWatch.disconnect();
  };
}

/** Calls `listener` now and whenever the section changes. Home page only. */
export function subscribeHomeSection(listener: (section: HomeSection) => void) {
  listeners.add(listener);
  // Only the home page has the hero; elsewhere the caller decides.
  if (!stop && document.getElementById(sectionAnchors.hero)) stop = start();
  listener(current);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop?.();
      stop = null;
      current = "hero";
    }
  };
}
