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

/** The source and its reflection share this projected contact point. */
export type HorizonReflection = Readonly<{
  x: number;
  y: number;
  intensity: number;
  length: number;
  width: number;
  shimmer: number;
  phase: number;
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
  reflections: () => readonly HorizonReflection[];
  setFocus: (viewportX: number | null) => void;
  intensity: () => number;
  destroy: () => void;
}>;

export function createHorizonLights(
  scene: Scene,
  camera: PerspectiveCamera,
  reducedMotion: boolean,
): HorizonLights {
  const group = new Group();
  const geometry = new PlaneGeometry(1, 1);
  const materials: ShaderMaterial[] = [];
  const meshes: Mesh[] = [];
  const gains = horizonLightConfig.sources.map(() => 0);
  const reflected: HorizonReflection[] = [];
  const probe = new Vector3();
  let mean = 1;
  let focusIndex = -1;

  horizonLightConfig.sources.forEach((source) => {
    const color = new Color(source.color);
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uColor: { value: color }, uIntensity: { value: source.intensity } },
    });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.scale.set(1.05, 1.05, 1);
    materials.push(material);
    meshes.push(mesh);
    group.add(mesh);
    reflected.push({
      x: source.position,
      y: 0.28,
      intensity: source.intensity,
      length: source.reflectionLength,
      width: source.width,
      shimmer: source.shimmer,
      phase: source.phase,
      color,
    });
  });
  scene.add(group);

  const resize = (viewCamera: PerspectiveCamera) => {
    // World x is derived from the desired screen fraction. Projecting the
    // same floor contact point keeps every glint under its source on resize.
    viewCamera.updateMatrixWorld();
    probe.set(1, 0, horizonLightConfig.depth).project(viewCamera);
    const xProjection = probe.x;
    horizonLightConfig.sources.forEach((source, index) => {
      const x = (2 * source.position - 1) / xProjection;
      meshes[index]!.position.set(x, 0.38, horizonLightConfig.depth);
      probe.set(x, 0, horizonLightConfig.depth).project(viewCamera);
      reflected[index] = {
        ...reflected[index]!,
        x: (probe.x + 1) * 0.5,
        y: (probe.y + 1) * 0.5,
      };
    });
  };
  resize(camera);

  return {
    group,
    resize,
    reflections: () => reflected,
    update: (deltaSeconds, elapsedSeconds) => {
      let total = 0;
      const step = Math.min(1, deltaSeconds / horizonLightConfig.focusEase);
      horizonLightConfig.sources.forEach((source, index) => {
        gains[index]! += ((index === focusIndex ? 1 : 0) - gains[index]!) * step;
        const shimmer = reducedMotion
          ? 1
          : 1 + Math.sin(elapsedSeconds * (0.33 + index * 0.11) + source.phase) * source.shimmer;
        const intensity =
          source.intensity * shimmer * (1 + gains[index]! * horizonLightConfig.focusGain);
        materials[index]!.uniforms.uIntensity!.value = intensity;
        reflected[index] = { ...reflected[index]!, intensity };
        total += intensity;
      });
      mean = total / horizonLightConfig.sources.length;
    },
    setFocus: (viewportX) => {
      if (viewportX === null) {
        focusIndex = -1;
        return;
      }
      focusIndex = horizonLightConfig.sources.reduce(
        (closest, source, index) =>
          Math.abs(source.position - viewportX) <
          Math.abs(horizonLightConfig.sources[closest]!.position - viewportX)
            ? index
            : closest,
        0,
      );
    },
    intensity: () => mean,
    destroy: () => {
      materials.forEach((material) => material.dispose());
      geometry.dispose();
      scene.remove(group);
    },
  };
}
