import { Vector3 } from "three";

import { DOORWAY, HALL, HALL_DOORWAY, type Vec3 } from "./stations";

/**
 * Walking routes through the clearing: round the cabin and the hall rather
 * than through them, and through their doors to get in or out.
 */

/** In front of the porch steps: every walk in or out of the door passes here. */
export const PORCH_FRONT: Vec3 = [6.1, 1.65, 7.4];

type Block = Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;

/** The cabin, porch and chimney, with room to walk round them (x and z). */
export const BLOCK: Block = { minX: 3.0, maxX: 13.0, minZ: -4.9, maxZ: 6.3 };

/** The hall and its canopy, with the same room round them. */
const HALL_BLOCK: Block = {
  minX: HALL.minX - 0.8,
  maxX: HALL.maxX + 0.8,
  minZ: HALL.minZ - 0.8,
  maxZ: HALL.maxZ + 0.8,
};

/** Inside the cabin's walls. */
export const ROOM = { minX: 4.1, maxX: 11.9, minZ: -3.4, maxZ: 3.4 } as const;

export const isInRoom = (x: number, z: number) =>
  x > ROOM.minX && x < ROOM.maxX && z > ROOM.minZ && z < ROOM.maxZ;

/** Inside the hall's glass. */
export const isInHall = (x: number, z: number) =>
  x > HALL.minX && x < HALL.maxX && z > HALL.minZ && z < HALL.maxZ;

/** Whether the straight walk from a to b passes through a block. */
function crosses(block: Block, a: Vector3, b: Vector3) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const edges: Array<[number, number]> = [
    [-dx, a.x - block.minX],
    [dx, block.maxX - a.x],
    [-dz, a.z - block.minZ],
    [dz, block.maxZ - a.z],
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

/** The shortest way round a block by one or two of its corners. */
function detour(block: Block, a: Vector3, b: Vector3): Vector3[] {
  if (!crosses(block, a, b)) return [];
  const corners = [
    [block.minX - 0.8, block.minZ - 0.8],
    [block.maxX + 0.8, block.minZ - 0.8],
    [block.maxX + 0.8, block.maxZ + 0.8],
    [block.minX - 0.8, block.maxZ + 0.8],
  ] as const;
  const corner = (index: number) => {
    const [x, z] = corners[index % 4]!;
    return new Vector3(x, 0, z);
  };
  let best: Vector3[] = [];
  let bestLength = Infinity;
  for (let i = 0; i < 4; i++) {
    const c = corner(i);
    if (!crosses(block, a, c) && !crosses(block, c, b)) {
      const length = a.distanceTo(c) + c.distanceTo(b);
      if (length < bestLength) [best, bestLength] = [[c], length];
    }
    for (const step of [1, 3]) {
      const d = corner(i + step);
      if (!crosses(block, a, c) && !crosses(block, d, b)) {
        const length = a.distanceTo(c) + c.distanceTo(d) + d.distanceTo(b);
        if (length < bestLength) [best, bestLength] = [[c, d], length];
      }
    }
  }
  return best;
}

/** The points after a on an outdoor walk from a to b, round both buildings. */
function around(a: Vector3, b: Vector3): Vector3[] {
  let points = [a, b];
  for (const block of [BLOCK, HALL_BLOCK]) {
    const next = [points[0]!];
    for (let i = 1; i < points.length; i++)
      next.push(...detour(block, points[i - 1]!, points[i]!), points[i]!);
    points = next;
  }
  return points.slice(1);
}

const flat = (p: Vector3 | Vec3) =>
  p instanceof Vector3 ? new Vector3(p.x, 0, p.z) : new Vector3(p[0], 0, p[2]);

/** The way out of each building, from inside to the open snow. */
const EXITS = {
  cabin: [DOORWAY.inside, DOORWAY.outside, PORCH_FRONT],
  hall: [HALL_DOORWAY.inside, HALL_DOORWAY.outside],
} as const;

const buildingAt = (p: Vector3) =>
  isInRoom(p.x, p.z) ? "cabin" : isInHall(p.x, p.z) ? "hall" : null;

/** The points to walk through from start to end, ending at end (heights ignored). */
export function route(start: Vector3, end: Vector3): Vector3[] {
  const a = flat(start);
  const b = flat(end);
  const from = buildingAt(a);
  const to = buildingAt(b);
  if (from && from === to) return [b];
  const out = from ? EXITS[from].map(flat) : [];
  const into = to ? [...EXITS[to]].reverse().map(flat) : [];
  const leaving = out.at(-1) ?? a;
  if (!to) return [...out, ...around(leaving, b)];
  return [...out, ...around(leaving, into[0]!), ...into.slice(1), b];
}
