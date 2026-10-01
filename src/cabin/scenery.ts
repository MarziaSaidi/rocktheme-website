import {
  Box3,
  Vector2,
  Raycaster,
  CanvasTexture,
  Frustum,
  Matrix4,
  Sphere,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EquirectangularReflectionMapping,
  ExtrudeGeometry,
  Fog,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
  Shape,
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
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { color, mix, normalWorld, smoothstep, texture, uv, vec4 } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { buildFlames } from "./flames";
import { buildMarziaPanel } from "./marziaPanel";
import { MARZIA, type Vec3 } from "./stations";
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
  const focus = new Vector3(3, 0, 1);
  sun.position.copy(focus).addScaledVector(sunDirection, 40);
  sun.target.position.copy(focus);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, {
    left: -17,
    right: 17,
    top: 14,
    bottom: -14,
    near: 10,
    far: 80,
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
  buildCabin(cabin, slab, surface, keep, occluders);

  // ------------------------------------------------------------ interior
  // Kitchen along the north wall, shelves on the west wall.
  const topOf = (object: Object3D) => new Box3().setFromObject(object).max.y;
  const stove = place("electric_stove", [4.62, FLOOR, -3.05], { turn: 0 });
  const sideboard = place("painted_wooden_cabinet", [6.3, FLOOR, -3.08], { turn: 0 });
  const stoveTop = topOf(stove);
  const counter = topOf(sideboard);
  place("pot_enamel_01", [4.5, stoveTop, -3.0]);
  place("brass_pan_01", [4.82, stoveTop, -2.95], { turn: 30 });
  place("wooden_cutting_board", [5.75, counter, -3.0], { turn: 8 });
  place("wooden_spoon", [5.9, counter + 0.03, -2.95], { turn: 70 });
  place("brass_pot_01", [6.65, counter, -3.05]);
  place("metal_jug", [7.0, counter, -3.12]);
  place("wicker_basket_01", [7.65, FLOOR, -2.95]);
  const shelf = place("Shelf_01", [4.32, FLOOR, -1.9], { turn: 90 });
  place("book_encyclopedia_set_01", [4.33, topOf(shelf), -1.9], { turn: 90 });

  // Fire corner: rocking chair and armchair facing the hearth, tea between.
  place("Rockingchair_01", [8.75, FLOOR, -1.55], { turn: 140 });
  place("ArmChair_01", [11.25, FLOOR, -1.15], { turn: -150 });
  buildTeaTable(cabin, keep, surface);
  place("tea_set_01", [9.45, 0.66, -2.4], { turn: 20 });
  place("vintage_electric_kettle", [10.85, 0.51, -3.02], { turn: -20 });
  place("Lantern_01", [10.3, 1.62, -3.1], { turn: 15 });
  place("hatchet", [9.75, FLOOR, -3.15], { turn: 80 });

  // Desk under the east window; the lamp and screen stand on its measured top.
  const desk = place("WoodenTable_01", [11.35, FLOOR, 2.1], { turn: 90 });
  const deskTop = new Box3().setFromObject(desk).max.y;
  place("painted_wooden_chair_01", [10.45, FLOOR, 2.1], { turn: 90 });
  place("desk_lamp_arm_01", [11.68, deskTop, 1.5], { turn: -120 });

  // Porch and outside.
  place("Lantern_01", [7.45, 1.85, 3.78], { interior: false });
  place("wooden_axe", [3.62, FLOOR, 1.75], { turn: 15, interior: false });

  // ------------------------------------------------------------ desk setup
  const monitor = await buildMonitor(keep);
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
    new Vector3(MARZIA.centre[0], MARZIA.height / 2, MARZIA.centre[2]),
    MARZIA.width / 2 + 1.5,
  );
  const frustum = new Frustum();
  const viewProjection = new Matrix4();
  const proxy = new Mesh(keep(new BoxGeometry(MARZIA.width, MARZIA.height, MARZIA.depth)));
  proxy.visible = false;
  proxy.userData.kind = "marzia";
  proxy.position.set(MARZIA.centre[0], MARZIA.height / 2 + 0.18, MARZIA.centre[2]);
  proxy.rotation.y = MARZIA.yaw;
  scene.add(proxy);
  occluders.push(proxy);
  const sign = buildSign(scene, slab, keep);
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
  "Rockingchair_01",
  "ArmChair_01",
  "hatchet",
  "wooden_axe",
  "Lantern_01",
  "WoodenTable_01",
  "desk_lamp_arm_01",
  "painted_wooden_chair_01",
  "book_encyclopedia_set_01",
  "painted_wooden_cabinet",
  "electric_stove",
  "pot_enamel_01",
  "brass_pot_01",
  "brass_pan_01",
  "wooden_cutting_board",
  "wooden_spoon",
  "wicker_basket_01",
  "metal_jug",
  "Shelf_01",
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

/** Calm areas where the snow must be level: the cabin, porch, path, MARZIA. */
const CALM: ReadonlyArray<readonly [number, number, number]> = [
  [8, 0, 9],
  [6.5, 6, 4],
  [MARZIA.centre[0], MARZIA.centre[2], 5],
  [1, 7, 4],
  [-6, 11, 4],
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
  return height * (1 - calmness) - 0.02;
}

/** What a visitor stands on: the cabin floor, the porch deck, or the snow. */
export function groundHeight(x: number, z: number) {
  if (x > X0 && x < X1 && z > Z0 && z < Z1) return FLOOR;
  if (x > 4.5 && x < 8.5 && z >= Z1 && z < 5.5) return 0.18;
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

function buildCabin(
  cabin: Group,
  slab: Slab,
  surface: (role: SurfaceRole, interior?: boolean, tint?: string) => Material,
  keep: <T extends { dispose: () => void }>(item: T) => T,
  occluders: Object3D[],
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

  wall("x", Z1, X0, X1, [
    { from: 5.6, to: 6.6, bottom: 0, top: 2.2 },
    { from: 9, to: 10.4, bottom: 1, top: 2.1 },
  ]);
  wall("x", Z0, X0, X1, [{ from: 5, to: 6.4, bottom: 1.25, top: 2.15 }]);
  wall("z", X0, Z0, Z1, [{ from: -1.1, to: 1.1, bottom: 0.75, top: 2.4 }]);
  wall("z", X1, Z0, Z1, [{ from: 1.3, to: 2.9, bottom: 1.3, top: 2.3 }]);

  // Corner posts where the logs meet.
  for (const [x, z] of [
    [X0, Z0],
    [X1, Z0],
    [X0, Z1],
    [X1, Z1],
  ] as const) {
    slab(cabin, [x - 0.2, 0, z - 0.2], [x + 0.2, WALL + 0.05, z + 0.2], "timber");
  }

  // Gable ends, in logs.
  const RIDGE = 4.9;
  const gable = new Shape();
  gable.moveTo(Z0 - T / 2, 0);
  gable.lineTo(Z1 + T / 2, 0);
  gable.lineTo(0, RIDGE - WALL);
  gable.closePath();
  for (const x of [X0, X1]) {
    const geometry = keep(new ExtrudeGeometry(gable, { depth: T, bevelEnabled: false }));
    const mesh = new Mesh(geometry, surface("walls"));
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x + T / 2, WALL, 0);
    cabin.add(mesh);
    mesh.updateMatrixWorld(true);
    applyWorldUVs(geometry, mesh.matrixWorld, TILE.walls, { swap: true });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    occluders.push(mesh);
  }

  // Roof: shingles with a thick blanket of snow, rounded at the eaves.
  const OVERHANG = 0.6;
  const run = Z1 + OVERHANG;
  const pitch = Math.atan2(RIDGE - WALL, Z1);
  const length = run / Math.cos(pitch);
  for (const side of [-1, 1]) {
    const roof = new Group();
    const shingles = new Mesh(
      keep(new BoxGeometry(X1 - X0 + OVERHANG * 2, 0.16, length)),
      surface("roof"),
    );
    const snow = new Mesh(
      keep(new RoundedBoxGeometry(X1 - X0 + OVERHANG * 2 - 0.08, 0.34, length + 0.06, 3, 0.14)),
      surface("snow", false, "#f7f9fc"),
    );
    snow.position.y = 0.2;
    roof.add(shingles, snow);
    roof.position.set(
      (X0 + X1) / 2,
      RIDGE - (Math.sin(pitch) * length) / 2 + 0.1,
      (side * Math.cos(pitch) * length) / 2,
    );
    roof.rotation.x = side * pitch;
    cabin.add(roof);
    roof.updateMatrixWorld(true);
    applyWorldUVs(shingles.geometry, shingles.matrixWorld, TILE.roof);
    applyWorldUVs(snow.geometry, snow.matrixWorld, TILE.snow);
    for (const mesh of [shingles, snow]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    occluders.push(roof);
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

  // Porch: deck, posts, rail, its own little roof under snow.
  slab(cabin, [4.5, 0, Z1], [8.5, 0.18, 5.5], "timber", { solid: false });
  for (const x of [4.65, 8.35])
    slab(cabin, [x - 0.09, 0.18, 5.26], [x + 0.09, 2.62, 5.44], "timber");
  slab(cabin, [4.5, 0.95, 5.3], [5.6, 1.03, 5.4], "timber", { solid: false });
  slab(cabin, [6.6, 0.95, 5.3], [8.5, 1.03, 5.4], "timber", { solid: false });
  slab(cabin, [4.5, 1.03, 5.29], [5.6, 1.09, 5.41], "snow", { solid: false, tint: "#f7f9fc" });
  slab(cabin, [6.6, 1.03, 5.29], [8.5, 1.09, 5.41], "snow", { solid: false, tint: "#f7f9fc" });
  slab(cabin, [4.35, 2.62, Z1 - 0.1], [8.65, 2.76, 5.7], "roof");
  slab(cabin, [4.4, 2.76, Z1], [8.6, 2.98, 5.65], "snow", { solid: false, tint: "#f7f9fc" });

  // The door, open into the room.
  const door = new Group();
  slab(door, [0, FLOOR, -0.03], [0.96, 2.18, 0.03], "timber", { interior: true });
  door.position.set(5.62, 0, Z1 - 0.12);
  door.rotation.y = MathUtils.degToRad(100);
  cabin.add(door);

  // Chimney outside the north wall, breast and hearth inside.
  slab(cabin, [10.4, 0, -4.25], [11.4, 5.7, -3.6], "stone");
  slab(cabin, [10.32, 5.7, -4.33], [11.48, 5.92, -3.52], "snow", { solid: false, tint: "#f7f9fc" });
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

function buildTeaTable(
  parent: Object3D,
  keep: <T extends { dispose: () => void }>(item: T) => T,
  surface: (role: SurfaceRole, interior?: boolean, tint?: string) => Material,
) {
  const table = new Group();
  const top = new Mesh(keep(new CylinderGeometry(0.42, 0.42, 0.05, 40)), surface("timber", true));
  top.position.y = 0.63;
  const stem = new Mesh(keep(new CylinderGeometry(0.06, 0.08, 0.5, 16)), surface("timber", true));
  stem.position.y = 0.38;
  const foot = new Mesh(keep(new CylinderGeometry(0.26, 0.3, 0.05, 32)), surface("timber", true));
  foot.position.y = FLOOR + 0.02;
  table.add(top, stem, foot);
  table.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  table.position.set(9.45, 0, -2.4);
  parent.add(table);
  return table;
}

async function buildMonitor(keep: <T extends { dispose: () => void }>(item: T) => T) {
  const group = new Group();
  const plastic = keep(
    new MeshStandardMaterial({
      color: "#1d1f22",
      roughness: 0.45,
      metalness: 0.1,
      envMapIntensity: 0.4,
    }),
  );
  const screenImage = await new TextureLoader().loadAsync(
    "/images/projects/quill-and-pigeon/monolith-screen.jpg",
  );
  screenImage.colorSpace = SRGBColorSpace;
  keep(screenImage);
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
    [-16, -12, 1.15, 0.4],
    [-11, -15, 0.95, 2.1],
    [-6, -14, 1.25, 4.2],
    [-19, 4, 1.05, 1.1],
    [-21, -6, 1.35, 5.3],
    [-15, 14, 0.95, 3.3],
    [2, -15, 1.15, 0.9],
    [8.5, -12, 1, 2.5],
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
function buildSign(
  scene: Scene,
  slab: Slab,
  keep: <T extends { dispose: () => void }>(item: T) => T,
) {
  const sign = new Group();
  const half = MARZIA.width / 2 + 0.2;
  const top = MARZIA.height + 0.8;
  for (const x of [-half, half])
    slab(sign, [x - 0.08, -0.4, -0.08], [x + 0.08, top, 0.08], "timber", { solid: false });
  slab(sign, [-half - 0.1, top - 0.1, -0.06], [half + 0.1, top, 0.06], "timber", { solid: false });
  slab(sign, [-1.0, top - 0.66, -0.05], [1.0, top - 0.12, 0.05], "timber", { solid: false });
  slab(sign, [-0.97, top - 0.12, -0.07], [0.97, top - 0.04, 0.07], "snow", {
    solid: false,
    tint: "#f7f9fc",
  });

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
  sign.position.set(MARZIA.centre[0], 0, MARZIA.centre[2]);
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
