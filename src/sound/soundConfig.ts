import type { InteractionSoundEvent } from "./soundEvents";

/**
 * Sound configuration.
 *
 * Interaction levels, timings and files are here; thunder uses thunder.ts. Changing how loud a cue
 * is, how the music gives way to it, or which file it plays is an edit to this
 * file and nothing else.
 *
 * The bed is the visitor's chosen music track. Over it, three short samples
 * mark interaction moments; main-page thunder lives on a separate bus. No hover or
 * pointer texture. The same transition sample is the site's signature, heard
 * whenever the visitor passes from one place to another.
 */

/** The background track starts only after an explicit sound-on gesture. */
export const BACKGROUND_TRACK = "/audio/night-bed-solarflex-loop.mp3";

/**
 * The track's end already blends into its opening (see the README). The two
 * players overlap by this much at the seam, so the loop never gaps.
 */
export const MUSIC_CROSSFADE_SECONDS = 2;

/**
 * The cue samples. Rendered by `scripts/render-sound-cues.mjs`; replace a file
 * with a recording of the same name to change a sound.
 */
export const SAMPLES = {
  transition: "/audio/effects/transition.mp3",
  readout: "/audio/effects/readout.mp3",
  chime: "/audio/effects/chime.mp3",
} as const;

export type SampleName = keyof typeof SAMPLES;

/**
 * Where the transition blooms, in seconds into its file. The entry starts it
 * this long before the passage bursts; shorter scene changes enter the file
 * part way through so the bloom comes soon after the gesture.
 */
export const TRANSITION_PEAK = 2.55;

/**
 * Music level before the master gain. The file is mastered to -16 LUFS; this
 * sits it about 2.5 dB under the old lofi bed, low enough to leave on through
 * a long read.
 */
export const MUSIC_GAIN = 0.7;

/** Master level. Conservative on purpose; the scene is quiet by design. */
export const MASTER_GAIN = 0.5;

/** Cue levels, relative to master. */
export const CUE_GAIN = 1;

/**
 * How the music makes room.
 *
 * `reading` holds while a case study is open, so the text is not read over a
 * full bed. `transition` is a brief dip under each transition bloom, the way a
 * mix ducks for a moment that should land.
 */
export const MUSIC_DUCK = {
  reading: 0.62,
  transition: { depth: 0.55, fall: 0.35, recover: 1.6 },
} as const;

/**
 * Voice limits.
 *
 * A per-event cooldown stops one gesture from retriggering a cue faster than
 * it decays, and the global cap stops cues from stacking. Both are hard
 * limits, not fades.
 */
export const VOICE_LIMITS = {
  /** Never more than this many voices alive at once. */
  maxConcurrent: 6,
  /** Minimum seconds between two firings of the same event. */
  cooldownSeconds: {
    "entry:passage": 5,
    "project:active": 0.22,
    "statement:read": 2,
    "project:open": 1,
    "contact:open": 1.2,
  } satisfies Record<InteractionSoundEvent, number>,
} as const;

/** Seconds the master gain takes to fade in and out on enable and disable. */
export const FADE_SECONDS = { in: 1.6, out: 0.45 } as const;

/**
 * Consecutive projects read out a whole step apart, so moving between them
 * reads as two lines of one printout rather than the same chatter twice.
 */
export const READOUT_RATES = [1, 1.122] as const;

export type CueShape = Readonly<{
  sample: SampleName;
  /** Level of this cue, 0 to 1, before intensity scaling. */
  peak: number;
  /**
   * Seconds before the bloom to enter a transition. Omitted plays the file
   * from its start.
   */
  lead?: number;
  /** Dip the music under this cue. */
  duck?: boolean;
}>;

/**
 * Per-cue shape: which sample, how loud, and where to enter it.
 */
export const CUES = {
  /** The doorway becomes the passage. The whole transition, full weight. */
  "entry:passage": { sample: "transition", peak: 1, duck: true },
  /**
   * A project settles and its card's text comes in: a soft tock and a faint
   * sparkle, lasting as long as the text takes to arrive. Kept low, under the
   * music, so the sparkle reads as texture rather than a tone.
   */
  "project:active": { sample: "readout", peak: 0.2 },
  /** The statement begins to light, word by word: the same soft readout. */
  "statement:read": { sample: "readout", peak: 0.2 },
  /** A case study opens. */
  "project:open": { sample: "transition", peak: 0.75, lead: 0.4, duck: true },
  /** The contact plane or email link is activated. */
  "contact:open": { sample: "chime", peak: 0.7 },
} satisfies Record<InteractionSoundEvent, CueShape>;

/** Session storage key. The preference lasts for the session, not forever. */
export const PREFERENCE_KEY = "marzia-saidi:sound";
