import {
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PointLight,
  Shape,
  Vector2,
  type Material,
  type Object3D,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

import { buildFlames } from "./flames";
import type { Vec3 } from "./stations";
import { applyWorldUVs, TILE, type SurfaceRole } from "./surfaces";

/**
 * The cabin's outside, modern: charcoal vertical boards over the log walls,
 * black steel frames, a dark clerestory band, warm cedar at the east end, and
 * one shed roof that rises to the south and runs out over a wide deck, its
 * cedar soffit set with downlights. A steel fire pit sits out in the snow.
 *
 * Everything here stands outside the log walls' outer faces, so the room
 * inside looks exactly as it did.
 */

/** The deck along the south front: [minX, maxX, minZ, maxZ], top height. */
export const DECK = { minX: 4, maxX: 12.4, minZ: 3.5, maxZ: 6.5, top: 0.18 } as const;

/** The steel posts carrying the roof's front edge: [x, z]. */
export const ROOF_POSTS: ReadonlyArray<readonly [number, number]> = [
  [4.25, 6.62],
  [12.15, 6.62],
];

/** The fire pit out front, and the chairs round it: [x, z, turn]. */
export const FIRE_PIT: readonly [number, number] = [9.2, 9.1];
export const PIT_CHAIRS: ReadonlyArray<readonly [number, number, number]> = [
  [8.0, 10.2, 132],
  [10.55, 10.05, -128],
  [10.4, 8.0, -40],
];

/** Roof: the underside rises along z from the north eave to the south edge. */
const ROOF_NORTH = -4.4;
const ROOF_SOUTH = 7.05;
const ROOF_LOW = 3.25;
const ROOF_RISE = 0.11;
const ROOF_OVER_X = 0.75;
const ROOF_BODY = 0.3;
const roofUnderside = (z: number) => ROOF_LOW + (z - ROOF_NORTH) * ROOF_RISE;

/** Cladding thickness, and how far the steel frames stand out from the logs. */
const SKIN = 0.04;
const FRAME = 0.1;

type Keep = <T extends { dispose: () => void }>(item: T) => T;
type Slab = (
  parent: Object3D,
  min: Vec3,
  max: Vec3,
  role: SurfaceRole,
  options?: { interior?: boolean; swap?: boolean; solid?: boolean; tint?: string },
) => Mesh;
type Opening = Readonly<{ from: number; to: number; bottom: number; top: number }>;
type Box = Readonly<{ X0: number; X1: number; Z0: number; Z1: number; WALL: number; T: number }>;

export function buildCabinExterior({
  cabin,
  box,
  openings,
  slab,
  surface,
  keep,
  occluders,
  groundAt,
}: {
  cabin: Group;
  box: Box;
  /** The log walls' real openings, which the cladding leaves clear. */
  openings: Readonly<Record<"south" | "north" | "east" | "west", readonly Opening[]>>;
  slab: Slab;
  surface: (role: SurfaceRole, interior?: boolean, tint?: string) => Material;
  keep: Keep;
  occluders: Object3D[];
  groundAt: (x: number, z: number) => number;
}) {
  const { X0, X1, Z0, Z1, T } = box;
  const half = T / 2;

  const steel = keep(
    new MeshStandardMaterial({ color: "#15171a", roughness: 0.42, metalness: 0.55 }),
  );
  const darkGlass = keep(
    new MeshStandardMaterial({
      color: "#24303a",
      roughness: 0.04,
      metalness: 0.6,
      envMapIntensity: 1.3,
    }),
  );
  const siding = surface("timber", false, "#2f3236");
  const cedar = surface("timber", false, "#e2a468");
  const soffit = surface("timber", false, "#d8935a");
  const deckBoards = surface("timber", false, "#9a7a5e");
  const snow = surface("snow", false, "#f7f9fc");

  const shadowed = (mesh: Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  const steelBox = (min: Vec3, max: Vec3, parent: Object3D = cabin) => {
    const mesh = shadowed(
      new Mesh(keep(new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])), steel),
    );
    mesh.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    parent.add(mesh);
    return mesh;
  };
  const glassPanel = (min: Vec3, max: Vec3) => {
    const mesh = new Mesh(
      keep(new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])),
      darkGlass,
    );
    mesh.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    mesh.receiveShadow = true;
    cabin.add(mesh);
    return mesh;
  };

  /**
   * One wall's cladding: a board skin with the given outline and holes,
   * extruded outward from the log face. `along` is the wall's run (x for the
   * south and north walls, −z for east and west so the outline reads left to
   * right from outside); `out` is the outward direction.
   */
  const clad = (
    wall: "south" | "north" | "east" | "west",
    outline: ReadonlyArray<readonly [number, number]>,
    holes: ReadonlyArray<Opening>,
    material: Material,
  ) => {
    const shape = new Shape(outline.map(([u, v]) => new Vector2(u, v)));
    for (const hole of holes) {
      const path = new Path();
      path.moveTo(hole.from, hole.bottom);
      path.lineTo(hole.from, hole.top);
      path.lineTo(hole.to, hole.top);
      path.lineTo(hole.to, hole.bottom);
      path.closePath();
      shape.holes.push(path);
    }
    const geometry = keep(new ExtrudeGeometry(shape, { depth: SKIN, bevelEnabled: false }));
    const mesh = shadowed(new Mesh(geometry, material));
    if (wall === "south") mesh.position.set(0, 0, Z1 + half);
    if (wall === "north") mesh.position.set(0, 0, Z0 - half - SKIN);
    if (wall === "east" || wall === "west") {
      // Shape x runs along world −z; the extrusion then points along +x.
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(wall === "east" ? X1 + half : X0 - half - SKIN, 0, 0);
    }
    cabin.add(mesh);
    mesh.updateMatrixWorld(true);
    // Vertical boards: grain runs up the wall.
    applyWorldUVs(geometry, mesh.matrixWorld, TILE.timber * 0.7, { swap: true });
    occluders.push(mesh);
    return mesh;
  };

  /** A black frame round an opening, standing proud of the boards. */
  const frameX = (z: number, out: 1 | -1, o: Opening, sill: boolean) => {
    const a = z + out * half;
    const b = a + out * (SKIN + FRAME);
    const [n, f] = out > 0 ? [a, b] : [b, a];
    const w = 0.1;
    steelBox([o.from - w, Math.max(o.bottom - (sill ? 0.07 : 0), 0), n], [o.from, o.top + w, f]);
    steelBox([o.to, Math.max(o.bottom - (sill ? 0.07 : 0), 0), n], [o.to + w, o.top + w, f]);
    steelBox([o.from - w, o.top, n], [o.to + w, o.top + w, f]);
    if (sill) steelBox([o.from - w, o.bottom - 0.07, n - 0.04], [o.to + w, o.bottom, f + 0.04]);
  };
  const frameZ = (x: number, out: 1 | -1, o: Opening, sill: boolean) => {
    const a = x + out * half;
    const b = a + out * (SKIN + FRAME);
    const [n, f] = out > 0 ? [a, b] : [b, a];
    const w = 0.1;
    // Openings on the end walls are given in world z.
    steelBox([n, o.bottom - (sill ? 0.07 : 0), o.from - w], [f, o.top + w, o.from]);
    steelBox([n, o.bottom - (sill ? 0.07 : 0), o.to], [f, o.top + w, o.to + w]);
    steelBox([n, o.top, o.from - w], [f, o.top + w, o.to + w]);
    if (sill) steelBox([n - 0.04, o.bottom - 0.07, o.from - w], [f + 0.04, o.bottom, o.to + w]);
  };

  // ---------------------------------------------------------------- south front
  // Charcoal boards, the door and window in full-height steel-framed bays,
  // a band of dark clerestory glass under the roof, cedar at the east end.
  const southTop = roofUnderside(Z1 + half + SKIN) + 0.12;
  const doorBay: Opening = { from: 5.45, to: 6.75, bottom: 0, top: 2.95 };
  const windowBay: Opening = { from: 8.6, to: 10.8, bottom: 0.2, top: 2.95 };
  const clerestory: Opening = { from: X0 + 0.25, to: X1 - 0.25, bottom: 3.08, top: southTop - 0.2 };
  const cedarFrom = 10.95;
  const sx0 = X0 - half - SKIN;
  const sx1 = X1 + half + SKIN;
  clad(
    "south",
    [
      [sx0, 0],
      [cedarFrom, 0],
      [cedarFrom, southTop],
      [sx0, southTop],
    ],
    [doorBay, windowBay, { ...clerestory, to: cedarFrom - 0.12 }],
    siding,
  );
  clad(
    "south",
    [
      [cedarFrom, 0],
      [sx1, 0],
      [sx1, southTop],
      [cedarFrom, southTop],
    ],
    [{ ...clerestory, from: cedarFrom + 0.12 }],
    cedar,
  );

  // The bays: real openings stay open; the rest of each bay is dark glass.
  const glassZ: [number, number] = [Z1 + half + 0.005, Z1 + half + 0.025];
  const [door] = openings.south.filter((o) => o.bottom < 0.05);
  const [sash] = openings.south.filter((o) => o.bottom >= 0.05);
  glassPanel([doorBay.from, door!.top + 0.09, glassZ[0]], [doorBay.to, doorBay.top, glassZ[1]]);
  glassPanel([doorBay.from, 0, glassZ[0]], [door!.from - 0.09, door!.top + 0.09, glassZ[1]]);
  glassPanel([door!.to + 0.09, 0, glassZ[0]], [doorBay.to, door!.top + 0.09, glassZ[1]]);
  glassPanel(
    [windowBay.from, windowBay.bottom, glassZ[0]],
    [windowBay.to, sash!.bottom - 0.07, glassZ[1]],
  );
  glassPanel(
    [windowBay.from, sash!.top + 0.09, glassZ[0]],
    [windowBay.to, windowBay.top, glassZ[1]],
  );
  glassPanel(
    [windowBay.from, sash!.bottom - 0.07, glassZ[0]],
    [sash!.from - 0.09, sash!.top + 0.09, glassZ[1]],
  );
  glassPanel(
    [sash!.to + 0.09, sash!.bottom - 0.07, glassZ[0]],
    [windowBay.to, sash!.top + 0.09, glassZ[1]],
  );
  frameX(Z1, 1, doorBay, false);
  frameX(Z1, 1, windowBay, true);
  // Inner frames round the real openings, so they read as doors and sashes.
  for (const o of [door!, sash!]) {
    const out = Z1 + half;
    const w = 0.09;
    steelBox([o.from - w, o.bottom, out], [o.from, o.top + w, out + 0.11]);
    steelBox([o.to, o.bottom, out], [o.to + w, o.top + w, out + 0.11]);
    steelBox([o.from - w, o.top, out], [o.to + w, o.top + w, out + 0.11]);
    if (o.bottom > 0.05)
      steelBox([o.from - w, o.bottom - 0.07, out], [o.to + w, o.bottom, out + 0.11]);
  }
  // A transom bar across each bay.
  steelBox([doorBay.from, door!.top, glassZ[0]], [doorBay.to, door!.top + 0.09, glassZ[1] + 0.05]);

  // Clerestory: dark glass between slim steel mullions.
  glassPanel(
    [clerestory.from, clerestory.bottom, glassZ[0]],
    [X1 - 0.25, clerestory.top, glassZ[1]],
  );
  frameX(Z1, 1, { ...clerestory, to: X1 - 0.25 }, true);
  const bays = 6;
  for (let k = 1; k < bays; k++) {
    const x = clerestory.from + ((X1 - 0.25 - clerestory.from) * k) / bays;
    steelBox(
      [x - 0.03, clerestory.bottom, glassZ[1]],
      [x + 0.03, clerestory.top, glassZ[1] + 0.06],
    );
  }

  // ---------------------------------------------------------------- north back
  const northTop = roofUnderside(Z0 - half - SKIN) + 0.12;
  clad(
    "north",
    [
      [sx0, 0],
      [sx1, 0],
      [sx1, northTop],
      [sx0, northTop],
    ],
    openings.north,
    siding,
  );
  for (const o of openings.north) frameX(Z0, -1, o, true);

  // ---------------------------------------------------------------- ends
  // Outlines follow the roof's slope; z is negated so the shape reads from outside.
  const end = (wall: "east" | "west", material: Material) => {
    const z0 = Z0 - half - SKIN;
    const z1 = Z1 + half + SKIN;
    clad(
      wall,
      [
        [-z1, 0],
        [-z0, 0],
        [-z0, roofUnderside(z0) + 0.12],
        [-z1, roofUnderside(z1) + 0.12],
      ],
      openings[wall].map((o) => ({ ...o, from: -o.to, to: -o.from })),
      material,
    );
    for (const o of openings[wall])
      frameZ(wall === "east" ? X1 : X0, wall === "east" ? 1 : -1, o, true);
  };
  end("west", siding);
  end("east", cedar);

  // Slim steel angles at the four corners.
  const c = half + SKIN;
  for (const [x, z] of [
    [X0, Z0],
    [X1, Z0],
    [X0, Z1],
    [X1, Z1],
  ] as const) {
    const sx = x === X0 ? -1 : 1;
    const sz = z === Z0 ? -1 : 1;
    const top = roofUnderside(z + sz * c);
    steelBox(
      [
        Math.min(x + sx * c, x + sx * (c + 0.04)),
        0,
        Math.min(z + sz * (c - 0.12), z + sz * (c + 0.04)),
      ],
      [
        Math.max(x + sx * c, x + sx * (c + 0.04)),
        top,
        Math.max(z + sz * (c - 0.12), z + sz * (c + 0.04)),
      ],
    );
    steelBox(
      [
        Math.min(x + sx * (c - 0.12), x + sx * (c + 0.04)),
        0,
        Math.min(z + sz * c, z + sz * (c + 0.04)),
      ],
      [
        Math.max(x + sx * (c - 0.12), x + sx * (c + 0.04)),
        top,
        Math.max(z + sz * c, z + sz * (c + 0.04)),
      ],
    );
  }

  // ---------------------------------------------------------------- shed roof
  // A cedar soffit under a black-edged slab, a thick blanket of snow on top.
  const pitch = Math.atan(ROOF_RISE);
  const run = ROOF_SOUTH - ROOF_NORTH;
  const length = run / Math.cos(pitch);
  const width = X1 - X0 + ROOF_OVER_X * 2;
  const roof = new Group();
  roof.position.set(
    (X0 + X1) / 2,
    roofUnderside((ROOF_NORTH + ROOF_SOUTH) / 2),
    (ROOF_NORTH + ROOF_SOUTH) / 2,
  );
  roof.rotation.x = -pitch;
  const soffitBoard = shadowed(
    new Mesh(keep(new BoxGeometry(width - 0.08, 0.04, length - 0.08)), soffit),
  );
  soffitBoard.position.y = 0.02;
  const body = shadowed(new Mesh(keep(new BoxGeometry(width, ROOF_BODY, length)), steel));
  body.position.y = 0.04 + ROOF_BODY / 2;
  const blanket = shadowed(
    new Mesh(keep(new RoundedBoxGeometry(width - 0.1, 0.32, length - 0.1, 3, 0.14)), snow),
  );
  blanket.position.y = 0.04 + ROOF_BODY + 0.1;
  roof.add(soffitBoard, body, blanket);
  cabin.add(roof);
  roof.updateMatrixWorld(true);
  applyWorldUVs(soffitBoard.geometry, soffitBoard.matrixWorld, TILE.timber * 0.7, { swap: true });
  applyWorldUVs(blanket.geometry, blanket.matrixWorld, TILE.snow);
  occluders.push(roof);

  // Downlights in the soffit over the deck.
  const puck = keep(new CylinderGeometry(0.05, 0.05, 0.015, 16));
  const lit = keep(new MeshBasicMaterial({ color: "#ffe2b0" }));
  for (const z of [4.5, 5.9]) {
    for (let x = X0 + 0.6; x < X1; x += 1.6) {
      const light = new Mesh(puck, lit);
      light.position.set(x, roofUnderside(z) - 0.004, z);
      light.rotation.x = -pitch;
      cabin.add(light);
    }
  }
  const spill = new PointLight("#ffc98a", 2.4, 6.5, 2);
  spill.position.set(7.2, roofUnderside(5.2) - 0.3, 5.2);
  cabin.add(spill);

  // Steel posts carrying the roof's front edge.
  for (const [x, z] of ROOF_POSTS) {
    steelBox([x - 0.06, DECK.top, z - 0.06], [x + 0.06, roofUnderside(z), z + 0.06]);
  }

  // ---------------------------------------------------------------- deck
  slab(cabin, [DECK.minX, 0, DECK.minZ], [DECK.maxX, DECK.top - 0.02, DECK.maxZ], "timber", {
    solid: false,
    tint: "#9a7a5e",
  });
  const boards = shadowed(
    new Mesh(keep(new BoxGeometry(DECK.maxX - DECK.minX, 0.02, DECK.maxZ - DECK.minZ)), deckBoards),
  );
  boards.position.set((DECK.minX + DECK.maxX) / 2, DECK.top - 0.01, (DECK.minZ + DECK.maxZ) / 2);
  cabin.add(boards);
  boards.updateMatrixWorld(true);
  applyWorldUVs(boards.geometry, boards.matrixWorld, TILE.timber, { swap: true });
  // A black fascia round the deck's open edges.
  steelBox([DECK.minX - 0.03, -0.05, DECK.maxZ], [DECK.maxX + 0.03, DECK.top, DECK.maxZ + 0.03]);
  steelBox([DECK.maxX, -0.05, DECK.minZ], [DECK.maxX + 0.03, DECK.top, DECK.maxZ]);
  steelBox([DECK.minX - 0.03, -0.05, Z1 + half], [DECK.minX, DECK.top, DECK.maxZ]);

  // ---------------------------------------------------------------- flue
  // The old stone stack becomes a black steel chimney through the roof.
  steelBox([10.45, 0, -4.2], [11.35, 5.3, -3.65]);
  steelBox([10.38, 5.3, -4.27], [11.42, 5.42, -3.58]);
  slab(cabin, [10.42, 5.42, -4.23], [11.38, 5.52, -3.62], "snow", {
    solid: false,
    tint: "#f7f9fc",
  });

  // ---------------------------------------------------------------- fire pit
  const [px, pz] = FIRE_PIT;
  const base = groundAt(px, pz);
  const bowl = shadowed(
    new Mesh(
      keep(
        new LatheGeometry(
          [
            new Vector2(0.0, 0.18),
            new Vector2(0.32, 0.2),
            new Vector2(0.5, 0.32),
            new Vector2(0.56, 0.44),
            new Vector2(0.53, 0.45),
            new Vector2(0.47, 0.34),
            new Vector2(0.3, 0.25),
            new Vector2(0.0, 0.24),
          ],
          40,
        ),
      ),
      keep(new MeshStandardMaterial({ color: "#2a2420", roughness: 0.7, metalness: 0.7 })),
    ),
  );
  bowl.position.set(px, base, pz);
  cabin.add(bowl);
  for (const turn of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    const leg = steelBox([-0.025, 0, -0.025], [0.025, 0.22, 0.025]);
    leg.position.set(px + Math.cos(turn) * 0.3, base + 0.11, pz + Math.sin(turn) * 0.3);
  }
  const logGeometry = keep(new CylinderGeometry(0.05, 0.055, 0.5, 12));
  const charred = surface("timber", false, "#3a2a22");
  for (const [turn, lift] of [
    [0.4, 0],
    [-0.7, 0.05],
    [1.6, 0.09],
  ] as const) {
    const log = shadowed(new Mesh(logGeometry, charred));
    log.rotation.set(0, turn, Math.PI / 2);
    log.position.set(px, base + 0.3 + lift, pz);
    cabin.add(log);
  }
  const flames = keep(buildFlames({ width: 0.62, height: 0.75 }));
  flames.group.position.set(px, base + 0.3, pz);
  cabin.add(flames.group);
  const glow = new PointLight("#ff8a3d", 2.2, 5, 2);
  glow.position.set(px, base + 0.9, pz);
  cabin.add(glow);
}
