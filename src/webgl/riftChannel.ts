/**
 * The rift's link between the scene and the page.
 *
 * Beside the bio a mountain stands in the water, split open, and through the
 * split is another world. The scene draws it and flies the camera through;
 * the page lays a real button over the opening, shows "Hold to move to the
 * next world" once the visitor is on it, measures the hold, and takes over
 * at the end with /my-world.
 *
 * Scene → page: where the opening is on screen, and the two moments of the
 * crossing the page acts on (the camera leaving, the handoff).
 * Page → scene: whether the visitor is on it, how far they have held, and
 * the moment the hold completes.
 */
export type RiftRect = Readonly<{ x: number; y: number; width: number; height: number }>;

let rect: RiftRect | null = null;
const rectListeners = new Set<(rect: RiftRect | null) => void>();

/** The opening on screen while it can be used, in CSS pixels, or null. */
export function publishRiftRect(next: RiftRect | null) {
  const changed =
    (rect === null) !== (next === null) ||
    (rect !== null &&
      next !== null &&
      (Math.abs(rect.x - next.x) > 0.5 ||
        Math.abs(rect.y - next.y) > 0.5 ||
        Math.abs(rect.width - next.width) > 0.5 ||
        Math.abs(rect.height - next.height) > 0.5));
  if (!changed) return;
  rect = next;
  rectListeners.forEach((listener) => listener(rect));
}

export function subscribeRiftRect(listener: (rect: RiftRect | null) => void) {
  rectListeners.add(listener);
  listener(rect);
  return () => {
    rectListeners.delete(listener);
  };
}

let engaged = false;
let hold = 0;
let crossRequested = false;

/** The visitor is on the opening: hovering it, focused on it, or tapped it. */
export function setRiftEngaged(next: boolean) {
  engaged = next;
}

/** How far the visitor has held, 0 to 1. */
export function setRiftHold(next: number) {
  hold = Math.min(1, Math.max(0, next));
}

/** The hold is complete: the camera goes through. */
export function requestRiftCrossing() {
  crossRequested = true;
}

export function readRiftInput() {
  const request = crossRequested;
  crossRequested = false;
  return { engaged, hold, cross: request };
}

/**
 * The crossing's moments the page acts on:
 *   leave    the camera has committed to the opening; the page's own text
 *            stays behind
 *   handoff  the world beyond fills the screen; the page takes over
 */
export type RiftMoment = "leave" | "handoff";

const momentListeners = new Set<(moment: RiftMoment) => void>();

export function announceRiftMoment(moment: RiftMoment) {
  momentListeners.forEach((listener) => listener(moment));
}

export function subscribeRiftMoments(listener: (moment: RiftMoment) => void) {
  momentListeners.add(listener);
  return () => {
    momentListeners.delete(listener);
  };
}

/**
 * Where the rift's plume dissolves into specks near the peak, on screen,
 * whenever it is there at all, with how present it is and how much is
 * flowing. The bio's dust leaves from there for the words, and goes back.
 */
export type RiftAnchor = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  presence: number;
  /** Where the plume dissolves near the peak, on screen: each grain leaves from one. */
  path?: readonly Readonly<{ x: number; y: number }>[];
  /** How much is flowing: 0 at rest, up to 2 fully held. More grains break away. */
  energy?: number;
}>;

let anchor: RiftAnchor | null = null;

export function publishRiftAnchor(next: RiftAnchor | null) {
  anchor = next;
}

export function getRiftAnchor() {
  return anchor;
}

/**
 * How long the camera stays at the bio once the sentence is centred, in
 * viewport heights of scroll, before it sets off for Contact. The sentence
 * crumbles back into the rift over this stretch.
 */
export const BIO_DWELL = 0.55;

/**
 * The scroll offset where the camera rests at the bio, facing the rift: the
 * sentence centred on screen. The camera's journey and the way back from
 * /my-world both stop here. Unclamped; the page's own bounds apply.
 */
export function bioRestScroll(about: HTMLElement, viewport: number) {
  const thesis = about.querySelector<HTMLElement>("h2") ?? about;
  const top = thesis.getBoundingClientRect().top + window.scrollY;
  return top + thesis.offsetHeight / 2 - viewport / 2;
}
