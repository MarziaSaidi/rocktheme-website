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
      intensity: 0.74,
      spread: 0.055,
      shimmer: 0.05,
      phase: 0.2,
    },
    {
      position: 0.43,
      depth: -52,
      elevation: 0.41,
      color: 0xdcc8f2,
      intensity: 1,
      spread: 0.075,
      shimmer: 0.06,
      phase: 2.6,
    },
    {
      position: 0.78,
      depth: -78,
      elevation: 0.52,
      color: 0xb99fd8,
      intensity: 0.86,
      spread: 0.135,
      shimmer: 0.04,
      phase: 4.4,
    },
  ],
};

export const horizonAtmosphereConfig: FogConfig = {
  color: sceneColors.aubergine,
  depth: -48,
  baseY: 0.38,
  hazeHeight: 2.5,
  hazeBelow: 1.1,
  hazeOpacity: 0.3,
  glowHeight: 3.5,
  glowBelow: 0.65,
  glowOpacity: 0.24,
  density: 0.015,
  mist: {
    height: 3.2,
    opacity: 0.9,
    coverageScale: 2.4,
    cling: 0.22,
    drift: 0.017,
  },
};

export const environmentLightingConfig: EnvironmentLightingConfig = {
  ambientColor: 0xd7cde2,
  ambientIntensity: 1.05,
  edgeColor: sceneColors.lavender,
  edgeIntensity: 2.5,
  edgePosition: [-8, 7, -14],
  fillColor: 0xc7c1d0,
  fillIntensity: 0.9,
  fillPosition: [5, 9, 6],
  beaconGain: 0.35,
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
