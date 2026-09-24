import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Scene,
} from "three";

import { horizonLightConfig } from "../sceneConfig";
import type { HorizonLightConfig } from "../sceneTypes";

const MAX_LIGHTS = 4;

/**
 * What the water needs in order to reflect a beacon: where it actually is.
 *
 * The floor mirrors this position through the water plane and tests it against
 * the reflected view vector, so the source and its reflection cannot drift
 * apart — they are the same point of geometry.
 */
export type BeaconSource = Readonly<{
  world: Vector3;
  intensity: number;
  color: Color;
}>;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * vec2(2.0, 1.3);
    float core = exp(-dot(p, p) * 33.0);
    float halo = exp(-dot(p, p) * 6.0) * 0.13;
    gl_FragColor = vec4(uColor, (core + halo) * uIntensity);
  }
`;

export type HorizonLights = Readonly<{
  group: Group;
  update: (deltaSeconds: number, elapsedSeconds: number) => void;
  resize: (camera: PerspectiveCamera) => void;
  beacons: () => readonly BeaconSource[];
  setFocus: (viewportX: number | null) => void;
  setConfig: (config: HorizonLightConfig, camera: PerspectiveCamera) => void;
  intensity: () => number;
  destroy: () => void;
}>;

export function createHorizonLights(
  scene: Scene,
  camera: PerspectiveCamera,
  reducedMotion: boolean,
  initialConfig: HorizonLightConfig = horizonLightConfig,
): HorizonLights {
  let config = initialConfig;
  const group = new Group();
  const geometry = new PlaneGeometry(1, 1);
  const materials: ShaderMaterial[] = [];
  const meshes: Mesh[] = [];
  const gains = Array.from({ length: MAX_LIGHTS }, () => 0);
  const sources: { world: Vector3; intensity: number; color: Color }[] = [];
  const probe = new Vector3();
  let mean = 1;
  let focusIndex = -1;

  Array.from({ length: MAX_LIGHTS }, (_, index) => {
    const source = config.sources[index];
    const color = new Color(source?.color ?? 0);
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uColor: { value: color }, uIntensity: { value: source?.intensity ?? 0 } },
    });
    const mesh = new Mesh(geometry, material);
    mesh.visible = Boolean(source);
    mesh.renderOrder = 2;
    materials.push(material);
    meshes.push(mesh);
    group.add(mesh);
    sources.push({
      world: new Vector3(),
      intensity: source?.intensity ?? 0,
      color,
    });
  });
  scene.add(group);

  const resize = (viewCamera: PerspectiveCamera) => {
    // World x is derived from the desired screen fraction, per source, because
    // each one sits at its own depth and so has its own projection scale.
    viewCamera.updateMatrixWorld();
    meshes.forEach((mesh, index) => {
      const source = config.sources[index];
      mesh.visible = Boolean(source);
      if (!source) return;
      probe.set(1, 0, source.depth).project(viewCamera);
      const x = (2 * source.position - 1) / probe.x;
      mesh.position.set(x, source.elevation, source.depth);
      // A more distant source needs a larger quad to hold the same apparent
      // size, and the wider ones are meant to read as softer and further off.
      const scale = Math.abs(source.depth) * source.spread * 0.9;
      mesh.scale.set(scale, scale, 1);
      sources[index]!.world.copy(mesh.position);
    });
  };
  resize(camera);

  return {
    group,
    resize,
    beacons: () => sources.slice(0, config.sources.length),
    update: (deltaSeconds, elapsedSeconds) => {
      let total = 0;
      const step = Math.min(1, deltaSeconds / config.focusEase);
      config.sources.forEach((source, index) => {
        gains[index]! += ((index === focusIndex ? 1 : 0) - gains[index]!) * step;
        // A slow luminosity drift, well under one cycle per ten seconds. Not a
        // pulse: the eye should never be able to time it.
        const shimmer = reducedMotion
          ? 1
          : 1 + Math.sin(elapsedSeconds * (0.11 + index * 0.037) + source.phase) * source.shimmer;
        const intensity = source.intensity * shimmer * (1 + gains[index]! * config.focusGain);
        materials[index]!.uniforms.uIntensity!.value = intensity;
        sources[index]!.intensity = intensity;
        total += intensity;
      });
      mean = total / config.sources.length;
    },
    setFocus: (viewportX) => {
      if (viewportX === null) {
        focusIndex = -1;
        return;
      }
      focusIndex = config.sources.reduce(
        (closest, source, index) =>
          Math.abs(source.position - viewportX) <
          Math.abs(config.sources[closest]!.position - viewportX)
            ? index
            : closest,
        0,
      );
    },
    setConfig: (next, viewCamera) => {
      config = next;
      meshes.forEach((mesh, index) => {
        const source = next.sources[index];
        const material = materials[index];
        const beacon = sources[index];
        mesh.visible = Boolean(source);
        if (!material || !beacon) return;
        beacon.color.setHex(source?.color ?? 0);
        beacon.intensity = source?.intensity ?? 0;
        material.uniforms.uColor!.value = beacon.color;
      });
      resize(viewCamera);
    },
    intensity: () => mean,
    destroy: () => {
      materials.forEach((material) => material.dispose());
      geometry.dispose();
      scene.remove(group);
    },
  };
}
