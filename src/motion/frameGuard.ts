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
 * whole frames instead, against the display's own cadence: a frame is over
 * budget above 1.2 cadences and slow above 1.5, never
 * below 20 and 25 ms. A browser pacing at 30 fps (a sleeping display, power
 * saving) therefore doesn't trip it on every frame.
 *
 * Measured at 60 Hz with the scene running: never trips at 1x or 2x CPU; at
 * 4x the hero's field trips in 0.32-0.44 s.
 *
 * The cadence is the shortest frame seen this visit: by a short probe when the
 * first guard is made (40 frames, then it stops) and by every guard's samples
 * since. A machine that later slows under load is still measured against its
 * real refresh rate; uniformly slow frames would otherwise pass for a 30 Hz
 * display and never trip. A display that really paces at 30 Hz calibrates at
 * 30 Hz, so it is not tripped on every frame.
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

/** The display's cadence: the shortest frame interval seen this visit. */
let displayCadence = Infinity;
let probed = false;
const PROBE_FRAMES = 40;

/** Measures the refresh rate once, early, before any effect has run. */
function probeDisplay() {
  if (probed || typeof window === "undefined") return;
  probed = true;
  let last = 0;
  let count = 0;
  const step = (now: number) => {
    if (last !== 0) displayCadence = Math.min(displayCadence, now - last);
    last = now;
    count += 1;
    if (count < PROBE_FRAMES) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function createFrameGuard(): FrameGuard {
  probeDisplay();
  let tripped = false;
  let overBudgetMs = 0;
  let warmup = 0;
  const stutters: number[] = [];
  /** Recent frame intervals, alongside the visit's shortest. */
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
      displayCadence = Math.min(displayCadence, elapsed);
      const cadence = Math.min(displayCadence, ...intervals);
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
