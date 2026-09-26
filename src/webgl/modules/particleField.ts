import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
} from "three";

import { emitSoundEvent, soundEventsIdle } from "@/sound/soundEvents";

import { createCurlField } from "../core/noise";
import { particleConfig, sceneColors } from "../sceneConfig";
import type { ParticleConfig } from "../sceneTypes";
import { applyPointerInfluence, type PointerInfluenceResult } from "./pointerInfluence";

/**
 * Particle field.
 *
 * Simulated in screen space, in CSS pixels, and drawn with an orthographic
 * camera. Screen space is deliberate: every distance in the creative direction
 * is a pixel distance, and obstacle avoidance works against DOM rectangles
 * measured in the same units, so nothing has to be unprojected.
 *
 * Obstacles arrive as plain rectangles. This module has no idea that they are
 * typography or project planes, which is what keeps portfolio content out of
 * the scene code.
 *
 * Two shapes share the one simulation. A stream follows a centreline across
 * the screen. A trail (`config.trail`) flows along fixed strands whose control
 * points are pinned to named anchor rectangles: the strands stay put and each
 * particle travels along one, so the river holds still while the water moves.
 * Where a strand crosses the page's content, some of its particles are drawn
 * front: the WebGL pass skips them and `drawFront` paints them onto a 2D canvas
 * the page stacks above its content. The rest stay behind, so the trail passes
 * through the type rather than over or under it.
 */

/** A screen-space rectangle the field should flow around. */
export type ObstacleRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

/** Named screen rectangles a trail is composed against. */
export type AnchorRects = Readonly<Record<string, ObstacleRect>>;

export type ParticleFieldOptions = Readonly<{
  count: number;
  width: number;
  height: number;
  /** Renderer pixel ratio. Point sizes are specified in device pixels. */
  pixelRatio: number;
  reducedMotion: boolean;
  config?: ParticleConfig;
}>;

export type ParticlePointerState = Readonly<{
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  active: boolean;
}>;

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aGold;

  varying float vAlpha;
  varying float vGold;

  void main() {
    vAlpha = aAlpha;
    vGold = aGold;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = aSize;
  }
`;

/** Shared with the Selected Work display dust, so both are the same specks. */
export const POINT_FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform vec3 uBotanical;
  uniform vec3 uGold;

  varying float vAlpha;
  varying float vGold;

  void main() {
    // Round, soft-edged point. No texture upload for a shape this simple.
    vec2 offset = gl_PointCoord - vec2(0.5);
    float radius = length(offset);
    if (radius > 0.5) discard;

    float falloff = smoothstep(0.5, 0.06, radius);
    vec3 tint = mix(uBotanical, uGold, vGold);
    gl_FragColor = vec4(tint * 2.2, falloff * vAlpha);
  }
`;

export type ParticleField = Readonly<{
  scene: Scene;
  camera: OrthographicCamera;
  update: (deltaSeconds: number, elapsedSeconds: number, pointer: ParticlePointerState) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  setObstacles: (obstacles: readonly ObstacleRect[]) => void;
  /**
   * Rectangle the field should gather around, or null to release. The field is
   * given geometry only; it never learns what the rectangle contains.
   */
  setFocus: (rect: ObstacleRect | null) => void;
  setConfig: (config: ParticleConfig) => void;
  /** Rectangles a trail's control points are pinned to, keyed by anchor name. */
  setAnchors: (anchors: AnchorRects) => void;
  /** True while there are front particles that could be on screen. */
  frontVisible: () => boolean;
  /**
   * Paints the front particles onto a 2D context whose origin sits at
   * (offsetX, offsetY) in viewport CSS pixels. Clears it first. Returns
   * whether anything was drawn.
   */
  drawFront: (
    context: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    viewWidth: number,
    viewHeight: number,
  ) => boolean;
  setCount: (count: number) => void;
  /** Number of particles currently recovering from a disturbance. */
  disturbedCount: () => number;
  destroy: () => void;
}>;

export function createParticleField(options: ParticleFieldOptions): ParticleField {
  const curl = createCurlField();
  const scene = new Scene();

  let width = options.width;
  let height = options.height;
  let config = options.config ?? particleConfig;
  /** The stream's overall presence, eased toward `config.presence`. */
  let presence = config.presence ?? 1;
  /** The quality tier's count; the config may scale it. */
  let baseCount = options.count;
  const wantedCount = () => {
    const scaled = Math.round(baseCount * (config.trail?.countScale ?? 1));
    return options.reducedMotion
      ? Math.round(scaled * config.density.reducedMotionFactor)
      : scaled;
  };
  let capacity = wantedCount();
  let active = capacity;
  let obstacles: readonly ObstacleRect[] = [];
  let anchors: AnchorRects = {};
  /** 0 to 1 after a reseed, so a new shape fades in over a second or so. */
  let reveal = 1;
  let focus: ObstacleRect | null = null;
  /** Eased 0 to 1 so the gathering builds and releases rather than snapping. */
  let focusAmount = 0;
  /** Point sizes are written in device pixels, so the field needs the DPR. */
  let pixelRatio = options.pixelRatio;

  const camera = new OrthographicCamera(0, width, 0, height, -1000, 1000);

  // Simulation state lives in plain typed arrays, never in React.
  let posX = new Float32Array(capacity);
  let posY = new Float32Array(capacity);
  let posZ = new Float32Array(capacity);
  let velX = new Float32Array(capacity);
  let velY = new Float32Array(capacity);
  let laneOffset = new Float32Array(capacity);
  let branchIndex = new Uint8Array(capacity);
  let pointAlpha = new Float32Array(capacity);
  let generation = new Uint32Array(capacity);
  let recovery = new Float32Array(capacity);
  let goldTimer = new Float32Array(capacity);
  // Trail state: strand, progress along it, offset across it, and wobble.
  let strand = new Uint8Array(capacity);
  let progress = new Float32Array(capacity);
  let lateral = new Float32Array(capacity);
  let speed = new Float32Array(capacity);
  let wobblePhase = new Float32Array(capacity);
  let wobbleRate = new Float32Array(capacity);
  let escaped = new Uint8Array(capacity);
  let age = new Float32Array(capacity);
  let life = new Float32Array(capacity);
  let frontRoll = new Float32Array(capacity);
  let front = new Uint8Array(capacity);
  let placed = new Uint8Array(capacity);
  let endFade = new Float32Array(capacity);
  let dispX = new Float32Array(capacity);
  let dispY = new Float32Array(capacity);
  let frontAlphas = new Float32Array(capacity);

  let positions = new Float32Array(capacity * 3);
  let sizes = new Float32Array(capacity);
  let alphas = new Float32Array(capacity);
  let golds = new Float32Array(capacity);

  const geometry = new BufferGeometry();
  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: POINT_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uBotanical: { value: new Color(sceneColors.botanical) },
      uGold: { value: new Color(sceneColors.gold) },
    },
  });

  /*
   * The front specks are drawn in 2D, so they get the same round, soft point
   * as a sprite: a brighter core falling off into the tint.
   */
  const makeSprite = (hex: number): HTMLCanvasElement | OffscreenCanvas => {
    const tint = new Color(hex);
    const r = Math.round(tint.r * 255);
    const g = Math.round(tint.g * 255);
    const b = Math.round(tint.b * 255);
    // Less lifted than the WebGL point: over light type a near-white core
    // would vanish, and the tint is what breaks the letterforms.
    const core = new Color(hex).multiplyScalar(1.35);
    const cr = Math.min(255, Math.round(core.r * 255));
    const cg = Math.min(255, Math.round(core.g * 255));
    const cb = Math.min(255, Math.round(core.b * 255));
    const size = 32;
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(size, size)
        : Object.assign(document.createElement("canvas"), { width: size, height: size });
    const context = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (context) {
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      // A tight falloff: the specks should read as sharp points, not glows.
      gradient.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
      gradient.addColorStop(0.45, `rgba(${r},${g},${b},0.95)`);
      gradient.addColorStop(0.7, `rgba(${r},${g},${b},0.3)`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    }
    return canvas;
  };
  let spriteCache: ReturnType<typeof makeSprite> | null = null;
  let goldSpriteCache: ReturnType<typeof makeSprite> | null = null;
  const spriteFor = (gold: boolean) => {
    if (gold) return (goldSpriteCache ??= makeSprite(sceneColors.gold));
    return (spriteCache ??= makeSprite(sceneColors.botanical));
  };

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const randomFor = (index: number, channel: number): number => {
    let value =
      (config.seed ^
        Math.imul(index + 1, 0x9e3779b1) ^
        Math.imul(generation[index]! + 1, 0x85ebca6b) ^
        Math.imul(channel + 1, 0xc2b2ae35)) >>>
      0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  };

  const smooth = (value: number): number => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };

  /** Smooth, non-repeating centreline through the configured landscape points. */
  const centreAt = (u: number, lane: number): number => {
    const knots = config.path;
    let segment = 0;
    while (segment < knots.length - 2 && u > knots[segment + 1]![0]) segment += 1;
    const left = knots[segment]!;
    const right = knots[segment + 1]!;
    const span = right[0] - left[0];
    const t = Math.max(0, Math.min(1, (u - left[0]) / span));
    const before = knots[Math.max(0, segment - 1)]!;
    const after = knots[Math.min(knots.length - 1, segment + 2)]!;
    const m0 = ((right[1] - before[1]) / (right[0] - before[0])) * span;
    const m1 = ((after[1] - left[1]) / (after[0] - left[0])) * span;
    const t2 = t * t;
    const t3 = t2 * t;
    let y =
      (2 * t3 - 3 * t2 + 1) * left[1] +
      (t3 - 2 * t2 + t) * m0 +
      (-2 * t3 + 3 * t2) * right[1] +
      (t3 - t2) * m1;

    if (lane > 0) {
      const branch = config.branches[lane - 1]!;
      const split = smooth((u - branch.split) / 0.15);
      const merge = smooth((branch.merge - u) / 0.17);
      y += branch.offset * split * merge;
    }
    return y;
  };

  const desiredY = (index: number, x: number): number =>
    (centreAt(x / Math.max(1, width), branchIndex[index]!) + laneOffset[index]!) * height;

  const spawn = (index: number, acrossFullWidth: boolean) => {
    const branchPick = randomFor(index, 0);
    let boundary = 1;
    branchIndex[index] = 0;
    for (let lane = 0; lane < config.branches.length; lane += 1) {
      boundary -= config.branches[lane]!.fraction;
      if (branchPick >= boundary) {
        branchIndex[index] = lane + 1;
        break;
      }
    }
    const wisp = randomFor(index, 1) < config.wispFraction;
    const bell = randomFor(index, 2) + randomFor(index, 3) + randomFor(index, 4) - 1.5;
    laneOffset[index] = bell * (wisp ? config.wispSpread : config.corridorHeight / 3);
    posX[index] = acrossFullWidth
      ? randomFor(index, 5) * width
      : -randomFor(index, 5) * width * 0.18;
    posY[index] = desiredY(index, posX[index]!);
    posZ[index] = randomFor(index, 6);
    const sparkle = randomFor(index, 7) > 0.985;
    pointAlpha[index] = sparkle
      ? 0.9 + randomFor(index, 8) * 0.1
      : (wisp ? 0.12 : 0.37) + Math.pow(randomFor(index, 8), 2) * (wisp ? 0.19 : 0.47);
    velX[index] = 0;
    velY[index] = 0;
    recovery[index] = 0;
    goldTimer[index] = 0;
    generation[index] = generation[index]! + 1;
  };

  /*
   * Strands, sampled into arc-length tables whenever the anchors move. Each
   * strand is a Catmull-Rom spline through its control points, so bends are
   * smooth and pass exactly through the authored points.
   */
  const SAMPLES_PER_SPAN = 16;
  const MAX_SAMPLES = 256;
  type StrandTable = {
    ready: boolean;
    count: number;
    length: number;
    x: Float32Array;
    y: Float32Array;
    /** Unit normal, pointing to the left of the direction of flow. */
    nx: Float32Array;
    ny: Float32Array;
    distance: Float32Array;
    width: Float32Array;
    front: Float32Array;
  };
  const strandTables: StrandTable[] = [];
  let tablesDirty = true;

  const tableFor = (slot: number): StrandTable => {
    let table = strandTables[slot];
    if (!table) {
      table = {
        ready: false,
        count: 0,
        length: 0,
        x: new Float32Array(MAX_SAMPLES),
        y: new Float32Array(MAX_SAMPLES),
        nx: new Float32Array(MAX_SAMPLES),
        ny: new Float32Array(MAX_SAMPLES),
        distance: new Float32Array(MAX_SAMPLES),
        width: new Float32Array(MAX_SAMPLES),
        front: new Float32Array(MAX_SAMPLES),
      };
      strandTables[slot] = table;
    }
    return table;
  };

  const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      0.5 *
      (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    );
  };

  const buildStrands = () => {
    const trail = config.trail;
    tablesDirty = false;
    if (!trail) return;
    const widthScale = height / 900;

    trail.strands.forEach((entry, slot) => {
      const table = tableFor(slot);
      const px: number[] = [];
      const py: number[] = [];
      table.ready = entry.points.every((point) => anchors[point.anchor] !== undefined);
      if (!table.ready) return;

      for (const point of entry.points) {
        const rect = anchors[point.anchor]!;
        px.push(rect.x + rect.width * point.at[0]);
        py.push(rect.y + rect.height * point.at[1]);
      }

      const spans = entry.points.length - 1;
      let count = 0;
      for (let span = 0; span < spans; span += 1) {
        const a = Math.max(0, span - 1);
        const d = Math.min(spans, span + 2);
        const steps = span === spans - 1 ? SAMPLES_PER_SPAN + 1 : SAMPLES_PER_SPAN;
        for (let step = 0; step < steps && count < MAX_SAMPLES; step += 1) {
          const t = step / SAMPLES_PER_SPAN;
          table.x[count] = catmull(px[a]!, px[span]!, px[span + 1]!, px[d]!, t);
          table.y[count] = catmull(py[a]!, py[span]!, py[span + 1]!, py[d]!, t);
          // Width and front share ease between control points.
          const ease = smooth(t);
          const from = entry.points[span]!;
          const to = entry.points[span + 1]!;
          table.width[count] = (from.width + (to.width - from.width) * ease) * widthScale;
          table.front[count] = (from.front ?? 0) + ((to.front ?? 0) - (from.front ?? 0)) * ease;
          count += 1;
        }
      }

      table.count = count;
      table.distance[0] = 0;
      for (let sample = 0; sample < count; sample += 1) {
        const before = Math.max(0, sample - 1);
        const after = Math.min(count - 1, sample + 1);
        const dx = table.x[after]! - table.x[before]!;
        const dy = table.y[after]! - table.y[before]!;
        const length = Math.hypot(dx, dy) || 1;
        table.nx[sample] = dy / length;
        table.ny[sample] = -dx / length;
        if (sample > 0) {
          table.distance[sample] =
            table.distance[sample - 1]! +
            Math.hypot(table.x[sample]! - table.x[sample - 1]!, table.y[sample]! - table.y[sample - 1]!);
        }
      }
      table.length = table.distance[count - 1]!;
    });
  };

  /** Scratch for a strand lookup: x, y, nx, ny, width, front. */
  const along = new Float32Array(6);

  const sampleStrand = (table: StrandTable, s: number) => {
    const target = Math.max(0, Math.min(1, s)) * table.length;
    let low = 0;
    let high = table.count - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (table.distance[middle]! < target) low = middle;
      else high = middle;
    }
    const span = table.distance[high]! - table.distance[low]! || 1;
    const t = Math.max(0, Math.min(1, (target - table.distance[low]!) / span));
    along[0] = table.x[low]! + (table.x[high]! - table.x[low]!) * t;
    along[1] = table.y[low]! + (table.y[high]! - table.y[low]!) * t;
    along[2] = table.nx[low]! + (table.nx[high]! - table.nx[low]!) * t;
    along[3] = table.ny[low]! + (table.ny[high]! - table.ny[low]!) * t;
    along[4] = table.width[low]! + (table.width[high]! - table.width[low]!) * t;
    along[5] = table.front[low]! + (table.front[high]! - table.front[low]!) * t;
  };

  /** Roughly Gaussian with unit deviation: the sum of three uniforms, rescaled. */
  const gaussian = (index: number, channel: number) =>
    (randomFor(index, channel) + randomFor(index, channel + 1) + randomFor(index, channel + 2) - 1.5) * 2;

  const spawnTrail = (index: number, anywhere: boolean) => {
    const trail = config.trail!;
    generation[index] = generation[index]! + 1;

    let total = 0;
    for (const entry of trail.strands) total += entry.weight;
    let pick = randomFor(index, 10) * total;
    let slot = 0;
    while (slot < trail.strands.length - 1 && pick > trail.strands[slot]!.weight) {
      pick -= trail.strands[slot]!.weight;
      slot += 1;
    }
    strand[index] = slot;

    // Anywhere along the strand at first; afterwards always from upstream.
    progress[index] = anywhere ? randomFor(index, 11) : randomFor(index, 11) * 0.04;

    /*
     * Three zones across the trail. Most particles hug the spine and define
     * it, a looser edge frays its outline, and a very few escape.
     */
    const zone = randomFor(index, 12);
    escaped[index] = zone < trail.escapeFraction ? 1 : 0;
    const spread = escaped[index]
      ? 0.9
      : zone < trail.escapeFraction + trail.edgeFraction
        ? 0.42
        : 0.16;
    lateral[index] = gaussian(index, 13) * spread;

    // Mostly tiny points; a few nearer ones read a touch larger.
    posZ[index] = Math.pow(randomFor(index, 6), 2.4);
    speed[index] =
      (trail.speed[0] + randomFor(index, 16) * (trail.speed[1] - trail.speed[0])) *
      (0.8 + posZ[index]! * 0.4);
    wobblePhase[index] = randomFor(index, 17) * Math.PI * 2;
    wobbleRate[index] =
      (trail.wobbleRate[0] + randomFor(index, 18) * (trail.wobbleRate[1] - trail.wobbleRate[0])) *
      (randomFor(index, 19) < 0.5 ? -1 : 1);
    frontRoll[index] = randomFor(index, 20);
    age[index] = 0;
    life[index] = escaped[index]
      ? trail.escapeSeconds[0] + randomFor(index, 21) * (trail.escapeSeconds[1] - trail.escapeSeconds[0])
      : Infinity;
    if (escaped[index] && anywhere) age[index] = randomFor(index, 22) * life[index]!;

    const sparkle = randomFor(index, 7) > 0.985;
    pointAlpha[index] = sparkle
      ? 0.9 + randomFor(index, 8) * 0.1
      : 0.6 + Math.pow(randomFor(index, 8), 1.5) * 0.4;
    velX[index] = 0;
    velY[index] = 0;
    dispX[index] = 0;
    dispY[index] = 0;
    recovery[index] = 0;
    goldTimer[index] = 0;
    placed[index] = 0;
  };

  /**
   * Where a trail particle is on its strand this frame. Writes the position to
   * `out` and sets its front flag and end fade. False while its anchors are
   * unknown.
   */
  const trailHome = (index: number, time: number, out: [number, number, number]): boolean => {
    const table = strandTables[strand[index]!];
    if (!table?.ready) return false;
    const s = progress[index]!;
    sampleStrand(table, s);
    const width = along[4]!;
    const trail = config.trail!;
    // Perpendicular wobble; two rates so it never reads as a clean sine.
    const phase = wobblePhase[index]! + wobbleRate[index]! * time;
    let offset =
      lateral[index]! * width +
      (Math.sin(phase) + Math.sin(phase * 0.43 + 1.7) * 0.6) * trail.wobble * width;
    if (escaped[index]) {
      // Drift away from the spine, on whichever side the particle started.
      offset += Math.sign(lateral[index]! || 1) * age[index]! * 5;
    }
    out[0] = along[0]! + along[2]! * offset;
    out[1] = along[1]! + along[3]! * offset;
    front[index] = frontRoll[index]! < along[5]! ? 1 : 0;
    endFade[index] = smooth(s / 0.08) * smooth((1 - s) / 0.16);
    return true;
  };

  function seedAll() {
    tablesDirty = true;
    for (let index = 0; index < capacity; index += 1) {
      if (config.trail) spawnTrail(index, true);
      else spawn(index, true);
    }
  }

  const allocate = (nextCapacity: number) => {
    capacity = nextCapacity;
    posX = new Float32Array(capacity);
    posY = new Float32Array(capacity);
    posZ = new Float32Array(capacity);
    velX = new Float32Array(capacity);
    velY = new Float32Array(capacity);
    laneOffset = new Float32Array(capacity);
    branchIndex = new Uint8Array(capacity);
    pointAlpha = new Float32Array(capacity);
    generation = new Uint32Array(capacity);
    recovery = new Float32Array(capacity);
    goldTimer = new Float32Array(capacity);
    strand = new Uint8Array(capacity);
    progress = new Float32Array(capacity);
    lateral = new Float32Array(capacity);
    speed = new Float32Array(capacity);
    wobblePhase = new Float32Array(capacity);
    wobbleRate = new Float32Array(capacity);
    escaped = new Uint8Array(capacity);
    age = new Float32Array(capacity);
    life = new Float32Array(capacity);
    frontRoll = new Float32Array(capacity);
    front = new Uint8Array(capacity);
    placed = new Uint8Array(capacity);
    endFade = new Float32Array(capacity);
    dispX = new Float32Array(capacity);
    dispY = new Float32Array(capacity);
    frontAlphas = new Float32Array(capacity);
    positions = new Float32Array(capacity * 3);
    sizes = new Float32Array(capacity);
    alphas = new Float32Array(capacity);
    golds = new Float32Array(capacity);

    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(alphas, 1));
    geometry.setAttribute("aGold", new BufferAttribute(golds, 1));

    seedAll();
  };

  allocate(capacity);

  const flow: [number, number, number] = [0, 0, 0];
  const home: [number, number, number] = [0, 0, 0];
  const influence: PointerInfluenceResult = { ax: 0, ay: 0, disturbance: 0, contact: false };
  let disturbed = 0;

  /**
   * Bend the flow around an obstacle.
   *
   * The force is a smooth falloff from the rectangle's nearest point rather
   * than a hard test against its interior, so particles start curving before
   * they arrive. A tangential component pointing the way the particle is
   * already travelling makes them slide past instead of queueing along the
   * edge in a visible line.
   */
  const avoidObstacles = (index: number, deltaSeconds: number) => {
    const x = posX[index]!;
    const y = posY[index]!;
    const padding = config.obstaclePadding;
    const band = config.obstacleInfluence;

    for (let rect = 0; rect < obstacles.length; rect += 1) {
      const box = obstacles[rect]!;
      const left = box.x - padding;
      const right = box.x + box.width + padding;
      const top = box.y - padding;
      const bottom = box.y + box.height + padding;

      if (x < left - band || x > right + band || y < top - band || y > bottom + band) {
        continue;
      }

      const nearestX = Math.min(right, Math.max(left, x));
      const nearestY = Math.min(bottom, Math.max(top, y));
      let normalX = x - nearestX;
      let normalY = y - nearestY;
      let distance = Math.hypot(normalX, normalY);

      if (distance < 0.001) {
        // Inside the rectangle: leave through the closest face.
        const toTop = y - top;
        const toBottom = bottom - y;
        const toLeft = x - left;
        const toRight = right - x;
        const minimum = Math.min(toTop, toBottom, toLeft, toRight);

        if (minimum === toTop) {
          normalX = 0;
          normalY = -1;
        } else if (minimum === toBottom) {
          normalX = 0;
          normalY = 1;
        } else if (minimum === toLeft) {
          normalX = -1;
          normalY = 0;
        } else {
          normalX = 1;
          normalY = 0;
        }

        distance = 0;
      } else {
        normalX /= distance;
        normalY /= distance;

        if (distance > band) {
          continue;
        }
      }

      const falloff = 1 - distance / band;
      const force = config.obstacleStrength * falloff * falloff * deltaSeconds;

      velX[index]! += normalX * force;
      velY[index]! += normalY * force;

      // Slide along the surface, in whichever direction the particle is headed.
      const tangentX = -normalY;
      const tangentY = normalX;
      const side = tangentX * velX[index]! + tangentY * velY[index]! >= 0 ? 1 : -1;
      velX[index]! += tangentX * side * force * 0.6;
      velY[index]! += tangentY * side * force * 0.6;
    }
  };

  /**
   * Draw a particle towards the focus rectangle's nearest edge and set it
   * circling there, so the field visibly collects around the active plane
   * instead of flowing straight past it.
   */
  const gatherAroundFocus = (index: number, deltaSeconds: number) => {
    const rect = focus;

    if (!rect) {
      return;
    }

    const x = posX[index]!;
    const y = posY[index]!;
    const nearestX = Math.min(rect.x + rect.width, Math.max(rect.x, x));
    const nearestY = Math.min(rect.y + rect.height, Math.max(rect.y, y));
    const toEdgeX = nearestX - x;
    const toEdgeY = nearestY - y;
    const distance = Math.hypot(toEdgeX, toEdgeY);

    if (distance > config.focusRadius || distance < 0.001) {
      return;
    }

    const falloff = 1 - distance / config.focusRadius;
    const pull = config.focusStrength * falloff * focusAmount * deltaSeconds;
    const normalX = toEdgeX / distance;
    const normalY = toEdgeY / distance;

    // Inward pull plus a tangential drift, so particles orbit the edge rather
    // than piling into it. Obstacle avoidance still keeps them outside.
    velX[index]! += normalX * pull;
    velY[index]! += normalY * pull;
    velX[index]! += -normalY * pull * 0.8;
    velY[index]! += normalX * pull * 0.8;
  };

  /**
   * The trail: each particle advances along its strand at its own speed and
   * sits a fixed distance across it, plus a small wobble. The pointer pushes a
   * displacement that decays, so a disturbed particle rejoins its place in the
   * flow. Nothing moves the trail itself.
   */
  const updateTrail = (step: number, elapsedSeconds: number, pointer: ParticlePointerState) => {
    if (tablesDirty) buildStrands();
    disturbed = 0;

    for (let index = 0; index < active; index += 1) {
      const table = strandTables[strand[index]!];
      if (!table?.ready || table.length < 1) continue;

      age[index]! += step;
      progress[index]! += (speed[index]! * step) / table.length;
      if (progress[index]! > 1 || age[index]! > life[index]!) spawnTrail(index, false);
      if (!trailHome(index, elapsedSeconds, home)) continue;
      placed[index] = 1;

      if (pointer.active) {
        applyPointerInfluence(
          {
            px: posX[index]!,
            py: posY[index]!,
            vx: velX[index]!,
            vy: velY[index]!,
            cx: pointer.x,
            cy: pointer.y,
            dirX: pointer.dirX,
            dirY: pointer.dirY,
            speed: pointer.speed,
          },
          influence,
          config,
        );

        if (influence.disturbance > 0) {
          velX[index]! += influence.ax * step;
          velY[index]! += influence.ay * step;
          recovery[index] = Math.max(recovery[index]!, influence.disturbance);

          if (influence.contact && goldTimer[index]! <= 0 && Math.random() < config.goldChance) {
            goldTimer[index] = config.goldSeconds;
            if (!soundEventsIdle()) {
              emitSoundEvent("particles:contact", {
                intensity: Math.min(1, pointer.speed / 1200),
              });
            }
          }
        }
      }

      if (recovery[index]! > 0) {
        recovery[index] = Math.max(0, recovery[index]! - step / config.recoverySeconds);
        disturbed += 1;
      }
      if (goldTimer[index]! > 0) {
        goldTimer[index] = Math.max(0, goldTimer[index]! - step);
      }

      // The displacement springs back over roughly `recoverySeconds`.
      const settle = step / Math.max(0.1, config.recoverySeconds * 0.35);
      velX[index]! -= velX[index]! * config.damping * step + dispX[index]! * settle * 2;
      velY[index]! -= velY[index]! * config.damping * step + dispY[index]! * settle * 2;
      dispX[index]! += velX[index]! * step;
      dispY[index]! += velY[index]! * step;

      posX[index] = home[0] + dispX[index]!;
      posY[index] = home[1] + dispY[index]!;
    }
  };

  const update: ParticleField["update"] = (deltaSeconds, elapsedSeconds, pointer) => {
    const wanted = config.presence ?? 1;
    presence =
      deltaSeconds === 0 || options.reducedMotion
        ? wanted
        : presence + (wanted - presence) * Math.min(1, deltaSeconds * 6);
    if (Math.abs(wanted - presence) < 0.002) presence = wanted;
    reveal = options.reducedMotion ? 1 : Math.min(1, reveal + deltaSeconds / 1.4);
    points.visible = presence > 0.002;

    // Reduced motion holds the field still: it becomes a slow ambient texture
    // that is drawn once rather than an animated system.
    if (options.reducedMotion) {
      if (config.trail) {
        if (tablesDirty) buildStrands();
        for (let index = 0; index < active; index += 1) {
          placed[index] = trailHome(index, 0, home) ? 1 : 0;
          posX[index] = home[0];
          posY[index] = home[1];
        }
      }
      writeBuffers();
      return;
    }

    if (config.trail) {
      updateTrail(Math.min(deltaSeconds, 1 / 30), elapsedSeconds, pointer);
      writeBuffers();
      return;
    }

    const step = Math.min(deltaSeconds, 1 / 30);
    const flowTime = elapsedSeconds * config.flowTimeScale;
    disturbed = 0;

    const wantedFocus = focus ? 1 : 0;
    focusAmount += (wantedFocus - focusAmount) * Math.min(1, step / config.focusEase);

    for (let index = 0; index < active; index += 1) {
      const depth = posZ[index]!;

      curl.sample(
        posX[index]! * config.flowScale,
        posY[index]! * config.flowScale,
        depth * 2 + flowTime,
        flow,
      );

      // Target velocity: steady rightward drift plus curl turbulence, both
      // scaled by depth so nearer particles travel faster.
      const depthScale = 0.4 + depth * 0.8;
      const targetX = config.driftSpeed * depthScale + flow[0] * config.flowStrength;
      const pathSlope = (desiredY(index, posX[index]! + 3) - desiredY(index, posX[index]! - 3)) / 6;
      const targetY =
        pathSlope * targetX +
        flow[1] * config.flowStrength +
        (desiredY(index, posX[index]!) - posY[index]!) * config.pathReturn;

      // A recovering particle steers back to the field gradually. The timer is
      // what makes a carved path close over roughly 1.4 seconds.
      const recovering = recovery[index]!;
      const follow = config.followStrength * (recovering > 0 ? 1 - recovering * 0.75 : 1);

      velX[index]! += (targetX - velX[index]!) * follow * step;
      velY[index]! += (targetY - velY[index]!) * follow * step;

      if (pointer.active) {
        applyPointerInfluence(
          {
            px: posX[index]!,
            py: posY[index]!,
            vx: velX[index]!,
            vy: velY[index]!,
            cx: pointer.x,
            cy: pointer.y,
            dirX: pointer.dirX,
            dirY: pointer.dirY,
            speed: pointer.speed,
          },
          influence,
          config,
        );

        if (influence.disturbance > 0) {
          velX[index]! += influence.ax * step;
          velY[index]! += influence.ay * step;
          recovery[index] = Math.max(recovering, influence.disturbance);

          if (influence.contact && goldTimer[index]! <= 0 && Math.random() < config.goldChance) {
            goldTimer[index] = config.goldSeconds;

            /*
             * Report the contact. This is an event, not a sound: the field
             * never learns whether anything is listening. The engine's own
             * cooldown decides how much of this becomes audible.
             */
            if (!soundEventsIdle()) {
              emitSoundEvent("particles:contact", {
                intensity: Math.min(1, pointer.speed / 1200),
              });
            }
          }
        }
      }

      if (recovery[index]! > 0) {
        recovery[index] = Math.max(0, recovery[index]! - step / config.recoverySeconds);
        disturbed += 1;
      }

      if (goldTimer[index]! > 0) {
        goldTimer[index] = Math.max(0, goldTimer[index]! - step);
      }

      velX[index]! -= velX[index]! * config.damping * step * 0.12;
      velY[index]! -= velY[index]! * config.damping * step * 0.12;

      avoidObstacles(index, step);

      if (focusAmount > 0.01 && focus) {
        gatherAroundFocus(index, step);
      }

      posX[index]! += velX[index]! * step;
      posY[index]! += velY[index]! * step;

      // Recycle at the right edge and wrap vertically.
      if (posX[index]! > width + config.edgeFade) {
        spawn(index, false);
      } else if (posY[index]! < -config.edgeFade || posY[index]! > height + config.edgeFade) {
        // Re-enter from the left rather than wrapping, so the stream keeps its
        // shape instead of degrading into an even spread.
        spawn(index, false);
      }
    }

    writeBuffers();
  };

  function writeBuffers() {
    const [minSize, maxSize] = config.sizeRange;
    const fade = config.edgeFade;

    for (let index = 0; index < active; index += 1) {
      const x = posX[index]!;
      const y = posY[index]!;
      const depth = posZ[index]!;

      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = depth * 10;

      sizes[index] = (minSize + (maxSize - minSize) * depth) * pixelRatio;

      // Gradual fade at every boundary so nothing pops in or out.
      const fadeLeft = Math.min(1, Math.max(0, (x + fade) / fade));
      const fadeRight = Math.min(1, Math.max(0, (width + fade - x) / fade));
      const fadeTop = Math.min(1, Math.max(0, (y + fade) / fade));
      const fadeBottom = Math.min(1, Math.max(0, (height + fade - y) / fade));
      const depthAlpha = 0.62 + depth * 0.38;

      let alpha =
        fadeLeft * fadeRight * fadeTop * fadeBottom * depthAlpha * pointAlpha[index]! * presence *
        smooth(reveal);

      if (config.trail) {
        // Fade in upstream, out downstream, and out as an escapee leaves.
        const escapeFade = escaped[index]
          ? smooth(age[index]! / 1.2) * smooth((life[index]! - age[index]!) / (life[index]! * 0.6))
          : 1;
        const strandAlpha = config.trail.strands[strand[index]!]?.alpha ?? 1;
        alpha *= placed[index] ? endFade[index]! * escapeFade * strandAlpha : 0;
      }

      const inFront = config.trail !== undefined && front[index] === 1;
      frontAlphas[index] = inFront ? alpha * config.trail!.frontAlpha : 0;
      alphas[index] = inFront ? 0 : alpha;
      golds[index] = goldTimer[index]! > 0 ? 1 : 0;
    }

    geometry.setDrawRange(0, active);
    (geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("aSize") as BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("aAlpha") as BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("aGold") as BufferAttribute).needsUpdate = true;
  }

  return {
    scene,
    camera,
    update,
    resize: (nextWidth, nextHeight, nextPixelRatio) => {
      const previousWidth = width;
      const previousHeight = height;
      width = nextWidth;
      height = nextHeight;
      pixelRatio = nextPixelRatio;
      tablesDirty = true;
      for (let index = 0; index < active; index += 1) {
        posX[index] = (posX[index]! / Math.max(1, previousWidth)) * width;
        posY[index] = (posY[index]! / Math.max(1, previousHeight)) * height;
      }
      camera.left = 0;
      camera.right = width;
      camera.top = 0;
      camera.bottom = height;
      camera.updateProjectionMatrix();
    },
    setObstacles: (next) => {
      obstacles = next;
    },

    setFocus: (rect) => {
      focus = rect;
    },
    setConfig: (next) => {
      const reshape = next.trail !== config.trail;
      config = next;
      // A change of shape reseeds, and the new shape fades up rather than cutting.
      if (reshape) {
        active = wantedCount();
        if (active > capacity) allocate(active);
        else seedAll();
        reveal = 0;
      }
    },
    setAnchors: (next) => {
      anchors = next;
      tablesDirty = true;
    },
    frontVisible: () => config.trail !== undefined && presence > 0.002,
    drawFront: (context, offsetX, offsetY, viewWidth, viewHeight) => {
      context.clearRect(0, 0, viewWidth, viewHeight);
      if (!config.trail || presence <= 0.002) return false;

      let drew = false;
      for (let index = 0; index < active; index += 1) {
        const alpha = frontAlphas[index]!;
        if (alpha < 0.004) continue;
        const x = posX[index]! - offsetX;
        const y = posY[index]! - offsetY;
        // The sprite fades to its edge, so it is drawn a touch larger than the
        // WebGL point to read at the same weight.
        const size = (sizes[index]! / pixelRatio) * 1.2;
        if (x < -size || y < -size || x > viewWidth + size || y > viewHeight + size) continue;
        context.globalAlpha = Math.min(1, alpha);
        context.drawImage(spriteFor(goldTimer[index]! > 0), x - size / 2, y - size / 2, size, size);
        drew = true;
      }
      context.globalAlpha = 1;
      return drew;
    },
    setCount: (nextCount) => {
      baseCount = nextCount;
      const count = wantedCount();
      if (count <= capacity) {
        active = count;
        return;
      }

      allocate(count);
      active = count;
    },
    disturbedCount: () => disturbed,
    destroy: () => {
      geometry.dispose();
      material.dispose();
      scene.remove(points);
    },
  };
}
