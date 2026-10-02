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
  /*
   * From one stone to the next: long enough to leave, pass the first stone,
   * open onto the water and still come in to the second one calmly.
   */
  travel: 3,
} as const;

export type WorkStretches = Readonly<{ approach: number; hold: number; travel: number }>;

/*
 * Phones and tablets below the desktop layout. The frame is half as wide
 * (about 25° across against 52°) and the page moves by flicks, not wheel
 * notches, so the desktop lengths read as long stretches of empty water: here
 * each shot is cut to what it has to show. The arrival keeps a calm settle and
 * the holds stay long enough to read the card; the travel between projects is
 * a single move rather than a journey.
 */
export const NARROW_WORK_STRETCHES: WorkStretches = {
  approach: 1.3,
  hold: 1.1,
  travel: 1.8,
};

/** The journey's lengths for a layout: desktop's, or the narrow ones below it. */
export function workStretchesFor(viewport: "desktop" | "tablet" | "mobile"): WorkStretches {
  return viewport === "desktop" ? WORK_STRETCHES : NARROW_WORK_STRETCHES;
}

/**
 * Where in a hold the details are on screen, in screen heights from its start.
 * They arrive just after the camera has settled and leave well before it moves
 * on, so the card is gone before the next stone comes into view.
 */
const DETAILS_FROM = 0.08;
const detailsUntil = (stretches: WorkStretches) => stretches.hold - 0.38;

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
export function workScreens(count: number, stretches: WorkStretches = WORK_STRETCHES): number {
  if (count <= 0) return 0;
  return stretches.approach + count * stretches.hold + (count - 1) * stretches.travel;
}

/** Where the hold at stone `station` begins, in screens since the stage pinned. */
export function holdStart(station: number, stretches: WorkStretches = WORK_STRETCHES): number {
  return stretches.approach + station * (stretches.hold + stretches.travel);
}

/** The scroll position, in screens, at which a project is best seen with its details. */
export function detailsPoint(station: number, stretches: WorkStretches = WORK_STRETCHES): number {
  return holdStart(station, stretches) + (DETAILS_FROM + detailsUntil(stretches)) / 2;
}

/** The journey at `screens` scrolled since the stage pinned. */
export function workMoment(
  screens: number,
  count: number,
  stretches: WorkStretches = WORK_STRETCHES,
): WorkMoment {
  const total = workScreens(count, stretches);
  const at = Math.min(total, Math.max(0, screens));

  if (at < stretches.approach || count === 0) {
    return {
      leg: { kind: "move", station: 0, progress: at / stretches.approach },
      project: 0,
      details: false,
    };
  }

  for (let station = 0; station < count; station += 1) {
    const start = holdStart(station, stretches);
    const holdEnd = start + stretches.hold;
    if (at <= holdEnd || station === count - 1) {
      const into = at - start;
      return {
        leg: { kind: "hold", station },
        project: station,
        details: into >= DETAILS_FROM && into <= detailsUntil(stretches),
      };
    }
    const travelEnd = holdEnd + stretches.travel;
    if (at < travelEnd) {
      const progress = (at - holdEnd) / stretches.travel;
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
