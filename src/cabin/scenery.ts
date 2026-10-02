import {
  Box3,
  Vector2,
  Raycaster,
  CanvasTexture,
  Frustum,
  Matrix4,
  Sphere,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EquirectangularReflectionMapping,
  Euler,
  Fog,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Material,
  type Object3D,
  type PerspectiveCamera,
  type Texture,
} from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { color, mix, normalWorld, smoothstep, texture, uv, vec4 } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { buildCabinExterior, DECK, PIT_CHAIRS } from "./cabinExterior";
import { buildFlames } from "./flames";
import { buildHall, buildHallSign } from "./hall";
import { buildMarziaPanel } from "./marziaPanel";
import { HALL, MARZIA, type Vec3 } from "./stations";
import {
  applyWorldUVs,
  loadSurfaces,
  surfaceMaterial,
  TILE,
  type SurfaceRole,
  type Surfaces,
} from "./surfaces";

/**
 * The winter cabin as a real place: a photographed snowy sky for light and
 * backdrop, Poly Haven scanned props and surfaces, firs with snow on their
 * branches, and MARZIA standing in the clearing: the old site's own effect.
 *
 * Every asset is prepared by `npm run prepare:cabin`.
 */
export type Scenery = Readonly<{
  scene: Scene;
  /** Fir trunks to walk round: [x, z, radius]. */
  trees: ReadonlyArray<readonly [number, number, number]>;
  update: (camera: PerspectiveCamera, ms: number) => void;
  /** The original MARZIA cursor handling; the pointer in device coordinates. */
  marzia: Readonly<{
    pointer: (x: number, y: number, camera: PerspectiveCamera) => void;
    pointerLeave: () => void;
    /** The theme swatch under the pointer, if any. */
    pickTheme: (x: number, y: number, camera: PerspectiveCamera) => MarziaTheme | null;
    setTheme: (theme: MarziaTheme) => void;
    readonly theme: MarziaTheme;
  }>;
  dispose: () => void;
}>;

type Manifest = Readonly<{ sun: Vec3 }>;

const ASSETS = "/assets/cabin";

/**
 * Turns the sky so the sun sits south, slightly west: it then lights the
 * cabin front, the porch and MARZIA's face from the arrival path.
 */
const SKY_TURN = MathUtils.degToRad(-72);

const FLOOR = 0.14;

export type SceneryOptions = Readonly<{
  mobile: boolean;
  maxAnisotropy: number;
}>;

export async function buildScenery({ mobile, maxAnisotropy }: SceneryOptions): Promise<Scenery> {
  const scene = new Scene();
  const disposables = new Set<{ dispose: () => void }>();
  const keep = <T extends { dispose: () => void }>(item: T) => {
    disposables.add(item);
    return item;
  };
  const occluders: Object3D[] = [];

  const gltf = new GLTFLoader();
  gltf.setMeshoptDecoder(MeshoptDecoder);

  const [manifest, surfaces, lighting, backdrop, props] = await Promise.all([
    fetch(`${ASSETS}/manifest.json`).then((response) => response.json() as Promise<Manifest>),
    loadSurfaces(maxAnisotropy),
    new HDRLoader().loadAsync(`${ASSETS}/sky/lighting.hdr`),
    new TextureLoader().loadAsync(`${ASSETS}/sky/backdrop.webp`),
    loadProps(gltf),
  ]);
  surfaces.forEach((set) => Object.values(set).forEach((t: Texture) => keep(t)));

  // ------------------------------------------------------------ sky and sun
  lighting.mapping = EquirectangularReflectionMapping;
  backdrop.mapping = EquirectangularReflectionMapping;
  backdrop.colorSpace = SRGBColorSpace;
  keep(lighting);
  keep(backdrop);
  scene.environment = lighting;
  scene.background = backdrop;
  scene.environmentRotation.y = SKY_TURN;
  scene.backgroundRotation.y = SKY_TURN;
  scene.fog = new Fog("#dfe7ef", 45, 160);

  const sunDirection = new Vector3(...manifest.sun)
    .applyAxisAngle(new Vector3(0, 1, 0), SKY_TURN)
    .normalize();
  const sun = new DirectionalLight("#fff3e2", 3.4);
  const focus = new Vector3(-2, 0, -8);
  sun.position.copy(focus).addScaledVector(sunDirection, 50);
  sun.target.position.copy(focus);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
  Object.assign(sun.shadow.camera, {
    left: -26,
    right: 26,
    top: 24,
    bottom: -24,
    near: 10,
    far: 110,
  });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // ------------------------------------------------------------ helpers
  const materials = new Map<string, Material>();
  const surface = (role: SurfaceRole, interior = false, tint?: string) => {
    const key = `${role}|${interior}|${tint ?? ""}`;
    let found = materials.get(key);
    if (!found) {
      found = keep(surfaceMaterial(surfaces, role, { interior, tint }));
      materials.set(key, found);
    }
    return found;
  };

  /** A world-aligned box with real-scale texture, built from two corners. */
  const slab = (
    parent: Object3D,
    min: Vec3,
    max: Vec3,
    role: SurfaceRole,
    {
      interior = false,
      swap = false,
      solid = true,
      tint,
    }: { interior?: boolean; swap?: boolean; solid?: boolean; tint?: string } = {},
  ) => {
    const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    // Timber grain runs along a post's height rather than across it.
    if (role === "timber" && size[1] > Math.max(size[0], size[2])) swap = !swap;
    const geometry = keep(new BoxGeometry(...size));
    const mesh = new Mesh(geometry, surface(role, interior, tint));
    mesh.position.set(min[0] + size[0] / 2, min[1] + size[1] / 2, min[2] + size[2] / 2);
    parent.add(mesh);
    mesh.updateMatrixWorld(true);
    applyWorldUVs(geometry, mesh.matrixWorld, TILE[role], { swap });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (solid) occluders.push(mesh);
    return mesh;
  };

  const place = (
    id: PropId,
    at: Vec3,
    {
      turn = 0,
      scale = 1,
      interior = true,
    }: { turn?: number; scale?: number; interior?: boolean } = {},
  ) => {
    const object = props.get(id)!.clone(true);
    object.scale.setScalar(scale);
    object.rotation.y = MathUtils.degToRad(turn);
    // Stand the prop on its point: centred in x and z, resting on y.
    const bounds = new Box3().setFromObject(object);
    const centre = bounds.getCenter(new Vector3());
    object.position.set(at[0] - centre.x, at[1] - bounds.min.y, at[2] - centre.z);
    object.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const list = Array.isArray(child.material) ? child.material : [child.material];
        for (const entry of list) {
          if (entry instanceof MeshStandardMaterial) entry.envMapIntensity = interior ? 0.45 : 1;
        }
      }
    });
    object.userData.kind = "prop";
    scene.add(object);
    return object;
  };

  // ------------------------------------------------------------ ground
  const ground = buildTerrain(surfaces, keep);
  ground.userData.kind = "ground";
  scene.add(ground);

  // ------------------------------------------------------------ cabin
  const cabin = new Group();
  cabin.userData.kind = "cabin";
  scene.add(cabin);
  buildCabin(cabin, slab, surface, keep);
  buildCabinExterior({
    cabin,
    box: { X0, X1, Z0, Z1, WALL, T },
    openings: OPENINGS,
    slab,
    surface,
    keep,
    occluders,
    groundAt: groundHeight,
  });

  // ------------------------------------------------------------ steel hall
  scene.add(buildHall(surfaces, keep), await buildHallSign(keep));

  // ------------------------------------------------------------ interior
  // A library: bookcases along the north and west walls, low under the windows.
  const library = buildLibrary(keep);
  scene.add(library);
  place("book_encyclopedia_set_01", [5.7, LOW_SHELF_TOP, -3.18]);

  // Fire corner: a pair of armchairs facing the hearth, an ottoman before one,
  // the tea on a marble table beside them.
  const topOf = (object: Object3D) => new Box3().setFromObject(object).max.y;
  place("modern_arm_chair_01", [8.75, FLOOR, -1.3], { turn: 125 });
  place("Ottoman_01", [9.5, FLOOR, -1.82], { turn: 125 });
  place("modern_arm_chair_01", [11.25, FLOOR, -1.15], { turn: -150 });
  const teaTable = place("coffee_table_round_01", [8.4, FLOOR, -2.5], { scale: 0.7 });
  place("tea_set_01", [8.4, topOf(teaTable), -2.5], { turn: 20, scale: 0.85 });
  place("vintage_electric_kettle", [10.85, 0.51, -3.02], { turn: -20 });
  place("Lantern_01", [10.3, 1.62, -3.1], { turn: 15 });
  place("hatchet", [9.75, FLOOR, -3.15], { turn: 80 });

  // Desk under the east window; the lamp and screen stand on its measured top.
  const deskTop = buildDesk(scene, keep);
  place("dining_chair_02", [10.6, FLOOR, 2.1], { turn: 90 });
  place("desk_lamp_arm_01", [11.68, deskTop, 1.5], { turn: -120 });

  // Outside: chairs round the fire pit, the axe by the log pile.
  for (const [x, z, turn] of PIT_CHAIRS) {
    const chair = place("painted_wooden_chair_01", [x, groundHeight(x, z), z], {
      turn,
      interior: false,
    });
    // Oiled teak rather than white paint.
    chair.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
        child.material = keep(child.material.clone());
        child.material.color.set("#a8784e");
      }
    });
  }
  place("wooden_axe", [3.62, FLOOR, 1.75], { turn: 15, interior: false });

  // ------------------------------------------------------------ desk setup
  const monitor = buildMonitor(keep, maxAnisotropy);
  monitor.position.y = deskTop + 0.343;
  monitor.userData.kind = "prop";
  scene.add(monitor);

  // ------------------------------------------------------------ fire
  const fire = buildFire(cabin, keep, surfaces);

  // ------------------------------------------------------------ firs
  const firs = buildFirs(
    { full: props.get("fir")!, lite: props.get("fir-lite")! },
    mobile,
    keep,
    occluders,
  );
  scene.add(firs.group);

  // ------------------------------------------------------------ MARZIA
  // The old site followed the system theme; a visitor's choice on the sign wins.
  let theme: MarziaTheme =
    readStoredTheme() ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const marzia = buildMarziaPanel({ theme });
  keep(marzia);
  marzia.panel.userData.kind = "marzia";
  scene.add(marzia.panel);
  const marziaBounds = new Sphere(
    new Vector3(MARZIA.centre[0], MARZIA.centre[1] + MARZIA.height / 2, MARZIA.centre[2]),
    MARZIA.width / 2 + 1.5,
  );
  const frustum = new Frustum();
  const viewProjection = new Matrix4();
  const proxy = new Mesh(keep(new BoxGeometry(MARZIA.width, MARZIA.height, MARZIA.depth)));
  proxy.visible = false;
  proxy.userData.kind = "marzia";
  proxy.position.set(
    MARZIA.centre[0],
    MARZIA.centre[1] + MARZIA.height / 2 + 0.18,
    MARZIA.centre[2],
  );
  proxy.rotation.y = MARZIA.yaw;
  scene.add(proxy);
  occluders.push(proxy);
  const sign = buildSign(scene, keep);
  sign.setActive(theme);

  return {
    scene,
    trees: firs.trunks,
    update: (camera, ms) => {
      fire.update(ms / 1000);
      // The particle word only works while it can be seen, as on the old site.
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      if (frustum.intersectsSphere(marziaBounds)) {
        marzia.update(camera, ms);
        // The frame turns with the word, so the posts always stand around it.
        sign.group.rotation.y = marzia.panel.rotation.y;
      }
    },
    marzia: {
      pointer: marzia.pointer,
      pointerLeave: marzia.pointerLeave,
      pickTheme: sign.pick,
      setTheme: (next) => {
        if (next === theme) return;
        theme = next;
        marzia.setTheme(next);
        sign.setActive(next);
        storeTheme(next);
      },
      get theme() {
        return theme;
      },
    },
    dispose: () => {
      disposables.forEach((item) => item.dispose());
      props.forEach((object) => disposeObject(object));
      sun.shadow.map?.dispose();
    },
  };
}

// ------------------------------------------------------------------ props

const PROP_IDS = [
  "vintage_electric_kettle",
  "tea_set_01",
  "Ottoman_01",
  "modern_arm_chair_01",
  "coffee_table_round_01",
  "dining_chair_02",
  "hatchet",
  "wooden_axe",
  "Lantern_01",
  "painted_wooden_chair_01",
  "desk_lamp_arm_01",
  "book_encyclopedia_set_01",
  "fir",
  "fir-lite",
] as const;
type PropId = (typeof PROP_IDS)[number];

async function loadProps(loader: GLTFLoader) {
  const entries = await Promise.all(
    PROP_IDS.map(async (id) => {
      const result = await loader.loadAsync(`${ASSETS}/props/${id}.glb`);
      return [id, result.scene] as const;
    }),
  );
  return new Map<PropId, Object3D>(entries);
}

function disposeObject(root: Object3D) {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const list = Array.isArray(child.material) ? child.material : [child.material];
    for (const entry of list) {
      for (const value of Object.values(entry)) {
        if (value && typeof value === "object" && "isTexture" in value)
          (value as Texture).dispose();
      }
      entry.dispose();
    }
  });
}

// ------------------------------------------------------------------ terrain

/** Calm areas where the snow must be level: the cabin, porch, path, the hall's door. */
const CALM: ReadonlyArray<readonly [number, number, number]> = [
  [8, 0, 9],
  [6.5, 6, 4],
  [-3, HALL.maxZ + 2, 5],
  [1, 7, 4],
  [-6, 11, 4],
  [9.2, 9.1, 3.5],
];

/** The snow's height at a point: the terrain mesh is built from this too. */
export function terrainHeight(x: number, z: number) {
  let height =
    Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 - 0.4) * 0.55 +
    Math.sin(x * 0.27 - z * 0.21) * 0.18 +
    Math.sin(x * 0.6 + z * 0.5) * 0.05;
  // Rise gently towards the edge of the clearing.
  height += Math.max(0, Math.hypot(x - 3, z) - 22) * 0.08;
  let calmness = 0;
  for (const [cx, cz, radius] of CALM) {
    calmness = Math.max(
      calmness,
      1 - MathUtils.smoothstep(Math.hypot(x - cx, z - cz), radius * 0.6, radius),
    );
  }
  // Level under the hall's slab and for a few metres round it.
  const outX = Math.max(HALL.minX - x, 0, x - HALL.maxX);
  const outZ = Math.max(HALL.minZ - z, 0, z - HALL.maxZ);
  calmness = Math.max(calmness, 1 - MathUtils.smoothstep(Math.hypot(outX, outZ), 1, 6));
  return height * (1 - calmness) - 0.02;
}

/** What a visitor stands on: the cabin floor, the deck, or the snow. */
export function groundHeight(x: number, z: number) {
  if (x > X0 && x < X1 && z > Z0 && z < Z1) return FLOOR;
  if (x > DECK.minX && x < DECK.maxX && z >= DECK.minZ && z < DECK.maxZ) return DECK.top;
  if (x > HALL.minX - 0.3 && x < HALL.maxX + 0.3 && z > HALL.minZ - 0.3 && z < HALL.maxZ + 0.3)
    return HALL.floor;
  if (x > HALL.door.from - 0.6 && x < HALL.door.to + 0.6 && z >= HALL.maxZ && z < HALL.maxZ + 2.6)
    return HALL.floor;
  return terrainHeight(x, z);
}

function buildTerrain(surfaces: Surfaces, keep: <T extends { dispose: () => void }>(item: T) => T) {
  const size = 170;
  const segments = 170;
  const geometry = keep(new PlaneGeometry(size, size, segments, segments));
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");

  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)));
  }
  geometry.computeVertexNormals();
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, positions.getX(i) / TILE.snow, positions.getZ(i) / TILE.snow);
  }

  const material = keep(surfaceMaterial(surfaces, "snow"));
  material.color.set("#f7f9fc");
  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

// ------------------------------------------------------------------ cabin

type Slab = (
  parent: Object3D,
  min: Vec3,
  max: Vec3,
  role: SurfaceRole,
  options?: { interior?: boolean; swap?: boolean; solid?: boolean; tint?: string },
) => Mesh;

const X0 = 4;
const X1 = 12;
const Z0 = -3.5;
const Z1 = 3.5;
const WALL = 3;
const T = 0.22;

/** The log walls' openings: doors and windows, cut through both faces. */
const OPENINGS = {
  south: [
    { from: 5.6, to: 6.6, bottom: 0, top: 2.2 },
    { from: 9, to: 10.4, bottom: 1, top: 2.1 },
  ],
  north: [{ from: 5, to: 6.4, bottom: 1.25, top: 2.15 }],
  west: [{ from: -1.1, to: 1.1, bottom: 0.75, top: 2.4 }],
  east: [{ from: 1.3, to: 2.9, bottom: 1.3, top: 2.3 }],
} as const;

function buildCabin(
  cabin: Group,
  slab: Slab,
  surface: (role: SurfaceRole, interior?: boolean, tint?: string) => Material,
  keep: <T extends { dispose: () => void }>(item: T) => T,
) {
  type Opening = Readonly<{ from: number; to: number; bottom: number; top: number }>;

  const glass = keep(
    new MeshStandardMaterial({
      color: "#dfe9f2",
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      envMapIntensity: 1.2,
      depthWrite: false,
    }),
  );

  const wall = (
    axis: "x" | "z",
    fixed: number,
    start: number,
    end: number,
    openings: Opening[],
  ) => {
    const sorted = [...openings].sort((a, b) => a.from - b.from);
    const piece = (a: number, b: number, bottom: number, top: number) => {
      if (b - a < 0.001 || top - bottom < 0.001) return;
      if (axis === "x")
        slab(cabin, [a, bottom, fixed - T / 2], [b, top, fixed + T / 2], "walls", { swap: true });
      else
        slab(cabin, [fixed - T / 2, bottom, a], [fixed + T / 2, top, b], "walls", { swap: true });
    };
    const trim = (min: Vec3, max: Vec3) => slab(cabin, min, max, "timber", { solid: false });
    let cursor = start;
    for (const hole of sorted) {
      piece(cursor, hole.from, 0, WALL);
      piece(hole.from, hole.to, 0, hole.bottom);
      piece(hole.from, hole.to, hole.top, WALL);

      // A timber frame proud of both faces, and glass for windows.
      const d = T / 2 + 0.05;
      const f = 0.09;
      if (axis === "x") {
        trim([hole.from - f, hole.bottom, fixed - d], [hole.from, hole.top + f, fixed + d]);
        trim([hole.to, hole.bottom, fixed - d], [hole.to + f, hole.top + f, fixed + d]);
        trim([hole.from - f, hole.top, fixed - d], [hole.to + f, hole.top + f, fixed + d]);
        if (hole.bottom > 0.05)
          trim(
            [hole.from - f, hole.bottom - 0.06, fixed - d - 0.04],
            [hole.to + f, hole.bottom, fixed + d + 0.04],
          );
      } else {
        trim([fixed - d, hole.bottom, hole.from - f], [fixed + d, hole.top + f, hole.from]);
        trim([fixed - d, hole.bottom, hole.to], [fixed + d, hole.top + f, hole.to + f]);
        trim([fixed - d, hole.top, hole.from - f], [fixed + d, hole.top + f, hole.to + f]);
        if (hole.bottom > 0.05)
          trim(
            [fixed - d - 0.04, hole.bottom - 0.06, hole.from - f],
            [fixed + d + 0.04, hole.bottom, hole.to + f],
          );
      }
      if (hole.bottom > 0.05) {
        const width = hole.to - hole.from;
        const height = hole.top - hole.bottom;
        const pane = new Mesh(keep(new PlaneGeometry(width, height)), glass);
        if (axis === "x") pane.position.set(hole.from + width / 2, hole.bottom + height / 2, fixed);
        else {
          pane.position.set(fixed, hole.bottom + height / 2, hole.from + width / 2);
          pane.rotation.y = Math.PI / 2;
        }
        pane.material.side = DoubleSide;
        // A click on a window walks through it (see world.ts).
        pane.userData.glass = true;
        cabin.add(pane);
        // A mullion, so the window reads as a window from far away.
        if (axis === "x")
          trim(
            [hole.from + width / 2 - 0.025, hole.bottom, fixed - 0.04],
            [hole.from + width / 2 + 0.025, hole.top, fixed + 0.04],
          );
        else
          trim(
            [fixed - 0.04, hole.bottom, hole.from + width / 2 - 0.025],
            [fixed + 0.04, hole.top, hole.from + width / 2 + 0.025],
          );
      }
      cursor = hole.to;
    }
    piece(cursor, end, 0, WALL);
  };

  wall("x", Z1, X0, X1, [...OPENINGS.south]);
  wall("x", Z0, X0, X1, [...OPENINGS.north]);
  wall("z", X0, Z0, Z1, [...OPENINGS.west]);
  wall("z", X1, Z0, Z1, [...OPENINGS.east]);

  // Corner posts where the logs meet: the part inside the room. Outside,
  // the cladding in cabinExterior.ts covers the corners.
  for (const [x, z] of [
    [X0, Z0],
    [X1, Z0],
    [X0, Z1],
    [X1, Z1],
  ] as const) {
    const sx = x === X0 ? 1 : -1;
    const sz = z === Z0 ? 1 : -1;
    const ax = x + sx * (T / 2);
    const bx = x + sx * 0.2;
    const az = z + sz * (T / 2);
    const bz = z + sz * 0.2;
    slab(
      cabin,
      [Math.min(ax, bx), 0, Math.min(az, bz)],
      [Math.max(ax, bx), WALL + 0.05, Math.max(az, bz)],
      "timber",
    );
  }

  // Floor and a ceiling under the roof inside.
  slab(cabin, [X0, 0, Z0], [X1, FLOOR, Z1], "floor", { interior: true });
  slab(cabin, [X0 + T / 2, WALL - 0.02, Z0 + T / 2], [X1 - T / 2, WALL, Z1 - T / 2], "timber", {
    interior: true,
    solid: false,
  });
  for (let x = X0 + 1; x < X1; x += 1.6) {
    slab(cabin, [x - 0.08, WALL - 0.22, Z0], [x + 0.08, WALL - 0.02, Z1], "timber", {
      interior: true,
      solid: false,
    });
  }

  // The door, open into the room.
  const door = new Group();
  slab(door, [0, FLOOR, -0.03], [0.96, 2.18, 0.03], "timber", { interior: true });
  door.position.set(5.62, 0, Z1 - 0.12);
  door.rotation.y = MathUtils.degToRad(100);
  cabin.add(door);

  // The breast and hearth inside; the flue outside is in cabinExterior.ts.
  slab(cabin, [9.9, FLOOR, -3.4], [10.3, 1.5, -2.72], "stone", { interior: true });
  slab(cabin, [11.4, FLOOR, -3.4], [11.8, 1.5, -2.72], "stone", { interior: true });
  slab(cabin, [10.3, 1.0, -3.4], [11.4, 1.5, -2.72], "stone", { interior: true });
  slab(cabin, [10.3, FLOOR, -3.4], [11.4, 1.0, -3.28], "stone", {
    interior: true,
    tint: "#3a3532",
  });
  slab(cabin, [9.75, 1.5, -3.45], [11.95, 1.62, -2.62], "timber", { interior: true });
  slab(cabin, [10.4, 1.62, -3.4], [11.3, WALL, -2.98], "stone", { interior: true });
  slab(cabin, [9.7, FLOOR, -2.72], [12, FLOOR + 0.05, -2.2], "stone", {
    interior: true,
    solid: false,
  });

  // Log pile against the west wall, outside.
  const logGeometry = keep(new CylinderGeometry(0.13, 0.13, 1.1, 14));
  const logMaterial = surface("timber", false, "#9a8370");
  for (let row = 0; row < 3; row++) {
    for (let index = 0; index < 5 - row; index++) {
      const log = new Mesh(logGeometry, logMaterial);
      log.rotation.x = Math.PI / 2;
      log.position.set(3.55, 0.13 + row * 0.24, 2.2 + index * 0.27 + row * 0.13);
      log.castShadow = true;
      log.receiveShadow = true;
      cabin.add(log);
    }
  }
}

/** Pale oak: long fine grain running the length of each board. */
function oakGrain() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  let seed = 5;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  context.fillStyle = "#c49c6f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let k = 0; k < 140; k++) {
    const y = random() * canvas.height;
    const dark = random() > 0.4;
    context.strokeStyle = dark
      ? `rgba(110,72,40,${0.08 + random() * 0.18})`
      : `rgba(240,214,170,${0.08 + random() * 0.12})`;
    context.lineWidth = 0.6 + random() * 2.2;
    context.beginPath();
    const wave = 1 + random() * 3;
    const phase = random() * Math.PI * 2;
    for (let x = 0; x <= canvas.width; x += 16) {
      const dy = Math.sin(x / (120 + wave * 40) + phase) * wave;
      if (x === 0) context.moveTo(x, y + dy);
      else context.lineTo(x, y + dy);
    }
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** A modern desk under the east window: an oak top on black steel sled legs. */
function buildDesk(scene: Scene, keep: <T extends { dispose: () => void }>(item: T) => T) {
  const top = 0.74;
  const [minX, maxX, minZ, maxZ] = [10.95, 11.75, 1.25, 2.95];
  const oak = keep(
    new MeshStandardMaterial({ map: keep(oakGrain()), roughness: 0.55, envMapIntensity: 0.45 }),
  );
  const steel = keep(
    new MeshStandardMaterial({
      color: "#0d0e10",
      roughness: 0.5,
      metalness: 0.4,
      envMapIntensity: 0.45,
    }),
  );
  const desk = new Group();
  desk.userData.kind = "prop";
  const add = (min: Vec3, max: Vec3, material: Material) => {
    const mesh = new Mesh(
      keep(new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])),
      material,
    );
    mesh.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    desk.add(mesh);
  };
  add([minX, top - 0.035, minZ], [maxX, top, maxZ], oak);
  // Each leg a closed loop of flat bar: two posts, a foot and a rail under the top.
  for (const z of [minZ + 0.06, maxZ - 0.06]) {
    for (const x of [minX + 0.06, maxX - 0.06])
      add([x - 0.02, FLOOR, z - 0.02], [x + 0.02, top - 0.035, z + 0.02], steel);
    add([minX + 0.04, FLOOR, z - 0.02], [maxX - 0.04, FLOOR + 0.03, z + 0.02], steel);
    add([minX + 0.04, top - 0.065, z - 0.02], [maxX - 0.04, top - 0.035, z + 0.02], steel);
  }
  scene.add(desk);
  return top;
}

// ------------------------------------------------------------------ library

/** Bookcases: built along a wall, in metres from the wall's own start. */
type Bookcase = Readonly<{
  wall: "north" | "west";
  /** World x (north) or world z (west) the case spans. */
  from: number;
  to: number;
  height: number;
  rows: number;
}>;

const BOOKCASES: readonly Bookcase[] = [
  // North wall: tall left of the window, low under it, a long run to the hearth.
  { wall: "north", from: 4.22, to: 4.88, height: 2.35, rows: 6 },
  { wall: "north", from: 4.92, to: 6.48, height: 1.0, rows: 3 },
  { wall: "north", from: 6.52, to: 9.58, height: 2.35, rows: 6 },
  // West wall: tall either side of the window, low under it.
  { wall: "west", from: -3.02, to: -1.22, height: 2.35, rows: 6 },
  { wall: "west", from: -1.18, to: 1.18, height: 0.52, rows: 2 },
  { wall: "west", from: 1.22, to: 3.28, height: 2.35, rows: 6 },
];

/** The top of the low case under the north window, for what stands on it. */
const LOW_SHELF_TOP = FLOOR + 1.0;

const CASE_DEPTH = 0.34;
const BOARD = 0.025;
const PLINTH = 0.07;
const BAY = 0.95;

const SPINES = [
  "#6b2420",
  "#2f4a35",
  "#22324d",
  "#9a6a2a",
  "#a07a52",
  "#24211f",
  "#4f5a62",
  "#5a1e2e",
  "#d3c6a6",
  "#2c5558",
  "#5a3a26",
  "#5e5a32",
  "#8a5550",
  "#6c7a89",
];

function buildLibrary(keep: <T extends { dispose: () => void }>(item: T) => T) {
  const library = new Group();
  library.userData.kind = "prop";
  let seed = 7;
  const random = () => {
    // mulberry32: the same shelves on every visit.
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (a: number, b: number) => a + (b - a) * random();

  // Every case is built in its wall's frame: x along the wall, y up, z out into the room.
  const frames = {
    north: new Matrix4().makeTranslation(0, 0, Z0 + T / 2 + 0.01),
    west: new Matrix4()
      .makeTranslation(X0 + T / 2 + 0.01, 0, 0)
      .multiply(new Matrix4().makeRotationY(Math.PI / 2)),
  };
  // Open shelving: black steel uprights, oak shelves, the log wall behind.
  const boards = { steel: [] as BufferGeometry[], oak: [] as BufferGeometry[] };
  const corner = new Vector3();
  const board = (frame: Matrix4, min: Vec3, max: Vec3, kind: keyof typeof boards) => {
    const a = corner
      .set(...min)
      .applyMatrix4(frame)
      .clone();
    const b = new Vector3(...max).applyMatrix4(frame);
    const low = a.clone().min(b);
    const size = a.clone().max(b).sub(low);
    const geometry = new BoxGeometry(size.x, size.y, size.z);
    geometry.translate(low.x + size.x / 2, low.y + size.y / 2, low.z + size.z / 2);
    boards[kind].push(geometry);
  };

  const placed: Matrix4[][] = SPINES.map(() => []);
  const turn = new Quaternion();
  const book = (frame: Matrix4, x: number, y: number, z: number, size: Vec3, lean = 0) => {
    turn.setFromEuler(new Euler(0, 0, lean));
    const local = new Matrix4().compose(new Vector3(x, y, z), turn, new Vector3(...size));
    placed[Math.floor(random() * SPINES.length)]!.push(frame.clone().multiply(local));
  };

  /** Fills one shelf, from its left end, in runs of like books. */
  const fillShelf = (frame: Matrix4, left: number, width: number, base: number, clear: number) => {
    const front = CASE_DEPTH - 0.025;
    let x = left + 0.01;
    const end = left + width - 0.01;
    while (x < end - 0.03) {
      const room = end - x;
      const pick = random();
      if (pick < 0.07 && room > 0.3) {
        // A short stack lying flat.
        const length = Math.min(clear * between(0.65, 0.85), 0.27);
        let y = base;
        const count = 2 + Math.floor(random() * 3);
        for (let k = 0; k < count; k++) {
          const t = between(0.025, 0.045);
          const d = between(0.15, 0.2);
          book(
            frame,
            x + length / 2 + between(-0.01, 0.01),
            y + t / 2,
            front - d / 2,
            [t, length, d],
            Math.PI / 2,
          );
          y += t;
        }
        x += length + 0.02;
        continue;
      }
      if (pick < 0.13) {
        x += between(0.03, 0.1);
        continue;
      }
      // A run: a set or a shelf of one kind, close in height.
      const height = clear * between(0.62, 0.9);
      const depth = between(0.15, 0.22);
      const run = 3 + Math.floor(random() * 7);
      for (let k = 0; k < run && x < end - 0.03; k++) {
        const t = Math.min(between(0.022, 0.055), end - x);
        const h = Math.min(height * between(0.94, 1.06), clear - 0.015);
        const d = depth * between(0.95, 1.05);
        book(frame, x + t / 2, base + h / 2, front - d / 2 - between(0, 0.02), [t, h, d]);
        x += t + 0.001;
      }
    }
    // The last book leans into whatever room is left.
    const room = end - x;
    if (room > 0.06) {
      const t = 0.035;
      const h = Math.min(clear * 0.8, clear - 0.04);
      const lean = Math.min(Math.asin(Math.min(1, (room - t) / h)), 0.5);
      const spanX = t * Math.cos(lean) + h * Math.sin(lean);
      const spanY = h * Math.cos(lean) + t * Math.sin(lean);
      book(frame, end - spanX / 2, base + spanY / 2, CASE_DEPTH - 0.12, [t, h, 0.18], lean);
    }
  };

  for (const bookcase of BOOKCASES) {
    const frame = frames[bookcase.wall];
    // West runs along −z in its own frame.
    const [from, to] =
      bookcase.wall === "north" ? [bookcase.from, bookcase.to] : [-bookcase.to, -bookcase.from];
    const top = FLOOR + bookcase.height;
    board(frame, [from, FLOOR, 0], [from + BOARD, top, CASE_DEPTH], "steel");
    board(frame, [to - BOARD, FLOOR, 0], [to, top, CASE_DEPTH], "steel");
    board(frame, [from + BOARD, top - BOARD, 0], [to - BOARD, top, CASE_DEPTH], "oak");
    board(
      frame,
      [from + BOARD, FLOOR, CASE_DEPTH - 0.03],
      [to - BOARD, FLOOR + PLINTH, CASE_DEPTH - 0.015],
      "steel",
    );

    const bays = Math.max(1, Math.ceil((to - from - BOARD * 2) / BAY));
    const bayWidth = (to - from - BOARD * 2 - (bays - 1) * BOARD) / bays;
    for (let k = 1; k < bays; k++) {
      const x = from + BOARD + k * bayWidth + (k - 1) * BOARD;
      board(frame, [x, FLOOR + PLINTH, 0], [x + BOARD, top - BOARD, CASE_DEPTH], "steel");
    }

    const bottom = FLOOR + PLINTH + BOARD;
    const clear = (top - BOARD - bottom - (bookcase.rows - 1) * BOARD) / bookcase.rows;
    board(frame, [from + BOARD, FLOOR + PLINTH, 0], [to - BOARD, bottom, CASE_DEPTH], "oak");
    for (let row = 0; row < bookcase.rows; row++) {
      const base = bottom + row * (clear + BOARD);
      if (row > 0)
        board(frame, [from + BOARD, base - BOARD, 0], [to - BOARD, base, CASE_DEPTH], "oak");
      for (let k = 0; k < bays; k++)
        fillShelf(frame, from + BOARD + k * (bayWidth + BOARD), bayWidth, base, clear);
    }
  }

  // A few being read: a stack on the floor by the rocking chair.
  const floor = new Matrix4()
    .makeTranslation(7.6, 0, -2.6)
    .multiply(new Matrix4().makeRotationY(0.4));
  let y = FLOOR;
  for (let k = 0; k < 4; k++) {
    const t = between(0.03, 0.05);
    const length = between(0.22, 0.28);
    const twist = new Matrix4().makeRotationY(between(-0.25, 0.25));
    book(
      floor.clone().multiply(twist),
      0,
      y + t / 2,
      0,
      [t, length, between(0.16, 0.2)],
      Math.PI / 2,
    );
    y += t;
  }

  const finishes = {
    steel: { color: "#0d0e10", roughness: 0.5, metalness: 0.4 },
    oak: { map: keep(oakGrain()), roughness: 0.6, metalness: 0 },
  } as const;
  for (const kind of ["steel", "oak"] as const) {
    const mesh = new Mesh(
      keep(mergeGeometries(boards[kind])),
      keep(new MeshStandardMaterial({ ...finishes[kind], envMapIntensity: 0.45 })),
    );
    boards[kind].forEach((part) => part.dispose());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    library.add(mesh);
  }

  // One material, one atlas: each spine colour is its own instanced box.
  const atlas = keep(new CanvasTexture(paintSpines()));
  atlas.colorSpace = SRGBColorSpace;
  const material = keep(
    new MeshStandardMaterial({ map: atlas, roughness: 0.82, metalness: 0, envMapIntensity: 0.4 }),
  );
  placed.forEach((matrices, index) => {
    if (matrices.length === 0) return;
    const mesh = new InstancedMesh(keep(spineGeometry(index)), material, matrices.length);
    matrices.forEach((matrix, k) => mesh.setMatrixAt(k, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    library.add(mesh);
  });

  return library;
}

const ATLAS = 1024;
const CELL = 64;
const PAGES_U = (SPINES.length * CELL) / ATLAS;

/** Spines side by side, cloth and leather with gilt bands, then a block of page edges. */
function paintSpines() {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const context = canvas.getContext("2d")!;
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  SPINES.forEach((spine, index) => {
    const x = index * CELL;
    context.fillStyle = spine;
    context.fillRect(x, 0, CELL, ATLAS);
    // Cloth grain.
    for (let k = 0; k < 900; k++) {
      context.fillStyle = random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
      context.fillRect(x + random() * CELL, random() * ATLAS, 1 + random() * 3, 1 + random() * 6);
    }
    // Rounded spine: darker at both edges.
    const shade = context.createLinearGradient(x, 0, x + CELL, 0);
    shade.addColorStop(0, "rgba(0,0,0,0.35)");
    shade.addColorStop(0.3, "rgba(0,0,0,0)");
    shade.addColorStop(0.7, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.35)");
    context.fillStyle = shade;
    context.fillRect(x, 0, CELL, ATLAS);
    const light = index % 3 === 1 ? "rgba(30,24,20,0.7)" : "rgba(214,178,104,0.85)";
    context.fillStyle = light;
    if (index % 2 === 0) {
      for (const y of [70, 92, ATLAS - 92, ATLAS - 70]) context.fillRect(x + 4, y, CELL - 8, 6);
    } else {
      context.fillRect(x + 6, 150, CELL - 12, 170);
      context.fillStyle = spine;
      context.fillRect(x + 10, 156, CELL - 20, 158);
      context.fillStyle = light;
    }
    // A title, as gilt marks down the spine.
    let y = 190;
    for (let k = 0; k < 5 + (index % 4); k++) {
      const size = 14 + random() * 22;
      context.fillRect(x + 22 + random() * 4, y, CELL - 48 + random() * 6, size);
      y += size + 6 + random() * 10;
    }
    context.fillRect(x + 20, ATLAS - 180, CELL - 40, 34);
  });
  // Page edges.
  const pages = SPINES.length * CELL;
  context.fillStyle = "#e6dcc3";
  context.fillRect(pages, 0, ATLAS - pages, ATLAS);
  for (let y = 0; y < ATLAS; y += 3) {
    context.fillStyle = `rgba(120,100,70,${0.08 + random() * 0.1})`;
    context.fillRect(pages, y, ATLAS - pages, 1);
  }
  return canvas;
}

/** A unit book: spine (+z) and covers in colour `index`, the other faces in pages. */
function spineGeometry(index: number) {
  const geometry = new BoxGeometry(1, 1, 1);
  const uvs = geometry.getAttribute("uv");
  const u0 = (index * CELL) / ATLAS;
  const width = CELL / ATLAS;
  // BoxGeometry faces: +x, −x, +y, −y, +z, −z; four vertices each.
  for (let face = 0; face < 6; face++) {
    for (let k = 0; k < 4; k++) {
      const vertex = face * 4 + k;
      const u = uvs.getX(vertex);
      const v = uvs.getY(vertex);
      if (face === 4) uvs.setXY(vertex, u0 + u * width, v);
      else if (face < 2) uvs.setXY(vertex, u0 + width * (0.4 + u * 0.2), 0.45 + v * 0.1);
      else uvs.setXY(vertex, PAGES_U + u * (1 - PAGES_U), v);
    }
  }
  uvs.needsUpdate = true;
  return geometry;
}

// ------------------------------------------------------------------ desk screen

/** Claude Code on the left, Codex on the right: two terminals side by side. */
function paintScreen() {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const c = canvas.getContext("2d")!;
  const mono = (size: number, weight = 400) =>
    `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const text = (value: string, x: number, y: number, fill: string, size = 21, weight = 400) => {
    c.font = mono(size, weight);
    c.fillStyle = fill;
    c.fillText(value, x, y);
  };
  const frame = (x: number, y: number, w: number, h: number, stroke: string) => {
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(x, y, w, h, 10);
    c.stroke();
  };

  // Desktop and window chrome.
  c.fillStyle = "#0d0e10";
  c.fillRect(0, 0, 1600, 900);
  c.fillStyle = "#1c1d21";
  c.fillRect(0, 0, 1600, 44);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((fill, k) => {
    c.fillStyle = fill;
    c.beginPath();
    c.arc(26 + k * 24, 22, 7, 0, Math.PI * 2);
    c.fill();
  });
  text("claude — ~/newsite", 330, 29, "#a9a9ad", 18);
  text("codex — ~/newsite", 1120, 29, "#a9a9ad", 18);
  c.fillStyle = "#2a2b30";
  c.fillRect(799, 44, 2, 856);

  // Claude Code.
  const clay = "#d97757";
  c.fillStyle = "#141413";
  c.fillRect(0, 44, 799, 856);
  frame(24, 66, 750, 140, clay);
  text("✻", 46, 128, clay, 52, 700);
  text("Claude Code", 104, 126, "#f0eee6", 46, 700);
  text("cwd: ~/Projects/newsite", 104, 176, "#8e8c85", 19);
  let y = 250;
  const line = (value: string, fill: string, indent = 30, size = 20) => {
    text(value, indent, y, fill, size);
    y += 34;
  };
  line("> turn the cabin wall into a library", "#b9b7af");
  y += 8;
  line("⏺ Read(src/cabin/scenery.ts)", "#f0eee6");
  line("  ⎿  Read 1051 lines", "#8e8c85");
  line("⏺ Update(src/cabin/scenery.ts)", "#f0eee6");
  c.fillStyle = "rgba(190,70,60,0.22)";
  c.fillRect(70, y - 24, 700, 32);
  line('  ⎿ - place("electric_stove", …)', "#e98a7e");
  c.fillStyle = "rgba(70,160,90,0.22)";
  c.fillRect(70, y - 24, 700, 32);
  line("    + buildLibrary(slab, keep)", "#8fd19e");
  y += 8;
  line("⏺ Shelves are up. The fire and the", "#f0eee6");
  line("  kettle stay where they were.", "#f0eee6");
  frame(24, 760, 750, 60, "#5c5b57");
  text(">", 46, 799, "#b9b7af", 22);
  c.fillStyle = "#f0eee6";
  c.fillRect(72, 780, 12, 26);
  text("? for shortcuts", 30, 860, "#6e6c66", 17);

  // Codex.
  const left = 801;
  c.fillStyle = "#0b0b0c";
  c.fillRect(left, 44, 799, 856);
  frame(left + 24, 66, 750, 140, "#3a3a3f");
  text(">_", left + 46, 126, "#ffffff", 46, 700);
  text("Codex", left + 120, 126, "#ffffff", 46, 700);
  text("directory: ~/Projects/newsite", left + 46, 176, "#8a8a92", 19);
  y = 250;
  const row = (value: string, fill: string, size = 20) => {
    text(value, left + 30, y, fill, size);
    y += 34;
  };
  row("› review the new library shelves", "#c9c9cf");
  y += 8;
  row("• Explored", "#ffffff");
  row("  └ Read scenery.ts, collision.ts", "#8a8a92");
  row("• Ran npx tsc --noEmit", "#ffffff");
  row("  └ (no output)", "#8a8a92");
  y += 8;
  row("• The bookcases clear both windows", "#e6e6ea");
  row("  and the hearth. Looks good to me.", "#e6e6ea");
  c.fillStyle = "#16161a";
  c.fillRect(left + 24, 760, 750, 60);
  text("›", left + 46, 799, "#5fd7ff", 24, 700);
  c.fillStyle = "#e6e6ea";
  c.fillRect(left + 72, 780, 12, 26);
  text("⏎ send   ⌃J newline   ⌃C quit", left + 30, 860, "#5e5e66", 17);
  return canvas;
}

function buildMonitor(keep: <T extends { dispose: () => void }>(item: T) => T, anisotropy: number) {
  const group = new Group();
  const plastic = keep(
    new MeshStandardMaterial({
      color: "#1d1f22",
      roughness: 0.45,
      metalness: 0.1,
      envMapIntensity: 0.4,
    }),
  );
  const screenImage = keep(new CanvasTexture(paintScreen()));
  screenImage.colorSpace = SRGBColorSpace;
  screenImage.anisotropy = anisotropy;
  const screen = keep(
    new MeshStandardMaterial({
      map: screenImage,
      emissiveMap: screenImage,
      emissive: "#ffffff",
      emissiveIntensity: 0.85,
      roughness: 0.2,
      envMapIntensity: 0.3,
    }),
  );
  const bezel = new Mesh(keep(new RoundedBoxGeometry(0.62, 0.38, 0.03, 3, 0.012)), plastic);
  const panel = new Mesh(keep(new PlaneGeometry(0.595, 0.335)), screen);
  panel.position.z = 0.0155;
  const neck = new Mesh(keep(new RoundedBoxGeometry(0.05, 0.2, 0.03, 2, 0.01)), plastic);
  neck.position.set(0, -0.24, -0.04);
  const base = new Mesh(keep(new RoundedBoxGeometry(0.22, 0.015, 0.16, 2, 0.006)), plastic);
  base.position.set(0, -0.335, -0.02);
  const keyboard = new Mesh(keep(new RoundedBoxGeometry(0.4, 0.018, 0.13, 2, 0.006)), plastic);
  keyboard.position.set(0, -0.335, 0.25);
  group.add(bezel, panel, neck, base, keyboard);
  group.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  // Facing into the room from the desk against the east wall.
  group.rotation.y = -Math.PI / 2;
  group.position.set(11.55, 0, 2.15);
  return group;
}

function buildFire(
  cabin: Group,
  keep: <T extends { dispose: () => void }>(item: T) => T,
  surfaces: Surfaces,
) {
  // Charred logs: real bark, burnt dark, with a low ember glow.
  const embers = keep(surfaceMaterial(surfaces, "walls", { interior: true, tint: "#3a2a22" }));
  embers.emissive.set("#ff4a10");
  embers.emissiveIntensity = 0.08;
  const logGeometry = keep(new CylinderGeometry(0.055, 0.065, 0.5, 16));
  for (const [x, z, turn, lift] of [
    [10.85, -3.08, 0.5, 0],
    [10.85, -2.98, -0.55, 0.05],
    [10.85, -3.03, 0.05, 0.1],
  ] as const) {
    const log = new Mesh(logGeometry, embers);
    log.rotation.set(0, turn, Math.PI / 2);
    log.position.set(x, FLOOR + 0.06 + lift, z);
    log.castShadow = true;
    cabin.add(log);
  }

  const flames = buildFlames({ width: 0.62, height: 0.72 });
  keep(flames);
  flames.group.position.set(10.85, FLOOR + 0.05, -3.03);
  cabin.add(flames.group);

  // An iron grate of bars the kettle stands on.
  const iron = keep(
    new MeshStandardMaterial({ color: "#232120", roughness: 0.55, metalness: 0.8 }),
  );
  const bar = keep(new CylinderGeometry(0.008, 0.008, 0.46, 6));
  const rail = keep(new CylinderGeometry(0.01, 0.01, 0.3, 6));
  for (let k = 0; k < 6; k++) {
    const piece = new Mesh(bar, iron);
    piece.rotation.z = Math.PI / 2;
    piece.position.set(10.85, 0.5, -3.15 + k * 0.05);
    cabin.add(piece);
  }
  for (const x of [10.63, 11.07]) {
    const side = new Mesh(rail, iron);
    side.rotation.x = Math.PI / 2;
    side.position.set(x, 0.5, -3.02);
    cabin.add(side);
    for (const z of [-3.15, -2.89]) {
      const leg = new Mesh(bar, iron);
      leg.scale.y = 0.75;
      leg.position.set(x, FLOOR + 0.17, z);
      cabin.add(leg);
    }
  }

  const light = new PointLight("#ff8a3d", 3.2, 7, 2);
  light.position.set(10.85, 0.95, -2.25);
  light.castShadow = false;
  cabin.add(light);
  const glow = new PointLight("#ffb070", 1.6, 5, 2);
  glow.position.set(9.8, 2.2, -1);
  cabin.add(glow);

  return {
    update: (elapsed: number) => {
      // Layered flicker: slow breathing plus faster licks.
      const flicker =
        0.82 +
        Math.sin(elapsed * 1.7) * 0.08 +
        Math.sin(elapsed * 7.3 + 1.2) * 0.06 +
        Math.sin(elapsed * 13.1) * 0.04;
      light.intensity = 3.2 * flicker;
      embers.emissiveIntensity = 0.05 + flicker * 0.06;
    },
  };
}

function buildFirs(
  sources: Readonly<{ full: Object3D; lite: Object3D }>,
  mobile: boolean,
  keep: <T extends { dispose: () => void }>(item: T) => T,
  occluders: Object3D[],
) {
  // Snow settles on every branch that faces up.
  for (const source of [sources.full, sources.lite])
    source.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const original = child.material as MeshStandardMaterial;
      const isTwig = original.name.includes("twig") || original.name.includes("dead");
      const snowy = keep(new MeshStandardNodeMaterial());
      snowy.map = original.map;
      snowy.normalMap = original.normalMap;
      snowy.roughnessMap = original.roughnessMap;
      snowy.aoMap = original.aoMap;
      snowy.roughness = 1;
      snowy.metalness = 0;
      snowy.side = isTwig ? DoubleSide : original.side;
      snowy.alphaTest = isTwig ? 0.45 : 0;
      if (original.map) {
        const base = texture(original.map, uv());
        // Only needles facing straight up hold snow; the rest stay green.
        const settle = smoothstep(isTwig ? 0.55 : 0.6, isTwig ? 0.92 : 0.95, normalWorld.y).mul(
          isTwig ? 0.55 : 0.85,
        );
        snowy.colorNode = vec4(mix(base.rgb, color("#eef3f8"), settle), base.a);
      }
      child.material = snowy;
    });

  const spots: Array<[number, number, number, number]> = [
    [-18, -11, 1.15, 0.4],
    [-17.5, -19, 1.2, 2.1],
    [-8, -27, 1.15, 4.2],
    [-19, 4, 1.05, 1.1],
    [-21, -6, 1.35, 5.3],
    [-15, 14, 0.95, 3.3],
    [3, -27.5, 1.3, 0.9],
    [12, -20, 1.05, 2.5],
    [15, -11, 1.25, 4.8],
    [19, 2, 1.1, 1.7],
    [17, 11, 1.2, 3.9],
    [-3, 18, 0.9, 5.6],
    [11, 16, 1, 0.2],
    [-24, 12, 1.2, 2.8],
    [23, -15, 1.35, 1.4],
  ];
  const used = mobile ? spots.filter((_, index) => index % 2 === 0) : spots;
  const trunks = used.map(([x, z, scale]) => [x, z, 0.45 * scale] as const);
  const group = new Group();
  const bounds = new Box3().setFromObject(sources.full);
  const centre = bounds.getCenter(new Vector3());
  const height = bounds.max.y - bounds.min.y;
  // Normalise to roughly 7.5 m, a young fir.
  const unit = 7.5 / height;
  for (const [x, z, scale, turn] of used) {
    // Trees near the cabin get full detail and cast shadows; the ring beyond is lighter.
    const near = !mobile && Math.hypot(x - 4, z) < 18;
    const tree = (near ? sources.full : sources.lite).clone(true);
    tree.scale.setScalar(unit * scale);
    tree.rotation.y = turn;
    tree.position.set(
      x - centre.x * unit * scale,
      -bounds.min.y * unit * scale - 0.05,
      z - centre.z * unit * scale,
    );
    tree.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = near || mobile;
        child.receiveShadow = true;
        // Clicks test the simple proxy below, not 200k triangles of needles.
        child.raycast = () => {};
      }
    });
    group.add(tree);

    const proxy = new Mesh(keep(new CylinderGeometry(0.25 * scale, 1.3 * scale, 7 * scale, 8)));
    proxy.visible = false;
    proxy.userData.kind = "tree";
    proxy.position.set(x, 3.5 * scale, z);
    group.add(proxy);
    occluders.push(proxy);
  }
  return { group, trunks };
}

export type MarziaTheme = "light" | "dark";

const THEME_KEY = "marzia-saidi:marzia-theme";

function readStoredTheme(): MarziaTheme | null {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function storeTheme(theme: MarziaTheme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Blocked storage only means the choice isn't remembered.
  }
}

/**
 * The wooden frame over MARZIA, with its theme toggle: the interface's
 * LIGHT | DARK pill painted on the board. Either half can be clicked.
 */
function buildSign(scene: Scene, keep: <T extends { dispose: () => void }>(item: T) => T) {
  const sign = new Group();
  const half = MARZIA.width / 2 + 0.2;
  const top = MARZIA.height + 0.8;
  // Black steel, like the hall it stands in.
  const steel = keep(
    new MeshStandardMaterial({ color: "#0d0e10", roughness: 0.5, metalness: 0.4 }),
  );
  const bar = (min: Vec3, max: Vec3) => {
    const geometry = keep(new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]));
    const mesh = new Mesh(geometry, steel);
    mesh.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    mesh.castShadow = true;
    sign.add(mesh);
  };
  for (const x of [-half, half]) {
    bar([x - 0.05, 0, -0.05], [x + 0.05, top, 0.05]);
    bar([x - 0.18, 0, -0.18], [x + 0.18, 0.03, 0.18]);
  }
  bar([-half - 0.05, top - 0.08, -0.05], [half + 0.05, top, 0.05]);
  bar([-1.0, top - 0.66, -0.04], [1.0, top - 0.12, 0.04]);
  for (const x of [-0.8, 0.8]) bar([x - 0.012, top - 0.12, -0.012], [x + 0.012, top - 0.08, 0.012]);

  // The LIGHT | DARK pill from the cabin's interface, painted on the board.
  const pill = document.createElement("canvas");
  pill.width = 1024;
  pill.height = 226;
  const pillTexture = keep(new CanvasTexture(pill));
  pillTexture.colorSpace = SRGBColorSpace;
  pillTexture.anisotropy = 8;
  const pillMaterial = keep(
    new MeshBasicMaterial({ map: pillTexture, transparent: true, toneMapped: false }),
  );
  const pillWidth = 1.6;
  const pillHeight = (pillWidth * pill.height) / pill.width;
  const pillMesh = new Mesh(keep(new PlaneGeometry(pillWidth, pillHeight)), pillMaterial);
  pillMesh.position.set(0, top - 0.42, 0.056);
  sign.add(pillMesh);

  const paintPill = (active: MarziaTheme) => {
    const context = pill.getContext("2d");
    if (!context) return;
    const { width, height } = pill;
    const inset = height * 0.047;
    const radius = height / 2;
    context.clearRect(0, 0, width, height);
    // Track: the interface's aubergine pill.
    context.fillStyle = "#2c2733";
    context.beginPath();
    context.roundRect(0, 0, width, height, radius);
    context.fill();
    // Active half: porcelain.
    const halfWidth = (width - inset * 2) / 2;
    const left = active === "light" ? inset : inset + halfWidth;
    context.fillStyle = "#f4eefa";
    context.beginPath();
    context.roundRect(left, inset, halfWidth, height - inset * 2, radius - inset);
    context.fill();
    // Labels: the interface's mono face, uppercase, tracked out.
    const mono = getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim();
    context.font = `500 ${Math.round(height * 0.3)}px ${mono || "ui-monospace"}, ui-monospace, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    if ("letterSpacing" in context) {
      (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${Math.round(height * 0.3 * 0.12)}px`;
    }
    for (const option of ["light", "dark"] as const) {
      const centre = (option === "light" ? inset : inset + halfWidth) + halfWidth / 2;
      context.fillStyle = option === active ? "#100b18" : "rgba(244, 238, 250, 0.7)";
      context.fillText(option.toUpperCase(), centre, height / 2 + height * 0.02);
    }
    pillTexture.needsUpdate = true;
  };

  sign.userData.kind = "marzia";
  sign.position.set(MARZIA.centre[0], MARZIA.centre[1], MARZIA.centre[2]);
  sign.rotation.y = MARZIA.yaw;
  scene.add(sign);

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  return {
    group: sign,
    setActive: paintPill,
    /** The half of the pill under the pointer, if any. */
    pick: (x: number, y: number, camera: PerspectiveCamera): MarziaTheme | null => {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(pillMesh, false)[0];
      if (!hit?.uv) return null;
      return hit.uv.x < 0.5 ? "light" : "dark";
    },
  };
}
