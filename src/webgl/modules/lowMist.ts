import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  type PerspectiveCamera,
  type Scene,
} from "three";

import { resolveResponsiveValue, sceneViewportForWidth } from "@/config/responsive";

import type { LowMistConfig } from "../sceneTypes";
import { FADE_RATE } from "./rocks";

/** Upper bound on slices; a viewport shows as many as its detail asks for. */
const MAX_SLICES = 14;
/** Side of the square the mist covers, centred under the Selected Work walk. */
const EXTENT = 230;
const CENTRE = new Vector2(2.7, -20);
/** The first slice sits just clear of the water so the two never z-fight. */
const BASE_HEIGHT = 0.05;
/** Near the viewer the ceiling stays this share of eye height, or lower. */
const EYE_LINE = 0.72;

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/*
 * One horizontal slice of the mist.
 *
 * Every slice samples the same world-space field, so together they read as
 * one body of air rather than a stack of sheets. Two scales carry it: broad
 * banks that decide where mist is at all, and a finer field, warped by the
 * broad one, that frays their edges.
 *
 * The ceiling rises with distance from the viewer. Close by it stays under
 * the eye line, where a slice seen edge-on would be a hard line; far out it
 * climbs round the mountain bases, which is the only place mist can rise
 * above the horizon in a camera this close to the water. Within that ceiling,
 * higher air keeps only the thickest part of each bank and lags a little
 * behind the drift, so the mist has rounded, sheared tops instead of a lid.
 */
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uOpacity;
  uniform float uDensity;
  uniform int uOctaves;
  uniform vec3 uColor;
  uniform vec2 uDrift;
  uniform vec2 uScale;
  /** near start, near end, far start, far end */
  uniform vec4 uFade;
  /** near ceiling, far ceiling, rise start, rise end */
  uniform vec4 uCeiling;

  varying vec3 vWorld;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
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
    float total = 0.0;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      if (i >= uOctaves) break;
      value += noise2D(p) * amplitude;
      total += amplitude;
      p = rotation * p * 2.03 + vec2(17.1, 9.2);
      amplitude *= 0.5;
    }
    return value / total;
  }

  void main() {
    float reachXZ = distance(vWorld.xz, cameraPosition.xz);
    float ceiling = mix(uCeiling.x, uCeiling.y, smoothstep(uCeiling.z, uCeiling.w, reachXZ));
    // Height through the mist at this point, 0 on the water, 1 at its ceiling.
    float layer = clamp(vWorld.y / ceiling, 0.0, 1.0);
    if (layer >= 1.0) discard;

    vec2 drift = uDrift * uTime;
    // Upper air trails the lower, which shears the banks as they move.
    vec2 flow = vWorld.xz - drift * (1.0 - 0.35 * layer);

    vec2 broadP = flow * uScale.x;
    vec2 warp = vec2(fbm(broadP * 0.6 + 3.1), fbm(broadP * 0.6 + vec2(8.3, 1.7))) - 0.5;
    float broad = fbm(broadP + warp * 1.3);
    float fine = fbm(flow * uScale.y + warp * 2.4 + vec2(layer * 2.3, -layer * 1.1));

    // Summed octaves cluster round 0.5; stretched, the banks separate.
    float field = (broad * 0.7 + fine * 0.3 - 0.5) * 2.4 + 0.5;
    float threshold = mix(0.42, 0.6, layer) - (uDensity - 0.5) * 0.3;
    float body = smoothstep(threshold, threshold + 0.3, field);

    // Mist is thickest on the water and thins out toward its ceiling.
    float profile = 1.0 - smoothstep(0.3, 1.0, layer);

    float dist = distance(vWorld, cameraPosition);
    float reach = smoothstep(uFade.x, uFade.y, dist) * (1.0 - smoothstep(uFade.z, uFade.w, dist));
    /*
     * A slice seen at a grazing angle shows its far edge as a hard horizontal
     * line, so each one fades as it flattens out. Above the eye that fade is
     * broad. Below it, only the slices almost level with the eye fade; the
     * rest converge onto the water's horizon as the dense band that belongs
     * there.
     */
    float slope = (vWorld.y - cameraPosition.y) / dist;
    reach *= slope > 0.0 ? smoothstep(0.012, 0.045, slope) : smoothstep(0.003, 0.012, -slope);

    vec2 edge = min(vUv, 1.0 - vUv);
    float border = smoothstep(0.0, 0.12, edge.x) * smoothstep(0.0, 0.12, edge.y);

    float alpha = body * profile * reach * border * uOpacity;
    // Denser cores catch a touch more light than the thin fringes.
    vec3 color = uColor * (0.82 + 0.36 * body * broad);
    gl_FragColor = vec4(color, alpha);
  }
`;

export type LowMist = Readonly<{
  /** Excluded from the water's reflection: mist lies on it, not above it. */
  group: Group;
  update: (deltaSeconds: number, elapsedSeconds: number) => void;
  resize: (width: number, camera: PerspectiveCamera) => void;
  setConfig: (config: LowMistConfig, camera: PerspectiveCamera) => void;
  destroy: () => void;
}>;

export function createLowMist(
  scene: Scene,
  camera: PerspectiveCamera,
  width: number,
  reducedMotion: boolean,
  initialConfig: LowMistConfig,
): LowMist {
  let config = initialConfig;
  let viewportWidth = width;
  /** Eased toward config.opacity so a chapter change never pops the mist. */
  let opacity = config.opacity;
  let slices = 0;

  const group = new Group();
  const geometry = new PlaneGeometry(EXTENT, EXTENT, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const shared = {
    uTime: { value: 0 },
    uDensity: { value: config.density },
    uOctaves: { value: 4 },
    uColor: { value: new Vector3() },
    uDrift: { value: new Vector2() },
    uScale: { value: new Vector2() },
    uFade: { value: new Vector4() },
    uCeiling: { value: new Vector4() },
  };
  const scratch = new Color();

  const meshes = Array.from({ length: MAX_SLICES }, () => {
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: { ...shared, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
      fog: false,
    });
    const mesh = new Mesh(geometry, material);
    // After the water, before the horizon glow.
    mesh.renderOrder = 1;
    mesh.position.set(CENTRE.x, 0, CENTRE.y);
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });
  scene.add(group);

  const applyConfig = () => {
    const rgb = { r: 0, g: 0, b: 0 };
    scratch.setHex(config.color).getRGB(rgb, SRGBColorSpace);
    shared.uColor.value.set(rgb.r, rgb.g, rgb.b);
    shared.uDensity.value = config.density;
    shared.uDrift.value.set(
      Math.cos(config.direction) * config.speed,
      Math.sin(config.direction) * config.speed,
    );
    shared.uScale.value.set(config.noiseScale.large, config.noiseScale.small);
    shared.uFade.value.set(
      config.distance.near[0],
      config.distance.near[1],
      config.distance.far[0],
      config.distance.far[1],
    );
  };

  /*
   * Per-slice opacity is set so a line of sight reaches the configured peak
   * where the mist is dense: 1 - (1 - a)^n = opacity. A ray low over the
   * water crosses about half the stack, so n is half the slice count.
   */
  const applyOpacity = () => {
    const crossed = Math.max(1, slices * 0.5);
    const perSlice = slices > 0 ? 1 - Math.pow(1 - Math.min(opacity, 0.98), 1 / crossed) : 0;
    meshes.forEach((mesh, index) => {
      mesh.visible = index < slices && opacity > 0.002;
      (mesh.material as ShaderMaterial).uniforms.uOpacity!.value = perSlice;
    });
  };

  const layout = (viewCamera: PerspectiveCamera) => {
    const detail = resolveResponsiveValue(config.detail, sceneViewportForWidth(viewportWidth));
    slices = Math.max(1, Math.min(MAX_SLICES, Math.round(detail.slices)));
    shared.uOctaves.value = Math.max(1, Math.min(5, Math.round(detail.octaves)));
    // Seen edge-on a slice is a hard line, so near the viewer the mist stays
    // under the eye.
    const nearCeiling = Math.max(
      BASE_HEIGHT + 0.1,
      Math.min(config.nearHeight, viewCamera.position.y * EYE_LINE),
    );
    const top = Math.max(nearCeiling, config.height);
    shared.uCeiling.value.set(nearCeiling, top, config.distance.rise[0], config.distance.rise[1]);
    meshes.forEach((mesh, index) => {
      const layer = slices > 1 ? index / (slices - 1) : 0;
      // Even spacing: the upper slices are the ones seen against the ridges.
      mesh.position.y = BASE_HEIGHT + layer * (top - BASE_HEIGHT);
    });
    applyOpacity();
  };

  applyConfig();
  layout(camera);

  return {
    group,
    update: (deltaSeconds, elapsedSeconds) => {
      shared.uTime.value = reducedMotion ? 0 : elapsedSeconds;
      if (opacity !== config.opacity) {
        const step = deltaSeconds === 0 ? 1 : Math.min(1, deltaSeconds * FADE_RATE);
        opacity += (config.opacity - opacity) * step;
        if (Math.abs(config.opacity - opacity) < 0.002) opacity = config.opacity;
        applyOpacity();
      }
    },
    resize: (nextWidth, viewCamera) => {
      viewportWidth = nextWidth;
      layout(viewCamera);
    },
    setConfig: (next, viewCamera) => {
      config = next;
      applyConfig();
      layout(viewCamera);
    },
    destroy: () => {
      scene.remove(group);
      meshes.forEach((mesh) => (mesh.material as ShaderMaterial).dispose());
      geometry.dispose();
    },
  };
}
