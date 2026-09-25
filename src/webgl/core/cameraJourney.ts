import { CatmullRomCurve3, Vector3 } from "three";

import type { SectionId } from "@/config/sections";

import type { Vector3Tuple } from "../sceneTypes";
import type { PosePoint } from "./chapterFrame";

export type { PosePoint };

/**
 * The camera journey.
 *
 * The single source of truth for where the rendered camera stands. The page
 * scrolls; every chapter's scroll range is measured from the DOM and handed in
 * as `JourneyStops`; this module turns one scroll offset into one pose. Nothing
 * else in the scene positions or aims the camera.
 *
 * Each chapter is composed in its own frame: the existing section cameras,
 * rock transforms and lights are authored as if the viewer stood at the
 * origin looking down -z, and the frame places that composition in the one
 * shared world. At rest the viewer sees exactly the approved composition; in
 * between, they travel across the water from one to the next.
 *
 * Between two rests the scroll is eased with smootherstep, so the camera
 * leaves and arrives with zero velocity and every rest is stable. Waypoints
 * inside a leg are passed through on a centripetal Catmull-Rom curve, which
 * neither loops nor overshoots on uneven spacing.
 */

export type CameraPose = { eye: Vector3; target: Vector3; fov: number };

/** Scroll offsets, in CSS pixels, measured from the document. */
export type JourneyStops = Readonly<{
  /** End of the hero's pinned runway; 0 where the hero is not pinned. */
  introEnd: number;
  /** Selected Work stage pins. */
  workStart: number;
  /** Selected Work stage unpins. */
  workEnd: number;
  /** How I Work sits in the middle of the screen. */
  about: number;
  /** End of the page: Contact. */
  contact: number;
}>;

export type JourneyRests = Readonly<{
  hero: PosePoint;
  intro: PosePoint | null;
  work: PosePoint;
  about: PosePoint;
  contact: PosePoint;
}>;

export type JourneyWaypoints = Readonly<{
  approach: PosePoint;
  arrival: PosePoint;
  /** Passing the stone on the way out, from behind it toward How I Work. */
  departure: readonly PosePoint[];
}>;

export type JourneyInput = Readonly<{
  scroll: number;
  stops: JourneyStops;
  rests: JourneyRests;
  waypoints: JourneyWaypoints;
  /** Selected Work walk round the stone, 0 in front and 1 behind. */
  orbit: number;
  /** The stone's axis, the centre of the walk. */
  pivot: Vector3;
}>;

export type JourneyState = Readonly<{
  /** The chapters whose lighting applies, and how far from one to the next. */
  from: SectionId;
  to: SectionId;
  blend: number;
  /** Walk round the stone applied to this pose, 0…1. */
  orbit: number;
}>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Zero velocity and zero acceleration at both ends. */
export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

type Leg = {
  start: number;
  end: number;
  eyes: CatmullRomCurve3 | null;
  targets: CatmullRomCurve3 | null;
  points: PosePoint[];
};

const vec = (tuple: Vector3Tuple) => new Vector3(...tuple);

function curve(points: readonly Vector3[]): CatmullRomCurve3 | null {
  return points.length > 2 ? new CatmullRomCurve3([...points], false, "centripetal") : null;
}

function makeLeg(start: number, end: number, points: PosePoint[]): Leg {
  return {
    start,
    end,
    eyes: curve(points.map((point) => vec(point.eye))),
    targets: curve(points.map((point) => vec(point.target))),
    points,
  };
}

/** Evaluates a leg at eased progress `u` into `out`. */
function sampleLeg(leg: Leg, u: number, out: CameraPose) {
  const first = leg.points[0]!;
  const last = leg.points[leg.points.length - 1]!;
  if (leg.eyes && leg.targets) {
    leg.eyes.getPoint(u, out.eye);
    leg.targets.getPoint(u, out.target);
  } else {
    out.eye.set(...first.eye).lerp(vec(last.eye), u);
    out.target.set(...first.target).lerp(vec(last.target), u);
  }
  // Field of view follows the waypoints piecewise, so a wider arrival
  // opens and closes again rather than drifting across the whole leg.
  const span = u * (leg.points.length - 1);
  const index = Math.min(leg.points.length - 2, Math.floor(span));
  const a = leg.points[index]!;
  const b = leg.points[index + 1]!;
  out.fov = a.fov + (b.fov - a.fov) * (span - index);
}

const up = new Vector3(0, 1, 0);

/** Walks a pose round the stone's axis: position and aim turn together. */
export function orbitPose(pose: PosePoint, pivot: Vector3, orbit: number, out: CameraPose) {
  const angle = orbit * Math.PI;
  out.eye
    .set(...pose.eye)
    .sub(pivot)
    .applyAxisAngle(up, angle)
    .add(pivot);
  out.target
    .set(...pose.target)
    .sub(pivot)
    .applyAxisAngle(up, angle)
    .add(pivot);
  out.fov = pose.fov;
}

const toTuple = (v: Vector3): Vector3Tuple => [v.x, v.y, v.z];

/**
 * The scroll offsets at which the camera rests. Reduced motion snaps to the
 * nearest of these so the camera cuts between compositions instead of flying.
 */
export function restOffsets(stops: JourneyStops, hasIntro: boolean): number[] {
  return [
    0,
    ...(hasIntro ? [stops.introEnd] : []),
    stops.workStart,
    stops.workEnd,
    stops.about,
    stops.contact,
  ];
}

export function nearestRest(scroll: number, stops: JourneyStops, hasIntro: boolean): number {
  const rests = restOffsets(stops, hasIntro);
  // Inside the pinned Selected Work stage the camera is already at rest.
  if (scroll >= stops.workStart && scroll <= stops.workEnd) return scroll;
  return rests.reduce((best, value) =>
    Math.abs(value - scroll) < Math.abs(best - scroll) ? value : best,
  );
}

/**
 * Evaluates the journey. Writes the pose into `out` and returns which
 * chapters it lies between, for the lighting that travels with it.
 */
export function evaluateJourney(input: JourneyInput, out: CameraPose): JourneyState {
  const { scroll, stops, rests, waypoints, pivot } = input;
  const orbit = clamp01(input.orbit);
  const hasIntro = rests.intro !== null && stops.introEnd > 1;

  // ------------------------------------------------ hero: arrival → intro
  if (hasIntro && scroll < stops.introEnd) {
    // The intro holds for the last stretch of the pinned hero, so the lead
    // line is read with the camera still.
    const travelEnd = stops.introEnd * 0.8;
    const leg = makeLeg(0, travelEnd, [rests.hero, waypoints.approach, rests.intro!]);
    sampleLeg(leg, smootherstep(scroll / Math.max(1, travelEnd)), out);
    return { from: "hero", to: "hero", blend: 0, orbit: 0 };
  }

  // --------------------------------------- hero → Selected Work arrival
  if (scroll < stops.workStart) {
    const start = hasIntro ? stops.introEnd : 0;
    const points = hasIntro
      ? [rests.intro!, waypoints.arrival, rests.work]
      : [rests.hero, waypoints.approach, waypoints.arrival, rests.work];
    const leg = makeLeg(start, stops.workStart, points);
    const u = smootherstep((scroll - start) / Math.max(1, stops.workStart - start));
    /*
     * Scrolled back up from behind the stone without walking round (by the
     * scrollbar or the keyboard), the last part of the leg walks the viewer
     * back to the front, so the approach is always from the front and the
     * camera never cuts across the stone.
     */
    const walkShare = 0.4 * orbit;
    if (walkShare > 0 && u > 1 - walkShare) {
      const back = (u - (1 - walkShare)) / walkShare;
      orbitPose(rests.work, pivot, orbit * smootherstep(back), out);
      return { from: "hero", to: "selected-work", blend: u, orbit };
    }
    sampleLeg(leg, u / (1 - walkShare), out);
    return { from: "hero", to: "selected-work", blend: u, orbit: 0 };
  }

  // --------------------------------------------- Selected Work: at rest
  if (scroll <= stops.workEnd) {
    orbitPose(rests.work, pivot, orbit, out);
    return { from: "selected-work", to: "selected-work", blend: 0, orbit };
  }

  // ----------------------------- Selected Work → How I Work, past the stone
  if (scroll < stops.about) {
    const u = smootherstep((scroll - stops.workEnd) / Math.max(1, stops.about - stops.workEnd));
    /*
     * The page is left from behind the stone, having walked round to the
     * second project. Left from in front (by the keyboard or the Continue
     * link), the first part of the leg finishes that walk, so the way on is
     * always the same.
     */
    const walkShare = 0.4 * (1 - orbit);
    if (u < walkShare) {
      orbitPose(rests.work, pivot, orbit + (1 - orbit) * smootherstep(u / walkShare), out);
      return { from: "selected-work", to: "selected-work", blend: 0, orbit: 1 };
    }
    const behind: CameraPose = { eye: new Vector3(), target: new Vector3(), fov: 0 };
    orbitPose(rests.work, pivot, 1, behind);
    const start: PosePoint = {
      eye: toTuple(behind.eye),
      target: toTuple(behind.target),
      fov: behind.fov,
    };
    const leg = makeLeg(0, 1, [start, ...waypoints.departure, rests.about]);
    const travel = walkShare > 0 ? (u - walkShare) / (1 - walkShare) : u;
    sampleLeg(leg, travel, out);
    return { from: "selected-work", to: "about", blend: travel, orbit: 1 };
  }

  // -------------------------------------------- How I Work → Contact
  const u = smootherstep((scroll - stops.about) / Math.max(1, stops.contact - stops.about));
  sampleLeg(makeLeg(0, 1, [rests.about, rests.contact]), u, out);
  return { from: "about", to: "footer", blend: u, orbit: 0 };
}
