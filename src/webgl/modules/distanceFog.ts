import {
  Color,
  RepeatWrapping,
  TextureLoader,
  Vector2,
  Vector3,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import { createWeatherUniforms, type WeatherUniforms } from "../core/weather";
import type { SceneViewport } from "@/config/responsive";
import type { DistanceFogConfig } from "../sceneTypes";
import { SKY_DETAIL, TERRAIN_FOG } from "../weather/shaders";
import preset from "../weather/preset.json";

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
    uFogColor: { value: new Color(config.color) },
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
  material.fog = true;
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
      uniform sampler2D tPerlin;
      uniform sampler2D uWeatherSkyTexture;
      uniform vec3 uFogColor;
      uniform float uFogStart;
      uniform float uFogEnd;
      uniform float uFogNoiseIntensity;
      uniform vec2 uFogNoiseScale;
      uniform float uFogNoiseSpeed;
      uniform float uTime;
      uniform vec2 uTerrainOffset;
      ${SKY_DETAIL}
    `,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
      gl_FragColor.rgb = applySkyDetail(gl_FragColor.rgb, uWeatherSkyTexture, vWorldPos.xz, 0.01, 0.25, 1.4620253164556962, 2.2405063291139244);
      ${TERRAIN_FOG}
    `,
      );
  };
  material.customProgramCacheKey = () => "terrain-atmosphere-v1";
  material.needsUpdate = true;
}
