/**
 * Tunable landscape data.
 *
 * WebGL modules render these records. They do not own chapter names, rock
 * paths, portfolio facts, or responsive placement values.
 */
import type { SceneViewport } from "@/config/responsive";
import { resolveResponsiveValue } from "@/config/responsive";
import { SECTION_IDS, type SectionId } from "@/config/sections";

import type {
  CameraComposition,
  EnvironmentLightingConfig,
  FogConfig,
  HorizonLightConfig,
  ParticleConfig,
  RockAssetDefinition,
  RockInstanceDefinition,
  RockTransform,
  SceneSectionConfig,
  WaterConfig,
} from "./sceneTypes";

/** Mirrors the brand colours in `src/styles/tokens.css`. */
export const sceneColors = {
  aubergine: 0x100b18,
  midnight: 0x191126,
  porcelain: 0xf4eefa,
  lavender: 0xb793d2,
  botanical: 0xa8c947,
  gold: 0xe6b84a,
  reflection: 0x715a92,
  waterNear: 0x1b1424,
} as const;

export const particleConfig: ParticleConfig = {
  density: {
    high: { perMegapixel: 3000, max: 4100 },
    medium: { perMegapixel: 1700, max: 2200 },
    low: { perMegapixel: 750, max: 1000 },
    mobileFactor: 0.62,
    reducedMotionFactor: 0.42,
  },
  path: [
    [-0.2, 0.62],
    [0.08, 0.59],
    [0.28, 0.48],
    [0.41, 0.39],
    [0.57, 0.53],
    [0.73, 0.59],
    [0.88, 0.52],
    [1.18, 0.33],
  ],
  corridorHeight: 0.1,
  wispFraction: 0.055,
  wispSpread: 0.14,
  branches: [
    { split: 0.18, merge: 0.73, offset: -0.065, fraction: 0.105 },
    { split: 0.43, merge: 1.08, offset: 0.055, fraction: 0.085 },
  ],
  seed: 0x7a31d4,
  pointer: {
    awareness: 142,
    orbit: 72,
    contact: 28,
    awarenessForce: 58,
    divideForce: 155,
    splitForce: 390,
    contactForce: 175,
  },
  driftSpeed: 58,
  flowScale: 0.001,
  rise: 3,
  flowStrength: 5,
  flowTimeScale: 0.045,
  damping: 2.4,
  followStrength: 2.7,
  pathReturn: 1.15,
  recoverySeconds: 1.4,
  goldChance: 0.004,
  goldSeconds: 0.2,
  obstaclePadding: 26,
  obstacleInfluence: 76,
  obstacleStrength: 165,
  edgeFade: 90,
  sizeRange: [1.2, 2.45],
  focusRadius: 110,
  focusStrength: 13,
  focusEase: 0.9,
};

export const pointerZones = particleConfig.pointer;

export const floorConfig: WaterConfig = {
  horizon: 0.72,
  distortion: 0.085,
  swell: 1,
  ripple: 1,
  pointerZone: 0.34,
  rippleSeconds: 2.6,
  rippleInterval: 0.42,
};

/**
 * Three sources, deliberately asymmetric: a dim near one on the left, the
 * dominant one left of centre, and a wider, dimmer, much more distant one to
 * the right. Even spacing reads as a row of streetlights.
 */
export const horizonLightConfig: HorizonLightConfig = {
  focusGain: 0.18,
  focusEase: 1.2,
  sources: [
    {
      position: 0.17,
      depth: -44,
      elevation: 0.34,
      color: 0xc6aee4,
      intensity: 0.58,
      width: 15,
      height: 6.8,
      spread: 0.1,
      shimmer: 0.05,
      phase: 0.2,
      seed: 1.7,
    },
    {
      position: 0.43,
      depth: -52,
      elevation: 0.41,
      color: 0xdcc8f2,
      intensity: 0.82,
      width: 21,
      height: 9.5,
      spread: 0.075,
      shimmer: 0.06,
      phase: 2.6,
      seed: 7.2,
    },
    {
      position: 0.78,
      depth: -78,
      elevation: 0.52,
      color: 0xb99fd8,
      intensity: 0.43,
      width: 38,
      height: 17,
      spread: 0.13,
      shimmer: 0.04,
      phase: 4.4,
      seed: 13.8,
    },
  ],
};

export const horizonAtmosphereConfig: FogConfig = {
  color: 0x100b18,
  layers: [
    {
      depth: -46,
      height: 5.2,
      widthFactor: 1.2,
      offsetX: 0,
      opacity: 1.15,
      seed: 1.2,
      speed: 0.42,
      noiseScale: 3.0,
      heightBias: -0.06,
    },
    {
      depth: -49,
      height: 3.9,
      widthFactor: 1.16,
      offsetX: -2.4,
      opacity: 0.9,
      seed: 8.4,
      speed: 0.31,
      noiseScale: 3.8,
      heightBias: -0.11,
    },
    {
      depth: -52,
      height: 2.6,
      widthFactor: 1.12,
      offsetX: 3.1,
      opacity: 0.6,
      seed: 16.7,
      speed: 0.22,
      noiseScale: 4.5,
      heightBias: -0.16,
    },
  ],
};

/*
 * Rock illumination. Broad and weak on purpose: the sharp purple key made the
 * stone look lit by a stage lamp. Fog is matched to the DOM background colour
 * rather than a new one, because the canvas composites over that background
 * and a mismatch is exactly what produces a visible horizon seam.
 */
export const environmentLightingConfig: EnvironmentLightingConfig = {
  hemisphereSky: 0x33273f,
  hemisphereGround: 0x07060a,
  hemisphereIntensity: 1.5,
  /*
   * Ratios and colours as specified, but scaled for physically correct
   * falloff: irradiance is intensity / d squared, so the supplied sub-unit
   * values left the rock an unlit silhouette. Depths are pulled forward so
   * each light actually sits among the rocks it is meant to shade.
   */
  points: [
    { position: [-8, 4, 3], color: 0x8066a5, intensity: 15, distance: 18, decay: 2 },
    { position: [2, 4, -4], color: 0x9b7fc2, intensity: 20, distance: 18, decay: 2 },
    { position: [13, 3.5, -2], color: 0x695483, intensity: 13, distance: 18, decay: 2 },
  ],
  beaconGain: 0.35,
  fogNear: 19,
  fogFar: 58,
};

export const cameraConfig: CameraComposition = {
  // The target and offset reproduce the former position plus computed pitch.
  target: [0, 3.2154139392793946, -1.360344639557681],
  offset: [0, -1.6654139392793946, 9.860344639557681],
  fov: 42,
  near: 0.1,
  far: 220,
};

export const ROCK_ASSET_IDS = [
  "intro-rock",
  "hero-rock",
  "selected-work-rock",
  "footer-rock",
] as const;
export type RockAssetId = (typeof ROCK_ASSET_IDS)[number];

export const rockAssets = {
  "intro-rock": {
    id: "intro-rock",
    source: "/assets/rocks/intro-rock.glb",
    allowedSections: ["hero"],
    role: "dominant-formation",
    loadingGroup: "entry",
    materialPreset: "wet-black-violet",
    fallback: "omit",
    attribution: "Generated source; prepared by scripts/prepare-rocks.mjs for the entry gate.",
  },
  "hero-rock": {
    id: "hero-rock",
    source: "/assets/rocks/hero-rock.glb",
    allowedSections: ["hero"],
    role: "dominant-formation",
    loadingGroup: "initial",
    materialPreset: "wet-black-violet",
    fallback: "css-landscape",
    attribution: "Tripo model prepared by scripts/prepare-rocks.mjs.",
  },
  "selected-work-rock": {
    id: "selected-work-rock",
    source: "/assets/rocks/selected-work-rock.glb",
    allowedSections: ["selected-work"],
    role: "foreground",
    loadingGroup: "initial",
    materialPreset: "wet-black-violet",
    fallback: "css-landscape",
    attribution: "Tripo model prepared by scripts/prepare-rocks.mjs.",
  },
  "footer-rock": {
    id: "footer-rock",
    source: "/assets/rocks/footer-rock.glb",
    allowedSections: ["footer"],
    role: "dominant-formation",
    loadingGroup: "initial",
    materialPreset: "wet-black-violet",
    fallback: "css-landscape",
    attribution: "Tripo model prepared by scripts/prepare-rocks.mjs.",
  },
} as const satisfies Readonly<Record<RockAssetId, RockAssetDefinition>>;

export const ROCK_INSTANCE_IDS = [
  "hero-dominant-right",
  "work-foreground-left",
  "footer-dominant-right",
] as const;
export type RockInstanceId = (typeof ROCK_INSTANCE_IDS)[number];

export const rockInstances = {
  "hero-dominant-right": {
    id: "hero-dominant-right",
    assetId: "hero-rock",
    sectionId: "hero",
    role: "dominant-formation",
    depthLayer: "foreground",
    renderOrder: 0,
    visibility: { viewports: ["desktop", "tablet", "mobile"], reducedMotion: true },
    materialPreset: "wet-black-violet",
    reflection: true,
    particleInteraction: false,
    transform: {
      desktop: { position: [10.5, -0.08, -12], rotation: [0, -0.45, 0], scale: [9, 4.5, 9] },
      mobile: { position: [3.8, 0.05, -12], rotation: [0, -0.45, 0], scale: [5.5, 4.4, 5.5] },
    },
  },
  "work-foreground-left": {
    id: "work-foreground-left",
    assetId: "selected-work-rock",
    sectionId: "selected-work",
    role: "foreground",
    depthLayer: "foreground",
    renderOrder: 0,
    visibility: { viewports: ["desktop", "tablet", "mobile"], reducedMotion: true },
    materialPreset: "wet-black-violet",
    reflection: true,
    particleInteraction: false,
    transform: {
      desktop: { position: [-6.2, -0.22, -0.5], rotation: [0, 0.52, 0], scale: [4.8, 5.52, 4.8] },
      mobile: { position: [-1.8, -0.24, -1.1], rotation: [0, 0.52, 0], scale: [2.6, 2.34, 2.6] },
    },
  },
  "footer-dominant-right": {
    id: "footer-dominant-right",
    assetId: "footer-rock",
    sectionId: "footer",
    role: "dominant-formation",
    depthLayer: "foreground",
    renderOrder: 0,
    visibility: { viewports: ["desktop", "tablet", "mobile"], reducedMotion: true },
    materialPreset: "wet-black-violet",
    reflection: true,
    particleInteraction: false,
    transform: {
      desktop: { position: [10, -0.08, -10], rotation: [0, -0.3, 0], scale: [8, 5.2, 8] },
      mobile: { position: [3.8, 0.05, -10], rotation: [0, -0.3, 0], scale: [5.5, 3.85, 5.5] },
    },
  },
} as const satisfies Readonly<Record<RockInstanceId, RockInstanceDefinition>>;

const camera = { desktop: cameraConfig } as const;
const reducedMotion = {
  animateParticles: false,
  animateWater: false,
  animateAtmosphere: false,
  pointerResponse: false,
} as const;

export const sceneSections = {
  hero: {
    sectionId: "hero",
    fallbackHorizonPercent: 72,
    camera,
    lighting: environmentLightingConfig,
    horizonLights: horizonLightConfig,
    fog: horizonAtmosphereConfig,
    water: floorConfig,
    particles: particleConfig,
    rockInstanceIds: ["hero-dominant-right"],
    reducedMotion,
  },
  "selected-work": {
    sectionId: "selected-work",
    fallbackHorizonPercent: 76,
    camera,
    lighting: environmentLightingConfig,
    horizonLights: horizonLightConfig,
    fog: horizonAtmosphereConfig,
    water: floorConfig,
    particles: particleConfig,
    rockInstanceIds: ["work-foreground-left"],
    reducedMotion,
  },
  about: {
    sectionId: "about",
    fallbackHorizonPercent: 80,
    camera,
    lighting: environmentLightingConfig,
    horizonLights: horizonLightConfig,
    fog: horizonAtmosphereConfig,
    water: floorConfig,
    particles: particleConfig,
    rockInstanceIds: [],
    reducedMotion,
  },
  footer: {
    sectionId: "footer",
    fallbackHorizonPercent: 62,
    camera,
    lighting: environmentLightingConfig,
    horizonLights: horizonLightConfig,
    fog: horizonAtmosphereConfig,
    water: floorConfig,
    particles: particleConfig,
    rockInstanceIds: ["footer-dominant-right"],
    reducedMotion,
  },
} as const satisfies Readonly<Record<SectionId, SceneSectionConfig>>;

export function getSceneSection(sectionId: SectionId): SceneSectionConfig {
  return sceneSections[sectionId];
}

export function resolveCamera(sectionId: SectionId, viewport: SceneViewport): CameraComposition {
  return resolveResponsiveValue(sceneSections[sectionId].camera, viewport);
}

export function resolveRockTransform(
  instanceId: RockInstanceId,
  viewport: SceneViewport,
): RockTransform {
  const instance: RockInstanceDefinition = rockInstances[instanceId];
  return resolveResponsiveValue(instance.transform, viewport);
}

export const sceneSectionIds = SECTION_IDS;
export const rockParallax = 0.1;
