/**
 * Pointer-input configuration.
 *
 * `motion.css` owns every value CSS consumes: durations, delays, easing,
 * stagger, travel distances, perspective strength and the pointer rotation
 * budget. This file owns only the input-smoothing values JavaScript needs, so
 * the two never duplicate a number and cannot drift apart.
 *
 * The pointer listener writes `--pointer-x` and `--pointer-y` as unitless
 * values between -1 and 1. `motion.css` converts them into degrees.
 */
export const pointerMotion = {
  /** Custom properties the listener writes onto the tracked element. */
  xVariable: "--pointer-x",
  yVariable: "--pointer-y",

  /**
   * Per-frame interpolation towards the pointer. Low values give the heavy,
   * weighted follow the direction asks for instead of a lightweight card
   * chasing the cursor.
   */
  smoothing: 0.055,

  /** Below this delta the listener snaps to target and parks the frame loop. */
  restThreshold: 0.0008,

  /** Only a mouse-like pointer drives depth. Touch and pen never do. */
  finePointerQuery: "(hover: hover) and (pointer: fine)",
  reducedMotionQuery: "(prefers-reduced-motion: reduce)",

  /** Marks the tracked element so CSS can scope compositing hints. */
  activeAttribute: "data-pointer-active",
} as const;
