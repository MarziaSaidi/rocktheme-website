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

/** Starting up against a building: the nearest step back out of its margin. */
function stepOut(block: Block, p: Vector3): Vector3 | null {
  const inside = p.x > block.minX && p.x < block.maxX && p.z > block.minZ && p.z < block.maxZ;
  if (!inside) return null;
  const exits: Array<[number, Vector3]> = [
    [p.x - block.minX, new Vector3(block.minX - 0.1, 0, p.z)],
    [block.maxX - p.x, new Vector3(block.maxX + 0.1, 0, p.z)],
    [p.z - block.minZ, new Vector3(p.x, 0, block.minZ - 0.1)],
    [block.maxZ - p.z, new Vector3(p.x, 0, block.maxZ + 0.1)],
  ];
  exits.sort((m, n) => m[0] - n[0]);
  return exits[0]![1];
}

/** The points after a on an outdoor walk from a to b, round both buildings. */
function around(a: Vector3, b: Vector3): Vector3[] {
  let points = [a, b];
  for (const block of [BLOCK, HALL_BLOCK]) {
    const out = stepOut(block, points[0]!);
    if (out) points.splice(1, 0, out);
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

// ------------------------------------------------------------------ doorways

/**
 * A building's entrance, for the doorway assist: when the visitor heads for
 * it on their own (keys or scroll), the walk lines them up on its axis and
 * carries them through, instead of leaving them against the wall beside it.
 *
 * Both doors face +z, so a door is its axis (x), its wall (z) and its width.
 */
type Door = Readonly<{
  building: "cabin" | "hall";
  x: number;
  /** The facade's outer face, and the inner face seen from the room. */
  outerZ: number;
  innerZ: number;
  /** Where the aim from outside is judged: the deck's middle, or the wall. */
  aimZ: number;
  /** How far either side of the axis an aim still counts, outside and inside. */
  catchOutside: number;
  catchInside: number;
  /** Close enough to the axis to walk straight in. */
  onAxis: number;
  /** On the axis, out front: the line-up point when arriving from an angle. */
  approachZ: number;
  /** Through the opening: outside, inside, and the step that ends the entry. */
  outsideZ: number;
  insideZ: number;
  arriveZ: number;
  /** Inside, a step back from the door: the line-up point for leaving. */
  leaveFromZ: number;
  /** Outside, where leaving ends. */
  departZ: number;
}>;

const DOORS: readonly Door[] = [
  {
    building: "cabin",
    x: DOORWAY.inside[0],
    outerZ: ROOM.maxZ + 0.1,
    innerZ: ROOM.maxZ,
    aimZ: 5.35,
    catchOutside: 2.4,
    catchInside: 1.6,
    onAxis: 0.22,
    approachZ: PORCH_FRONT[2],
    outsideZ: DOORWAY.outside[2],
    insideZ: DOORWAY.inside[2],
    arriveZ: 1.0,
    leaveFromZ: 2.4,
    departZ: 8.6,
  },
  {
    building: "hall",
    x: HALL_DOORWAY.inside[0],
    outerZ: HALL.maxZ,
    innerZ: HALL.maxZ,
    aimZ: HALL.maxZ,
    catchOutside: 4.5,
    catchInside: 3.0,
    onAxis: 1.1,
    approachZ: HALL.maxZ + 3,
    outsideZ: HALL_DOORWAY.outside[2],
    insideZ: HALL_DOORWAY.inside[2],
    arriveZ: HALL.maxZ - 2.8,
    leaveFromZ: HALL.maxZ - 1.5,
    departZ: HALL.maxZ + 3.4,
  },
];

/** The deck in front of the door, under the roof. */
const onPorch = (x: number, z: number) => x > 4.5 && x < 8.5 && z >= ROOM.maxZ && z < 5.35;

const at = (x: number, z: number) => new Vector3(x, 0, z);

/** Walks a door's axis from wherever the visitor is, outside, to just inside. */
function entering(door: Door, position: Vector3): Vector3[] {
  const lateral = Math.abs(position.x - door.x);
  const through = [at(door.x, door.insideZ), at(door.x, door.arriveZ)];
  // On the deck the usual line-up point is behind the visitor.
  if (door.building === "cabin" && onPorch(position.x, position.z)) {
    return [...(lateral > door.onAxis ? [at(door.x, 4.4)] : []), ...through];
  }
  const outside = at(door.x, door.outsideZ);
  // Already out front and on the axis: straight in.
  if (lateral <= door.onAxis && position.z > door.outerZ && position.z < door.approachZ)
    return [outside, ...through];
  // The hall's front is open snow: line up level with the visitor, not back out.
  const approachZ =
    door.building === "hall"
      ? Math.min(door.approachZ, Math.max(door.outsideZ, position.z))
      : door.approachZ;
  const approach = at(door.x, approachZ);
  return [...around(flat(position), approach), outside, ...through];
}

/** Walks a door's axis from wherever the visitor is, inside, to out in the open. */
function leaving(door: Door, position: Vector3): Vector3[] {
  const lateral = Math.abs(position.x - door.x);
  const lineUp =
    lateral <= door.onAxis && position.z > door.leaveFromZ ? [] : [at(door.x, door.leaveFromZ)];
  const out = [at(door.x, door.outsideZ), at(door.x, door.departZ)];
  if (door.building === "cabin") out.splice(1, 0, at(door.x, PORCH_FRONT[2]));
  return [...lineUp, ...out];
}

/**
 * When the visitor heads for a door on their own: the walk through it, or
 * null if they aren't. `heading` is their direction of travel, flat and unit.
 */
export function passageFor(position: Vector3, heading: Vector3): Vector3[] | null {
  const inside = buildingAt(flat(position));
  for (const door of DOORS) {
    if (inside === door.building) {
      // Leaving: heading for the door's wall, near enough the opening.
      if (heading.z < 0.35) continue;
      const along = door.innerZ - position.z;
      if (along < 0.05 || along > 8) continue;
      const lateral = position.x + (heading.x / heading.z) * along - door.x;
      if (Math.abs(lateral) <= door.catchInside) return leaving(door, position);
      continue;
    }
    if (inside) continue;
    if (heading.z > -0.35) continue;
    // Entering from the porch: aimed at the wall the door is in.
    const porch = door.building === "cabin" && onPorch(position.x, position.z);
    const plane = porch ? door.outerZ : door.aimZ;
    const along = position.z - plane;
    if (along < 0.05 || along > 10) continue;
    const lateral = position.x + (heading.x / -heading.z) * along - door.x;
    if (Math.abs(lateral) <= door.catchOutside) return entering(door, position);
  }
  return null;
}

/**
 * Outside, pressed against a building: the walk round to its door and in,
 * or null if no building is that close.
 */
export function wayInFrom(position: Vector3): Vector3[] | null {
  if (buildingAt(flat(position))) return null;
  for (const door of DOORS) {
    const block = door.building === "cabin" ? BLOCK : HALL_BLOCK;
    const near =
      position.x > block.minX - 0.2 &&
      position.x < block.maxX + 0.2 &&
      position.z > block.minZ - 0.2 &&
      position.z < block.maxZ + 0.2;
    if (near) return entering(door, position);
  }
  return null;
}
