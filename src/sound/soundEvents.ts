/**
 * Semantic sound events.
 *
 * This module contains no audio. It is a plain publish and subscribe channel,
 * which is what lets a visual component or the WebGL scene announce that
 * something happened without ever holding an AudioContext, scheduling a node,
 * or knowing whether sound is even switched on.
 *
 * Publishing when sound is off is free: nothing is subscribed, so the call
 * returns immediately. That is deliberate. A component should never ask
 * whether sound is enabled before reporting what it did.
 */

import { thunderAudit } from "./thunderAudit";

export const SOUND_EVENTS = [
  /** The doorway has opened into the passage and the camera is pushing in. */
  "entry:passage",
  /** A project has settled in front of the camera. */
  "project:active",
  /** The statement's words have begun to light. */
  "statement:read",
  /** A case study is being opened. */
  "project:open",
  /** The contact plane or email link was activated. */
  "contact:open",
  /** The first visible flash of one main-page storm strike. */
  "weather:lightning",
  /** Silent lifecycle signal: discard pending weather audio. */
  "weather:stop",
] as const;

export type SoundEvent = (typeof SOUND_EVENTS)[number];
export type InteractionSoundEvent = Exclude<SoundEvent, "weather:lightning" | "weather:stop">;

/**
 * Optional shaping for a cue. Every field is a hint, never a requirement: the
 * engine clamps anything out of range and works with no detail at all.
 */
export type SoundEventDetail = Readonly<{
  /** 0 to 1. Scales this one cue within its layer. */
  intensity?: number;
  /** Slowly eased, audio-only section character from the weather controller. */
  storm?: number;
  /** Audio correlation only; never changes the visual weather controller. */
  weatherEventId?: number;
  firstVisibleAt?: number;
  /**
   * Which of a sequence this is, for cues that vary along one. Consecutive
   * projects lock in at different pitches.
   */
  step?: number;
}>;

type Listener = (event: SoundEvent, detail: SoundEventDetail) => void;

const listeners = new Set<Listener>();
let weatherEventId = 0;

/** Announce that something happened. Safe to call at any rate, from anywhere. */
export function emitSoundEvent(event: SoundEvent, detail: SoundEventDetail = {}): void {
  if (event === "weather:lightning") {
    detail = { ...detail, weatherEventId: ++weatherEventId, firstVisibleAt: performance.now() };
    thunderAudit("bus:lightning", { ...detail, listeners: listeners.size });
  } else if (event === "weather:stop") {
    thunderAudit("bus:stop", { listeners: listeners.size });
  }
  if (listeners.size === 0) {
    return;
  }

  listeners.forEach((listener) => listener(event, detail));
}

/** Subscribe to every event. Only the sound engine should need this. */
export function subscribeSoundEvents(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** True when nothing is listening, so callers can skip expensive detail work. */
export function soundEventsIdle(): boolean {
  return listeners.size === 0;
}
