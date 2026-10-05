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

import { BIO_DUST_STRIDE, type BioDustFrame } from "../bioDustChannel";

/**
 * The bio's dust, inside the world.
 *
 * The page decides where every grain is on screen; this places each one at
 * the rift's depth along its own line of sight, so the dust stands in the
 * same air as the mountain: the stone hides grains going into the crack, and
 * the water mirrors the ones leaving its mouth. A grain lifting towards the
 * viewer comes nearer, grows and goes out of focus. A moving grain is drawn
 * as a short streak along its motion, as long as the exposure the page asks for.
 */

/** The most grains drawn at once: two titles crossing. */
const CAPACITY = 16000;
/** How far towards the viewer a fully lifted grain comes, as a share of the rift's depth. */
const LIFT_NEARER = 0.45;

const VERTEX = /* glsl */ `
attribute vec2 corner;
attribute vec3 iPosition;
attribute vec2 iVelocity;
attribute vec4 iLook;

uniform vec2 uViewport;
uniform float uExposure;

varying vec2 vCorner;
varying float vStretch;
varying float vAlpha;
varying float vSoft;
varying vec3 vColour;

const vec3 LAVENDER = vec3(0.718, 0.576, 0.824);
const vec3 MOONLIT = vec3(0.769, 0.667, 0.941);
const vec3 PORCELAIN = vec3(0.957, 0.933, 0.98);

void main() {
  float size = iLook.x;
  float colour = iLook.y;
  float alpha = iLook.z;
  float blur = iLook.w;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(iPosition, 1.0);

  // Screen pixels, y up like clip space.
  vec2 smear = vec2(iVelocity.x, -iVelocity.y) * uExposure;
  float length_ = length(smear);
  vec2 along = length_ > 0.01 ? smear / length_ : vec2(1.0, 0.0);
  vec2 across = vec2(-along.y, along.x);
  float radius = size * 0.5 * (1.0 + blur * 2.5) + 0.6;
  float half_ = radius + length_ * 0.5;
  vec2 offset = along * corner.x * half_ + across * corner.y * radius;
  clip.xy += offset * 2.0 / uViewport * clip.w;

  vCorner = corner;
  vStretch = half_ / radius;
  vSoft = blur;
  // The same light spread over a larger streak or a defocused disc is fainter.
  vAlpha = alpha * mix(1.0, radius / half_, 0.6) / (1.0 + blur * 2.0);
  vColour = colour < 0.5
    ? mix(LAVENDER, MOONLIT, colour * 2.0)
    : mix(MOONLIT, PORCELAIN, colour * 2.0 - 1.0);
  gl_Position = clip;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vCorner;
varying float vStretch;
varying float vAlpha;
varying float vSoft;
varying vec3 vColour;

void main() {
  // A capsule: a disc drawn out along the grain's motion.
  vec2 p = vec2(vCorner.x * vStretch, vCorner.y);
  float d = length(vec2(max(abs(p.x) - (vStretch - 1.0), 0.0), p.y));
  float edge = mix(0.45, 0.05, vSoft);
  float a = (1.0 - smoothstep(edge, 1.0, d)) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColour * a, a);
}
`;

export type BioDust = Readonly<{
  /** Places the page's grains at `focus` (metres from the viewer) along their lines of sight. */
  update: (
    camera: PerspectiveCamera,
    frame: BioDustFrame | null,
    focus: number | null,
    width: number,
    height: number,
  ) => void;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
}>;

export function createBioDust(scene: Scene): BioDust {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute(
    "corner",
    new BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const positions = new InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
  const velocities = new InstancedBufferAttribute(new Float32Array(CAPACITY * 2), 2);
  const looks = new InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  for (const attribute of [positions, velocities, looks]) attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("iPosition", positions);
  geometry.setAttribute("iVelocity", velocities);
  geometry.setAttribute("iLook", looks);
  geometry.instanceCount = 0;

  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uViewport: { value: new Vector2(1, 1) },
      uExposure: { value: 1 / 60 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  scene.add(mesh);

  const eye = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const forward = new Vector3();
  let visible = true;

  return {
    update: (camera, frame, focus, width, height) => {
      if (!visible || !frame || focus === null || frame.count === 0) {
        geometry.instanceCount = 0;
        return;
      }
      camera.updateMatrixWorld();
      const m = camera.matrixWorld.elements;
      eye.setFromMatrixPosition(camera.matrixWorld);
      right.set(m[0]!, m[1]!, m[2]!).normalize();
      up.set(m[4]!, m[5]!, m[6]!).normalize();
      forward.set(-m[8]!, -m[9]!, -m[10]!).normalize();
      const tanY = Math.tan((camera.fov * Math.PI) / 360);
      const tanX = tanY * camera.aspect;
      const count = Math.min(CAPACITY, frame.count);
      const grains = frame.grains;
      const p = positions.array as Float32Array;
      const v = velocities.array as Float32Array;
      const l = looks.array as Float32Array;
      for (let i = 0; i < count; i += 1) {
        const g = i * BIO_DUST_STRIDE;
        const lift = grains[g + 7]!;
        const depth = focus * (1 - LIFT_NEARER * lift);
        const nx = (grains[g]! / width) * 2 - 1;
        const ny = 1 - (grains[g + 1]! / height) * 2;
        const sx = nx * tanX * depth;
        const sy = ny * tanY * depth;
        p[i * 3] = eye.x + forward.x * depth + right.x * sx + up.x * sy;
        p[i * 3 + 1] = eye.y + forward.y * depth + right.y * sx + up.y * sy;
        p[i * 3 + 2] = eye.z + forward.z * depth + right.z * sx + up.z * sy;
        v[i * 2] = grains[g + 5]!;
        v[i * 2 + 1] = grains[g + 6]!;
        // Nearer is larger on screen, and out of focus.
        l[i * 4] = grains[g + 2]! * (focus / depth);
        l[i * 4 + 1] = grains[g + 3]!;
        l[i * 4 + 2] = grains[g + 4]!;
        l[i * 4 + 3] = lift;
      }
      positions.clearUpdateRanges();
      positions.addUpdateRange(0, count * 3);
      velocities.clearUpdateRanges();
      velocities.addUpdateRange(0, count * 2);
      looks.clearUpdateRanges();
      looks.addUpdateRange(0, count * 4);
      positions.needsUpdate = true;
      velocities.needsUpdate = true;
      looks.needsUpdate = true;
      geometry.instanceCount = count;
      (material.uniforms.uViewport!.value as Vector2).set(width, height);
      material.uniforms.uExposure!.value = frame.exposure;
    },
    setVisible: (next) => {
      visible = next;
      mesh.visible = next;
      if (!next) geometry.instanceCount = 0;
    },
    destroy: () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
