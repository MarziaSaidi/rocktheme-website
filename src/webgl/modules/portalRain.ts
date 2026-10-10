import {
  AdditiveBlending,
  BufferAttribute,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  type PerspectiveCamera,
  type Scene,
} from "three";
import type { QualityTier } from "../core/quality";

/** World-space falling light. One pooled simulation, one instanced draw, no private clock. */
const CAPACITY = 3000;
const BUDGET = { high: 2400, medium: 1200, low: 450 } as const;
const VERTEX = /* glsl */ `
attribute vec2 corner;
attribute vec3 iPosition;
attribute vec3 iVelocity;
attribute vec4 iLook;
uniform vec2 uViewport;
uniform float uPixelScale;
varying vec2 vCorner;
varying vec4 vLook;
varying float vStretch;
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPosition, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec3 velocity = mat3(viewMatrix) * iVelocity;
  vec2 along = normalize(velocity.xy + vec2(0.00001));
  vec2 across = vec2(along.y, -along.x);
  float radius = clamp(iLook.x * uPixelScale / max(1.0, -mv.z), 0.9, 3.8);
  float tail = iLook.w > 0.72 && iLook.w < 0.93 ? 0.20 : 0.014;
  float extension = min(22.0, length(velocity.xy) * tail * uPixelScale / max(1.0, -mv.z));
  float halfLength = radius + extension;
  clip.xy += (along * corner.y * halfLength + across * corner.x * radius) * 2.0 / uViewport * clip.w;
  vCorner = corner;
  vLook = iLook;
  vStretch = halfLength / radius;
  vDepth = -mv.z;
  gl_Position = clip;
}
`;
const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec2 uFogRange;
varying vec2 vCorner;
varying vec4 vLook;
varying float vStretch;
varying float vDepth;
void main() {
  vec2 p = vec2(vCorner.x, vCorner.y * vStretch);
  float core = exp(-dot(p, p) * 4.5);
  float trail = exp(-p.x * p.x * 13.0) * pow(max(0.0, 1.0 - abs(vCorner.y)), 2.5);
  float shape = max(core, trail * (vLook.w > 0.72 && vLook.w < 0.93 ? 0.48 : 0.15));
  if (vLook.w > 0.97) {
    shape = max(shape, (exp(-abs(p.x) * 15.0) * exp(-abs(p.y) * 1.5)
      + exp(-abs(p.y) * 15.0) * exp(-abs(p.x) * 1.5)) * 0.5);
  }
  vec3 colour = mix(vec3(0.24, 0.64, 1.0), vec3(0.72, 0.39, 1.0), smoothstep(0.0, 0.5, vLook.y));
  colour = mix(colour, vec3(0.93, 0.40, 0.84), smoothstep(0.5, 0.88, vLook.y));
  colour = mix(colour, vec3(0.83, 0.94, 1.0), smoothstep(0.94, 1.0, vLook.y));
  float atmosphere = 1.0 - smoothstep(uFogRange.x, uFogRange.y, vDepth);
  float alpha = shape * vLook.z * atmosphere;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(colour * alpha, alpha);
}
`;

export type RainEmitter = (seed: number, position: Vector3, outward: Vector3) => boolean;
export function createPortalRain(
  scene: Scene,
  reducedMotion: boolean,
  impact: (x: number, z: number, colour: number, strength: number) => boolean,
) {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute(
    "corner",
    new BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const position = new InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
  const velocity = new InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
  const look = new InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const attributes = [position, velocity, look];
  for (const a of attributes) a.setUsage(DynamicDrawUsage);
  geometry.setAttribute("iPosition", position);
  geometry.setAttribute("iVelocity", velocity);
  geometry.setAttribute("iLook", look);
  geometry.instanceCount = 0;
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uViewport: { value: new Vector2() },
      uFogRange: { value: new Vector2(19, 70) },
      uPixelScale: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "portal-falling-stars";
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  mesh.visible = false;
  scene.add(mesh);
  // Each slot retains world position, velocity, age and appearance until it expires.
  const p = new Float32Array(CAPACITY * 3);
  const v = new Float32Array(CAPACITY * 3);
  const age = new Float32Array(CAPACITY);
  const lifetime = new Float32Array(CAPACITY);
  const seeds = new Float32Array(CAPACITY);
  const sizes = new Float32Array(CAPACITY);
  const colours = new Float32Array(CAPACITY);
  const brightness = new Float32Array(CAPACITY);
  const kind = new Float32Array(CAPACITY);
  const state = new Uint8Array(CAPACITY); // 0 free, 1 falling, 2 dissolving, 3 splash
  const hitAge = new Float32Array(CAPACITY);
  const birth = new Vector3();
  const outward = new Vector3();
  const ray = new Vector3();
  const forward = new Vector3();
  const cursorRay = new Vector3();
  const cursorOrigin = new Vector3();
  let cursorActive = false;
  let cursorCone = 0;
  let next = 0,
    alive = 0,
    rate = 0,
    credit = 0,
    time = 0;
  let totalBirths = 0,
    totalImpacts = 0,
    updateMs = 0;
  let budget: number = BUDGET.high;
  const freeSlot = () => {
    for (let k = 0; k < CAPACITY; k++) {
      const i = next++ % CAPACITY;
      if (state[i] === 0) return i;
    }
    return -1;
  };
  const spawn = (emit: RainEmitter, compact: boolean) => {
    const seed = Math.random();
    if (!emit(seed, birth, outward) || birth.y < 0.12) return;
    const i = freeSlot();
    if (i < 0) return;
    const j = i * 3;
    p[j] = birth.x;
    p[j + 1] = birth.y;
    p[j + 2] = birth.z;
    const spread = compact ? 0.65 : 1;
    const forward = (1.0 + Math.random() * 2.0) * spread;
    const sideways = (Math.random() - 0.5) * (seed > 0.85 ? 4.0 : 2.4) * spread;
    v[j] = outward.x * forward + outward.z * sideways;
    v[j + 1] = (Math.random() - 0.68) * 0.6;
    v[j + 2] = outward.z * forward - outward.x * sideways;
    age[i] = 0;
    lifetime[i] = 9;
    seeds[i] = Math.random() * 100;
    kind[i] = Math.random();
    sizes[i] = 0.032 + Math.pow(Math.random(), 3) * 0.052;
    if (kind[i]! > 0.97) sizes[i] *= 1.9;
    colours[i] = Math.random();
    brightness[i] = kind[i]! > 0.97 ? 0.95 : 0.3 + Math.random() * 0.42;
    state[i] = 1;
    alive++;
    totalBirths++;
  };
  return {
    mesh,
    setPointer: (
      pointer: { x: number; y: number } | null,
      camera: PerspectiveCamera,
      width: number,
      height: number,
    ) => {
      cursorActive = pointer !== null && !reducedMotion;
      if (!cursorActive || !pointer) return;
      cursorOrigin.copy(camera.position);
      cursorRay
        .set((pointer.x / width) * 2 - 1, 1 - (pointer.y / height) * 2, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      cursorCone = (85 / height) * 2 * Math.tan((camera.fov * Math.PI) / 360);
    },
    releaseFromBio: (
      x: number,
      y: number,
      seed: number,
      camera: PerspectiveCamera,
      depth: number,
      width: number,
      height: number,
    ) => {
      if (reducedMotion || alive >= budget) return;
      camera.updateMatrixWorld();
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      ray
        .set((x / width) * 2 - 1, 1 - (y / height) * 2, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      birth.copy(camera.position).addScaledVector(ray, depth / Math.max(0.1, ray.dot(forward)));
      if (birth.y < 0.1) return;
      const i = freeSlot();
      if (i < 0) return;
      const j = i * 3;
      p[j] = birth.x;
      p[j + 1] = birth.y;
      p[j + 2] = birth.z;
      v[j] = (seed - 0.5) * 0.7;
      v[j + 1] = -0.12 - seed * 0.3;
      v[j + 2] = (Math.random() - 0.5) * 0.5;
      age[i] = 0;
      lifetime[i] = 12;
      seeds[i] = Math.random() * 100;
      kind[i] = Math.random();
      colours[i] = 0.2 + Math.random() * 0.8;
      sizes[i] = 0.035 + Math.pow(seed, 3) * 0.055;
      brightness[i] = kind[i]! > 0.97 ? 1.15 : 0.5 + seed * 0.5;
      state[i] = 1;
      alive++;
      totalBirths++;
    },
    setQuality: (tier: QualityTier) => {
      budget = BUDGET[tier];
    },
    update: (
      delta: number,
      intensity: number,
      moving: boolean,
      compact: boolean,
      emit: RainEmitter,
      camera: PerspectiveCamera,
      width: number,
      height: number,
    ) => {
      if (reducedMotion) return;
      const start = performance.now();
      const dt = Math.min(delta, 0.1);
      time += dt;
      const target = ((intensity * (moving ? 1 : 0.28) * budget) / 3.8) * (compact ? 0.65 : 1);
      rate += (target - rate) * (1 - Math.exp(-dt * (target > rate ? 1.1 : 1.6)));
      credit = Math.min(24, credit + rate * dt);
      while (credit >= 1) {
        credit--;
        if (alive < budget) spawn(emit, compact);
      }
      const positions = position.array as Float32Array;
      const velocities = velocity.array as Float32Array;
      const looks = look.array as Float32Array;
      let count = 0;
      for (let i = 0; i < CAPACITY; i++) {
        if (!state[i]) continue;
        const j = i * 3;
        age[i] = age[i]! + dt;
        if (age[i]! > lifetime[i]!) {
          state[i] = 0;
          alive--;
          continue;
        }
        const seed = seeds[i]!;
        if (state[i] === 1 || state[i] === 3) {
          const gravity = state[i] === 3 ? 3.4 : 0.85 + (seed % 1) * 0.9;
          v[j + 1] = v[j + 1]! - gravity * dt;
          if (state[i] === 1) {
            v[j] = v[j]! + Math.sin(time * 0.7 + seed + p[j + 1]! * 0.4) * dt * 0.16;
            v[j + 2] = v[j + 2]! + Math.cos(time * 0.57 + seed) * dt * 0.11;
            // A local air current responds to the cursor. Gravity and water
            // collision stay unchanged; touch and departing scenes never apply it.
            if (cursorActive && p[j + 1]! > 0.4) {
              const dx = p[j]! - cursorOrigin.x;
              const dy = p[j + 1]! - cursorOrigin.y;
              const dz = p[j + 2]! - cursorOrigin.z;
              const along = dx * cursorRay.x + dy * cursorRay.y + dz * cursorRay.z;
              const x = dx - cursorRay.x * along;
              const y = dy - cursorRay.y * along;
              const z = dz - cursorRay.z * along;
              const distance = Math.sqrt(x * x + y * y + z * z);
              const radius = Math.min(2.5, Math.max(0.5, along * cursorCone));
              if (along > 0 && distance < radius) {
                const force =
                  (Math.pow(1 - distance / radius, 2) * dt * 0.12) / Math.max(0.2, distance);
                v[j] = v[j]! + x * force;
                v[j + 2] = v[j + 2]! + z * force;
              }
            }
          }
          p[j] = p[j]! + v[j]! * dt;
          p[j + 1] = p[j + 1]! + v[j + 1]! * dt;
          p[j + 2] = p[j + 2]! + v[j + 2]! * dt;
          if (p[j + 1]! <= 0.025) {
            p[j + 1] = 0.025;
            if (
              state[i] === 1 &&
              seed % 1 < 0.11 &&
              impact(p[j]!, p[j + 2]!, colours[i]!, brightness[i]!)
            ) {
              totalImpacts++;
              // Two extremely small ballistic splashes reuse the particle pool and draw.
              for (let k = 0; k < 2; k++) {
                const s = freeSlot();
                if (s < 0) break;
                const sj = s * 3,
                  a = Math.random() * Math.PI * 2;
                p[sj] = p[j]!;
                p[sj + 1] = 0.04;
                p[sj + 2] = p[j + 2]!;
                v[sj] = Math.cos(a) * 0.18;
                v[sj + 1] = 0.4 + Math.random() * 0.2;
                v[sj + 2] = Math.sin(a) * 0.18;
                age[s] = 0;
                lifetime[s] = 0.4;
                seeds[s] = seed;
                sizes[s] = 0.012;
                colours[s] = colours[i]!;
                brightness[s] = 0.65;
                kind[s] = 0.1;
                state[s] = 3;
                alive++;
              }
            }
            state[i] = 2;
            hitAge[i] = age[i]!;
            v[j] = 0;
            v[j + 1] = 0;
            v[j + 2] = 0;
          }
        }
        const dissolve = state[i] === 2 ? Math.max(0, 1 - (age[i]! - hitAge[i]!) / 0.28) : 1;
        if (dissolve === 0) {
          state[i] = 0;
          alive--;
          continue;
        }
        const fadeIn = Math.min(1, age[i]! / 0.3);
        const shimmer = 0.78 + 0.22 * Math.sin(time * (1.1 + (seed % 2)) + seed);
        const c = count * 3,
          l = count * 4;
        positions[c] = p[j]!;
        positions[c + 1] = p[j + 1]!;
        positions[c + 2] = p[j + 2]!;
        velocities[c] = v[j]!;
        velocities[c + 1] = v[j + 1]!;
        velocities[c + 2] = v[j + 2]!;
        looks[l] = sizes[i]!;
        looks[l + 1] = colours[i]!;
        looks[l + 2] = brightness[i]! * dissolve * fadeIn * shimmer;
        looks[l + 3] = kind[i]!;
        count++;
      }
      for (const a of attributes) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, count * a.itemSize);
        a.needsUpdate = count > 0;
      }
      geometry.instanceCount = count;
      mesh.visible = count > 0;
      (material.uniforms.uViewport!.value as Vector2).set(width, height);
      (material.uniforms.uFogRange!.value as Vector2).set(compact ? 32 : 19, compact ? 95 : 70);
      material.uniforms.uPixelScale!.value = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
      updateMs = performance.now() - start;
    },
    stats: () => ({ alive, budget, emissionPerSecond: rate, totalBirths, totalImpacts, updateMs }),
    destroy: () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
