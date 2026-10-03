import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";

import { createRiftRibbons } from "./riftRibbons";

/**
 * The aurora rising through the rift: the other world's energy, made of
 * vapour, glitter, light and mist.
 *
 *   vapour   hundreds of soft wisps simulated on the CPU, carried up the
 *            crack by a slow swirling current in lanes: a broad current
 *            through the middle, wisps climbing the left and right inner
 *            faces of the stone, a few spilling out over the lower flanks.
 *            Each is drawn as a quad stretched along its motion and filled
 *            with flowing noise, so overlapping wisps curl through each
 *            other instead of reading as blobs. Concentrated but soft at the
 *            bottom of the opening, fullest through the middle, thinning to
 *            nothing near the peak.
 *   glitter  tiny sparks carried in the vapour, twinkling.
 *   shafts   faint vertical rays of the other world's light in the opening.
 *   mist     low vapour pooling on the water at the foot of the opening.
 *
 * Only the substance glows. The stone is lit only where the vapour passes
 * close to it (by the lights the rift moves with it), and the outside of
 * the mountain stays dark.
 *
 * The wisps near the peak are where the bio's dust comes from: sourcePoints
 * returns the ones dissolving there this frame, so the particles that cross
 * to the words visibly leave the last of the vapour.
 *
 * Everything is in the mountain's own units (0.82 tall; the opening runs
 * from the water to about 0.68).
 */
export type RiftVapour = Readonly<{
  group: Group;
  update: (
    frame: Readonly<{
      delta: number;
      time: number;
      /** 0 at rest, 1 near and on it, 2 fully held. */
      energy: number;
      /** 0 → 1 through the crossing. */
      go: number;
      /** The cursor on the opening's plane, in the mountain's units, or null. */
      cursor: Vector3 | null;
    }>,
  ) => void;
  /** Wisps dissolving near the peak this frame: the bio's dust leaves from them. */
  sourcePoints: () => readonly Vector3[];
  /** Where the light of each lane is, for the lights that travel with it. */
  laneLight: (lane: "centre-low" | "centre-high" | "left" | "right") => Vector3;
  dispose: () => void;
}>;

type Rows = readonly (readonly [number, number, number])[];

/** Where a wisp travels. Flank lanes spill out over the lower slopes. */
const LANES = ["centre", "left", "right", "flank-left", "flank-right"] as const;
type Lane = (typeof LANES)[number];
const LANE_SHARE: Readonly<Record<Lane, number>> = {
  // As in the reference: the vapour is the band along the right inner edge,
  // with a little along the left; nothing up the middle of the opening.
  centre: 0,
  left: 0.16,
  right: 0.84,
  "flank-left": 0,
  "flank-right": 0,
};

const COUNT = { wide: 460, compact: 180 } as const;
const GLITTER = { wide: 320, compact: 110 } as const;
const SHAFTS = { wide: 9, compact: 0 } as const;
const MIST = { wide: 14, compact: 6 } as const;

// ------------------------------------------------------------------ shaders
const NOISE = /* glsl */ `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.07 + vec2(3.1, 7.7);
    amplitude *= 0.5;
  }
  return value;
}
`;

const WISP_VERTEX = /* glsl */ `
attribute vec3 iPosition;
attribute vec3 iVelocity;
/** size, alpha, colour seed, shape seed */
attribute vec4 iData;
varying vec2 vUv;
varying vec4 vData;
varying float vHeat;

void main() {
  vec4 centre = modelViewMatrix * vec4(iPosition, 1.0);
  // Stretched along its motion on screen, so the vapour streams.
  vec3 motion = (modelViewMatrix * vec4(iVelocity, 0.0)).xyz;
  vec2 along = length(motion.xy) > 0.00001 ? normalize(motion.xy) : vec2(0.0, 1.0);
  // Right-handed with "along", so the quad keeps facing the camera.
  vec2 across = vec2(along.y, -along.x);
  float scale = length(modelViewMatrix[0].xyz);
  float size = iData.x * scale;
  // Long and narrow along the current: neighbouring wisps join into ribbons.
  // A soft haze behind the strands: only a little drawn out along the flow.
  float stretch = 1.6 + min(0.8, length(iVelocity) * 4.0);
  centre.xy += (across * position.x + along * position.y * stretch) * size;
  vUv = position.xy * 2.0;
  vData = iData;
  vHeat = clamp(length(iVelocity) * 6.0, 0.0, 1.0);
  gl_Position = projectionMatrix * centre;
}
`;

const WISP_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uLavender;
uniform vec3 uViolet;
uniform vec3 uIce;
uniform vec3 uCyan;
uniform vec3 uPink;
uniform vec3 uCore;
varying vec2 vUv;
varying vec4 vData;
varying float vHeat;
${NOISE}

void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float seed = vData.w * 31.0;
  // Filaments inside the wisp: noise stretched along it, flowing.
  vec2 q = vec2(vUv.x * 1.3, vUv.y * 0.55 - uTime * 0.3) + seed;
  float filaments = fbm(q + vec2(fbm(q * 0.7 + seed), 0.0) * 1.6);
  // Filaments with gaps between them: the world behind shows through.
  float falloff = 1.0 - smoothstep(0.15, 1.0, r);
  float shape = falloff * smoothstep(0.4, 0.72, filaments);
  // Bright threads where the vapour folds: the luminous edges of each wisp.
  float threads = 1.0 - smoothstep(0.0, 0.045, abs(filaments - 0.55));
  threads *= falloff;
  float alpha = (shape * 0.6 + threads * 0.15) * vData.y;
  if (alpha < 0.003) discard;

  // Saturated: each wisp leans to one colour and drifts towards the next
  // along its own filaments, so the colours mix inside the vapour.
  float c = fract(vData.z + filaments * 0.35);
  vec3 colour = mix(uViolet, uIce, smoothstep(0.0, 0.25, c));
  colour = mix(colour, uCyan, smoothstep(0.25, 0.45, c));
  colour = mix(colour, uLavender, smoothstep(0.45, 0.65, c));
  colour = mix(colour, uPink, smoothstep(0.65, 0.85, c));
  colour = mix(colour, uViolet, smoothstep(0.85, 1.0, c));
  // The threads burn towards white.
  colour = mix(colour, uCore, clamp(threads * (0.3 + vHeat * 0.2), 0.0, 0.55));
  // Mostly additive: it is light, glowing against the night and still
  // reading against the other world's bright day.
  gl_FragColor = vec4(colour * alpha * 1.35, alpha * 0.22);
}
`;

const GLITTER_VERTEX = /* glsl */ `
attribute float aTwinkle;
uniform float uTime;
uniform float uSize;
varying float vAlpha;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  float twinkle = pow(0.5 + 0.5 * sin(uTime * (2.0 + aTwinkle * 5.0) + aTwinkle * 40.0), 4.0);
  vAlpha = twinkle;
  gl_PointSize = uSize * (0.6 + twinkle * 1.2);
  gl_Position = projectionMatrix * view;
}
`;
const GLITTER_FRAGMENT = /* glsl */ `
uniform float uStrength;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float glint = smoothstep(0.5, 0.0, d);
  glint += (smoothstep(0.06, 0.0, abs(p.x)) + smoothstep(0.06, 0.0, abs(p.y))) * smoothstep(0.5, 0.1, d) * 0.6;
  float a = glint * vAlpha * uStrength;
  gl_FragColor = vec4(vec3(0.93, 0.92, 1.0) * a, a);
}
`;

const SHAFT_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SHAFT_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform float uSeed;
varying vec2 vUv;
${NOISE}
void main() {
  float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
  float ray = pow(across, 3.0);
  // Brightest low down where the light pours in, fading up the opening.
  float height = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
  float shimmer = 0.55 + 0.45 * noise(vec2(vUv.y * 6.0 - uTime * 0.6, uSeed * 13.0));
  float a = ray * height * shimmer * uStrength;
  gl_FragColor = vec4(vec3(0.9, 0.92, 1.0) * a, a);
}
`;

const MIST_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uStrength;
uniform float uSeed;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p * vec2(1.0, 2.2));
  float cloud = fbm(vUv * vec2(3.0, 1.6) + vec2(uTime * 0.04 + uSeed, uSeed * 2.0));
  float a = (1.0 - smoothstep(0.3, 1.0, r)) * smoothstep(0.35, 0.75, cloud) * uStrength;
  vec3 colour = mix(vec3(0.78, 0.74, 0.96), vec3(0.8, 0.88, 1.0), cloud);
  gl_FragColor = vec4(colour * a, a * 0.7);
}
`;

// ------------------------------------------------------------------ the opening
function edgesAt(rows: Rows, y: number) {
  if (y <= rows[0]![0]) return [rows[0]![1], rows[0]![2]] as const;
  for (let i = 1; i < rows.length; i += 1) {
    const b = rows[i]!;
    if (b[0] < y) continue;
    const a = rows[i - 1]!;
    const t = (y - a[0]) / Math.max(1e-6, b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as const;
  }
  const top = rows[rows.length - 1]!;
  return [top[1], top[2]] as const;
}

export function createRiftVapour(rows: Rows, compact: boolean): RiftVapour {
  const group = new Group();
  group.name = "rift-vapour";
  const apex = rows[rows.length - 1]![0];
  const apexX = (rows[rows.length - 1]![1] + rows[rows.length - 1]![2]) / 2;
  let seed = 0x5eed;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const palette = {
    uLavender: { value: new Color("#b98cff") },
    uViolet: { value: new Color("#8a4dff") },
    uIce: { value: new Color("#4f9dff") },
    uCyan: { value: new Color("#5cf0ff") },
    uPink: { value: new Color("#ff7fd8") },
    uCore: { value: new Color("#ffffff") },
  };

  // ---------------------------------------------------------------- wisps
  const count = compact ? COUNT.compact : COUNT.wide;
  const lane = new Uint8Array(count);
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const age = new Float32Array(count);
  const life = new Float32Array(count);
  const size = new Float32Array(count);
  const tint = new Float32Array(count);
  const shapeSeed = new Float32Array(count);
  const wander = new Float32Array(count);
  const data = new Float32Array(count * 4);

  const laneOf = (roll: number): Lane => {
    let sum = 0;
    for (const name of LANES) {
      sum += LANE_SHARE[name];
      if (roll < sum) return name;
    }
    return "centre";
  };

  /** Where a lane wants a wisp at a height: x and z, in the mountain's units. */
  let clock = 0;
  const laneTarget = (which: Lane, y: number, side: number, out: Vector3) => {
    const [left, right] = edgesAt(rows, Math.min(y, apex));
    const middle = (left + right) / 2;
    const half = Math.max(0.004, (right - left) / 2);
    // Comes forward out of the other world as it climbs.
    const forward = -0.1 + Math.min(1, y / 0.22) * 0.16;
    // Every lane snakes: long S-curves travelling up it, out of step.
    const lean = which === "left" ? 1.3 : which === "right" ? 2.6 : 0;
    const snake =
      Math.sin(y * 15 - clock * 0.8 + lean + side * 0.8) +
      0.45 * Math.sin(y * 31 + clock * 0.55 + lean * 2);
    switch (which) {
      case "centre":
        out.set(middle + side * half * 0.4 + snake * half * 0.45, y, forward);
        break;
      // The face lanes wind out over the lip of the stone and back.
      case "left":
        out.set(left + half * 0.1 + snake * 0.035, y, forward + 0.1 + Math.max(0, -snake) * 0.05);
        break;
      // Spread across the band, from just inside the opening out over the rock.
      case "right":
        out.set(
          right + side * Math.max(0.03, 0.085 - y * 0.08) + snake * 0.02,
          y,
          forward + 0.12 + (side + 1) * 0.03,
        );
        break;
      // Out over the lip and across the lower slope, rising as it goes.
      case "flank-left":
        out.set(left - 0.02 - Math.max(0, y - 0.05) * 0.9, y, 0.14 + y * 0.25);
        break;
      case "flank-right":
        out.set(right + 0.02 + Math.max(0, y - 0.05) * 0.9, y, 0.14 + y * 0.25);
        break;
    }
    // Above the crack, everything drifts towards the peak.
    if (y > apex) out.x += (apexX - out.x) * Math.min(1, (y - apex) / 0.1);
    return out;
  };

  /** Where a lane fades out: the centre and faces reach the peak, flanks less high. */
  const laneTop = (which: Lane) =>
    which === "centre" ? apex + 0.14 : which === "left" || which === "right" ? apex + 0.06 : 0.42;

  const target = new Vector3();
  const spawn = (i: number, scatter: boolean) => {
    const which = laneOf(random());
    lane[i] = LANES.indexOf(which);
    const side = random() * 2 - 1;
    wander[i] = side;
    const startY = scatter ? random() * laneTop(which) : random() * 0.04;
    laneTarget(which, startY, side, target);
    pos[i * 3] = target.x + (random() - 0.5) * 0.02;
    pos[i * 3 + 1] = startY;
    pos[i * 3 + 2] = target.z + (random() - 0.5) * 0.04;
    vel[i * 3] = 0;
    vel[i * 3 + 1] = 0.05;
    vel[i * 3 + 2] = 0;
    age[i] = scatter ? random() * 4 : 0;
    life[i] = 7 + random() * 6;
    size[i] =
      (which === "centre" ? 0.05 : which.startsWith("flank") ? 0.04 : 0.036) *
      (0.6 + random() * 0.9);
    // Lanes lean to their own colours: faces icier on the left, rosier on the right.
    const base =
      which === "left" || which === "flank-left"
        ? 0.45
        : which === "right" || which === "flank-right"
          ? 0.62
          : 0.3;
    tint[i] = Math.min(1, Math.max(0, base + (random() - 0.5) * 0.7));
    shapeSeed[i] = random();
  };
  for (let i = 0; i < count; i += 1) spawn(i, true);

  const quad = new PlaneGeometry(1, 1);
  const wispGeometry = new InstancedBufferGeometry();
  wispGeometry.index = quad.index;
  wispGeometry.setAttribute("position", quad.getAttribute("position"));
  const positionAttribute = new InstancedBufferAttribute(pos, 3);
  const velocityAttribute = new InstancedBufferAttribute(vel, 3);
  const dataAttribute = new InstancedBufferAttribute(data, 4);
  wispGeometry.setAttribute("iPosition", positionAttribute);
  wispGeometry.setAttribute("iVelocity", velocityAttribute);
  wispGeometry.setAttribute("iData", dataAttribute);
  wispGeometry.instanceCount = count;
  const wispMaterial = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, ...palette },
    vertexShader: WISP_VERTEX,
    fragmentShader: WISP_FRAGMENT,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
  });
  const wisps = new Mesh(wispGeometry, wispMaterial);
  wisps.name = "rift-vapour-wisps";
  wisps.frustumCulled = false;
  wisps.renderOrder = 6;
  group.add(wisps);

  // The strands themselves: the silk-fine band along the right edge.
  const ribbons = createRiftRibbons(rows, compact);
  group.add(ribbons.mesh);

  // ---------------------------------------------------------------- glitter
  const glitterCount = compact ? GLITTER.compact : GLITTER.wide;
  const glitterHost = new Uint16Array(glitterCount);
  const glitterOffset = new Float32Array(glitterCount * 3);
  const glitterPosition = new Float32Array(glitterCount * 3);
  const twinkle = new Float32Array(glitterCount);
  for (let g = 0; g < glitterCount; g += 1) {
    glitterHost[g] = Math.floor(random() * count);
    glitterOffset.set(
      [(random() - 0.5) * 0.04, (random() - 0.5) * 0.05, (random() - 0.5) * 0.03],
      g * 3,
    );
    twinkle[g] = random();
  }
  const glitterGeometry = new BufferGeometry();
  const glitterAttribute = new BufferAttribute(glitterPosition, 3);
  glitterGeometry.setAttribute("position", glitterAttribute);
  glitterGeometry.setAttribute("aTwinkle", new BufferAttribute(twinkle, 1));
  const glitterMaterial = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: compact ? 4.5 : 5.5 },
      uStrength: { value: 0.6 },
    },
    vertexShader: GLITTER_VERTEX,
    fragmentShader: GLITTER_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const glitter = new Points(glitterGeometry, glitterMaterial);
  glitter.frustumCulled = false;
  glitter.renderOrder = 7;
  group.add(glitter);

  // ---------------------------------------------------------------- shafts
  const shaftMaterials: ShaderMaterial[] = [];
  const shaftGeometry = new PlaneGeometry(1, 1);
  shaftGeometry.translate(0, 0.5, 0);
  const shaftCount = compact ? SHAFTS.compact : SHAFTS.wide;
  const [baseLeft, baseRight] = edgesAt(rows, 0.12);
  for (let s = 0; s < shaftCount; s += 1) {
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uSeed: { value: random() } },
      vertexShader: SHAFT_VERTEX,
      fragmentShader: SHAFT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const shaft = new Mesh(shaftGeometry, material);
    const t = (s + 0.5) / shaftCount;
    shaft.position.set(
      baseLeft + (baseRight - baseLeft) * (0.15 + t * 0.7),
      0,
      0.02 + random() * 0.04,
    );
    shaft.scale.set(0.006 + random() * 0.012, apex * (0.6 + random() * 0.35), 1);
    shaft.renderOrder = 5;
    group.add(shaft);
    shaftMaterials.push(material);
  }

  // ---------------------------------------------------------------- mist
  const mistMaterials: ShaderMaterial[] = [];
  const mistGeometry = new PlaneGeometry(1, 1);
  const mistCount = compact ? MIST.compact : MIST.wide;
  const [floorLeft, floorRight] = edgesAt(rows, 0.02);
  for (let m = 0; m < mistCount; m += 1) {
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uSeed: { value: random() * 10 } },
      vertexShader: SHAFT_VERTEX,
      fragmentShader: MIST_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
    });
    const mist = new Mesh(mistGeometry, material);
    const spread = (m / Math.max(1, mistCount - 1) - 0.5) * 2;
    mist.position.set(
      (floorLeft + floorRight) / 2 + spread * 0.28,
      0.012 + random() * 0.02,
      0.04 + random() * 0.32,
    );
    mist.scale.set(0.18 + random() * 0.16, 0.05 + random() * 0.03, 1);
    mist.renderOrder = 5;
    group.add(mist);
    mistMaterials.push(material);
  }

  // ---------------------------------------------------------------- the simulation
  const sources: Vector3[] = [];
  const sourcePool = Array.from({ length: 14 }, () => new Vector3());
  const lights = {
    "centre-low": new Vector3(),
    "centre-high": new Vector3(),
    left: new Vector3(),
    right: new Vector3(),
  };
  laneTarget("centre", 0.1, 0, lights["centre-low"]);
  laneTarget("centre", apex * 0.65, 0, lights["centre-high"]);
  laneTarget("left", apex * 0.4, 0, lights.left);
  laneTarget("right", apex * 0.45, 0, lights.right);

  const update: RiftVapour["update"] = ({ delta, time, energy, go, cursor }) => {
    const dt = Math.min(0.05, delta);
    const rise = 0.045 + energy * 0.03 + go * 0.25;
    // Restrained at rest; fuller as more of the other world pushes through.
    clock = time;
    // Restrained at rest, fuller held; never so much it burns to white.
    const strength = 0.22 + energy * 0.1;
    sources.length = 0;

    for (let i = 0; i < count; i += 1) {
      const which = LANES[lane[i]!]!;
      age[i] = age[i]! + dt;
      const k = i * 3;
      let x = pos[k]!;
      let y = pos[k + 1]!;
      let z = pos[k + 2]!;
      const top = laneTop(which) + energy * 0.03;
      if (y > top || age[i]! > life[i]!) {
        spawn(i, false);
        continue;
      }

      // The current: upward, swirling, each wisp pulled back towards its lane.
      laneTarget(which, y, wander[i]!, target);
      const phase = shapeSeed[i]! * 6.28;
      const curlX =
        Math.sin(y * 19 + time * 0.55 + phase) * 0.9 +
        Math.sin(y * 43 - time * 0.9 + phase * 2) * 0.45;
      const curlZ = Math.cos(y * 17 - time * 0.5 + phase) * 0.5;
      // Upward at its own pace; across and in depth, a damped spring back to
      // its lane plus the curl, so wisps wander off and are drawn back.
      const riseTarget = rise * (0.75 + shapeSeed[i]! * 0.5);
      let vy = vel[k + 1]! + (riseTarget - vel[k + 1]!) * Math.min(1, dt * 2);
      let vx = vel[k]! + ((target.x - x) * 1.6 + curlX * 0.05 - vel[k]! * 1.5) * dt;
      let vz = vel[k + 2]! + ((target.z - z) * 1.8 + curlZ * 0.025 - vel[k + 2]! * 1.8) * dt;
      // Near the cursor the vapour leans towards it.
      if (cursor) {
        const dx = cursor.x - x;
        const dy = cursor.y - y;
        const pull = Math.exp(-(dx * dx + dy * dy) / 0.01) * Math.min(1, energy);
        vx += dx * pull * dt * 4;
        vy += dy * pull * dt * 1.5;
      }
      // Through the crossing, it streams forward past the camera.
      vz += go * go * 0.4 * dt;
      vy = Math.max(0.01, vy);
      vel[k] = vx;
      vel[k + 1] = vy;
      vel[k + 2] = vz;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      pos[k] = x;
      pos[k + 1] = y;
      pos[k + 2] = z;

      // Visible gradually out of the bottom; fullest through the middle;
      // thinning and fragmenting near the top.
      const height = y / top;
      const fadeIn = Math.min(1, age[i]! / 1.6) * Math.min(1, y / 0.08);
      const fadeOut = 1 - Math.min(1, Math.max(0, (height - 0.62) / 0.38));
      const thin = 1 - Math.max(0, (height - 0.55) / 0.45) * 0.55;
      const bottom = 0.55 + Math.min(1, y / 0.18) * 0.45;
      const d = i * 4;
      data[d] = size[i]! * (0.6 + Math.min(1, y / 0.25) * 0.7) * thin * (1 + energy * 0.12);
      data[d + 1] = strength * fadeIn * fadeOut * bottom * (1 - go * 0.6);
      data[d + 2] = tint[i]!;
      data[d + 3] = shapeSeed[i]!;

      // Dissolving near the peak: where the bio's dust leaves from.
      if (
        height > 0.7 &&
        sources.length < sourcePool.length &&
        (which === "centre" || which === "left" || which === "right")
      ) {
        sources.push(sourcePool[sources.length]!.set(x, y, z));
      }
    }
    positionAttribute.needsUpdate = true;
    velocityAttribute.needsUpdate = true;
    dataAttribute.needsUpdate = true;
    wispMaterial.uniforms.uTime!.value = time;
    ribbons.update(time, energy, go);

    for (let g = 0; g < glitterCount; g += 1) {
      const host = glitterHost[g]! * 3;
      glitterPosition[g * 3] = pos[host]! + glitterOffset[g * 3]!;
      glitterPosition[g * 3 + 1] = pos[host + 1]! + glitterOffset[g * 3 + 1]!;
      glitterPosition[g * 3 + 2] = pos[host + 2]! + glitterOffset[g * 3 + 2]!;
    }
    glitterAttribute.needsUpdate = true;
    glitterMaterial.uniforms.uTime!.value = time;
    glitterMaterial.uniforms.uStrength!.value = (0.45 + energy * 0.3) * (1 - go * 0.5);

    for (const material of shaftMaterials) {
      material.uniforms.uTime!.value = time;
      material.uniforms.uStrength!.value = (0.1 + energy * 0.06) * (1 - go * 0.5);
    }
    for (const material of mistMaterials) {
      material.uniforms.uTime!.value = time;
      material.uniforms.uStrength!.value = (0.32 + energy * 0.12) * (1 - go);
    }
  };

  return {
    group,
    update,
    sourcePoints: () => sources,
    laneLight: (which) => lights[which],
    dispose: () => {
      ribbons.dispose();
      quad.dispose();
      wispGeometry.dispose();
      wispMaterial.dispose();
      glitterGeometry.dispose();
      glitterMaterial.dispose();
      shaftGeometry.dispose();
      shaftMaterials.forEach((material) => material.dispose());
      mistGeometry.dispose();
      mistMaterials.forEach((material) => material.dispose());
    },
  };
}
