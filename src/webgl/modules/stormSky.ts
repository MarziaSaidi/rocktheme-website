import {
  BackSide,
  Color,
  DataTexture,
  GLSL3,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RepeatWrapping,
  Scene,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";
import { createWeatherUniforms, type WeatherUniforms } from "../core/weather";
import type { QualityTier } from "../core/quality";
import { CLOUD_VERTEX, CLOUD_FRAGMENT, DOME_VERTEX, DOME_FRAGMENT } from "../weather/shaders";
import preset from "../weather/preset.json";
import { sceneColors, stormSkyConfig } from "../sceneConfig";

export type StormSky = Readonly<{
  mesh: Mesh<IcosahedronGeometry, RawShaderMaterial>;
  update: (elapsed: number, camera: PerspectiveCamera) => void;
  setQuality: (tier: QualityTier, width: number) => void;
  destroy: () => void;
}>;
export function createStormSky(
  scene: Scene,
  reducedMotion: boolean,
  _tier: QualityTier,
  _width: number,
  weather: WeatherUniforms = createWeatherUniforms(),
  renderer?: WebGLRenderer,
): StormSky {
  const target = new WebGLRenderTarget(256, 256, {
    depthBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  target.texture.wrapS = target.texture.wrapT = RepeatWrapping;
  const background = new Color(stormSkyConfig.cloud).convertLinearToSRGB();
  const baseTexture = new DataTexture(
    new Uint8Array([
      Math.round(background.r * 255),
      Math.round(background.g * 255),
      Math.round(background.b * 255),
      255,
    ]),
    1,
    1,
  );
  baseTexture.needsUpdate = true;
  const cloudUniforms = {
    tScene: { value: baseTexture },
    uTime: { value: 0 },
    uSpeed: { value: preset.sky.speed },
    uScale: { value: preset.sky.scale },
    uStretch: { value: 1.5 },
    uBlend: { value: 0.5 },
    uContrast: { value: preset.sky.contrast },
    uBrightness: { value: preset.sky.brightness },
    uSaturation: { value: preset.sky.saturation },
    uLightningFlash: weather.uWeatherReflection,
    uLightningColor: weather.uWeatherColor,
  };
  const cloudMaterial = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: CLOUD_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    uniforms: cloudUniforms,
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const cloudScene = new Scene();
  const quad = new Mesh(new PlaneGeometry(2, 2), cloudMaterial);
  cloudScene.add(quad);
  const cloudCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const horizon = preset.dome.horizon;
  const radius = 2000;
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    // The camera journey translates the dome; its angular weather coordinates stay local.
    vertexShader: DOME_VERTEX.replace(
      "vWorldDir = normalize(worldPosition.xyz);",
      "vWorldDir = normalize(position);",
    ).replace(
      "vGradient = worldPosition.y / uRadius + 0.5;",
      "vGradient = position.y / uRadius + 0.5;",
    ),
    fragmentShader: DOME_FRAGMENT,
    uniforms: {
      tSky: { value: target.texture },
      uRadius: { value: radius },
      uOffset1: { value: 0.5 },
      uOffset2: { value: -0.75 },
      uYOffset: { value: 0.1 },
      uScale1: { value: 2 },
      uScale2: { value: 1 },
      uEdgeSpread: { value: 0.015 },
      uSeamSpread1: { value: 0.01 },
      uSeamSpread2: { value: 0.02 },
      uHorizonColor: {
        value: new Color(sceneColors.midnight).convertLinearToSRGB(),
      },
      uHorizonStart: { value: horizon.start },
      uHorizonSize: { value: horizon.size },
      uFlash: weather.uWeatherFlash,
      uFlashColor: weather.uWeatherColor,
      uFlashDir: weather.uWeatherDirection,
      uFlashCellSize: { value: 0.55 },
      uFade: { value: 1 },
      uFogColor: { value: new Color(sceneColors.aubergine).convertLinearToSRGB() },
    },
    side: BackSide,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(new IcosahedronGeometry(radius, 10), material);
  mesh.name = "portfolio-storm-sky";
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  scene.add(mesh);
  weather.uWeatherSkyTexture.value = target.texture;
  return {
    mesh,
    setQuality: () => {},
    update: (elapsed, camera) => {
      weather.uWeatherCloudTime.value = reducedMotion ? 0 : elapsed;
      cloudUniforms.uTime.value = weather.uWeatherCloudTime.value;
      // Keep the dome within the portfolio camera's far plane without changing its angular scale.
      mesh.position.copy(camera.position);
      const scale = Math.min(camera.far * 0.8, 2000) / radius;
      mesh.scale.setScalar(scale);

      if (!renderer) return;
      const previousTarget = renderer.getRenderTarget(),
        autoClear = renderer.autoClear;
      renderer.autoClear = true;
      renderer.setRenderTarget(target);
      renderer.render(cloudScene, cloudCamera);
      renderer.setRenderTarget(previousTarget);
      renderer.autoClear = autoClear;
    },
    destroy: () => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
      quad.geometry.dispose();
      cloudMaterial.dispose();
      baseTexture.dispose();
      target.dispose();
      weather.uWeatherSkyTexture.value = null;
    },
  };
}
