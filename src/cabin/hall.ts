import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { HALL, type Vec3 } from "./stations";
import { applyWorldUVs, surfaceMaterial, TILE, type Surfaces } from "./surfaces";

/**
 * The steel hall: black I-beam portal frames carrying deep roof trusses,
 * X-braced end bays, full-height glass on three sides and a dark wall at the
 * back for the experiments to stand against. Polished concrete underfoot.
 *
 * All the steel is merged into one mesh, so the frame costs one draw call.
 */

/** Frame lines across the hall: the middle bay is centred on MARZIA. */
export const FRAMES_X = Array.from({ length: 6 }, (_, k) => -13.6 + k * 4.24);
/** Where a column's centre sits inside the glass of the long walls. */
const COLUMN_DEPTH = 0.7;
const COLUMN_FLANGE = 0.4;
const TRUSS_DEPTH = 1.8;
const TOP = HALL.eave + TRUSS_DEPTH;
/** Columns stand clear of the glass and the back wall, never in their plane. */
const WALL_GAP = 0.08;
const FRONT_Z = HALL.maxZ - COLUMN_DEPTH / 2 - WALL_GAP;
const BACK_Z = HALL.minZ + COLUMN_DEPTH / 2 + WALL_GAP;

/** Plinths waiting for future experiments, in the end bays: [x, z]. */
export const PLINTHS: ReadonlyArray<readonly [number, number]> = [
  [(FRAMES_X[0]! + FRAMES_X[1]!) / 2, -16],
  [(FRAMES_X[4]! + FRAMES_X[5]!) / 2, -16],
];
export const PLINTH_SIZE = 2.6;

/** Columns standing proud of the walls, for the collider: [x, z, radius]. */
export const HALL_COLUMNS: ReadonlyArray<readonly [number, number, number]> = FRAMES_X.flatMap(
  (x) => [[x, FRONT_Z, 0.45] as const, [x, BACK_Z, 0.45] as const],
);

type Keep = <T extends { dispose: () => void }>(item: T) => T;

export function buildHall(surfaces: Surfaces, keep: Keep) {
  const hall = new Group();
  hall.userData.kind = "hall";

  const steel = keep(
    new MeshStandardMaterial({
      color: "#0d0e10",
      roughness: 0.5,
      metalness: 0.4,
      envMapIntensity: 0.6,
    }),
  );
  const cladding = keep(
    new MeshStandardMaterial({
      color: "#2a2c30",
      roughness: 0.55,
      metalness: 0.35,
      envMapIntensity: 0.6,
    }),
  );
  const deck = keep(new MeshStandardMaterial({ color: "#d6d9dd", roughness: 0.7, metalness: 0.2 }));
  const glass = keep(
    new MeshStandardMaterial({
      color: "#dfe9f2",
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.08,
      envMapIntensity: 0.55,
      depthWrite: false,
    }),
  );
  const lamp = keep(
    new MeshStandardMaterial({
      color: "#f6f3ff",
      emissive: "#f6f3ff",
      emissiveIntensity: 2.2,
      roughness: 0.5,
    }),
  );

  // ---------------------------------------------------------------- steel
  const parts: BufferGeometry[] = [];
  const box = (min: Vec3, max: Vec3) => {
    const geometry = new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    geometry.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    parts.push(geometry);
  };
  const up = new Vector3(0, 1, 0);
  /** A square member from a to b, for diagonals and bracing. */
  const strut = (a: Vec3, b: Vec3, size: number) => {
    const start = new Vector3(...a);
    const direction = new Vector3(...b).sub(start);
    const length = direction.length();
    const geometry = new BoxGeometry(size, length, size);
    const turn = new Quaternion().setFromUnitVectors(up, direction.clone().normalize());
    geometry.applyMatrix4(
      new Matrix4().compose(start.addScaledVector(direction, 0.5), turn, new Vector3(1, 1, 1)),
    );
    parts.push(geometry);
  };
  /** A vertical I-section: web along `along`, flanges across it. */
  const column = (x: number, z: number, top: number, along: "x" | "z", depth = COLUMN_DEPTH) => {
    const flange = 0.045;
    const half = depth / 2;
    const width = COLUMN_FLANGE / 2;
    const y0 = HALL.floor;
    if (along === "z") {
      box([x - width, y0, z - half], [x + width, top, z - half + flange]);
      box([x - width, y0, z + half - flange], [x + width, top, z + half]);
      box([x - 0.014, y0, z - half], [x + 0.014, top, z + half]);
    } else {
      box([x - half, y0, z - width], [x - half + flange, top, z + width]);
      box([x + half - flange, y0, z - width], [x + half, top, z + width]);
      box([x - half, y0, z - 0.014], [x + half, top, z + 0.014]);
    }
    // A base plate on the slab.
    box([x - 0.38, y0, z - 0.38], [x + 0.38, y0 + 0.04, z + 0.38]);
  };

  // Portal frames: two giant columns and a Warren truss across the hall.
  const panels = 8;
  for (const x of FRAMES_X) {
    column(x, FRONT_Z, TOP, "z");
    column(x, BACK_Z, TOP, "z");
    const chord = 0.16;
    box([x - chord, HALL.eave, BACK_Z], [x + chord, HALL.eave + 0.34, FRONT_Z]);
    box([x - chord, TOP - 0.34, BACK_Z], [x + chord, TOP, FRONT_Z]);
    const step = (FRONT_Z - BACK_Z) / panels;
    for (let k = 0; k <= panels; k++) {
      const z = BACK_Z + k * step;
      box([x - 0.09, HALL.eave + 0.34, z - 0.09], [x + 0.09, TOP - 0.34, z + 0.09]);
      if (k < panels) {
        const low = k % 2 === 0;
        strut(
          [x, low ? HALL.eave + 0.34 : TOP - 0.34, z],
          [x, low ? TOP - 0.34 : HALL.eave + 0.34, z + step],
          0.15,
        );
      }
    }
  }

  // Along the hall: eave ties, purlins on the trusses, a tie on the bottom chords.
  const [first, last] = [FRAMES_X[0]!, FRAMES_X[FRAMES_X.length - 1]!];
  for (const z of [FRONT_Z, BACK_Z]) {
    box([first, HALL.eave - 0.1, z - 0.15], [last, HALL.eave + 0.34, z + 0.15]);
    box([first, TOP - 0.34, z - 0.15], [last, TOP, z + 0.15]);
  }
  const step = (FRONT_Z - BACK_Z) / panels;
  for (let k = 1; k < panels; k++) {
    const z = BACK_Z + k * step;
    // Two centimetres short of the deck, so their tops never share its plane.
    box([HALL.minX + 0.2, TOP, z - 0.08], [HALL.maxX - 0.2, TOP + 0.2, z + 0.08]);
  }
  box([first, HALL.eave, -16.1], [last, HALL.eave + 0.2, -15.9]);

  // X-bracing in both end bays: long walls and roof.
  for (const [a, b] of [
    [FRAMES_X[0]!, FRAMES_X[1]!],
    [FRAMES_X[4]!, FRAMES_X[5]!],
  ] as const) {
    for (const z of [FRONT_Z - 0.3, BACK_Z + 0.3]) {
      strut([a, HALL.floor + 0.3, z], [b, HALL.eave, z], 0.07);
      strut([b, HALL.floor + 0.3, z], [a, HALL.eave, z], 0.07);
    }
    strut([a, TOP + 0.1, BACK_Z], [b, TOP + 0.1, FRONT_Z], 0.06);
    strut([b, TOP + 0.1, BACK_Z], [a, TOP + 0.1, FRONT_Z], 0.06);
  }

  // Side walls: posts to carry the glass between the end frames.
  for (const x of [HALL.minX + 0.25, HALL.maxX - 0.25]) {
    for (const z of [-18.33, -13.67]) column(x, z, TOP, "x", 0.4);
  }

  // Curtain wall: mullions and transoms on the glass line.
  const mullion = (min: Vec3, max: Vec3) => box(min, max);
  const transoms = [3, 6, 9, HALL.eave];
  const runX = (z: number, skip?: { from: number; to: number; height: number }) => {
    for (let x = HALL.minX; x <= HALL.maxX + 1e-3; x += (HALL.maxX - HALL.minX) / 20) {
      const bottom = skip && x > skip.from - 0.05 && x < skip.to + 0.05 ? skip.height : HALL.floor;
      mullion([x - 0.03, bottom, z - 0.06], [x + 0.03, TOP, z + 0.06]);
    }
    for (const y of transoms) {
      if (skip && y < skip.height) {
        mullion([HALL.minX, y - 0.03, z - 0.05], [skip.from, y + 0.03, z + 0.05]);
        mullion([skip.to, y - 0.03, z - 0.05], [HALL.maxX, y + 0.03, z + 0.05]);
      } else mullion([HALL.minX, y - 0.03, z - 0.05], [HALL.maxX, y + 0.03, z + 0.05]);
    }
  };
  const runZ = (x: number) => {
    for (let z = HALL.minZ; z <= HALL.maxZ + 1e-3; z += (HALL.maxZ - HALL.minZ) / 12) {
      mullion([x - 0.06, HALL.floor, z - 0.03], [x + 0.06, TOP, z + 0.03]);
    }
    for (const y of transoms)
      mullion([x - 0.05, y - 0.03, HALL.minZ], [x + 0.05, y + 0.03, HALL.maxZ]);
  };
  runX(HALL.maxZ, HALL.door);
  runZ(HALL.minX);
  runZ(HALL.maxX);
  // A deep header over the entrance, and a canopy hung from the frame.
  box(
    [HALL.door.from - 0.3, HALL.door.height, HALL.maxZ - 0.12],
    [HALL.door.to + 0.3, HALL.door.height + 0.3, HALL.maxZ + 0.12],
  );
  box(
    [HALL.door.from - 0.6, HALL.door.height + 0.3, HALL.maxZ],
    [HALL.door.to + 0.6, HALL.door.height + 0.48, HALL.maxZ + 2.4],
  );
  for (const x of [HALL.door.from - 0.4, HALL.door.to + 0.4])
    strut(
      [x, HALL.door.height + 0.48, HALL.maxZ + 2.3],
      [x, HALL.door.height + 3.2, HALL.maxZ],
      0.05,
    );

  // Fascia: a black band round the roof edge.
  const fascia = [TOP + 0.22, TOP + 0.95] as const;
  box([HALL.minX - 0.4, fascia[0], HALL.maxZ], [HALL.maxX + 0.4, fascia[1], HALL.maxZ + 0.4]);
  box([HALL.minX - 0.4, fascia[0], HALL.minZ - 0.4], [HALL.maxX + 0.4, fascia[1], HALL.minZ]);
  box([HALL.minX - 0.4, fascia[0], HALL.minZ], [HALL.minX, fascia[1], HALL.maxZ]);
  box([HALL.maxX, fascia[0], HALL.minZ], [HALL.maxX + 0.4, fascia[1], HALL.maxZ]);

  const frame = new Mesh(keep(mergeGeometries(parts)), steel);
  parts.forEach((part) => part.dispose());
  frame.castShadow = true;
  frame.receiveShadow = true;
  hall.add(frame);

  // ---------------------------------------------------------------- back wall
  // Standing-seam cladding, dark, so the experiments read against it.
  const seams: BufferGeometry[] = [];
  const wall = new BoxGeometry(HALL.maxX - HALL.minX, TOP + 0.22 - HALL.floor, 0.14);
  wall.translate((HALL.minX + HALL.maxX) / 2, (TOP + 0.22 + HALL.floor) / 2, HALL.minZ - 0.07);
  seams.push(wall);
  for (let x = HALL.minX + 0.3; x < HALL.maxX; x += 0.5) {
    const seam = new BoxGeometry(0.03, TOP + 0.22 - HALL.floor, 0.05);
    seam.translate(x, (TOP + 0.22 + HALL.floor) / 2, HALL.minZ + 0.025);
    seams.push(seam);
  }
  const back = new Mesh(keep(mergeGeometries(seams)), cladding);
  seams.forEach((part) => part.dispose());
  back.castShadow = true;
  back.receiveShadow = true;
  hall.add(back);

  // ---------------------------------------------------------------- glass
  const pane = (width: number, height: number, at: Vec3, turn: number) => {
    const mesh = new Mesh(keep(new PlaneGeometry(width, height)), glass);
    mesh.position.set(...at);
    mesh.rotation.y = turn;
    mesh.userData.hallGlass = true;
    mesh.renderOrder = 2;
    hall.add(mesh);
  };
  const height = TOP - HALL.floor;
  const midY = HALL.floor + height / 2;
  const { door } = HALL;
  pane(door.from - HALL.minX, height, [(HALL.minX + door.from) / 2, midY, HALL.maxZ], 0);
  pane(HALL.maxX - door.to, height, [(door.to + HALL.maxX) / 2, midY, HALL.maxZ], 0);
  pane(
    door.to - door.from,
    TOP - door.height - 0.3,
    [(door.from + door.to) / 2, (TOP + door.height + 0.3) / 2, HALL.maxZ],
    0,
  );
  pane(HALL.maxZ - HALL.minZ, height, [HALL.minX, midY, (HALL.minZ + HALL.maxZ) / 2], Math.PI / 2);
  pane(HALL.maxZ - HALL.minZ, height, [HALL.maxX, midY, (HALL.minZ + HALL.maxZ) / 2], Math.PI / 2);

  // ---------------------------------------------------------------- roof
  // The deck stops just inside the fascia, so their outer faces don't meet.
  const span = HALL.maxX - HALL.minX + 0.76;
  const roofDeck = new Mesh(keep(new BoxGeometry(span, 0.12, HALL.maxZ - HALL.minZ + 0.76)), deck);
  roofDeck.position.set((HALL.minX + HALL.maxX) / 2, TOP + 0.28, (HALL.minZ + HALL.maxZ) / 2);
  roofDeck.castShadow = true;
  roofDeck.receiveShadow = true;
  hall.add(roofDeck);
  const snow = new Mesh(
    keep(new RoundedBoxGeometry(span - 0.9, 0.36, HALL.maxZ - HALL.minZ - 0.1, 3, 0.15)),
    surfaceMaterial(surfaces, "snow", { tint: "#f7f9fc" }),
  );
  keep(snow.material as MeshStandardMaterial);
  snow.position.set(roofDeck.position.x, TOP + 0.5, roofDeck.position.z);
  snow.updateMatrixWorld(true);
  applyWorldUVs(snow.geometry, snow.matrixWorld, TILE.snow);
  snow.castShadow = true;
  hall.add(snow);
  // The canopy carries its own snow.
  const canopySnow = new Mesh(
    keep(new RoundedBoxGeometry(door.to - door.from + 0.9, 0.2, 2.2, 3, 0.08)),
    snow.material,
  );
  canopySnow.position.set((door.from + door.to) / 2, door.height + 0.56, HALL.maxZ + 1.25);
  hall.add(canopySnow);

  // ---------------------------------------------------------------- floor
  const concrete = keep(paintConcrete());
  const floorMaterial = keep(
    new MeshStandardMaterial({
      map: concrete,
      roughness: 0.22,
      metalness: 0,
      envMapIntensity: 0.7,
    }),
  );
  const slab = new Mesh(
    keep(
      new BoxGeometry(HALL.maxX - HALL.minX + 0.6, HALL.floor + 0.3, HALL.maxZ - HALL.minZ + 0.6),
    ),
    floorMaterial,
  );
  slab.position.set(
    (HALL.minX + HALL.maxX) / 2,
    (HALL.floor - 0.3) / 2,
    (HALL.minZ + HALL.maxZ) / 2,
  );
  slab.updateMatrixWorld(true);
  applyWorldUVs(slab.geometry, slab.matrixWorld, 8.48);
  slab.receiveShadow = true;
  slab.userData.kind = "ground";
  hall.add(slab);
  // An apron in front of the entrance.
  const apron = new Mesh(
    keep(new BoxGeometry(door.to - door.from + 1.2, HALL.floor + 0.3, 2.6)),
    floorMaterial,
  );
  apron.position.set((door.from + door.to) / 2, (HALL.floor - 0.3) / 2 - 0.001, HALL.maxZ + 1.3);
  apron.updateMatrixWorld(true);
  applyWorldUVs(apron.geometry, apron.matrixWorld, 8.48);
  apron.receiveShadow = true;
  apron.userData.kind = "ground";
  hall.add(apron);

  // ---------------------------------------------------------------- empty bays
  const plinthMaterial = keep(
    new MeshStandardMaterial({ color: "#c9c9cc", roughness: 0.62, metalness: 0 }),
  );
  for (const [x, z] of PLINTHS) {
    const plinth = new Mesh(keep(new BoxGeometry(PLINTH_SIZE, 0.36, PLINTH_SIZE)), plinthMaterial);
    plinth.position.set(x, HALL.floor + 0.18 + 0.02, z);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    plinth.userData.kind = "prop";
    hall.add(plinth);
    // A thin line of light where it floats off the floor.
    const glow = new Mesh(
      keep(new BoxGeometry(PLINTH_SIZE - 0.08, 0.02, PLINTH_SIZE - 0.08)),
      lamp,
    );
    glow.position.set(x, HALL.floor + 0.012, z);
    hall.add(glow);
  }

  // ---------------------------------------------------------------- lights
  // Linear pendants hung from the bottom chords, one per bay, two rows.
  const lights: BufferGeometry[] = [];
  const cables: BufferGeometry[] = [];
  for (let k = 0; k < FRAMES_X.length - 1; k++) {
    const x = (FRAMES_X[k]! + FRAMES_X[k + 1]!) / 2;
    for (const z of [-19.5, -12.5]) {
      const bar = new BoxGeometry(2.6, 0.06, 0.12);
      bar.translate(x, 8.6, z);
      lights.push(bar);
      for (const end of [-1.1, 1.1]) {
        const cable = new BoxGeometry(0.012, HALL.eave - 8.6, 0.012);
        cable.translate(x + end, (HALL.eave + 8.6) / 2, z);
        cables.push(cable);
      }
    }
  }
  hall.add(new Mesh(keep(mergeGeometries(lights)), lamp));
  hall.add(new Mesh(keep(mergeGeometries(cables)), steel));
  lights.forEach((part) => part.dispose());
  cables.forEach((part) => part.dispose());

  return hall;
}

const SIGN_TEXT = "EXPERIMENT LAB";
/** Cap height of the letters, metres. */
const SIGN_HEIGHT = 2.4;
/** The letters' depth, built from stacked cut-outs. */
const SIGN_DEPTH = 0.26;
const SIGN_LAYERS = 14;

/**
 * Rooftop letters over the entrance, in the site's display face: porcelain
 * fronts with a soft glow, dark returns, on a black steel frame behind.
 */
export async function buildHallSign(keep: Keep) {
  const sign = new Group();
  sign.userData.kind = "hall";

  // The display face next/font loaded for the page, under its own family name.
  const family =
    getComputedStyle(document.body).getPropertyValue("--font-anton").trim() || "Impact";
  const size = 400;
  const font = `400 ${size}px ${family}, "Arial Narrow", sans-serif`;
  await document.fonts.load(font, SIGN_TEXT).catch(() => []);

  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d")!;
  measure.font = font;
  const metrics = measure.measureText(SIGN_TEXT);
  const tracking = size * 0.05;
  const capTop = metrics.actualBoundingBoxAscent;
  const pad = size * 0.08;
  canvas.width = Math.ceil(metrics.width + tracking * (SIGN_TEXT.length - 1) + pad * 2);
  canvas.height = Math.ceil(capTop + pad * 2);
  const context = canvas.getContext("2d")!;
  context.font = font;
  context.fillStyle = "#ffffff";
  context.textBaseline = "alphabetic";
  if ("letterSpacing" in context) {
    (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${tracking}px`;
  }
  context.fillText(SIGN_TEXT, pad, pad + capTop);

  // White letters on nothing: the alpha map cuts every layer to their shape.
  const cut = keep(new CanvasTexture(canvas));
  cut.anisotropy = 8;
  const height = SIGN_HEIGHT * (canvas.height / capTop);
  const width = height * (canvas.width / canvas.height);

  const face = keep(
    new MeshStandardMaterial({
      color: "#f4eefa",
      emissive: "#f4eefa",
      emissiveIntensity: 0.45,
      alphaMap: cut,
      alphaTest: 0.5,
      roughness: 0.4,
    }),
  );
  const returns = keep(
    new MeshStandardMaterial({
      color: "#1c1724",
      alphaMap: cut,
      alphaTest: 0.5,
      roughness: 0.55,
      metalness: 0.3,
      side: DoubleSide,
    }),
  );

  // Standing on the front edge, clear above the fascia, so it reads from the ground.
  const front = HALL.maxZ + 0.3;
  const base = TOP + 1.35;
  const centreX = (HALL.door.from + HALL.door.to) / 2;
  const centreY = base + SIGN_HEIGHT / 2;
  const plane = new PlaneGeometry(width, height);
  const lettersFront = new Mesh(keep(plane), face);
  lettersFront.position.set(centreX, centreY, front);
  sign.add(lettersFront);
  const layers: BufferGeometry[] = [];
  for (let k = 1; k <= SIGN_LAYERS; k++) {
    const layer = new PlaneGeometry(width, height);
    layer.translate(centreX, centreY, front - (k / SIGN_LAYERS) * SIGN_DEPTH);
    layers.push(layer);
  }
  sign.add(new Mesh(keep(mergeGeometries(layers)), returns));
  layers.forEach((layer) => layer.dispose());

  // The frame: posts standing on the deck, two rails, kickers back to the roof.
  const steel = keep(
    new MeshStandardMaterial({ color: "#0d0e10", roughness: 0.5, metalness: 0.4 }),
  );
  const parts: BufferGeometry[] = [];
  const box = (min: Vec3, max: Vec3) => {
    const geometry = new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    geometry.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    parts.push(geometry);
  };
  const up = new Vector3(0, 1, 0);
  const strut = (a: Vec3, b: Vec3, thickness: number) => {
    const start = new Vector3(...a);
    const direction = new Vector3(...b).sub(start);
    const geometry = new BoxGeometry(thickness, direction.length(), thickness);
    geometry.applyMatrix4(
      new Matrix4().compose(
        start.addScaledVector(direction, 0.5),
        new Quaternion().setFromUnitVectors(up, direction.clone().normalize()),
        new Vector3(1, 1, 1),
      ),
    );
    parts.push(geometry);
  };
  const rail = front - SIGN_DEPTH - 0.12;
  const deck = TOP + 0.34;
  const left = centreX - width / 2 + 0.3;
  const right = centreX + width / 2 - 0.3;
  const posts = Math.max(2, Math.round((right - left) / 1.6) + 1);
  for (let k = 0; k < posts; k++) {
    const x = left + ((right - left) * k) / (posts - 1);
    box([x - 0.07, deck, rail - 0.07], [x + 0.07, base + SIGN_HEIGHT + 0.1, rail + 0.07]);
    strut([x, base + SIGN_HEIGHT * 0.7, rail - 0.05], [x, deck, rail - 2.4], 0.08);
  }
  for (const y of [base + 0.25, base + SIGN_HEIGHT - 0.25])
    box([left - 0.1, y - 0.06, rail - 0.06], [right + 0.1, y + 0.06, rail + 0.06]);
  const frame = new Mesh(keep(mergeGeometries(parts)), steel);
  parts.forEach((part) => part.dispose());
  frame.castShadow = true;
  frame.receiveShadow = true;
  sign.add(frame);

  return sign;
}

/** Polished concrete: mottled grey, fine aggregate, saw-cut joints. */
function paintConcrete() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  let seed = 3;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  context.fillStyle = "#7c7e81";
  context.fillRect(0, 0, size, size);
  // Clouds of slightly lighter and darker trowelling.
  for (let k = 0; k < 260; k++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 30 + random() * 160;
    const light = random() > 0.5;
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, light ? "rgba(255,255,255,0.05)" : "rgba(30,30,34,0.06)");
    cloud.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = cloud;
    // Drawn three times over so the clouds wrap across the tile edges.
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        context.save();
        context.translate(dx, dy);
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        context.restore();
      }
  }
  for (let k = 0; k < 9000; k++) {
    context.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(20,20,24,0.08)";
    context.fillRect(random() * size, random() * size, 1 + random() * 1.5, 1 + random() * 1.5);
  }
  // Saw cuts on a half-tile grid.
  context.fillStyle = "rgba(40,40,44,0.55)";
  for (const at of [0, size / 2]) {
    context.fillRect(at, 0, 2, size);
    context.fillRect(0, at, size, 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
