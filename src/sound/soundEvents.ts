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

export const SOUND_EVENTS = [
  /** The engine has been switched on by the visitor. */
  "environment:start",
  /** A particle entered the pointer's contact zone. */
  "particles:contact",
  /** A project plane is coming towards its active position. */
  "project:approach",
  /** A project plane has locked into place. */
  "project:active",
  /** A project is being opened. */
  "project:open",
  /** The pointer disturbed the reflective floor. */
  "water:ripple",
  /** The pointer reached the contact plane. */
  "contact:hover",
  /** The contact plane was activated. */
  "contact:open",
] as const;

export type SoundEvent = (typeof SOUND_EVENTS)[number];

/**
 * Optional shaping for a cue. Every field is a hint, never a requirement: the
 * engine clamps anything out of range and works with no detail at all.
 */
export type SoundEventDetail = Readonly<{
  /** 0 to 1. Scales this one cue within its layer. */
  intensity?: number;
  /**
   * Selects a pitch from the layer's scale, for cues that have one. Used by
   * the horizon lights so consecutive projects form a chord rather than a
   * repeated note.
   */
  step?: number;
}>;

type Listener = (event: SoundEvent, detail: SoundEventDetail) => void;

const listeners = new Set<Listener>();

/** Announce that something happened. Safe to call at any rate, from anywhere. */
export function emitSoundEvent(event: SoundEvent, detail: SoundEventDetail = {}): void {
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
