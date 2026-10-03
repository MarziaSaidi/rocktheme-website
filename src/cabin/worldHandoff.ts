/**
 * The handoff from the homepage to /my-world, held across the route change.
 *
 * When the homepage world has broken away, the capture of /my-world is laid
 * over everything by a single element in the root layout. Because that
 * element belongs to the layout, it survives the route change untouched: no
 * new image to load, no frame without it. /my-world draws its live world
 * underneath and, once its first frame is up, releases the picture, which
 * fades away over a world showing the same view.
 */
export type Handoff = Readonly<{
  /** When the homepage handed over (Date.now()): both pages drift the picture from it. */
  at: number;
  /** The live world is up: the picture stops drifting and fades out. */
  leaving: boolean;
}>;

/** How long the picture takes to fade from over the live world. */
export const HANDOFF_FADE_MS = 700;

let state: Handoff | null = null;
const listeners = new Set<() => void>();
let clearTimer = 0;

const publish = (next: Handoff | null) => {
  state = next;
  listeners.forEach((listener) => listener());
};

export function beginHandoff(at: number) {
  window.clearTimeout(clearTimer);
  publish({ at, leaving: false });
}

/** The live world is ready (or failed): let the picture go. */
export function releaseHandoff() {
  if (!state || state.leaving) return;
  publish({ ...state, leaving: true });
  clearTimer = window.setTimeout(() => publish(null), HANDOFF_FADE_MS);
}

export function getHandoff() {
  return state;
}

export function subscribeHandoff(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let decoded: Promise<void> | null = null;

/** Starts loading and decoding a picture, once; resolves when it can be painted at once. */
export function predecode(src: string) {
  if (!decoded) {
    const image = new Image();
    image.src = src;
    decoded = image.decode().catch(() => {
      // Painting it undecoded is still better than not handing over.
    });
  }
  return decoded;
}
