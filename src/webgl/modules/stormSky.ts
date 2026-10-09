import {
  BackSide,
  Color,
  Mesh,
  NormalBlending,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type PerspectiveCamera,
  type Scene,
} from "three";

import { createWeatherUniforms, WEATHER_GLSL, type WeatherUniforms } from "../core/weather";

import type { QualityTier } from "../core/quality";
import { stormSkyConfig } from "../sceneConfig";
import { STORM_CLOUD_GLSL } from "./stormCloudField";

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vSkyDirection;
  void main() {
    // Local directions stay aligned with the world, not the camera's rotation.
    vSkyDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // An infinitely distant sky: every landscape depth can occlude it.
    gl_Position.z = gl_Position.w;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  uniform vec3 uBase;
  uniform vec3 uCloud;
  varying vec3 vSkyDirection;

  ${WEATHER_GLSL}
  ${STORM_CLOUD_GLSL}

  void main() {
    vec3 direction = normalize(vSkyDirection);
    // Directional coordinates avoid a wrap seam or pole in a UV sky texture.
    // The broad horizon fade leaves the DOM background visible at the water.
    float horizon = smoothstep(0.015, 0.28, direction.y);
    if (horizon <= 0.0) discard;
    float cloud = stormCloudDensity(direction);
    vec3 color = mix(uBase, uCloud, cloud);
    float alpha = uOpacity * horizon * mix(0.2, 1.0, cloud);
    // Premultiplied normal blending preserves calm coverage while carrying
    // emitted cloud radiance without multiplying the flash by alpha again.
    gl_FragColor = vec4(color * alpha + stormCloudRadiance(direction, cloud), alpha);
  }
`;

export type StormSky = Readonly<{
  mesh: Mesh<SphereGeometry, ShaderMaterial>;
  update: (elapsedSeconds: number, camera: PerspectiveCamera) => void;
  setQuality: (tier: QualityTier, width: number) => void;
  destroy: () => void;
}>;

/** Main portfolio's sky. Owns one surface, with no render target or extra pass. */
export function createStormSky(
  scene: Scene,
  reducedMotion: boolean,
  tier: QualityTier,
  width: number,
  weather: WeatherUniforms = createWeatherUniforms(),
): StormSky {
  const displayColor = (hex: number) => {
    const rgb = { r: 0, g: 0, b: 0 };
    new Color(hex).getRGB(rgb, SRGBColorSpace);
    return new Vector3(rgb.r, rgb.g, rgb.b);
  };
  const uniforms = {
    ...weather,
    uOpacity: { value: stormSkyConfig.opacity },
    uBase: { value: displayColor(stormSkyConfig.base) },
    uCloud: { value: displayColor(stormSkyConfig.cloud) },
  };
  const geometry = new SphereGeometry(1, 32, 16);
  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
    side: BackSide,
    transparent: true,
    premultipliedAlpha: true,
    blending: NormalBlending,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "portfolio-storm-sky";
  mesh.frustumCulled = false;
  // First transparent surface; opaque mountains have already written depth.
  mesh.renderOrder = -10;
  scene.add(mesh);

  let qualityTier = tier;
  const setQuality = (nextTier: QualityTier, nextWidth: number) => {
    qualityTier = nextTier;
    weather.uWeatherCloudOctaves.value =
      nextTier === "low" ? 1 : nextTier === "high" && nextWidth >= 1024 ? 3 : 2;
  };
  setQuality(tier, width);

  return {
    mesh,
    setQuality,
    update: (elapsedSeconds, camera) => {
      // Follow translation only: distant clouds have no ground-level parallax.
      mesh.position.copy(camera.position);
      weather.uWeatherCloudTime.value = reducedMotion || qualityTier === "low" ? 0 : elapsedSeconds;
    },
    destroy: () => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    },
  };
}
