/**
 * A frame guard for an optional pointer effect (docs/typography-motion-system.md).
 *
 * It follows the scene's quality manager (src/webgl/core/quality.ts): a frame
 * over budget charges a bucket, at most 50 ms so one long frame can't trip it,
 * and a frame within budget drains it; the effect gives up after 160 ms of net
 * overload, not the scene's 1.2 s, because it is optional. Fast frames drain
 * that bucket, so stutter (slow frames between quick ones) never fills it; 4
 * slow frames within 60 also trip it. The scene times its own render work; an
 * effect's cost lands in the browser's style, layout and paint, so this times
 * whole frames instead, against the display's own cadence (the shortest recent
 * frame): a frame is over budget above 1.2 cadences and slow above 1.5, never
 * below 20 and 25 ms. A browser pacing at 30 fps (a sleeping display, power
 * saving) therefore doesn't trip it on every frame.
 *
 * Measured at 60 Hz with the scene running: never trips at 1x or 2x CPU; at
 * 4x the hero's field trips in 0.32-0.44 s.
 */
const GUARD = {
  budgetMs: 20,
  maxChargeMs: 50,
  patienceMs: 160,
  stutterMs: 25,
  stutterFrames: 4,
  windowFrames: 60,
  budgetCadences: 1.2,
  stutterCadences: 1.5,
};

export type FrameGuard = Readonly<{
  /**
   * One frame's interval, in ms. Returns true once the guard has tripped, and
   * from then on for the rest of the visit.
   */
  sample: (elapsedMs: number) => boolean;
  /** Skip the next `frames` frames: an effect's own one-off start-up cost. */
  warmUp: (frames: number) => void;
  readonly tripped: boolean;
}>;

export function createFrameGuard(): FrameGuard {
  let tripped = false;
  let overBudgetMs = 0;
  let warmup = 0;
  const stutters: number[] = [];
  /** Recent frame intervals; the shortest is the display's cadence. */
  const intervals: number[] = [];

  return {
    get tripped() {
      return tripped;
    },
    warmUp: (frames) => {
      warmup = frames;
    },
    sample: (elapsed) => {
      // Absurd intervals are a tab switch or a breakpoint, not a slow device.
      if (tripped || elapsed >= 500) return tripped;
      intervals.push(elapsed);
      if (intervals.length > GUARD.windowFrames) intervals.shift();
      const cadence = Math.min(...intervals);
      const budget = Math.max(GUARD.budgetMs, cadence * GUARD.budgetCadences);
      const slow = Math.max(GUARD.stutterMs, cadence * GUARD.stutterCadences);
      if (warmup > 0) {
        warmup -= 1;
        return false;
      }
      overBudgetMs =
        elapsed > budget
          ? overBudgetMs + Math.min(elapsed, GUARD.maxChargeMs)
          : Math.max(0, overBudgetMs - elapsed);
      stutters.push(elapsed > slow ? 1 : 0);
      if (stutters.length > GUARD.windowFrames) stutters.shift();
      const stuttering = stutters.reduce((sum, frame) => sum + frame, 0) >= GUARD.stutterFrames;
      if (overBudgetMs >= GUARD.patienceMs || stuttering) tripped = true;
      return tripped;
    },
  };
}
