import { MathUtils, Vector3, type PerspectiveCamera } from "three";

import type { Collider } from "./collision";
import { passageFor, route, wayInFrom } from "./paths";

/**
 * The visitor's body and eyes: a free first-person explorer, the way
 * exploration games handle the mouse.
 *
 * Looking follows the cursor. The view leans towards wherever the cursor is,
 * and near the left or right edge it keeps turning that way, so the whole
 * world can be looked round without dragging. Walking is W A S D or the
 * arrow keys, the scroll wheel (forward and back), or a click on any place,
 * which walks there with the view turning to lead the way.
 *
 * Doors help: heading for one on your own lines you up and carries you
 * through, and pushing into a building's outside wall takes you round to
 * its door. Going on forward keeps that glide; anything else hands back.
 */
export type Explorer = Readonly<{
  readonly position: Vector3;
  readonly moving: boolean;
  /** Cursor over the world in −1…1 (y up); null when it leaves. */
  pointer: (x: number, y: number) => void;
  pointerLeave: () => void;
  /** A drag (touch, or a held mouse) turns the view directly, in CSS pixels. */
  drag: (dx: number, dy: number) => void;
  /** Returns true when the key moves the visitor. */
  key: (code: string, pressed: boolean) => boolean;
  wheel: (deltaY: number) => void;
  /** Walk to a point (heights ignored), then turn to face `face` if given. */
  walkTo: (point: Vector3, face?: Vector3 | null) => void;
  update: (delta: number) => void;
}>;

type Options = Readonly<{
  start: Vector3;
  lookAt: Vector3;
  /** Ground or floor height under a point. */
  heightAt: (x: number, z: number) => number;
  collider: Collider;
  reducedMotion: boolean;
  /** Distance from the clearing's middle the visitor may wander. */
  bounds: Readonly<{ x: number; z: number; radius: number }>;
}>;

const EYE = 1.62;
const WALK_SPEED = 2.7;
const ACCELERATION = 7;
/** The view leans this far towards the cursor (degrees). */
const LEAN_YAW = 14;
const LEAN_PITCH = 20;
/** Beyond this share of the half-width, the view keeps turning. */
const EDGE = 0.6;
const EDGE_TURN = MathUtils.degToRad(55);
const AUTO_TURN = MathUtils.degToRad(160);
const DRAG_TURN = 0.0045;
const LOOK_DAMPING = 6;
const BOB_HEIGHT = 0.024;
const BOB_STRIDE = 1.45;

const KEYS: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createExplorer(camera: PerspectiveCamera, options: Options): Explorer {
  const { heightAt, collider, reducedMotion, bounds } = options;
  const position = options.start.clone();
  position.y = heightAt(position.x, position.z) + EYE;

  // Yaw 0 looks along −z; positive turns left.
  let baseYaw = Math.atan2(-(options.lookAt.x - position.x), -(options.lookAt.z - position.z));
  let basePitch = 0;
  let leanYaw = 0;
  let leanPitch = 0;
  let cursor: { x: number; y: number } | null = null;

  const velocity = new Vector3();
  const pressed = new Set<string>();
  let wheelDistance = 0;
  let path: Vector3[] = [];
  let face: Vector3 | null = null;
  let faceYaw: number | null = null;
  let stuckFor = 0;
  /** Through a door on the visitor's own heading, rather than a clicked walk. */
  let transit = false;
  let pushedFor = 0;
  let walked = 0;
  let bobAmount = 0;

  const forward = new Vector3();
  const right = new Vector3();
  const desired = new Vector3();
  const heading = new Vector3();
  const before = new Vector3();

  const angleTo = (from: number, to: number) =>
    MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
  const turnTowards = (target: number, maxStep: number) => {
    const difference = angleTo(baseYaw, target);
    baseYaw += MathUtils.clamp(difference, -maxStep, maxStep);
    return Math.abs(difference) <= maxStep;
  };
  const headingTo = (point: Vector3) =>
    Math.atan2(-(point.x - position.x), -(point.z - position.z));

  const cancelWalk = () => {
    path = [];
    face = null;
    faceYaw = null;
    transit = false;
  };

  /** Take over a self-led walk and carry it through a door. */
  const startTransit = (points: Vector3[]) => {
    const end = points[points.length - 1]!;
    const from = points[points.length - 2] ?? position;
    if (reducedMotion) {
      position.set(end.x, position.y, end.z);
      collider.resolve(position);
      baseYaw = Math.atan2(-(end.x - from.x), -(end.z - from.z));
      cancelWalk();
      return;
    }
    path = points;
    face = null;
    faceYaw = null;
    transit = true;
    stuckFor = 0;
    pushedFor = 0;
    wheelDistance = 0;
  };

  const walkTo = (point: Vector3, target: Vector3 | null = null) => {
    if (reducedMotion) {
      position.set(point.x, position.y, point.z);
      collider.resolve(position);
      if (target) baseYaw = headingTo(target);
      cancelWalk();
      return;
    }
    path = route(position, point);
    face = target;
    faceYaw = null;
    stuckFor = 0;
    wheelDistance = 0;
  };

  const update = (delta: number) => {
    // ---------------------------------------------------------- looking
    if (cursor) {
      const across = Math.abs(cursor.x);
      if (across > EDGE) {
        const strength = Math.pow((across - EDGE) / (1 - EDGE), 1.6);
        baseYaw -= Math.sign(cursor.x) * strength * EDGE_TURN * delta;
      }
    }
    const targetLeanYaw = cursor ? -cursor.x * MathUtils.degToRad(LEAN_YAW) : 0;
    const targetLeanPitch = cursor ? cursor.y * MathUtils.degToRad(LEAN_PITCH) : 0;
    leanYaw = MathUtils.damp(leanYaw, targetLeanYaw, LOOK_DAMPING, delta);
    leanPitch = MathUtils.damp(leanPitch, targetLeanPitch, LOOK_DAMPING, delta);

    // ---------------------------------------------------------- moving
    forward.set(-Math.sin(baseYaw), 0, -Math.cos(baseYaw));
    right.set(-forward.z, 0, forward.x);
    desired.set(0, 0, 0);

    let side = 0;
    let ahead = 0;
    for (const code of pressed) {
      const step = KEYS[code];
      if (!step) continue;
      side += step[0];
      ahead += step[1];
    }
    const keysHeld = side !== 0 || ahead !== 0;
    // Going on forward keeps a glide through a door; any other key takes over.
    if (transit && keysHeld && !(ahead > 0 && side === 0)) cancelWalk();
    let manual = false;
    if (keysHeld && !transit) {
      cancelWalk();
      wheelDistance = 0;
      desired
        .addScaledVector(forward, ahead)
        .addScaledVector(right, side)
        .normalize()
        .multiplyScalar(WALK_SPEED);
      manual = true;
    } else if (wheelDistance !== 0 && !transit) {
      const step = Math.sign(wheelDistance);
      desired.copy(forward).multiplyScalar(step * WALK_SPEED);
      const used = Math.min(Math.abs(wheelDistance), WALK_SPEED * delta);
      wheelDistance -= step * used;
      manual = true;
    }
    // Heading for a door on their own: line up and carry them through.
    if (manual) {
      heading.copy(desired).normalize();
      const passage = heading.dot(forward) > 0.3 ? passageFor(position, heading) : null;
      if (passage) {
        startTransit(passage);
        desired.set(0, 0, 0);
        manual = false;
      }
    }
    if (!manual && path.length) {
      const next = path[0]!;
      const toNext = Math.hypot(next.x - position.x, next.z - position.z);
      const last = path.length === 1;
      if (toNext < (last ? 0.35 : 0.5)) {
        path.shift();
      } else {
        // The view turns to lead the walk, the way a game camera follows.
        turnTowards(headingTo(next), AUTO_TURN * delta);
        desired.set(next.x - position.x, 0, next.z - position.z).normalize();
        // Only the end of the walk slows; the turns on the way are rounded.
        desired.multiplyScalar(WALK_SPEED * (last ? Math.min(1, toNext / 0.9 + 0.35) : 1));
      }
      if (!path.length) transit = false;
    } else if (!manual && face) {
      faceYaw ??= headingTo(face);
      if (turnTowards(faceYaw, AUTO_TURN * 0.8 * delta)) {
        face = null;
        faceYaw = null;
      }
    }

    velocity.x = MathUtils.damp(velocity.x, desired.x, ACCELERATION, delta);
    velocity.z = MathUtils.damp(velocity.z, desired.z, ACCELERATION, delta);

    before.copy(position);
    position.addScaledVector(velocity, delta);
    collider.resolve(position);
    const fromCentre = Math.hypot(position.x - bounds.x, position.z - bounds.z);
    if (fromCentre > bounds.radius) {
      const scale = bounds.radius / fromCentre;
      position.x = bounds.x + (position.x - bounds.x) * scale;
      position.z = bounds.z + (position.z - bounds.z) * scale;
    }

    // A walk that has stopped making progress (blocked) gives up quietly.
    const progressed = Math.hypot(position.x - before.x, position.z - before.z);
    // Pressed against a building's outside wall: take them round to its door.
    // Scrolling comes in bursts, so the pauses between them only ease it off.
    if (manual && progressed < Math.hypot(desired.x, desired.z) * delta * 0.35) {
      pushedFor += delta;
      if (pushedFor > 0.35) {
        pushedFor = 0;
        const way = wayInFrom(position);
        if (way) startTransit(way);
      }
    } else if (manual) {
      pushedFor = 0;
    } else {
      pushedFor = Math.max(0, pushedFor - delta * 0.5);
    }
    if (path.length && progressed < WALK_SPEED * delta * 0.1) {
      stuckFor += delta;
      if (stuckFor > 0.8) cancelWalk();
    } else {
      stuckFor = 0;
    }

    // ---------------------------------------------------------- body
    const speed = Math.hypot(velocity.x, velocity.z);
    walked += speed * delta;
    bobAmount = MathUtils.damp(
      bobAmount,
      reducedMotion ? 0 : Math.min(1, speed / WALK_SPEED),
      8,
      delta,
    );
    const ground = heightAt(position.x, position.z) + EYE;
    position.y = MathUtils.damp(position.y, ground, 10, delta);

    camera.position.set(
      position.x,
      position.y + Math.sin((walked / BOB_STRIDE) * Math.PI * 2) * BOB_HEIGHT * bobAmount,
      position.z,
    );
    camera.rotation.order = "YXZ";
    camera.rotation.set(MathUtils.clamp(basePitch + leanPitch, -0.7, 0.6), baseYaw + leanYaw, 0);
  };

  update(0);

  return {
    get position() {
      return position;
    },
    get moving() {
      return Math.hypot(velocity.x, velocity.z) > 0.15 || path.length > 0;
    },
    pointer: (x, y) => {
      cursor = { x, y };
    },
    pointerLeave: () => {
      cursor = null;
    },
    drag: (dx, dy) => {
      baseYaw += dx * DRAG_TURN;
      basePitch = MathUtils.clamp(basePitch + dy * DRAG_TURN, -0.6, 0.5);
      cancelWalk();
    },
    key: (code, isDown) => {
      if (!KEYS[code]) return false;
      if (isDown) pressed.add(code);
      else pressed.delete(code);
      return true;
    },
    wheel: (deltaY) => {
      // Scrolling on keeps a glide through a door going; scrolling back stops it.
      if (transit && deltaY > 0) return;
      cancelWalk();
      wheelDistance = MathUtils.clamp(wheelDistance + deltaY * 0.006, -4, 4);
    },
    walkTo,
    update,
  };
}
