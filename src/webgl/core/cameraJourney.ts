import { CatmullRomCurve3, Vector3 } from "three";

import type { SectionId } from "@/config/sections";

import type { Vector3Tuple, WorkStation } from "../sceneTypes";
import { detailsPoint, holdStart, workMoment, workScreens } from "../workJourney";
import type { ArrivalKeyframe, PosePoint } from "./chapterFrame";

export type { ArrivalKeyframe, PosePoint };

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
 * shared world.
 *
 * The arrival, from the top of the page to the first stone, is one shot: a
 * timeline of composed keyframes the camera passes through at authored speeds,
 * slow where it leans, fast where it crosses, with a long deceleration into
 * its settle. It does not stop until it arrives.
 *
 * After that, between two rests the scroll is eased with smootherstep, so the
 * camera leaves and arrives with zero velocity. Waypoints are passed through
 * on a centripetal Catmull-Rom curve, which neither loops nor overshoots on
 * uneven spacing.
 */

export type CameraPose = { eye: Vector3; target: Vector3; fov: number };

/** Scroll offsets, in CSS pixels, measured from the document. */
export type JourneyStops = Readonly<{
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
  about: PosePoint;
  contact: PosePoint;
}>;

export type JourneyWaypoints = Readonly<{
  /** Turning away from the last stone toward How I Work. */
  departure: readonly PosePoint[];
}>;

export type JourneyInput = Readonly<{
  scroll: number;
  stops: JourneyStops;
  /** Hero to the first stone's settle. The last keyframe is that settle. */
  arrival: readonly ArrivalKeyframe[];
  rests: JourneyRests;
  waypoints: JourneyWaypoints;
  /** Selected Work: one station per stone, in project order. */
  stations: readonly WorkStation[];
  /**
   * The way to each stone after the first, by that stone's index, as a
   * keyframed shot. Where there is none, the station's approach points are
   * eased through instead.
   */
  departures?: readonly (readonly ArrivalKeyframe[] | null)[];
}>;

export type JourneyState = Readonly<{
  /** The chapters whose lighting applies, and how far from one to the next. */
  from: SectionId;
  to: SectionId;
  blend: number;
  /** Progress through the arrival, 0 to 1; null once the camera has arrived. */
  arrival: number | null;
  /**
   * How many stones, in project order, may be drawn. A stone is held back
   * until the camera sets off toward it, which the departures time for a
   * moment it stands out of frame: it is found by moving, never faded in.
   */
  revealed: number;
}>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Zero velocity and zero acceleration at both ends. */
export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

const vec = (tuple: Vector3Tuple) => new Vector3(...tuple);

// ------------------------------------------------------------ arrival

/*
 * Progress along one stretch between keyframes, 0 to 1 over normalised time,
 * leaving at slope `m0` and arriving at slope `m1` (1 is the stretch's average
 * pace). Both are capped at 3, which keeps every curve here monotonic: the
 * camera never backs up.
 */

/** Leaves at slope `m`, arrives with zero velocity and zero acceleration. */
function settle(t: number, m: number): number {
  const b = 6 - 3 * m;
  const c = 3 * m - 8;
  const d = 3 - m;
  return t * (m + t * (b + t * (c + t * d)));
}

function stretch(t: number, m0: number, m1: number): number {
  const a = Math.min(3, m0);
  const b = Math.min(3, m1);
  if (a === 0 && b === 0) return smootherstep(t);
  // Coming to rest: the long tail of a deceleration, no bump at the end.
  if (b === 0) return settle(t, a);
  // Setting off from rest: gathers pace with no jolt.
  if (a === 0) return 1 - settle(1 - t, b);
  const t2 = t * t;
  const t3 = t2 * t;
  return (t3 - 2 * t2 + t) * a + (3 * t2 - 2 * t3) + (t3 - t2) * b;
}

type Timeline = Readonly<{
  keys: readonly ArrivalKeyframe[];
  eyes: CatmullRomCurve3;
  targets: CatmullRomCurve3;
  /** Length of the eye path from each keyframe to the next. */
  lengths: readonly number[];
  /** Speed through each keyframe, in world units per whole arrival. */
  speeds: readonly number[];
}>;

const timelines = new WeakMap<readonly ArrivalKeyframe[], Timeline>();

function timelineFor(keys: readonly ArrivalKeyframe[]): Timeline {
  const cached = timelines.get(keys);
  if (cached) return cached;

  const eyes = new CatmullRomCurve3(
    keys.map((key) => vec(key.eye)),
    false,
    "centripetal",
  );
  const targets = new CatmullRomCurve3(
    keys.map((key) => vec(key.target)),
    false,
    "centripetal",
  );
  const last = keys.length - 1;
  const lengths: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  for (let index = 0; index < last; index += 1) {
    let length = 0;
    eyes.getPoint(index / last, a);
    for (let step = 1; step <= 32; step += 1) {
      eyes.getPoint((index + step / 32) / last, b);
      length += a.distanceTo(b);
      a.copy(b);
    }
    lengths.push(length);
  }
  // A keyframe without an authored speed carries the pace of its neighbours.
  const pace = lengths.map(
    (length, index) => length / Math.max(1e-6, keys[index + 1]!.at - keys[index]!.at),
  );
  const speeds = keys.map(
    (key, index) =>
      key.speed ?? (index === 0 || index === last ? 0 : (pace[index - 1]! + pace[index]!) / 2),
  );

  const timeline = { keys, eyes, targets, lengths, speeds };
  timelines.set(keys, timeline);
  return timeline;
}

/** Where along the keyframes the camera is at arrival progress `u`, 0 to 1. */
function arrivalPosition(timeline: Timeline, u: number): { index: number; along: number } {
  const { keys, lengths, speeds } = timeline;
  const at = clamp01(u);
  let index = 0;
  while (index < keys.length - 2 && at > keys[index + 1]!.at) index += 1;
  const from = keys[index]!;
  const to = keys[index + 1] ?? from;
  const span = to.at - from.at;
  if (span <= 0) return { index, along: 1 };
  const length = Math.max(1e-6, lengths[index] ?? 0);
  const m0 = (speeds[index]! * span) / length;
  const m1 = (speeds[index + 1]! * span) / length;
  return { index, along: stretch((at - from.at) / span, m0, m1) };
}

/*
 * How far ahead of the eye the aim runs, in arrival progress. The camera
 * looks where it is going a moment before it goes there. Zero at both ends,
 * so the hero and the settle are exactly as composed.
 */
const AIM_LEAD = 0.02;

function sampleArrival(keys: readonly ArrivalKeyframe[], u: number, out: CameraPose) {
  const timeline = timelineFor(keys);
  const last = keys.length - 1;
  const eye = arrivalPosition(timeline, u);
  timeline.eyes.getPoint(clamp01((eye.index + eye.along) / last), out.eye);
  const aim = arrivalPosition(timeline, u + AIM_LEAD * Math.sin(Math.PI * clamp01(u)));
  timeline.targets.getPoint(clamp01((aim.index + aim.along) / last), out.target);
  const from = keys[eye.index]!;
  const to = keys[eye.index + 1] ?? from;
  out.fov = from.fov + (to.fov - from.fov) * eye.along;
}

// ------------------------------------------------------------ legs

type Leg = {
  eyes: CatmullRomCurve3 | null;
  targets: CatmullRomCurve3 | null;
  points: readonly PosePoint[];
};

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

/** The scroll offset at `screens` into the Selected Work stage. */
function workScroll(screens: number, stops: JourneyStops, count: number): number {
  const total = workScreens(count);
  return total > 0
    ? stops.workStart + (screens / total) * (stops.workEnd - stops.workStart)
    : stops.workStart;
}

/** Where the arrival ends: the camera has settled at the first stone. */
export function arrivalEnd(stops: JourneyStops, stations: number): number {
  return stations > 0 ? workScroll(holdStart(0), stops, stations) : stops.workStart;
}

/**
 * The scroll offsets at which the camera rests. Reduced motion snaps to the
 * nearest of these so the camera cuts between compositions instead of flying.
 */
export function restOffsets(stops: JourneyStops, stations: number): number[] {
  const holds = Array.from({ length: stations }, (_, index) =>
    workScroll(detailsPoint(index), stops, stations),
  );
  return [0, ...holds, stops.workEnd, stops.about, stops.contact];
}

export function nearestRest(scroll: number, stops: JourneyStops, stations: number): number {
  return restOffsets(stops, stations).reduce((best, value) =>
    Math.abs(value - scroll) < Math.abs(best - scroll) ? value : best,
  );
}

/**
 * Evaluates the journey. Writes the pose into `out` and returns which
 * chapters it lies between, for the lighting that travels with it.
 */
export function evaluateJourney(input: JourneyInput, out: CameraPose): JourneyState {
  const { scroll, stops, arrival, rests, waypoints, stations, departures } = input;
  const arrived = arrivalEnd(stops, stations.length);
  const last = stations[stations.length - 1]?.settle ?? arrival[arrival.length - 1] ?? rests.about;

  // ------------------------------------------- hero → the first stone
  if (scroll < arrived && arrival.length > 1) {
    const u = clamp01(scroll / Math.max(1, arrived));
    sampleArrival(arrival, u, out);
    return {
      from: "hero",
      to: "selected-work",
      blend: smootherstep((u - 0.25) / 0.6),
      arrival: u,
      revealed: 1,
    };
  }

  // ----------------------------------- Selected Work: stone to stone
  if (scroll <= stops.workEnd) {
    const { leg } = workMoment(workProgress(scroll, stops, stations.length), stations.length);
    const station = stations[leg.station];
    const previous = stations[leg.station - 1];
    const keys = departures?.[leg.station];
    if (!station) {
      setPose(last, out);
    } else if (leg.kind === "hold" || !previous) {
      setPose(station.settle, out);
    } else if (keys && keys.length > 1) {
      sampleArrival(keys, leg.progress, out);
    } else {
      const points = [previous.settle, ...station.approach, station.settle];
      sampleLeg(makeLeg(points), smootherstep(leg.progress), out);
    }
    const revealed = leg.kind === "move" && leg.progress <= 0 ? leg.station : leg.station + 1;
    return { from: "selected-work", to: "selected-work", blend: 0, arrival: null, revealed };
  }

  // ------------------------------ last stone → How I Work, turning away
  if (scroll < stops.about) {
    const u = smootherstep((scroll - stops.workEnd) / Math.max(1, stops.about - stops.workEnd));
    sampleLeg(makeLeg([last, ...waypoints.departure, rests.about]), u, out);
    return {
      from: "selected-work",
      to: "about",
      blend: u,
      arrival: null,
      revealed: stations.length,
    };
  }

  // -------------------------------------------- How I Work → Contact
  const u = smootherstep((scroll - stops.about) / Math.max(1, stops.contact - stops.about));
  sampleLeg(makeLeg([rests.about, rests.contact]), u, out);
  return { from: "about", to: "footer", blend: u, arrival: null, revealed: stations.length };
}
