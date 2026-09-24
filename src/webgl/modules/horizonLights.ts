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

/*
 * Light scattered through atmosphere, not a light object.
 *
 * The visible mass is a wide, flat scattering lobe; the source itself is a tiny
 * bright core. Drawing the source large is what produces a glowing purple bulb,
 * so it stays small and the width does the work. Brightness desaturates toward
 * pale lavender rather than intensifying into neon.
 */
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uIntensity;
  uniform float uSeed;

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise2D(p) * amplitude;
      p = p * 2.03 + vec2(17.1, 9.2);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 p = vUv - 0.5;

    // Much wider than tall, so the glow cannot read as a floating orb.
    vec2 atmosphereP = vec2(p.x / 0.48, p.y / 0.16);
    float atmosphere = exp(-dot(atmosphereP, atmosphereP) * 2.2);

    vec2 innerP = vec2(p.x / 0.17, p.y / 0.075);
    float innerGlow = exp(-dot(innerP, innerP) * 2.5);

    /*
     * The actual source. The quad is roughly 2.2 times wider than tall, so the
     * two radii stay in that ratio: equal fractions would stretch the core into
     * the horizontal dash this replaced. Bigger than a pinpoint, still a point.
     */
    vec2 sourceP = vec2(p.x / 0.014, p.y / 0.028);
    float source = exp(-dot(sourceP, sourceP) * 3.4);

    float noise = fbm(vec2(vUv.x * 5.0 + uSeed, vUv.y * 4.0 + uTime * 0.008));
    atmosphere *= mix(0.78, 1.10, noise);

    // Strongest scattering stays near the horizon.
    float horizonMask = exp(-pow((vUv.y - 0.47) / 0.24, 2.0));
    atmosphere *= horizonMask;

    // The core carries more weight now that it covers far fewer pixels.
    float alpha = atmosphere * 0.15 + innerGlow * 0.18 + source * 0.95;
    alpha *= uIntensity;

    vec3 outerColor = vec3(0.23, 0.16, 0.31);
    vec3 innerColor = vec3(0.52, 0.39, 0.68);
    vec3 sourceColor = vec3(0.90, 0.84, 1.0);

    vec3 color =
      outerColor * atmosphere +
      innerColor * innerGlow * 0.55 +
      sourceColor * source;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.78));
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
  /** Viewport-fraction centre and spread of each source, for the mist. */
  illumination: () => readonly [number, number][];
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
  const centres: [number, number][] = [];
  const probe = new Vector3();
  let mean = 1;
  let focusIndex = -1;

  Array.from({ length: MAX_LIGHTS }, (_, index) => {
    const source = config.sources[index];
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: source?.intensity ?? 0 },
        uSeed: { value: source?.seed ?? 0 },
      },
    });
    const mesh = new Mesh(geometry, material);
    mesh.visible = Boolean(source);
    mesh.renderOrder = 3;
    materials.push(material);
    meshes.push(mesh);
    group.add(mesh);
    sources.push({
      world: new Vector3(),
      intensity: source?.intensity ?? 0,
      color: new Color(source?.color ?? 0),
    });
    centres.push([source?.position ?? 0, source?.spread ?? 0.1]);
  });
  scene.add(group);

  const resize = (viewCamera: PerspectiveCamera) => {
    // World x comes from the wanted screen fraction, per source, because each
    // one sits at its own depth and so has its own projection scale.
    viewCamera.updateMatrixWorld();
    meshes.forEach((mesh, index) => {
      const source = config.sources[index];
      mesh.visible = Boolean(source);
      if (!source) return;
      probe.set(1, 0, source.depth).project(viewCamera);
      const x = (2 * source.position - 1) / probe.x;
      mesh.position.set(x, source.elevation, source.depth);
      mesh.scale.set(source.width, source.height, 1);
      sources[index]!.world.copy(mesh.position);
      centres[index] = [source.position, source.spread];
    });
  };
  resize(camera);

  return {
    group,
    resize,
    beacons: () => sources.slice(0, config.sources.length),
    illumination: () => centres.slice(0, config.sources.length),
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
        const material = materials[index]!;
        material.uniforms.uIntensity!.value = intensity;
        material.uniforms.uTime!.value = reducedMotion ? 0 : elapsedSeconds;
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
        material.uniforms.uSeed!.value = source?.seed ?? 0;
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
