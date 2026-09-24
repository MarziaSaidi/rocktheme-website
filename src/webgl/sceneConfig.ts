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
  MonolithConfig,
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

/*
 * The intro keeps two quiet beacons well to the left. At landscape intensity
 * they lit the water into a bright violet that the charcoal rock could not
 * belong to; here the rock is the subject and the water stays close to it.
 */
export const introLightConfig: HorizonLightConfig = {
  focusGain: 0,
  focusEase: 1.2,
  sources: [
    {
      position: 0.11,
      depth: -46,
      elevation: 0.34,
      color: 0xbca7d8,
      intensity: 0.26,
      width: 14,
      height: 6.2,
      spread: 0.09,
      shimmer: 0.04,
      phase: 0.6,
      seed: 3.1,
    },
    {
      position: 0.33,
      depth: -58,
      elevation: 0.42,
      color: 0xc9b6e4,
      intensity: 0.34,
      width: 24,
      height: 10.5,
      spread: 0.11,
      shimmer: 0.05,
      phase: 3.2,
      seed: 9.4,
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
/** Same mist, held back so it does not lift the water off the stone. */
export const introAtmosphereConfig: FogConfig = {
  color: 0x100b18,
  layers: horizonAtmosphereConfig.layers.map((layer) => ({
    ...layer,
    opacity: layer.opacity * 0.45,
  })),
};

export const environmentLightingConfig: EnvironmentLightingConfig = {
  /*
   * Neutral base light for the stone. The rocks are the only lit materials in
   * the scene, and the former 0x33273f sky was too dim and too violet to show
   * the grey surface and cracks baked into the textures.
   */
  hemisphereSky: 0x9a9a9c,
  hemisphereGround: 0x3a3a3c,
  hemisphereIntensity: 3,
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

export const ROCK_ASSET_IDS = ["intro-rock", "hero-rock", "footer-rock"] as const;
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

export const ROCK_INSTANCE_IDS = ["hero-dominant-right", "footer-dominant-right"] as const;
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

/*
 * Selected Work is lit by the stone's own screens: the particle stream fades
 * out and the glow of the horizon lights goes while it is on screen. The
 * water keeps its reflections. The lowered path
 * only matters while the stream is fading.
 */
export const workParticleConfig: ParticleConfig = {
  ...particleConfig,
  presence: 0,
  path: [
    [-0.2, 0.66],
    [0.12, 0.64],
    [0.34, 0.67],
    [0.55, 0.63],
    [0.76, 0.66],
    [0.95, 0.64],
    [1.18, 0.62],
  ],
  branches: [
    { split: 0.2, merge: 0.7, offset: 0.03, fraction: 0.1 },
    { split: 0.45, merge: 1.05, offset: -0.025, fraction: 0.08 },
  ],
};

export const workHorizonLightConfig: HorizonLightConfig = {
  ...horizonLightConfig,
  level: 0,
};

/*
 * Selected Work lighting. The landscape points sit where the monolith now
 * stands, so here they move in front of it and to its sides: the stone is lit
 * from the camera's side and rimmed faintly in lavender from behind.
 */
export const workLightingConfig: EnvironmentLightingConfig = {
  ...environmentLightingConfig,
  hemisphereIntensity: 2.6,
  points: [
    { position: [-7, 5, 3], color: 0x8066a5, intensity: 14, distance: 20, decay: 2 },
    { position: [8.5, 7, -7], color: 0x9b7fc2, intensity: 22, distance: 16, decay: 2 },
    { position: [13, 3.5, -2], color: 0x695483, intensity: 10, distance: 18, decay: 2 },
  ],
};

/*
 * The Selected Work monolith. Face planes, the alignment yaw and the pillar
 * axis were measured from public/assets/selected-work/monolith.glb: its square
 * section sits 36° off the model axes, each wide face leans back a few degrees,
 * and each is twisted a little across its width (the front by 11°). The
 * planes are least-squares fits to the rock's surface, raised to its highest
 * point, so the housings sit flush and their walls stay inside the stone.
 * Re-measure them if the stone asset is replaced.
 */
export const monolithConfig: MonolithConfig = {
  sectionId: "selected-work",
  stone: {
    source: "/assets/selected-work/monolith.glb",
    alignYaw: (-36 * Math.PI) / 180,
    axis: [0.023, -0.015],
    placement: {
      desktop: {
        position: [2.7, 0, -6.4],
        height: 8.2,
        girth: 1.32,
        yaw: -0.1,
        screenHeight: 0.35,
        screenCenterY: 0.545,
      },
      /*
       * Stacked: the stone stands centred above the project text, so it is
       * chunkier and its screen takes more of the face to stay legible.
       */
      tablet: {
        position: [0, 0, -10.5],
        height: 6.06,
        girth: 1.6,
        yaw: -0.06,
        screenHeight: 0.5,
        screenCenterY: 0.56,
      },
      mobile: {
        position: [0, 0, -10.5],
        height: 6.06,
        girth: 1.75,
        yaw: -0.04,
        screenHeight: 0.52,
        screenCenterY: 0.565,
      },
    },
  },
  mountains: {
    source: "/assets/selected-work/mountains.glb",
    placement: {
      desktop: { position: [0, -0.4, -64], scale: [104, 44, 40], yaw: 0 },
      mobile: { position: [0, -0.4, -64], scale: [72, 40, 36], yaw: 0 },
    },
  },
  screen: {
    aspect: 640 / 922,
    bezel: 0.007,
    housingDepth: 0.045,
    clearance: 0.004,
    offColor: 0x0d0b12,
    housingColor: 0x2c2b30,
    rimColor: sceneColors.lavender,
    glowColor: sceneColors.lavender,
    glowIntensity: 3.2,
    front: { offset: 0.2178, slope: -0.0783, across: -0.1955 },
    back: { offset: 0.2458, slope: -0.1035, across: 0.0847 },
  },
  key: { color: 0xd8d4e0, intensity: 1.4, position: [-6, 9, 10] },
  timing: {
    fadeOutMs: 220,
    orbitMs: 1400,
    fadeInMs: 280,
    reducedFadeOutMs: 200,
    reducedFadeInMs: 250,
  },
};

const camera = { desktop: cameraConfig } as const;

/*
 * Selected Work below the desktop breakpoint stacks the project under the
 * stone. The landscape camera puts the horizon at 72%, which leaves no room
 * beneath a stone standing in the water, so here the camera sits lower and
 * level: the horizon is at mid-screen and the water carries the text.
 */
const stackedWorkCamera: CameraComposition = {
  ...cameraConfig,
  target: [0, 1.1, -1.5],
  offset: [0, 0, 10],
};
const workCamera = {
  desktop: cameraConfig,
  tablet: stackedWorkCamera,
  mobile: stackedWorkCamera,
} as const;
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
    camera: workCamera,
    lighting: workLightingConfig,
    horizonLights: workHorizonLightConfig,
    fog: horizonAtmosphereConfig,
    water: floorConfig,
    particles: workParticleConfig,
    rockInstanceIds: [],
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
