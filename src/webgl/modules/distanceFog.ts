import { Color, SRGBColorSpace, Vector3, Vector4, type MeshStandardMaterial } from "three";

import { createWeatherUniforms, WEATHER_GLSL, type WeatherUniforms } from "../core/weather";
import { lightningConfig } from "../sceneConfig";

import type { SceneViewport } from "@/config/responsive";
import { lowMistConfig } from "../sceneConfig";
import { MIST_FIELD_GLSL } from "./mistField";

import type { DistanceFogConfig } from "../sceneTypes";

/**
 * Aerial perspective for far geometry.
 *
 * The scene's linear fog is tuned for the rocks standing 15 to 25 units out;
 * anything past its far distance comes out solid fog colour. The mountain
 * range stands well beyond that, so it opts out of scene fog and takes this
 * instead: one optical path through world-space air. Near surfaces keep their
 * contrast; longer paths and moisture between low ridges soften distant detail.
 * The existing lightning response is added after this calm transport.
 *
 * It is blended after the colour-space conversion, as three.js does with its
 * own fog, so the colour is uploaded in the output (sRGB) space and matches
 * the DOM background the canvas composites over.
 */

export type DistanceFogUniforms = WeatherUniforms & {
  uAtmosColor: { value: Vector3 };
  uAtmosLow: { value: Vector3 };
  /** x distance, y density, z height, w heightDensity */
  uAtmosShape: { value: Vector4 };
  uAtmosMax: { value: number };
  uAtmosTime: { value: number };
  uOctaves: { value: number };
  /** scale, drift x, drift z, valley strength */
  uAtmosMist: { value: Vector4 };
};

/** Optical depth and its low-air share; also used by the real GPU distance probe. */
export const ATMOSPHERIC_PATH_GLSL = /* glsl */ `
  vec2 atmospherePath(vec3 surface, vec3 eye, vec4 shape, float valleyMist, float bank) {
    float path = max(distance(surface, eye) - shape.x * 0.45, 0.0);
    float densityPath = shape.y * path;
    float eyeHeight = max(eye.y, 0.0) / shape.z;
    float faceHeight = max(surface.y, 0.0) / shape.z;
    float heightDelta = faceHeight - eyeHeight;
    float heightMean = abs(heightDelta) < 0.001
      ? exp(-0.5 * (eyeHeight + faceHeight))
      : (exp(-eyeHeight) - exp(-faceHeight)) / heightDelta;
    float bankDensity = mix(0.65, 1.25, smoothstep(0.25, 0.75, bank));
    float valleyDepth = heightMean * path / max(shape.x * 1.4, 1.0)
      * (shape.w + valleyMist * bankDensity);
    return vec2(densityPath * (0.5 + densityPath) + valleyDepth, valleyDepth);
  }
`;

const scratch = new Color();

/** Legacy altitude channel kept for the frozen journey; fog now integrates the view ray. */
export const aerialMist = {
  uAerialLift: { value: 0 },
  uAerialMist: { value: new Vector3(0.2, 0.175, 0.27) },
};

export function createDistanceFogUniforms(
  config: DistanceFogConfig,
  weather: WeatherUniforms = createWeatherUniforms(),
): DistanceFogUniforms {
  const uniforms: DistanceFogUniforms = {
    ...weather,
    uAtmosColor: { value: new Vector3() },
    uAtmosLow: { value: new Vector3() },
    uAtmosShape: { value: new Vector4() },
    uAtmosMax: { value: 0 },
    uAtmosTime: { value: 0 },
    uOctaves: { value: 3 },
    uAtmosMist: {
      value: new Vector4(
        lowMistConfig.noiseScale.large,
        Math.cos(lowMistConfig.direction) * lowMistConfig.speed,
        Math.sin(lowMistConfig.direction) * lowMistConfig.speed,
        config.valleyMist ?? 0,
      ),
    },
  };
  setDistanceFog(uniforms, config);
  return uniforms;
}

export function setDistanceFog(uniforms: DistanceFogUniforms, config: DistanceFogConfig) {
  scratch.setHex(config.color);
  const rgb = { r: 0, g: 0, b: 0 };
  scratch.getRGB(rgb, SRGBColorSpace);
  uniforms.uAtmosColor.value.set(rgb.r, rgb.g, rgb.b);
  scratch.setHex(config.lowColor ?? config.color);
  scratch.getRGB(rgb, SRGBColorSpace);
  uniforms.uAtmosLow.value.set(rgb.r, rgb.g, rgb.b);
  uniforms.uAtmosShape.value.set(
    config.distance,
    config.density,
    Math.max(config.height, 0.001),
    config.heightDensity,
  );
  uniforms.uAtmosMax.value = config.maxAmount;
  uniforms.uAtmosMist.value.w = config.valleyMist ?? 0;
}

/** Uses the existing scene clock; no timers or independent animation loop. */
export function updateDistanceFog(
  uniforms: DistanceFogUniforms,
  elapsed: number,
  reducedMotion: boolean,
  viewport: SceneViewport,
) {
  uniforms.uAtmosTime.value = reducedMotion ? 0 : elapsed;
  uniforms.uOctaves.value = viewport === "desktop" ? 3 : 2;
}

export function applyDistanceFog(material: MeshStandardMaterial, uniforms: DistanceFogUniforms) {
  // Scene fog would flatten the range to its colour; this replaces it.
  material.fog = false;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vAtmosWorld;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvAtmosWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vAtmosWorld;
         uniform vec3 uAtmosColor;
         uniform vec3 uAtmosLow;
         uniform vec4 uAtmosShape;
         uniform float uAtmosMax;
         uniform float uAtmosTime;
         uniform int uOctaves;
         uniform vec4 uAtmosMist;
         ${WEATHER_GLSL}
         ${MIST_FIELD_GLSL}
         ${ATMOSPHERIC_PATH_GLSL}`,
      )
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
         {
           float atmosDepth = max(distance(vAtmosWorld, cameraPosition) - uAtmosShape.x, 0.0);
           float atmosDistance = 1.0 - exp(-pow(uAtmosShape.y * atmosDepth, 2.0));
           // Haze at the base, only where the distance term has begun.
           float atmosLow = exp(-max(vAtmosWorld.y, 0.0) / uAtmosShape.z);
           float atmosBase = uAtmosShape.w * atmosLow * clamp(atmosDepth / uAtmosShape.x, 0.0, 1.0);
           // Drift the air in world space, never the mountain's UVs or vertices.
           vec2 flow = vAtmosWorld.xz - uAtmosMist.yz * uAtmosTime;
           float bank = mistBank(flow, uAtmosMist.x);
           float ceiling = uAtmosShape.z * mix(0.18, 0.85, bank);
           float valley = 1.0 - smoothstep(ceiling * 0.25, ceiling, max(vAtmosWorld.y, 0.0));
           // View-space normal and world up: suppress streaks on steep faces.
           vec3 worldUpInView = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
           float slopeMask = smoothstep(0.08, 0.65, abs(dot(normal, worldUpInView)));
           valley *= uAtmosMist.w * smoothstep(0.3, 0.7, bank) * mix(0.25, 1.0, slopeMask);
           valley *= clamp(atmosDepth / uAtmosShape.x, 0.0, 1.0);
           atmosBase = 1.0 - (1.0 - atmosBase) * (1.0 - valley);
           float atmos = 1.0 - (1.0 - atmosDistance) * (1.0 - atmosBase);
           // The base haze takes the low colour; distance alone sinks to the background.
           vec3 atmosTint = mix(uAtmosColor, uAtmosLow, atmosBase / max(atmos, 1e-4));
           float weatherCell = weatherHorizonCell(vAtmosWorld - cameraPosition);
           float response = uWeatherFlash * (0.25 + weatherCell * 0.75);
           // Resolve the calm surface/haze first. Scattered radiance is added
           // after that mix, so valley light is not extinguished a second time.
           // Integrate air crossed between the actual eye and surface. No scroll uniform.
           float path = max(distance(vAtmosWorld, cameraPosition) - uAtmosShape.x * 0.45, 0.0);
           vec2 depth = atmospherePath(vAtmosWorld, cameraPosition, uAtmosShape, uAtmosMist.w, bank);
           float opticalDepth = depth.x;
           float valleyDepth = depth.y;
           float transport = 1.0 - exp(-opticalDepth);
           // Retain a near silhouette; far ridges can actually sink into the night.
           float ceilingAmount = mix(uAtmosMax, 0.995,
             smoothstep(uAtmosShape.x * 1.5, uAtmosShape.x * 4.0, path));
           vec3 transportTint = mix(uAtmosColor, uAtmosLow,
             clamp(valleyDepth / max(opticalDepth, 0.001), 0.0, 1.0));
           gl_FragColor.rgb = mix(gl_FragColor.rgb, transportTint, min(transport, ceilingAmount));
           float scatter = 1.0 - exp(-(atmosDistance + atmosBase * 1.8) * 1.2);
           float layeredAir = scatter * (0.65 + atmosBase * 0.75);
           vec3 airLight = uWeatherColor * response * ${lightningConfig.hazeGain} * layeredAir;
           float distantFace = smoothstep(8.0, 60.0, atmosDepth) * (1.0 - atmosDistance);
           vec3 ridgeLight = uWeatherColor * response * 0.065 * distantFace * (0.3 + slopeMask * 0.7);
           gl_FragColor.rgb += airLight + ridgeLight;
         }`,
      );
  };
  material.customProgramCacheKey = () => "distance-fog-optical-v4";
  material.needsUpdate = true;
}
