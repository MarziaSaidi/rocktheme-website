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
 * Nothing here reads layout. One observer watches a line across the middle of
 * the viewport; the bio and the contact are watched through their own
 * attributes. `--arrival` is read directly from the root's inline style once a
 * frame, and only while the camera is between the hero and its first stop
 * (the hero or Selected Work holds the middle of the screen and the root has
 * no `data-arrived`). Standing at a project, nothing runs. The root's style is
 * never observed: the scene sets several properties there every frame, and
 * observing that attribute measurably cost frames.
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

  /*
   * The bio and the contact report their own state through attributes the
   * page observes below; those are read once per change and cached here, so
   * the per-frame path (the scene rewriting the root's style) only parses one
   * inline value.
   */
  const contact = document.getElementById("contact-title");
  const bio = document.querySelector("[data-bio-story]");
  let rippleOn = false;
  let bioOn = false;
  const readPage = () => {
    const ripple = contact?.dataset.ripple;
    rippleOn = ripple === "playing" || ripple === "done";
    bioOn = !!bio?.querySelector("[data-bio-passage][data-on]");
  };

  const compute = (): HomeSection => {
    if (rippleOn) return null;
    if (bioOn || middle.get(sectionAnchors.about)) return "about";
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
      syncFollow();
      update();
    },
    { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
  );
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element) io.observe(element);
  });

  // The camera's progress, read once a frame while it can change the answer.
  let frame = 0;
  const follow = () => {
    update();
    frame = requestAnimationFrame(follow);
  };
  const syncFollow = () => {
    const near =
      !!(middle.get(sectionAnchors.hero) || middle.get(sectionAnchors["selected-work"])) &&
      root.dataset.arrived === undefined;
    update();
    if (near && !frame) frame = requestAnimationFrame(follow);
    else if (!near && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  const pageWatch = new MutationObserver(() => {
    readPage();
    update();
  });
  if (bio)
    pageWatch.observe(bio, { attributes: true, subtree: true, attributeFilter: ["data-on"] });
  // Arriving at a project, and leaving it again: filtered, so the per-frame style writes never reach it.
  const arrivedWatch = new MutationObserver(syncFollow);
  arrivedWatch.observe(root, {
    attributes: true,
    attributeFilter: ["data-arrived", "data-journey"],
  });
  if (contact) pageWatch.observe(contact, { attributes: true, attributeFilter: ["data-ripple"] });

  readPage();
  syncFollow();
  return () => {
    io.disconnect();
    pageWatch.disconnect();
    arrivedWatch.disconnect();
    cancelAnimationFrame(frame);
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
