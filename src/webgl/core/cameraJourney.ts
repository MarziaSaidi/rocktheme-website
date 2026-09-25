import { CatmullRomCurve3, Vector3 } from "three";

import type { SectionId } from "@/config/sections";

import type { Vector3Tuple, WorkStation } from "../sceneTypes";
import { nearestHold, workMoment, workScreens } from "../workJourney";
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
  about: PosePoint;
  contact: PosePoint;
}>;

export type JourneyWaypoints = Readonly<{
  approach: PosePoint;
  arrival: PosePoint;
  /** Turning away from the last stone toward How I Work. */
  departure: readonly PosePoint[];
}>;

export type JourneyInput = Readonly<{
  scroll: number;
  stops: JourneyStops;
  rests: JourneyRests;
  waypoints: JourneyWaypoints;
  /** Selected Work: one station per stone, in project order. */
  stations: readonly WorkStation[];
}>;

export type JourneyState = Readonly<{
  /** The chapters whose lighting applies, and how far from one to the next. */
  from: SectionId;
  to: SectionId;
  blend: number;
}>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Zero velocity and zero acceleration at both ends. */
export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

type Leg = {
  eyes: CatmullRomCurve3 | null;
  targets: CatmullRomCurve3 | null;
  points: readonly PosePoint[];
};

const vec = (tuple: Vector3Tuple) => new Vector3(...tuple);

function curve(points: readonly Vector3[]): CatmullRomCurve3 | null {
  return points.length > 2 ? new CatmullRomCurve3([...points], false, "centripetal") : null;
}

function makeLeg(points: readonly PosePoint[]): Leg {
  return {
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

function setPose(pose: PosePoint, out: CameraPose) {
  out.eye.set(...pose.eye);
  out.target.set(...pose.target);
  out.fov = pose.fov;
}

/** Screens scrolled since the Selected Work stage pinned. */
function workProgress(scroll: number, stops: JourneyStops, count: number): number {
  const span = stops.workEnd - stops.workStart;
  return span > 0 ? clamp01((scroll - stops.workStart) / span) * workScreens(count) : 0;
}

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

export function nearestRest(
  scroll: number,
  stops: JourneyStops,
  hasIntro: boolean,
  stations: number,
): number {
  // Inside the pinned Selected Work stage, cut to the nearest settled project.
  if (scroll >= stops.workStart && scroll <= stops.workEnd && stations > 0) {
    const total = workScreens(stations);
    const hold = nearestHold(workProgress(scroll, stops, stations), stations);
    return stops.workStart + (hold / total) * (stops.workEnd - stops.workStart);
  }
  const rests = restOffsets(stops, hasIntro);
  return rests.reduce((best, value) =>
    Math.abs(value - scroll) < Math.abs(best - scroll) ? value : best,
  );
}

/** The far view of the first stone, where the Selected Work stage pins. */
function farView(stations: readonly WorkStation[], rests: JourneyRests): PosePoint {
  return stations[0]?.approach[0] ?? stations[0]?.settle ?? rests.about;
}

/**
 * Evaluates the journey. Writes the pose into `out` and returns which
 * chapters it lies between, for the lighting that travels with it.
 */
export function evaluateJourney(input: JourneyInput, out: CameraPose): JourneyState {
  const { scroll, stops, rests, waypoints, stations } = input;
  const hasIntro = rests.intro !== null && stops.introEnd > 1;
  const far = farView(stations, rests);
  const last = stations[stations.length - 1]?.settle ?? far;

  // ------------------------------------------------ hero: arrival → intro
  if (hasIntro && scroll < stops.introEnd) {
    // The intro holds for the last stretch of the pinned hero, so the lead
    // line is read with the camera still.
    const travelEnd = stops.introEnd * 0.8;
    const leg = makeLeg([rests.hero, waypoints.approach, rests.intro!]);
    sampleLeg(leg, smootherstep(scroll / Math.max(1, travelEnd)), out);
    return { from: "hero", to: "hero", blend: 0 };
  }

  // ------------------------------- hero → the far view of the first stone
  if (scroll < stops.workStart) {
    const start = hasIntro ? stops.introEnd : 0;
    const points = hasIntro
      ? [rests.intro!, waypoints.arrival, far]
      : [rests.hero, waypoints.approach, waypoints.arrival, far];
    const u = smootherstep((scroll - start) / Math.max(1, stops.workStart - start));
    sampleLeg(makeLeg(points), u, out);
    return { from: "hero", to: "selected-work", blend: u };
  }

  // ----------------------------------- Selected Work: stone to stone
  if (scroll <= stops.workEnd) {
    const { leg } = workMoment(workProgress(scroll, stops, stations.length), stations.length);
    const station = stations[leg.station];
    if (!station) {
      setPose(far, out);
    } else if (leg.kind === "hold") {
      setPose(station.settle, out);
    } else {
      const previous = stations[leg.station - 1];
      const points = previous
        ? [previous.settle, ...station.approach, station.settle]
        : [...station.approach, station.settle];
      sampleLeg(makeLeg(points), smootherstep(leg.progress), out);
    }
    return { from: "selected-work", to: "selected-work", blend: 0 };
  }

  // ------------------------------ last stone → How I Work, turning away
  if (scroll < stops.about) {
    const u = smootherstep((scroll - stops.workEnd) / Math.max(1, stops.about - stops.workEnd));
    sampleLeg(makeLeg([last, ...waypoints.departure, rests.about]), u, out);
    return { from: "selected-work", to: "about", blend: u };
  }

  // -------------------------------------------- How I Work → Contact
  const u = smootherstep((scroll - stops.about) / Math.max(1, stops.contact - stops.about));
  sampleLeg(makeLeg([rests.about, rests.contact]), u, out);
  return { from: "about", to: "footer", blend: u };
}
