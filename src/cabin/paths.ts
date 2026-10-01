import { Vector3 } from "three";

import { DOORWAY, type Vec3 } from "./stations";

/**
 * Walking routes through the clearing: round the cabin rather than through
 * it, and through the door to get in or out.
 */

/** In front of the porch steps: every walk in or out of the door passes here. */
export const PORCH_FRONT: Vec3 = [6.1, 1.65, 7.4];

/** The cabin, porch and chimney, with room to walk round them (x and z). */
export const BLOCK = { minX: 3.0, maxX: 13.0, minZ: -4.9, maxZ: 6.3 } as const;

/** Inside the cabin's walls. */
export const ROOM = { minX: 4.1, maxX: 11.9, minZ: -3.4, maxZ: 3.4 } as const;

export const isInRoom = (x: number, z: number) =>
  x > ROOM.minX && x < ROOM.maxX && z > ROOM.minZ && z < ROOM.maxZ;

const CORNERS = [
  [BLOCK.minX - 0.8, BLOCK.minZ - 0.8],
  [BLOCK.maxX + 0.8, BLOCK.minZ - 0.8],
  [BLOCK.maxX + 0.8, BLOCK.maxZ + 0.8],
  [BLOCK.minX - 0.8, BLOCK.maxZ + 0.8],
] as const;

/** Whether the straight walk from a to b passes through the cabin. */
function crossesCabin(a: Vector3, b: Vector3) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const edges: Array<[number, number]> = [
    [-dx, a.x - BLOCK.minX],
    [dx, BLOCK.maxX - a.x],
    [-dz, a.z - BLOCK.minZ],
    [dz, BLOCK.maxZ - a.z],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** The shortest way round the cabin by one or two of its corners. */
function detour(a: Vector3, b: Vector3): Vector3[] {
  if (!crossesCabin(a, b)) return [];
  const corner = (index: number) => {
    const [x, z] = CORNERS[index % 4]!;
    return new Vector3(x, 0, z);
  };
  let best: Vector3[] = [];
  let bestLength = Infinity;
  for (let i = 0; i < 4; i++) {
    const c = corner(i);
    if (!crossesCabin(a, c) && !crossesCabin(c, b)) {
      const length = a.distanceTo(c) + c.distanceTo(b);
      if (length < bestLength) [best, bestLength] = [[c], length];
    }
    for (const step of [1, 3]) {
      const d = corner(i + step);
      if (!crossesCabin(a, c) && !crossesCabin(d, b)) {
        const length = a.distanceTo(c) + c.distanceTo(d) + d.distanceTo(b);
        if (length < bestLength) [best, bestLength] = [[c, d], length];
      }
    }
  }
  return best;
}

/** The points to walk through from start to end, ending at end (heights ignored). */
export function route(start: Vector3, end: Vector3): Vector3[] {
  const flat = (p: Vector3 | Vec3) =>
    p instanceof Vector3 ? new Vector3(p.x, 0, p.z) : new Vector3(p[0], 0, p[2]);
  const a = flat(start);
  const b = flat(end);
  const startInside = isInRoom(a.x, a.z);
  const endInside = isInRoom(b.x, b.z);
  if (startInside && endInside) return [b];
  if (!startInside && !endInside) return [...detour(a, b), b];
  const door = [flat(DOORWAY.outside), flat(DOORWAY.inside)];
  const porch = flat(PORCH_FRONT);
  return startInside
    ? [door[1]!, door[0]!, porch, ...detour(porch, b), b]
    : [...detour(a, porch), porch, door[0]!, door[1]!, b];
}
