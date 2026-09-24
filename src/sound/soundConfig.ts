import type { SoundEvent } from "./soundEvents";

/**
 * Sound configuration.
 *
 * Every level, timing and pitch in the system is here. Changing how loud the
 * water is, how often particles may speak, or what a cue sounds like is an
 * edit to this file and nothing else.
 *
 * Interaction cues are synthesised. The environmental bed is the visitor's
 * chosen music track, loaded only after sound is enabled.
 */

/** The background track starts only after an explicit sound-on gesture. */
export const BACKGROUND_TRACK = "/audio/sahtori-path-of-the-wind-lofi-223116.mp3";

/** Music level before the master gain. Keep interaction cues underneath it. */
export const MUSIC_GAIN = 0.62;

/** Master level. Conservative on purpose; the scene is quiet by design. */
export const MASTER_GAIN = 0.5;

/**
 * Layer levels, relative to master. These are the six layers in the creative
 * direction. Raise or lower one to rebalance the mix without touching a cue.
 */
export const LAYER_GAIN = {
  /** 1. Quiet environmental atmosphere. */
  atmosphere: 0.1,
  /** 2. Subtle particle texture. */
  particles: 0.05,
  /** 3. Weighted project-plane movement. */
  planes: 0.14,
  /** 4. Soft ripple events. */
  water: 0.09,
  /** 5. Sparse purple-light tones. */
  lights: 0.08,
  /** 6. Warmer footer and contact resolution. */
  contact: 0.16,
} as const;

export type SoundLayer = keyof typeof LAYER_GAIN;

/**
 * Voice limits.
 *
 * Rapid pointer movement and rapid project navigation are the two cases that
 * turn a responsive texture into noise. A per-event cooldown stops one gesture
 * from retriggering a cue faster than it decays, and the global cap stops the
 * sum of all cues from stacking. Both are hard limits, not fades.
 */
export const VOICE_LIMITS = {
  /** Never more than this many scheduled voices alive at once. */
  maxConcurrent: 12,
  /** Minimum seconds between two firings of the same event. */
  cooldownSeconds: {
    "environment:start": 1,
    "particles:contact": 0.07,
    "project:approach": 0.35,
    "project:active": 0.22,
    "project:open": 0.5,
    "water:ripple": 0.3,
    "contact:hover": 0.9,
    "contact:open": 0.8,
  } satisfies Record<SoundEvent, number>,
} as const;

/** Seconds the master gain takes to fade in and out on enable and disable. */
export const FADE_SECONDS = { in: 1.6, out: 0.45 } as const;

/**
 * The horizon lights form a sparse chord rather than a melody. These are the
 * pitches, in hertz, one per beacon. Nothing loops through them in order.
 */
export const LIGHT_SCALE = [110, 146.83, 164.81, 220, 246.94] as const;

export type CueShape = Readonly<{
  layer: SoundLayer;
  /** Seconds. Kept short: nothing here is a musical phrase. */
  duration: number;
  /** Peak level within the layer, before intensity scaling. */
  peak: number;
}>;

/**
 * Per-cue shape. The engine reads these; the synthesis for each is in
 * `soundEngine.ts`. Adjust length and level here, timbre there.
 */
export const CUES = {
  "environment:start": { layer: "atmosphere", duration: 2.4, peak: 0.5 },
  "particles:contact": { layer: "particles", duration: 0.09, peak: 0.5 },
  "project:approach": { layer: "planes", duration: 0.55, peak: 0.55 },
  "project:active": { layer: "planes", duration: 0.34, peak: 0.7 },
  "project:open": { layer: "planes", duration: 0.7, peak: 0.75 },
  "water:ripple": { layer: "water", duration: 0.4, peak: 0.6 },
  "contact:hover": { layer: "contact", duration: 1.5, peak: 0.55 },
  "contact:open": { layer: "contact", duration: 2.2, peak: 0.8 },
} satisfies Record<SoundEvent, CueShape>;

/** Session storage key. The preference lasts for the session, not forever. */
export const PREFERENCE_KEY = "marzia-saidi:sound";
