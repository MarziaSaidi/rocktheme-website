import type { Vector3Tuple } from "../sceneTypes";

/**
 * Chapter frames, as plain maths.
 *
 * A chapter is composed as if the viewer stood at the origin looking down -z;
 * its frame places that composition in the shared world. This file must stay
 * free of three.js values: the scene configuration that uses it is also read
 * by server-rendered sections.
 */

export type ChapterFrame = Readonly<{ origin: Vector3Tuple; yaw: number }>;

export type PosePoint = Readonly<{ eye: Vector3Tuple; target: Vector3Tuple; fov: number }>;

/**
 * A composed moment of the arrival. `at` is its share of the arrival's scroll;
 * `speed` how fast the camera passes it, in world units per whole arrival
 * (0 holds still; left out, the timeline carries the pace through).
 */
export type ArrivalKeyframe = PosePoint & Readonly<{ at: number; speed?: number }>;

/** Places a point authored in a chapter's frame into the world (yaw about +y). */
export function toWorld(frame: ChapterFrame, local: Vector3Tuple): Vector3Tuple {
  const cos = Math.cos(frame.yaw);
  const sin = Math.sin(frame.yaw);
  const [x, y, z] = local;
  return [
    frame.origin[0] + x * cos + z * sin,
    frame.origin[1] + y,
    frame.origin[2] - x * sin + z * cos,
  ];
}

export function poseInFrame(frame: ChapterFrame, pose: PosePoint): PosePoint {
  return { eye: toWorld(frame, pose.eye), target: toWorld(frame, pose.target), fov: pose.fov };
}
