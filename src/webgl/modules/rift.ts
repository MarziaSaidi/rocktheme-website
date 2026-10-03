import {
  Box3,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Plane,
  PointLight,
  Ray,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  type BufferGeometry,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

import { bridgeSize, WORLD_CAPTURE } from "@/cabin/worldCapture";

import { toWorld } from "../core/chapterFrame";
import { smootherstep, type CameraPose } from "../core/cameraJourney";
import type { RiftAnchor, RiftMoment, RiftRect } from "../riftChannel";
import { chapterFrames } from "../sceneConfig";
import { createRiftVapour, type RiftVapour } from "./riftVapour";
import { applyWaterlineContact } from "./rocks";

/**
 * The rift: the way into /my-world.
 *
 * Out on the water to the right of the bio stands a mountain split from
 * peak to waterline, and through the split is another world: a winter day,
 * the Experiment Lab and the cabin. Stones broken off the mountain hang in
 * the air round it, turning slowly, and the daylight from the other side
 * lights the inside of the crack. It is always there while the bio is: the
 * visitor sees at once that there is something beyond, and the bio's own
 * words stream out of it.
 *
 *   on it     the stones draw in towards the opening and the daylight grows;
 *             the page says "Hold to move to the next world"
 *   holding   the stones turn faster and close in, the light swells and the
 *             camera leans in a little; letting go lets it all settle back
 *   held      the camera flies through the opening; the stones scatter past
 *             it, the mountain goes by on either side, and the world beyond
 *             fills the screen at exactly the framing /my-world opens with
 *
 * The world beyond is a capture of the real /my-world (worldCapture.ts),
 * drawn into the exact shape of the mountain's opening, measured offline by
 * scripts/prepare-rift.mjs.
 */
export type Rift = Readonly<{
  setPresence: (presence: number) => void;
  /** The bio camera's resting eye, and whether this is a phone or tablet layout. */
  setViewer: (eye: readonly [number, number, number], compact: boolean) => void;
  /** Screen size in CSS pixels and the renderer's pixel ratio. */
  setViewport: (width: number, height: number, pixelRatio: number) => void;
  update: (
    delta: number,
    input: Readonly<{
      camera: PerspectiveCamera;
      engaged: boolean;
      /** Cursor in client pixels while a mouse is over the page, else null. */
      pointer: { x: number; y: number } | null;
      hold: number;
      /** The camera is resting at the bio. */
      atRest: boolean;
      onMoment: (moment: RiftMoment) => void;
    }>,
  ) => void;
  /** The hold is complete: fly through. */
  cross: () => void;
  crossing: () => boolean;
  /** 0 to 1 once the camera is well on its way; the scene's particles leave with it. */
  departure: () => number;
  /** Moves the camera's pose while held or crossing; returns true while crossing. */
  steer: (pose: CameraPose) => boolean;
  screenRect: (camera: PerspectiveCamera) => RiftRect | null;
  screenAnchor: (camera: PerspectiveCamera) => RiftAnchor | null;
  /** Objects the water should not mirror. */
  reflectionExclusions: () => readonly Object3D[];
  destroy: () => void;
}>;

const ASSETS = "/assets/rift";

/**
 * Composed in the bio's frame: right of the sentence, out on the water,
 * facing the bio camera. Height in metres. A phone sees a narrow slice, so
 * there the mountain stands further out and nearer the middle of its view.
 */
const PLACEMENT = {
  wide: { position: [6.2, 0, -16], height: 10.5, sink: 0.35 },
  compact: { position: [4.9, 0, -31], height: 9.5, sink: 0.35 },
} as const;

/** The point of the capture that shows through the opening: the fire pit and the peak beyond it. */
const WORLD_BEHIND = { x: 0.4, y: 0.33 } as const;

/** Heavier downloads wait until the hero has had the network to itself. */
const LOAD_AFTER_MS = 4500;

/** The crossing, wide and compact, in seconds. */
const CROSSING = {
  wide: { seconds: 2.5, leave: 0.8 },
  compact: { seconds: 2, leave: 0.65 },
} as const;

/**
 * Daylight through the opening, and the light the plume itself sheds on the
 * stone nearest it (at energy 0 and at energy 2). The mountain does not glow;
 * only what passes through it does.
 */
const LIGHT = {
  day: { rest: 7, engaged: 11, hold: 24 },
  plume: { rest: 5, full: 16 },
} as const;

/** The cursor starts to stir the plume this far from the opening, in CSS pixels. */
const NEAR_PX = 380;

const WINDOW_VERTEX = /* glsl */ `
varying vec2 vLocal;
varying float vHeight;
void main() {
  vLocal = position.xy;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vHeight = world.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const WINDOW_FRAGMENT = /* glsl */ `
uniform sampler2D uWorld;
uniform float uHasWorld;
/** Drawing-buffer centre and size of the captured world on screen, in pixels. */
uniform vec4 uFrame;
/** Where the world sits relative to that framing, in pixels; it settles to 0. */
uniform vec2 uShift;
uniform float uPresence;
uniform float uGlow;
uniform float uMirror;
/** The opening's middle and height in its own units, for the water's mirror. */
uniform vec3 uOpening;
uniform vec2 uBehind;
/** 1 while the opening fills the view at the end of the crossing. */
uniform float uFull;
varying vec2 vLocal;
varying float vHeight;

void main() {
  // The water is the opening's floor: nothing of the world below it, until
  // the crossing's last moment when the opening is the whole view.
  if (vHeight < 0.0 && uFull < 0.5) discard;
  vec2 uv = (gl_FragCoord.xy - uFrame.xy - uShift) / uFrame.zw + 0.5;
  if (uMirror > 0.5) {
    // In the water's mirror pass the screen mapping means nothing; the
    // opening shows the same place, framed by its own shape.
    uv = uBehind + vec2(1.0, -1.0) * (vLocal - uOpening.xy) / uOpening.z * vec2(0.22, 0.32);
    uv.y = 1.0 - uv.y;
  }
  vec3 world = uHasWorld > 0.5
    ? texture2D(uWorld, clamp(uv, 0.001, 0.999)).rgb
    : vec3(0.78, 0.85, 0.93);
  // Bright air where the other world's daylight pours through.
  world += vec3(0.85, 0.9, 1.0) * uGlow * 0.12;
  // Its ground melts into lavender mist towards the waterline, so the day
  // beyond never ends in a hard edge against the dark water.
  float low = 1.0 - smoothstep(0.0, 0.9, vHeight);
  world = mix(world, vec3(0.72, 0.68, 0.92), low * 0.75);
  // And it thins away over the last stretch above the water, so the bright
  // world fades into the mist instead of ending on a line.
  float fade = uMirror > 0.5 || uFull > 0.5 ? 1.0 : smoothstep(0.0, 0.7, vHeight);
  gl_FragColor = vec4(world, uPresence * fade);
}
`;

/*
 * The stones: each moved as a rigid body round its own centre (scripts/
 * prepare-rift.mjs gives every vertex its stone's centre and a random
 * number). They hang round the opening, turning slowly, drift in towards it
 * as the visitor engages and holds, and scatter past the camera when it
 * goes through.
 */
const STONE_COMMON = /* glsl */ `
attribute vec4 _chunk;
uniform float uTime;
uniform float uPull;
uniform float uHold;
uniform float uGo;
uniform vec3 uFocus;
uniform vec3 uToward;
/** How much wider than modelled the ring of stones is, and half the opening's width. */
uniform float uSpread;
uniform float uCorridor;

mat3 stoneTurn(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float t = 1.0 - c;
  return mat3(
    t * axis.x * axis.x + c, t * axis.x * axis.y + s * axis.z, t * axis.x * axis.z - s * axis.y,
    t * axis.x * axis.y - s * axis.z, t * axis.y * axis.y + c, t * axis.y * axis.z + s * axis.x,
    t * axis.x * axis.z + s * axis.y, t * axis.y * axis.z - s * axis.x, t * axis.z * axis.z + c
  );
}

mat3 stoneSpin() {
  float r = _chunk.w;
  vec3 axis = normalize(vec3(sin(r * 12.9), cos(r * 7.3), sin(r * 3.1 + 1.0)));
  // Resting in the water they barely turn; holding stirs them, the crossing throws them.
  float rate = 0.01 + uHold * 0.06;
  return stoneTurn(axis, uTime * rate + r * 6.2831 + uGo * uGo * (3.0 + r * 4.0));
}
`;

const STONE_POSITION = /* glsl */ `
  float r = _chunk.w;
  vec3 centre = _chunk.xyz;
  vec3 local = stoneSpin() * ((transformed - centre) * (0.3 + r * 0.4));
  // All of them down at the waterline, in front of the opening and away to
  // the right, at different depths: a scatter of broken rock sitting in the
  // water at the mountain's foot, partly sunk, the nearest the largest.
  float spread = fract(r * 3.71 + 0.13);
  float depth = fract(r * 7.13);
  centre.x = uFocus.x + 0.02 + spread * 0.5 + (depth - 0.5) * 0.06;
  centre.y = 0.075 + fract(r * 5.17) * 0.015 + sin(uTime * 0.4 + r * 21.0) * 0.002;
  centre.z = 0.16 + depth * 0.55;
  local *= 0.8 + depth * 0.5;
  // Resting in the water: they only tremble a little as the hold builds.
  centre.y += sin(uTime * 9.0 + r * 40.0) * 0.0015 * uHold;
  // Thrown outward and past the camera as it goes through.
  vec3 outward = normalize(vec3(centre.xy - uFocus.xy, 0.0) + vec3(0.0001));
  centre += (outward * 0.45 + uToward * 1.2) * uGo * uGo * (0.5 + r);
  transformed = centre + local;
`;

export function createRift(scene: Scene, reducedMotion: boolean): Rift {
  const group = new Group();
  group.name = "rift";
  group.visible = false;
  scene.add(group);

  /** Holds the mountain at model scale (its opening data is in model units). */
  const model = new Group();
  group.add(model);

  let destroyed = false;
  let loaded = false;
  let presence = 0;
  let compactLayout = false;
  let height: number = PLACEMENT.wide.height;
  const viewport = { width: 1, height: 1, ratio: 1 };
  const mountainMaterials: MeshStandardMaterial[] = [];
  const disposables: { dispose: () => void }[] = [];

  // ---------------------------------------------------------------- light
  const daylight = new PointLight(new Color("#e4ecff"), LIGHT.day.rest, 22, 1.4);
  // Small lights inside the vapour, one per lane: only the inner stone close
  // to the substance catches its colour, icier on the left, rosier on the right.
  const plumeLights = [
    { lane: "centre-low", light: new PointLight(new Color("#dfe6ff"), 0, 5, 2) },
    { lane: "centre-high", light: new PointLight(new Color("#c4aaf0"), 0, 5, 2) },
    { lane: "left", light: new PointLight(new Color("#9cc4ff"), 0, 5, 2) },
    { lane: "right", light: new PointLight(new Color("#d9a9ee"), 0, 5, 2) },
  ] as const;
  model.add(daylight, ...plumeLights.map((entry) => entry.light));

  // ---------------------------------------------------------------- the world beyond
  const frameData = new Vector4(0, 0, 1, 1);
  const shift = new Vector2();
  const opening = { centre: new Vector2(0, 0.25), height: 0.5, widest: 0.25 };
  const windowMaterial = new ShaderMaterial({
    uniforms: {
      uWorld: { value: null as Texture | null },
      uHasWorld: { value: 0 },
      uFrame: { value: frameData },
      uShift: { value: shift },
      uPresence: { value: 0 },
      uGlow: { value: 0 },
      uMirror: { value: 0 },
      uOpening: { value: new Vector3(0, 0.25, 0.5) },
      uBehind: { value: new Vector2(WORLD_BEHIND.x, WORLD_BEHIND.y) },
      uFull: { value: 0 },
    },
    vertexShader: WINDOW_VERTEX,
    fragmentShader: WINDOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    // Still drawn if the camera's last step takes it past the opening's plane.
    side: DoubleSide,
  });
  const windowUniforms = windowMaterial.uniforms;
  let windowMesh: Mesh | null = null;
  disposables.push(windowMaterial);

  new TextureLoader().load(WORLD_CAPTURE.src, (texture) => {
    if (destroyed) {
      texture.dispose();
      return;
    }
    // Display values, written unconverted, like the water.
    windowUniforms.uWorld!.value = texture;
    windowUniforms.uHasWorld!.value = 1;
    disposables.push(texture);
  });

  // ---------------------------------------------------------------- stones
  const stoneUniforms = {
    uTime: { value: 0 },
    uPull: { value: 0 },
    uHold: { value: 0 },
    uGo: { value: 0 },
    uFocus: { value: new Vector3() },
    uToward: { value: new Vector3(0, 0, 1) },
    uSpread: { value: 1.75 },
    uCorridor: { value: 0.1 },
  };
  let stones: Mesh | null = null;
  let plume: RiftVapour | null = null;
  /** Points inside the opening, in the mountain's units: the dust's way in and out. */
  const crackPoints: Vector3[] = [];

  // ---------------------------------------------------------------- loading
  const load = async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const [mountainGltf, stonesGltf, outline] = await Promise.all([
      loader.loadAsync(`${ASSETS}/mountain.glb`),
      loader.loadAsync(`${ASSETS}/stones.glb`),
      fetch(`${ASSETS}/opening.json`).then(
        (response) =>
          response.json() as Promise<{
            bounds: { min: [number, number]; max: [number, number] };
            rows: [number, number, number][];
          }>,
      ),
    ]);
    if (destroyed) return;

    // The mountain, lit by the night like every rock, wet at the waterline,
    // a shade towards the night's violet.
    const mountain = mountainGltf.scene;
    mountain.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        material.color.set("#9a90ad");
        material.metalness = 0.04;
        // Tripo's roughness map turns the rock to wet chrome under close
        // light; stone is matte.
        material.roughnessMap = null;
        material.metalnessMap = null;
        material.roughness = 0.86;
        applyWaterlineContact(material);
        mountainMaterials.push(material);
      }
      disposables.push(item.geometry);
    });
    model.add(mountain);

    // The opening, as measured: left edges up, right edges down, a little
    // wider so the rock overlaps it everywhere, and on below the waterline.
    const rows = outline.rows;
    // Where the bio's dust comes from and returns to: inside the opening,
    // across its width, from low down to two-thirds of the way up.
    for (let k = 0; k < 24; k += 1) {
      const t = (k + 0.5) / 24;
      const row = rows[Math.floor(rows.length * (0.08 + t * 0.6))]!;
      const across = ((k * 0.618) % 1) * 0.7 + 0.15;
      crackPoints.push(new Vector3(row[1] + (row[2] - row[1]) * across, row[0], 0.02));
    }
    const grow = 0.012;
    const shape = new Shape();
    shape.moveTo(rows[0]![1] - grow, -0.06);
    for (const [y, left] of rows) shape.lineTo(left - grow, y);
    const top = rows[rows.length - 1]!;
    shape.lineTo((top[1] + top[2]) / 2, top[0] + grow);
    for (let i = rows.length - 1; i >= 0; i -= 1) shape.lineTo(rows[i]![2] + grow, rows[i]![0]);
    shape.lineTo(rows[0]![2] + grow, -0.06);
    const geometry: BufferGeometry = new ShapeGeometry(shape, 1);
    disposables.push(geometry);
    windowMesh = new Mesh(geometry, windowMaterial);
    windowMesh.name = "rift-window";
    windowMesh.renderOrder = 4;
    // In the water's mirror pass the window shows its own framing.
    windowMesh.onBeforeRender = (renderer) => {
      windowUniforms.uMirror!.value = renderer.getRenderTarget() ? 1 : 0;
    };
    model.add(windowMesh);

    // The other world's light escaping through the opening, towards the bio.
    plume = createRiftVapour(rows, compactLayout);
    model.add(plume.group);
    disposables.push(plume);

    // Where the opening is widest and its middle: the camera goes through there.
    let widest = rows[0]!;
    for (const row of rows) if (row[2] - row[1] > widest[2] - widest[1]) widest = row;
    const low = rows[0]![0];
    const high = top[0];
    opening.centre.set((widest[1] + widest[2]) / 2, (low + high) * 0.42);
    opening.height = high - low;
    opening.widest = widest[2] - widest[1];
    (windowUniforms.uOpening!.value as Vector3).set(
      opening.centre.x,
      opening.centre.y,
      opening.height,
    );
    daylight.position.set(opening.centre.x, widest[0], -0.18);

    // The stones, round the opening and in front of it.
    stonesGltf.scene.traverse((item) => {
      if (item instanceof Mesh && !stones) stones = item;
    });
    if (stones) {
      const material = stones.material as MeshStandardMaterial;
      material.color.set("#8f86a3");
      material.roughnessMap = null;
      material.metalnessMap = null;
      material.metalness = 0.04;
      material.roughness = 0.84;
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, stoneUniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${STONE_COMMON}`)
          .replace(
            "#include <beginnormal_vertex>",
            "#include <beginnormal_vertex>\nobjectNormal = stoneSpin() * objectNormal;",
          )
          .replace("#include <begin_vertex>", `#include <begin_vertex>\n${STONE_POSITION}`);
      };
      material.customProgramCacheKey = () => "rift-stones";
      const bounds = new Box3().setFromObject(stones);
      const size = bounds.getSize(new Vector3());
      // The ring of stones a little taller than the mountain, centred on its opening.
      const scale = 0.98 / size.y;
      stones.scale.setScalar(scale);
      stones.position.set(
        opening.centre.x - ((bounds.min.x + bounds.max.x) / 2) * scale,
        -0.06,
        0.1,
      );
      stones.frustumCulled = false;
      stoneUniforms.uCorridor.value = (opening.widest / 2 / scale) * 1.35;
      // The opening's middle, in the stones' own space.
      stoneUniforms.uFocus.value.set(
        (opening.centre.x - stones.position.x) / scale,
        (opening.centre.y - stones.position.y) / scale,
        (0 - stones.position.z) / scale,
      );
      model.add(stones);
      disposables.push(stones.geometry, material);
    }

    loaded = true;
    place();
  };
  const loadTimer = window.setTimeout(() => {
    load().catch((error: unknown) => console.error("Rift failed to load", error));
  }, LOAD_AFTER_MS);

  // ---------------------------------------------------------------- placing it
  const origin = new Vector3();
  const facing = new Vector3(0, 0, 1);
  const eye = new Vector3();

  const place = () => {
    const layout = compactLayout ? PLACEMENT.compact : PLACEMENT.wide;
    height = layout.height;
    const [x, , z] = toWorld(chapterFrames.about, [layout.position[0], 0, layout.position[2]]);
    origin.set(x, -layout.sink, z);
    facing.set(eye.x - x, 0, eye.z - z).normalize();
    group.position.copy(origin);
    group.rotation.set(0, Math.atan2(facing.x, facing.z), 0);
    // The mountain model is 0.82 units tall.
    model.scale.setScalar(height / 0.82);
    // The group faces the camera, so the stones are thrown along their own +z.
    group.updateMatrixWorld(true);
  };

  // ---------------------------------------------------------------- helpers
  const toWorldPoint = (local: Vector2, depth = 0, out = new Vector3()) =>
    model.localToWorld(out.set(local.x, local.y, depth));

  const project = (camera: PerspectiveCamera, point: Vector3) => {
    const projected = point.clone().project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * viewport.width,
      y: (-projected.y * 0.5 + 0.5) * viewport.height,
      behind: projected.z > 1,
    };
  };

  const ray = new Ray();
  const plane = new Plane();
  const ndc = new Vector2();
  const hit = new Vector3();
  /** The cursor on the opening's plane, in the mountain's own units. */
  const onOpeningPlane = (camera: PerspectiveCamera, x: number, y: number) => {
    ndc.set((x / viewport.width) * 2 - 1, -(y / viewport.height) * 2 + 1);
    ray.origin.setFromMatrixPosition(camera.matrixWorld);
    ray.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(ray.origin).normalize();
    const normal = new Vector3(0, 0, 1).transformDirection(model.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal, model.localToWorld(new Vector3(0, 0, 0.1)));
    if (!ray.intersectPlane(plane, hit)) return null;
    return model.worldToLocal(cursorOnPlane.copy(hit));
  };

  // ---------------------------------------------------------------- state
  let elapsed = 0;
  let lastEnergy = 0;
  let engagedness = 0;
  /** The cursor coming near the opening, before it is on it. */
  let nearness = 0;
  const cursorOnPlane = new Vector3();
  let held = 0;
  type Flight = {
    age: number;
    timing: (typeof CROSSING)["wide"] | (typeof CROSSING)["compact"];
    left: boolean;
    handed: boolean;
    eye: Vector3;
    target: Vector3;
    shift: Vector2;
  };
  let flight: Flight | null = null;
  let crossRequested = false;
  const lastPose = { eye: new Vector3(), target: new Vector3() };

  const flightProgress = () => (flight ? Math.min(1, flight.age / flight.timing.seconds) : 0);

  return {
    setPresence: (next) => {
      presence = MathUtils.clamp(next, 0, 1);
    },

    setViewer: (restEye, compact) => {
      eye.set(restEye[0], restEye[1], restEye[2]);
      compactLayout = compact;
      place();
    },

    setViewport: (width, viewportHeight, pixelRatio) => {
      viewport.width = Math.max(1, width);
      viewport.height = Math.max(1, viewportHeight);
      viewport.ratio = pixelRatio;
    },

    update: (delta, input) => {
      elapsed += delta;
      const visible = loaded && (presence > 0.002 || flight !== null);
      group.visible = visible;
      if (!visible) return;
      if (crossRequested && !flight) {
        crossRequested = false;
        flight = {
          age: 0,
          timing: compactLayout ? CROSSING.compact : CROSSING.wide,
          left: false,
          handed: false,
          eye: lastPose.eye.clone(),
          target: lastPose.target.clone(),
          shift: shift.clone(),
        };
      }

      const dt = reducedMotion ? 1 : delta;
      engagedness = MathUtils.damp(
        engagedness,
        input.engaged || flight ? 1 : 0,
        input.engaged ? 4 : 1.6,
        dt,
      );
      held = flight ? 1 : MathUtils.damp(held, input.hold, input.hold > held ? 10 : 3, dt);

      const go = flight ? smootherstep(flightProgress() / 0.9) : 0;
      stoneUniforms.uTime.value = reducedMotion ? 0 : elapsed;
      stoneUniforms.uPull.value = engagedness;
      stoneUniforms.uHold.value = held;
      stoneUniforms.uGo.value = go;
      // Always flowing; stronger and quicker when the visitor is on it, and held.
      // The cursor nearing the opening stirs the plume before the cue shows.
      let cursor: Vector3 | null = null;
      let near = 0;
      if (input.pointer && !flight) {
        const centre = project(input.camera, toWorldPoint(opening.centre));
        const distance = Math.hypot(input.pointer.x - centre.x, input.pointer.y - centre.y);
        near = 1 - smootherstep((distance - 60) / NEAR_PX);
        cursor = onOpeningPlane(input.camera, input.pointer.x, input.pointer.y);
      }
      nearness = MathUtils.damp(nearness, near, near > nearness ? 2.5 : 1.2, dt);
      // 0 at rest; up to 1 near and on it; up to 2 fully held.
      const energy = Math.max(nearness * 0.6, engagedness) + held;
      plume?.update({
        delta: reducedMotion ? 0 : delta,
        time: reducedMotion ? 0 : elapsed,
        energy,
        go,
        cursor,
      });
      lastEnergy = energy;
      if (plume) {
        for (const { lane, light } of plumeLights) {
          light.position.copy(plume.laneLight(lane));
          light.position.z += 0.05;
          light.intensity =
            MathUtils.lerp(LIGHT.plume.rest, LIGHT.plume.full, energy / 2) * (1 - go * 0.6);
        }
      }

      daylight.intensity =
        MathUtils.lerp(LIGHT.day.rest, LIGHT.day.engaged, Math.max(engagedness, nearness * 0.5)) +
        held * (LIGHT.day.hold - LIGHT.day.engaged);

      // The mountain fades with the bio's comings and goings; through the
      // crossing it stays solid.
      const solid = flight ? 1 : presence;
      for (const material of mountainMaterials) {
        material.opacity = solid;
        material.transparent = solid < 0.999;
        material.depthWrite = solid >= 0.999;
      }
      if (stones) {
        const material = stones.material as MeshStandardMaterial;
        material.opacity = solid;
        material.transparent = solid < 0.999;
      }

      // ------------------------------------------------------------ the world beyond
      const size = bridgeSize(viewport.width, viewport.height);
      const progress = flightProgress();
      // At rest the far world is seen whole, small through the gap; crossing,
      // it grows to exactly /my-world's own framing.
      const zoom = MathUtils.lerp(0.42, 1, smootherstep(progress));
      const ratio = viewport.ratio;
      frameData.set(
        (viewport.width * ratio) / 2,
        (viewport.height * ratio) / 2,
        size.width * zoom * ratio,
        size.height * zoom * ratio,
      );
      // At rest the hall and cabin stand in the opening; through the crossing
      // the world slides to exactly /my-world's framing.
      if (!flight) {
        const centre = toWorldPoint(opening.centre).project(input.camera);
        shift.set(
          centre.x * 0.5 * viewport.width - (WORLD_BEHIND.x - 0.5) * size.width * zoom,
          centre.y * 0.5 * viewport.height - (0.5 - WORLD_BEHIND.y) * size.height * zoom,
        );
      }
      const settle = flight ? 1 - smootherstep(progress / 0.85) : 1;
      (windowUniforms.uShift!.value as Vector2)
        .copy(flight ? flight.shift : shift)
        .multiplyScalar(settle * ratio);
      windowUniforms.uPresence!.value = solid;
      windowUniforms.uGlow!.value = engagedness * 0.5 + held * 0.5;

      // The last stretch: the opening is all there is.
      const full = flight ? smootherstep((progress - 0.82) / 0.14) : 0;
      windowUniforms.uFull!.value = full;
      if (windowMesh) {
        windowMesh.scale.setScalar(1 + full * 60);
        windowMaterial.depthTest = full < 0.01;
        windowMesh.renderOrder = full > 0.01 ? 1000 : 4;
      }

      if (flight) {
        flight.age += delta;
        if (!flight.left && flight.age >= flight.timing.leave) {
          flight.left = true;
          input.onMoment("leave");
        }
        if (!flight.handed && progress >= 1) {
          flight.handed = true;
          input.onMoment("handoff");
        }
      }
    },

    cross: () => {
      if (loaded) crossRequested = true;
    },

    crossing: () => flight !== null,

    departure: () => smootherstep((flightProgress() - 0.35) / 0.4),

    steer: (pose) => {
      lastPose.eye.copy(pose.eye);
      lastPose.target.copy(pose.target);
      if (!loaded) return false;
      const centre = toWorldPoint(opening.centre);
      if (!flight) {
        // Holding leans the camera in, a little; letting go eases it back.
        if (held > 0.001) {
          pose.eye.lerp(centre, held * 0.035);
          pose.target.lerp(centre, held * 0.08);
        }
        return false;
      }
      const t = flightProgress();
      // Through the opening where it is widest, a little above its middle.
      const through = toWorldPoint(new Vector2(opening.centre.x, opening.centre.y), 0);
      const outward = facing.clone();
      const distance = flight.eye.distanceTo(through);
      const p0 = flight.eye;
      const p1 = flight.eye
        .clone()
        .lerp(through, 0.45)
        .add(new Vector3(0, 0.25, 0));
      const p2 = through.clone().addScaledVector(outward, distance * 0.16);
      // It ends just short of the opening's plane, the opening all it sees.
      const p3 = through.clone().addScaledVector(outward, 0.25);
      // Gentle at first, still moving as it goes through.
      const s = smootherstep(t * 0.86) / smootherstep(0.86);
      const r = 1 - s;
      pose.eye
        .copy(p0)
        .multiplyScalar(r * r * r)
        .addScaledVector(p1, 3 * r * r * s)
        .addScaledVector(p2, 3 * r * s * s)
        .addScaledVector(p3, s * s * s);
      const beyond = through.clone().addScaledVector(outward, -12);
      pose.target
        .copy(flight.target)
        .lerp(centre, smootherstep(t / 0.35))
        .lerp(beyond, smootherstep((t - 0.3) / 0.6));
      return true;
    },

    screenRect: (camera) => {
      if (!loaded || presence < 0.7 || flight) return null;
      // The opening and a margin of rock round it.
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const half = opening.widest / 2 + 0.06;
      for (const [dx, y] of [
        [-half, -0.02],
        [half, -0.02],
        [-half, opening.centre.y + opening.height * 0.5],
        [half, opening.centre.y + opening.height * 0.5],
        [0, opening.height + 0.03],
      ] as const) {
        const point = project(camera, toWorldPoint(new Vector2(opening.centre.x + dx, y)));
        if (point.behind) return null;
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
      if (maxX < 0 || minX > viewport.width || maxY < 0 || minY > viewport.height) return null;
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },

    screenAnchor: (camera) => {
      if (!loaded || presence < 0.002) return null;
      // The bio's dust comes out of the crack itself, and goes back into it:
      // points spread through the opening, low to high, inside its edges.
      const path: { x: number; y: number }[] = [];
      let sumX = 0;
      let sumY = 0;
      for (const point of crackPoints) {
        const screen = project(camera, model.localToWorld(point.clone()));
        if (screen.behind) continue;
        path.push({ x: screen.x, y: screen.y });
        sumX += screen.x;
        sumY += screen.y;
      }
      if (path.length === 0) return null;
      return {
        x: sumX / path.length,
        y: sumY / path.length,
        width: 60,
        height: 60,
        presence,
        path,
        energy: lastEnergy,
      };
    },

    reflectionExclusions: () => [],

    destroy: () => {
      destroyed = true;
      window.clearTimeout(loadTimer);
      scene.remove(group);
      disposables.forEach((item) => item.dispose());
    },
  };
}
