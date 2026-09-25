/**
 * The Selected Work journey, as plain numbers.
 *
 * Each project has its own stone at its own place in the landscape. Once the
 * Selected Work stage pins, the scroll walks the camera through them:
 *
 *   approach   far view of the first stone → settled in front of it
 *   hold       the camera is still; the project's details come and go
 *   travel     away from one stone, across the water, settled at the next
 *   hold       …
 *
 * The camera (cameraJourney.ts) and the details card (MonolithGallery.tsx)
 * both read this one table with the same scroll progress, so the card can
 * only show while the camera is standing still at its own project. This file
 * stays free of three.js and React: both sides import it.
 */

/** Scroll lengths of each stretch, in screen heights. */
export const WORK_STRETCHES = {
  /*
   * The last part of the arrival (cameraJourney.ts): from the stage pinning to
   * the camera settling at the first stone. On desktop the hero's own pinned
   * runway comes before it, and the two together make the arrival's four
   * screens.
   */
  approach: 1.7,
  hold: 1.25,
  travel: 2.4,
} as const;

/**
 * Where in a hold the details are on screen, in screen heights from its start.
 * They arrive just after the camera has settled and leave well before it moves
 * on, so the card is gone before the next stone comes into view.
 */
const DETAILS_FROM = 0.08;
const DETAILS_UNTIL = WORK_STRETCHES.hold - 0.38;

export type WorkLeg =
  /** Toward stone `station`; the first leg starts at the far view. */
  | Readonly<{ kind: "move"; station: number; progress: number }>
  /** Standing still at stone `station`. */
  | Readonly<{ kind: "hold"; station: number }>;

export type WorkMoment = Readonly<{
  leg: WorkLeg;
  /** The project in view, or being travelled toward. */
  project: number;
  /** Whether the project's details belong on screen. */
  details: boolean;
}>;

/** Total scroll length of the pinned stage beyond its first screen. */
export function workScreens(count: number): number {
  if (count <= 0) return 0;
  return (
    WORK_STRETCHES.approach + count * WORK_STRETCHES.hold + (count - 1) * WORK_STRETCHES.travel
  );
}

/** Where the hold at stone `station` begins, in screens since the stage pinned. */
export function holdStart(station: number): number {
  return WORK_STRETCHES.approach + station * (WORK_STRETCHES.hold + WORK_STRETCHES.travel);
}

/** The scroll position, in screens, at which a project is best seen with its details. */
export function detailsPoint(station: number): number {
  return holdStart(station) + (DETAILS_FROM + DETAILS_UNTIL) / 2;
}

/** The journey at `screens` scrolled since the stage pinned. */
export function workMoment(screens: number, count: number): WorkMoment {
  const total = workScreens(count);
  const at = Math.min(total, Math.max(0, screens));

  if (at < WORK_STRETCHES.approach || count === 0) {
    return {
      leg: { kind: "move", station: 0, progress: at / WORK_STRETCHES.approach },
      project: 0,
      details: false,
    };
  }

  for (let station = 0; station < count; station += 1) {
    const start = holdStart(station);
    const holdEnd = start + WORK_STRETCHES.hold;
    if (at <= holdEnd || station === count - 1) {
      const into = at - start;
      return {
        leg: { kind: "hold", station },
        project: station,
        details: into >= DETAILS_FROM && into <= DETAILS_UNTIL,
      };
    }
    const travelEnd = holdEnd + WORK_STRETCHES.travel;
    if (at < travelEnd) {
      const progress = (at - holdEnd) / WORK_STRETCHES.travel;
      return {
        leg: { kind: "move", station: station + 1, progress },
        // The card is long gone by now; its content turns over half way.
        project: progress < 0.5 ? station : station + 1,
        details: false,
      };
    }
  }

  return { leg: { kind: "hold", station: count - 1 }, project: count - 1, details: false };
}

/** The hold nearest to `screens`, for reduced motion, which cuts between them. */
export function nearestHold(screens: number, count: number): number {
  let best = 0;
  for (let station = 1; station < count; station += 1) {
    if (Math.abs(detailsPoint(station) - screens) < Math.abs(detailsPoint(best) - screens)) {
      best = station;
    }
  }
  return detailsPoint(best);
}
