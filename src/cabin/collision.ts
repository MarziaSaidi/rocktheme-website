import type { Vector3 } from "three";

/**
 * What the visitor can't walk through, in plan (x, z): the cabin's walls
 * with the door left open, porch rails, chimney, log pile, the furniture
 * inside and the fir trunks. Movement slides along anything it meets.
 */
type Segment = readonly [number, number, number, number];
type Circle = readonly [number, number, number];

const rect = (minX: number, minZ: number, maxX: number, maxZ: number): Segment[] => [
  [minX, minZ, maxX, minZ],
  [maxX, minZ, maxX, maxZ],
  [maxX, maxZ, minX, maxZ],
  [minX, maxZ, minX, minZ],
];

const STATIC_SEGMENTS: Segment[] = [
  // Cabin walls; the south wall leaves the doorway (x 5.6–6.6) open.
  [4, -3.5, 12, -3.5],
  [12, -3.5, 12, 3.5],
  [12, 3.5, 6.6, 3.5],
  [5.6, 3.5, 4, 3.5],
  [4, 3.5, 4, -3.5],
  // The open door leaf, swung into the room.
  [5.62, 3.38, 5.46, 2.43],
  // Porch rails, with the gap in front of the door.
  [4.5, 5.35, 5.6, 5.35],
  [6.6, 5.35, 8.5, 5.35],
  // Chimney stack outside the north wall, log pile by the west wall.
  ...rect(10.4, -4.25, 11.4, -3.6),
  ...rect(3.42, 2.05, 3.7, 3.6),
  // Inside: hearth, kitchen run, shelves, desk.
  ...rect(9.75, -3.5, 11.95, -2.62),
  ...rect(4.0, -3.5, 7.3, -2.75),
  ...rect(4.0, -2.45, 4.6, -1.35),
  ...rect(10.9, 1.25, 12, 2.95),
];

const STATIC_CIRCLES: Circle[] = [
  [8.75, -1.55, 0.45], // rocking chair
  [11.25, -1.15, 0.5], // armchair
  [9.45, -2.4, 0.45], // tea table
  [10.45, 2.1, 0.3], // desk chair
  [7.65, -2.95, 0.25], // basket
  [4.65, 5.35, 0.12], // porch posts
  [8.35, 5.35, 0.12],
];

export type Collider = Readonly<{ resolve: (position: Vector3) => void }>;

/** Builds the collider; trees come from the scenery as [x, z, trunk radius]. */
export function createCollider(trees: readonly Circle[], radius = 0.3): Collider {
  const circles = [...STATIC_CIRCLES, ...trees];
  return {
    resolve: (position) => {
      // Two passes settle corners where two walls push at once.
      for (let pass = 0; pass < 2; pass++) {
        for (const [ax, az, bx, bz] of STATIC_SEGMENTS) {
          const dx = bx - ax;
          const dz = bz - az;
          const lengthSq = dx * dx + dz * dz || 1;
          const t = Math.max(
            0,
            Math.min(1, ((position.x - ax) * dx + (position.z - az) * dz) / lengthSq),
          );
          const cx = ax + dx * t;
          const cz = az + dz * t;
          const ox = position.x - cx;
          const oz = position.z - cz;
          const distance = Math.hypot(ox, oz);
          if (distance >= radius) continue;
          if (distance < 1e-6) {
            // Exactly on the line: step out along its normal.
            const length = Math.sqrt(lengthSq);
            position.x += (-dz / length) * radius;
            position.z += (dx / length) * radius;
          } else {
            position.x = cx + (ox / distance) * radius;
            position.z = cz + (oz / distance) * radius;
          }
        }
        for (const [x, z, r] of circles) {
          const ox = position.x - x;
          const oz = position.z - z;
          const distance = Math.hypot(ox, oz);
          const limit = r + radius;
          if (distance >= limit || distance < 1e-6) continue;
          position.x = x + (ox / distance) * limit;
          position.z = z + (oz / distance) * limit;
        }
      }
    },
  };
}
