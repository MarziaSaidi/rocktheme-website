import {
  Color,
  RepeatWrapping,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import { createWeatherUniforms, type WeatherUniforms } from "../core/weather";
import type { SceneViewport } from "@/config/responsive";
import type { DistanceFogConfig } from "../sceneTypes";
import { SKY_DETAIL, TERRAIN_FOG } from "../weather/shaders";
import preset from "../weather/preset.json";

const ATMOSPHERIC_PATH_GLSL = /* glsl */ `
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

/** Portfolio world coordinates are ten times the atmosphere's scene coordinates. */
export const ATMOSPHERE_SCALE = 10;
export const aerialMist = {
  uAerialLift: { value: 0 },
  uAerialMist: { value: new Vector3(0.2, 0.175, 0.27) },
};
let perlin: Texture | null = null;
function noiseTexture() {
  if (!perlin) {
    perlin = new TextureLoader().load("/weather/textures/perlin.webp");
    perlin.wrapS = perlin.wrapT = RepeatWrapping;
  }
  return perlin;
}
export function disposeAtmosphereTextures() {
  perlin?.dispose();
  perlin = null;
}
export type DistanceFogUniforms = WeatherUniforms & {
  tPerlin: { value: Texture };
  uFogColor: { value: Color };
  uAtmosShape: { value: Vector4 };
  uAtmosMax: { value: number };
  uAtmosLow: { value: Color };
  uFogStart: { value: number };
  uFogEnd: { value: number };
  uFogNoiseIntensity: { value: number };
  uFogNoiseScale: { value: Vector2 };
  uFogNoiseSpeed: { value: number };
  uTime: { value: number };
  uTerrainOffset: { value: Vector2 };
};
export function createDistanceFogUniforms(
  config: DistanceFogConfig,
  weather: WeatherUniforms = createWeatherUniforms(),
): DistanceFogUniforms {
  const f = preset.terrainFog;
  return {
    ...weather,
    tPerlin: { value: noiseTexture() },
    uFogColor: { value: new Color(config.color).convertLinearToSRGB() },
    uAtmosShape: {
      value: new Vector4(config.distance, config.density, config.height, config.heightDensity),
    },
    uAtmosMax: { value: config.maxAmount },
    uAtmosLow: { value: new Color(config.lowColor ?? config.color).convertLinearToSRGB() },
    uFogStart: { value: f.start },
    uFogEnd: { value: f.end },
    uFogNoiseIntensity: { value: f.noiseIntensity },
    uFogNoiseScale: { value: new Vector2(f.noiseScaleX, f.noiseScaleY) },
    uFogNoiseSpeed: { value: f.noiseSpeed },
    uTime: { value: 0 },
    uTerrainOffset: { value: new Vector2() },
  };
}
export function updateDistanceFog(
  uniforms: DistanceFogUniforms,
  elapsed: number,
  reducedMotion: boolean,
  viewport: SceneViewport,
) {
  void viewport; // The four-octave field is shared at every breakpoint.
  uniforms.uTime.value = reducedMotion ? 0 : elapsed;
}
export function applyDistanceFog(material: MeshStandardMaterial, uniforms: DistanceFogUniforms) {
  // Distant mountains use their own mist; scene fog would flatten their texture.
  material.fog = false;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
      .replace(
        "#include <project_vertex>",
        `vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz / ${ATMOSPHERE_SCALE.toFixed(1)};\n#include <project_vertex>`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec3 vWorldPos;
      #define vAtmosWorld (vWorldPos * ${ATMOSPHERE_SCALE.toFixed(1)})
      uniform sampler2D tPerlin;
      uniform sampler2D uWeatherSkyTexture;
      uniform vec3 uFogColor;
      uniform vec4 uAtmosShape;
      uniform float uAtmosMax;
      uniform vec3 uAtmosLow;
      uniform float uFogStart;
      uniform float uFogEnd;
      uniform float uFogNoiseIntensity;
      uniform vec2 uFogNoiseScale;
      uniform float uFogNoiseSpeed;
      uniform float uTime;
      uniform vec2 uTerrainOffset;
      ${SKY_DETAIL}
      ${ATMOSPHERIC_PATH_GLSL}
    `,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
      gl_FragColor.rgb = applySkyDetail(gl_FragColor.rgb, uWeatherSkyTexture, vWorldPos.xz, 0.01, 0.25, 1.4620253164556962, 2.2405063291139244);
      {
        vec3 surface = vWorldPos * ${ATMOSPHERE_SCALE.toFixed(1)};
        float path = max(distance(surface, cameraPosition) - uAtmosShape.x * 0.45, 0.0);
        vec2 depth = atmospherePath(surface, cameraPosition, uAtmosShape, 0.0, 0.5);
        float transport = 1.0 - exp(-depth.x);
        float ceilingAmount = mix(uAtmosMax, 0.995, smoothstep(uAtmosShape.x * 1.5, uAtmosShape.x * 4.0, path));
        vec3 transportTint = mix(uFogColor, uAtmosLow, clamp(depth.y / max(depth.x, 0.001), 0.0, 1.0));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, transportTint, min(transport, ceilingAmount));
      }
      ${TERRAIN_FOG}
    `,
      );
  };
  material.customProgramCacheKey = () => "terrain-atmosphere-v1";
  material.needsUpdate = true;
}
