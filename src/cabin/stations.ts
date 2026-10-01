/**
 * The cabin's stations: where the camera stands, what it looks at, and how
 * freely the visitor may look around once it arrives.
 *
 * Units are metres. The clearing lies west (−x) of the cabin; the porch and
 * door face south (+z). Eye height is about 1.65 m.
 */
export type Vec3 = readonly [number, number, number];

export type StationId = "arrival" | "marzia" | "porch" | "fire" | "desk" | "kitchen" | "window";

export type Zone = "outside" | "inside";

type StationBase = Readonly<{
  /** "spot" for a place the visitor picked by clicking. */
  id: StationId | "spot";
  label: string;
  /** One line shown under the station name. */
  caption: string;
  zone: Zone;
  /** Where the station's marker floats when seen from elsewhere. */
  anchor: Vec3;
}>;

/** Stand still and look around within limits. */
export type LookStation = StationBase &
  Readonly<{
    mode: "look";
    position: Vec3;
    target: Vec3;
    /** Half-range of free look, in degrees. */
    yawLimit: number;
    pitchLimit: number;
  }>;

/** Circle a subject freely. */
export type OrbitStation = StationBase &
  Readonly<{
    mode: "orbit";
    target: Vec3;
    radius: number;
    /** The subject's front, degrees around the target, 0 = +z. */
    azimuth: number;
    /** Arrival stays within this many degrees of the front. */
    arrivalSpread: number;
    /** Height of the camera above the horizon, degrees. */
    elevation: number;
    elevationRange: readonly [number, number];
  }>;

export type Station = LookStation | OrbitStation;

/** The MARZIA sculpture: centre on the ground, and the direction it faces. */
export const MARZIA = {
  centre: [-3, 0, -1] as Vec3,
  /** Rotation about y, radians. Faces between the arrival path and the cabin. */
  yaw: 0.3,
  width: 5.2,
  height: 1.7,
  depth: 0.35,
} as const;

export const STATIONS: readonly Station[] = [
  {
    id: "arrival",
    label: "Arrival",
    caption: "The edge of the clearing",
    zone: "outside",
    mode: "look",
    position: [-8.5, 1.7, 13],
    target: [0, 1.4, -1],
    anchor: [-8.5, 0.4, 13],
    yawLimit: 60,
    pitchLimit: 18,
  },
  {
    id: "marzia",
    label: "MARZIA",
    caption: "Walk all the way around it",
    zone: "outside",
    mode: "orbit",
    target: [MARZIA.centre[0], 1, MARZIA.centre[2]],
    radius: 4.6,
    azimuth: (MARZIA.yaw * 180) / Math.PI,
    arrivalSpread: 25,
    elevation: 10,
    elevationRange: [3, 34],
    anchor: [MARZIA.centre[0], MARZIA.height + 1.7, MARZIA.centre[2]],
  },
  {
    id: "porch",
    label: "Porch",
    caption: "Snow on the rail, the door ahead",
    zone: "outside",
    mode: "look",
    position: [9.4, 1.7, 10.6],
    target: [6.2, 1.45, 3.6],
    anchor: [7.4, 2.2, 3.7],
    yawLimit: 55,
    pitchLimit: 20,
  },
  {
    id: "fire",
    label: "Fire and tea",
    caption: "The kettle over the fire, a cup by the chair",
    zone: "inside",
    mode: "look",
    position: [8.4, 1.5, 0.9],
    target: [10.7, 0.9, -3],
    anchor: [10.85, 1.9, -2.55],
    yawLimit: 50,
    pitchLimit: 25,
  },
  {
    id: "desk",
    label: "Desk",
    caption: "Where the work happens",
    zone: "inside",
    mode: "look",
    position: [9.7, 1.55, 0.55],
    target: [11.6, 1.0, 2.2],
    anchor: [11.6, 1.55, 2.1],
    yawLimit: 45,
    pitchLimit: 25,
  },
  {
    id: "kitchen",
    label: "Kitchen",
    caption: "Stove, pots, a window over the counter",
    zone: "inside",
    mode: "look",
    position: [7.4, 1.55, -0.6],
    target: [5.3, 1.0, -3.2],
    anchor: [5.4, 1.4, -3.1],
    yawLimit: 50,
    pitchLimit: 25,
  },
  {
    id: "window",
    label: "Window",
    caption: "Looking back out at MARZIA",
    zone: "inside",
    mode: "look",
    position: [7.0, 1.6, 0.3],
    target: [MARZIA.centre[0], 1.1, MARZIA.centre[2]],
    anchor: [4.1, 2.35, 0],
    yawLimit: 40,
    pitchLimit: 15,
  },
];

/** The door, as two points the camera passes through on its way in or out. */
export const DOORWAY = {
  outside: [6.1, 1.65, 5.2] as Vec3,
  inside: [6.1, 1.62, 2.0] as Vec3,
} as const;

export function stationIndex(id: StationId): number {
  return STATIONS.findIndex((station) => station.id === id);
}

export function getStation(id: StationId): Station {
  const station = STATIONS.find((candidate) => candidate.id === id);
  if (!station) throw new Error(`Unknown station: ${id}`);
  return station;
}
