/**
 * Channel between the Selected Work gallery and the scene.
 *
 * The stone never moves. What the gallery changes is where the viewer stands:
 * in front of the stone (view 0) or behind it (view 1), having walked half way
 * round it. The gallery owns one timeline for that walk; the scene evaluates
 * it every frame to place the camera and light the screens, and keeps no
 * clock of its own, so camera and screens cannot drift apart.
 *
 * Like the focus channel, this carries plain data only: image URLs for the two
 * faces and numbers for the walk. The scene learns nothing about projects.
 */

export type MonolithTiming = Readonly<{
  fadeOutMs: number;
  orbitMs: number;
  fadeInMs: number;
}>;

export type MonolithTimeline = Readonly<{
  /** 0 is the front face, 1 the back face. */
  fromView: number;
  toView: number;
  /** `performance.now()` at which the walk began. */
  startedAt: number;
  timing: MonolithTiming;
  /** Cut to the other side while the screens are dark instead of walking. */
  reduced: boolean;
}>;

export type MonolithPose = Readonly<{
  /** Progress round the stone, eased: 0 in front, 1 behind. */
  orbit: number;
  /** Screen brightness for the front and back faces. */
  front: number;
  back: number;
  /** Position of the passing light across the fading screen, 0…1, or -1. */
  sweep: number;
  settled: boolean;
}>;

export function monolithDuration(timeline: MonolithTimeline): number {
  const { fadeOutMs, orbitMs, fadeInMs } = timeline.timing;
  return fadeOutMs + (timeline.reduced ? 0 : orbitMs) + fadeInMs;
}

/** Symmetric ease-in-out. Heavy at both ends, no overshoot. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const faceOf = (view: number) => (view === 0 ? "front" : "back");

export function evaluateMonolith(timeline: MonolithTimeline, now: number): MonolithPose {
  const { fadeOutMs, orbitMs, fadeInMs } = timeline.timing;
  const walkMs = timeline.reduced ? 0 : orbitMs;
  const elapsed = Math.max(0, now - timeline.startedAt);
  const from = faceOf(timeline.fromView);
  const to = faceOf(timeline.toView);

  const brightness = { front: 0, back: 0 };
  let orbit = timeline.fromView;
  let sweep = -1;

  if (elapsed < fadeOutMs) {
    const t = elapsed / fadeOutMs;
    brightness[from] = 1 - t;
    sweep = t;
  } else if (elapsed < fadeOutMs + walkMs) {
    const t = (elapsed - fadeOutMs) / walkMs;
    orbit = timeline.fromView + (timeline.toView - timeline.fromView) * easeInOutCubic(t);
  } else {
    const t = clamp01((elapsed - fadeOutMs - walkMs) / fadeInMs);
    orbit = timeline.toView;
    brightness[to] = t;
    sweep = t < 1 ? t : -1;
  }

  return {
    orbit,
    front: brightness.front,
    back: brightness.back,
    sweep,
    settled: elapsed >= fadeOutMs + walkMs + fadeInMs,
  };
}

// ------------------------------------------------------------------- channel

type Listener = () => void;

let faces: readonly string[] = [];
let present = false;
let timeline: MonolithTimeline | null = null;
const listeners = new Set<Listener>();

const notify = () => listeners.forEach((listener) => listener());

/** Image URLs for the front and back screens, in that order. */
export function setMonolithFaces(next: readonly string[]): void {
  faces = next;
  notify();
}

export function setMonolithTimeline(next: MonolithTimeline): void {
  timeline = next;
  notify();
}

/**
 * Whether the gallery's stage is in place on screen. The stone and its
 * mountains only stand in the landscape while it is, so they never appear
 * over the neighbouring chapters' text while the page is still moving.
 */
export function setMonolithPresent(next: boolean): void {
  if (next === present) return;
  present = next;
  notify();
}

export function getMonolithPresent(): boolean {
  return present;
}

export function getMonolithFaces(): readonly string[] {
  return faces;
}

export function getMonolithTimeline(): MonolithTimeline | null {
  return timeline;
}

export function subscribeMonolith(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
