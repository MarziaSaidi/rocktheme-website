/**
 * Tunable landscape data.
 *
 * WebGL modules render these records. They do not own chapter names, rock
 * paths, portfolio facts, or responsive placement values.
 */
import type { ResponsiveOverrides, SceneViewport } from "@/config/responsive";
import { resolveResponsiveValue } from "@/config/responsive";
import { SECTION_IDS, type SectionId } from "@/config/sections";

import {
  poseInFrame,
  type ArrivalKeyframe,
  type ChapterFrame,
  type PosePoint,
} from "./core/chapterFrame";
import type {
  CameraComposition,
  DistanceFogConfig,
  EnvironmentLightingConfig,
  FogConfig,
  HeroLandscapeConfig,
  HeroLandscapePlacement,
  HorizonLightConfig,
  LandscapeModelPlacement,
  LowMistConfig,
  MonolithConfig,
  ParticleConfig,
  RockAssetDefinition,
  RockInstanceDefinition,
  RockTransform,
  SceneSectionConfig,
  Vector3Tuple,
  WaterConfig,
  WorkStation,
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

/*
 * The water's own tones. The water shader writes its colour straight to the
 * canvas without a colour-space conversion, so these are display values: the
 * hex is what reaches the screen. The surface is dark charcoal with a cool
 * violet undertone; lavender only arrives in what it reflects.
 *
 *   near    the body of the water close to the viewer
 *   far     the body out toward the horizon, a shade lighter
 *   haze    the night air the far water dissolves into; the page background
 *   sheen   the tint on the mirrored image. Almost neutral: a mirror does not
 *           colour what it reflects, and the old violet tint (0x715a92) is
 *           what spread purple across the whole surface
 */
export const waterTones = {
  near: 0x09080c,
  far: 0x0d0b12,
  haze: sceneColors.aubergine,
  sheen: 0xa6a2b4,
  /** Share of the mirrored image the water returns head-on and at grazing. */
  reflectance: [0.02, 0.4],
} as const;

/** Dark sky banks; alpha keeps the existing page atmosphere visible through them. */
export const stormSkyConfig = {
  base: sceneColors.aubergine,
  cloud: 0x30223f,
  opacity: 0.42,
  scale: 3.2,
} as const;

/** Illumination only. Start-to-start gaps use visible, active scene time. */
export const lightningConfig = {
  color: 0xc9b6e4,
  storm: 0.55,
  firstInterval: [8, 14],
  interval: [20, 40],
  duration: 1.65,
  maxFlash: 0.65,
  skyGain: 0.65,
  hazeGain: 0.16,
  mistGain: 0.13,
  rockGain: 0.055,
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
 * The hero's horizon. The moon is part of the landscape (heroLandscapeConfig)
 * because the peaks must cut into it; here a low source left of centre lays
 * the one bright path across the water, and a faint one far left keeps that
 * side of the horizon from going dead.
 */
export const heroHorizonLightConfig: HorizonLightConfig = {
  focusGain: 0.12,
  focusEase: 1.2,
  sources: [
    {
      position: 0.4,
      depth: -74,
      elevation: 0.6,
      color: 0xd6c4f2,
      intensity: 0.75,
      width: 22,
      height: 9,
      spread: 0.08,
      shimmer: 0.05,
      phase: 2.6,
      seed: 7.2,
    },
    {
      position: 0.13,
      depth: -62,
      elevation: 0.4,
      color: 0xbca7d8,
      intensity: 0.32,
      width: 16,
      height: 6.5,
      spread: 0.09,
      shimmer: 0.04,
      phase: 0.4,
      seed: 3.1,
    },
  ],
};

/*
 * The hero has no particle stream: the approved composition is the landscape
 * alone. The field eases in once the journey reaches the chapters that use it.
 */
export const heroParticleConfig: ParticleConfig = { ...particleConfig, presence: 0 };

/*
 * The bio has no stream either: its only particles are the sentence's own
 * dust, coming out of the rift and going back into it.
 */
export const aboutParticleConfig: ParticleConfig = { ...particleConfig, presence: 0 };

/*
 * Contact is one trail, not a field. Strands are listed upstream first and
 * flow right to left: down from the top right, across the lower half of the
 * conversation plane ("plane"), pinched through the dark gap, then through the
 * right end of the headline ("heading"), sweeping up from "TED." to "ATE". A
 * thinner thread runs on low through the second line, one wraps under the
 * plane, and a faint one runs high above. Front shares are non-zero only where a strand crosses the type
 * or the plane, so the crossing is dimensional and the rest of each letter
 * stays clean. Widths are CSS px at a 900px-tall viewport.
 */
export const footerParticleConfig: ParticleConfig = {
  ...particleConfig,
  sizeRange: [1.1, 2.5],
  trail: {
    strands: [
      {
        weight: 0.72,
        points: [
          { anchor: "plane", at: [1.32, -1.05], width: 50 },
          { anchor: "plane", at: [1.12, -0.35], width: 44 },
          { anchor: "plane", at: [0.98, 0.3], width: 42, front: 0.12 },
          { anchor: "plane", at: [0.75, 0.66], width: 70, front: 0.14 },
          { anchor: "plane", at: [0.45, 0.78], width: 88, front: 0.12 },
          { anchor: "plane", at: [0.12, 0.6], width: 52, front: 0.08 },
          { anchor: "plane", at: [-0.15, 0.42], width: 32 },
          // Into the headline, sweeping up and left from "TED." toward "ATE".
          { anchor: "heading", at: [0.97, 0.64], width: 62, front: 0.6 },
          { anchor: "heading", at: [0.86, 0.58], width: 88, front: 0.62 },
          { anchor: "heading", at: [0.76, 0.46], width: 70, front: 0.6 },
          { anchor: "heading", at: [0.68, 0.33], width: 44, front: 0.56 },
          { anchor: "heading", at: [0.6, 0.24], width: 18, front: 0.45 },
        ],
      },
      {
        // A thinner thread that carries on low through the second line.
        weight: 0.12,
        points: [
          { anchor: "plane", at: [0.02, 0.6], width: 18 },
          { anchor: "heading", at: [1.04, 0.66], width: 20 },
          { anchor: "heading", at: [0.88, 0.72], width: 28, front: 0.55 },
          { anchor: "heading", at: [0.72, 0.76], width: 24, front: 0.5 },
          { anchor: "heading", at: [0.58, 0.74], width: 12, front: 0.4 },
        ],
      },
      {
        // Wrapping under the plane and rejoining the main strand.
        weight: 0.1,
        points: [
          { anchor: "plane", at: [1.08, 0.75], width: 20 },
          { anchor: "plane", at: [0.85, 1.1], width: 26, front: 0.06 },
          { anchor: "plane", at: [0.55, 1.14], width: 22 },
          { anchor: "plane", at: [0.3, 0.95], width: 20 },
          { anchor: "plane", at: [0.12, 0.7], width: 18 },
        ],
      },
      {
        // Faint and high, from the top right toward the headline.
        weight: 0.08,
        alpha: 0.75,
        points: [
          { anchor: "plane", at: [1.2, -1.5], width: 24 },
          { anchor: "plane", at: [0.6, -1.05], width: 28 },
          { anchor: "plane", at: [0.0, -0.75], width: 22 },
          { anchor: "heading", at: [0.9, 0.05], width: 16 },
          { anchor: "heading", at: [0.72, -0.05], width: 10 },
        ],
      },
    ],
    speed: [22, 62],
    edgeFraction: 0.2,
    escapeFraction: 0.03,
    escapeSeconds: [4, 8],
    wobble: 0.08,
    wobbleRate: [0.3, 1.1],
    frontAlpha: 1,
    countScale: 2.8,
  },
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
 * The hero's air is lit by the moon, so its sheets are a little thicker than
 * elsewhere. Their height is unchanged: taller sheets, seen this low over the
 * water, show as hard horizontal bands across the range.
 */
export const heroAtmosphereConfig: FogConfig = {
  color: 0x100b18,
  layers: horizonAtmosphereConfig.layers.map((layer) => ({
    ...layer,
    opacity: Math.min(1.5, layer.opacity * 1.1),
  })),
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

/*
 * Low mist on the water. The colour is the midnight surface lifted a little
 * toward porcelain, so it reads as air catching what light there is rather
 * than as smoke. The near fade keeps the water under the project text clear.
 */
export const lowMistConfig: LowMistConfig = {
  color: 0x4d4857,
  opacity: 0.72,
  density: 0.44,
  height: 4.6,
  nearHeight: 0.9,
  speed: 0.32,
  direction: 0.18,
  noiseScale: { large: 0.05, small: 0.17 },
  distance: { near: [9, 22], rise: [24, 50], far: [95, 135] },
  detail: {
    desktop: { slices: 12, octaves: 4 },
    mobile: { slices: 7, octaves: 3 },
  },
};

/* Keep the hero banks faint: a dense stack reads as a pale waterline. */
export const heroMistConfig: LowMistConfig = {
  ...lowMistConfig,
  opacity: 0.16,
  height: 2.8,
  nearHeight: 0.45,
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
  // The receded hero range and moon stand up to about 380 units out.
  far: 420,
};

/*
 * The entry doorway: the supplied stone arch, prepared by
 * `npm run prepare:intro-arch`. It stands square to the camera and never
 * moves; the camera travels through it.
 *
 * `opening` is measured from the model, in its own units (height 0.98): the
 * gap between the columns is centred just left of the model's middle, its
 * floor is the top of the stone step and its head the underside of the arch.
 */
export const introDoorwayConfig = {
  source: "/assets/rocks/intro-arch.glb",
  /** World height of the whole model, base rocks to crown. */
  height: 6.6,
  /** How far the base stands below the water, so the surface cuts the rocks. */
  sink: 0.38,
  /** Distance of the doorway's plane down the water. */
  z: -6,
  opening: { x: -0.012, floor: 0.14, head: 0.79 },
  /** Resting camera: the landscape eye height and lens. */
  eyeHeight: cameraConfig.target[1] + cameraConfig.offset[1],
  fov: cameraConfig.fov,
  /** Eye to doorway when the viewport is wide enough to hold it. */
  distance: 14.5,
  /** Share of a narrow viewport's width the base rocks may span. */
  narrowFill: 0.94,
  /** Where the camera aims at rest: a little below the doorway's middle. */
  aimHeight: 2.75,
} as const;

export const ROCK_ASSET_IDS = ["intro-rock", "footer-rock"] as const;
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

export const ROCK_INSTANCE_IDS = ["footer-dominant-right"] as const;
export type RockInstanceId = (typeof ROCK_INSTANCE_IDS)[number];

export const rockInstances = {
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
    /*
     * The footer rock's base tucks in by about 6% over its lowest 8%, and on a
     * phone it stood 0.05 above the water. Each placement sinks it by that 8%
     * of its own height: 0.2 on desktop, 0.15 on a phone.
     */
    transform: {
      desktop: { position: [10, -0.2, -10], rotation: [0, -0.3, 0], scale: [8, 5.2, 8] },
      mobile: { position: [3.8, -0.15, -10], rotation: [0, -0.3, 0], scale: [5.5, 3.85, 5.5] },
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
 * Aerial perspective on the Selected Work mountains. The nearest ridges start
 * about 52 units out and the back of the range about 92; the scene's linear
 * fog ends at 58, so it would erase them. This curve leaves the front ridges
 * almost untouched, sinks the back ones most of the way into the background,
 * and thickens the haze at their feet where they meet the water.
 */
export const distanceFogConfig: DistanceFogConfig = {
  color: sceneColors.aubergine,
  distance: 40,
  density: 0.017,
  height: 7,
  heightDensity: 0.45,
  maxAmount: 0.86,
  lowColor: 0x302a3c,
  valleyMist: 0.28,
};

/*
 * Frame 05, and the first stone's settled view, where its details show. Low
 * and a little left of the stone, 28 units out, looking up about 7°: the
 * crown runs out of the top of the frame, the waterline and the rubble at its
 * foot stay in, and the face is seen slightly from the side so the screen
 * reads as set into the rock. The camera looks past the stone's right side,
 * so the stone holds the left third and the details the open right.
 */
export const quillWaterSettle: PosePoint = {
  eye: [-5.1, 3.6, 21.9],
  target: [4.8, 6.2, -1.6],
  fov: 34,
};

/*
 * Quill & Pigeon, held up among the peaks (2026-10-08): about 54 over the water, the ridges in the lower third and dark sky
 * behind the copy. Same heading as the water-level view, so the range reads
 * as the same place seen from the air.
 */
const quillSettle: PosePoint = { eye: [-7, 54, -10], target: [9, 61, -144], fov: 34 };

/*
 * Frame 07, and the second stone's settled view. The release after Quill &
 * Pigeon: higher (6.6 over the water), farther (36 out) and level, from the
 * south-west, with the range some 70 units behind the stone as it is behind
 * Quill & Pigeon, the horizon and sky back in the frame, and open water across
 * the left half, where the details go. The stone holds the right third, crown
 * and waterline both in frame, at about three quarters of the view's height.
 */
const survueWaterSettle: PosePoint = {
  eye: [-38.5, 6.6, 21],
  target: [-35.89, 7.65, -8.87],
  fov: 34,
};

/*
 * Survue, held at the same altitude, a glide to the west of
 * Quill & Pigeon, turned a little left so the details on the left sit over sky.
 */
const survueSettle: PosePoint = { eye: [-46, 52, -8], target: [-55, 58, -172], fov: 34 };

export const monolithConfig: MonolithConfig = {
  sectionId: "selected-work",
  stone: {
    source: "/assets/selected-work/monolith.glb",
    alignYaw: (-36 * Math.PI) / 180,
    axis: [0.023, -0.015],
  },
  // Project media now occupies a separate DOM foreground layer. The landscape
  // keeps its range and camera stations, but no project-bearing stones.
  stones: [],
  mountains: {
    source: "/assets/selected-work/mountains.glb",
    /*
     * The model is a low terrain tile (0.3 as tall as it is wide). Scaled
     * about as much in height as in depth it read as a rocky field seen from
     * above. The hero range is scaled roughly three times as much in height
     * as in depth; this one is brought close to that, so both ranges share
     * one proportion: steep peaks rising well above the water.
     */
    placement: {
      desktop: { position: [0, -0.4, -64], scale: [104, 85, 34], yaw: 0 },
      mobile: { position: [0, -0.4, -64], scale: [72, 78, 30], yaw: 0 },
    },
    fog: distanceFogConfig,
    shade: 0.85,
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
    face: { offset: 0.2178, slope: -0.0783, across: -0.1955 },
  },
  // Held low enough that the lit face stays the footer stone's charcoal.
  key: { color: 0xd8d4e0, intensity: 1.0, position: [-6, 9, 10] },
  /*
   * The camera's stops, in world space. Each settled view stands level with
   * the screen, a little right of its axis, and looks past the stone's right
   * side, so the stone holds the left of the frame and the details the right.
   * Level, the screen keeps its proportions and reads as set into the rock
   * rather than as a plate seen from below. The two settles differ on
   * purpose: at Survue the camera stands lower against the screen, further
   * off the face and turned well to the left, toward the deeper water.
   *
   * On the way from one to the other the camera swings out left of Quill &
   * Pigeon's stone, more than 9 units clear of its axis, and turns in on
   * Survue as it slows.
   */
  stations: {
    desktop: [
      // The way in is the arrival (arrivalKeyframes); only the settle is used.
      { approach: [], settle: quillSettle },
      // The way there is the departure (departureKeyframes); only the settle is used.
      { approach: [], settle: survueSettle },
    ],
    stacked: [
      {
        approach: [{ eye: [4.4, 3.2, 29], target: [3.0, 4.5, -3.2], fov: 46 }],
        settle: { eye: [-4, 56, -6], target: [6, 82, -140], fov: 46 },
      },
      {
        approach: [{ eye: [-24, 58, -10], target: [-22, 84, -160], fov: 46 }],
        settle: { eye: [-42, 54, -6], target: [-50, 80, -170], fov: 46 },
      },
    ],
  },
};

/*
 * The hero landscape, in the hero frame (camera at the origin's composition,
 * eye at y 1.55, z 8.5, looking down -z).
 *
 * The range stands 55 to 80 units out, well past the scene fog, and spans the
 * whole view with its highest peak right of centre. The perch rock stands in
 * the water in the right foreground, close enough to run off the bottom and
 * right edges; the robot sits on its crown, small against the landscape,
 * turned a little toward the open water on the left.
 *
 * On a phone the view is a third as wide, so the rock and robot move in toward
 * the centre line and back, and the range is narrower so its peaks still read.
 */
/*
 * How much further out the range, its flank and the moon stand than where the
 * hero was composed. Each is pushed back along the line from the hero eye and
 * scaled by the same factor, so from the hero it looks exactly as approved;
 * but it now stands behind the Selected Work range instead of among the
 * stones, stays in view for the whole journey and barely moves while the
 * camera crosses the water. The range's aerial perspective is stretched by the
 * same factor so it hazes as it did.
 */
const RANGE_RECESSION = 2.1;
/** The hero eye each viewport's range was composed from, in the hero frame. */
const heroEyes: Record<SceneViewport, Vector3Tuple> = {
  desktop: [0.4, 0.8, 11],
  tablet: [2.2, 1.55, 8.5],
  mobile: [2.2, 1.55, 8.5],
};

function recede(point: Vector3Tuple, eye: Vector3Tuple, keepHeight = false): Vector3Tuple {
  const k = RANGE_RECESSION;
  return [
    eye[0] + (point[0] - eye[0]) * k,
    keepHeight ? point[1] : eye[1] + (point[1] - eye[1]) * k,
    eye[2] + (point[2] - eye[2]) * k,
  ];
}

function recedeModel(model: LandscapeModelPlacement, eye: Vector3Tuple): LandscapeModelPlacement {
  const k = RANGE_RECESSION;
  return {
    ...model,
    // Its feet stay in the water.
    position: recede(model.position, eye, true),
    width: model.width * k,
    height: model.height * k,
    depth: model.depth * k,
  };
}

function recedeRange(
  placement: ResponsiveOverrides<HeroLandscapePlacement>,
): ResponsiveOverrides<HeroLandscapePlacement> {
  const viewports = ["desktop", "tablet", "mobile"] as const;
  const out: Record<string, Partial<HeroLandscapePlacement>> = {};
  viewports.forEach((viewport) => {
    const own = viewport === "desktop" ? placement.desktop : placement[viewport];
    if (!own) return;
    const eye = heroEyes[viewport];
    out[viewport] = {
      ...own,
      ...(own.mountains ? { mountains: recedeModel(own.mountains, eye) } : {}),
      ...(own.flank ? { flank: recedeModel(own.flank, eye) } : {}),
      ...(own.moon ? { moon: recede(own.moon, eye) } : {}),
    };
  });
  // A viewport that inherits the desktop flank inherits it receded from the desktop eye.
  return out as unknown as ResponsiveOverrides<HeroLandscapePlacement>;
}

export const heroLandscapeConfig: HeroLandscapeConfig = {
  sectionId: "hero",
  sources: {
    mountains: "/assets/hero/mountains.glb",
    perch: "/assets/hero/perch-rock.glb",
    robot: "/assets/hero/robot.glb",
  },
  placement: recedeRange({
    /*
     * The perch stands 14% of its own height into the water. Its lowest 3% is
     * an underside cap that curls back under the rock, and at 6% the front row
     * of boulders still showed their whole rounded bottoms resting on the
     * surface. This deep, the lower boulders are partly under water, each cut
     * at its own height, so there is no single edge where the rock ends. It
     * stood 0.1 to 0.65 above the surface before. The robot is seated on the
     * rock's surface, so it comes down with it.
     */
    desktop: {
      mountains: { position: [16, -0.3, -66], width: 135, height: 30, depth: 34, yaw: 0 },
      flank: {
        position: [-34, -0.3, -58],
        width: 90,
        height: 24,
        depth: 26,
        yaw: 2.6,
      },
      perch: { position: [4.4, -0.53, 1.2], width: 9, height: 3.77, depth: 9, yaw: -0.3 },
      robot: { x: 2.6, z: 2.8, height: 1.45, yaw: 0.5 },
      moon: [54, 37, -150],
    },
    tablet: {
      mountains: { position: [-4, -0.3, -66], width: 120, height: 30, depth: 34, yaw: 0 },
      perch: { position: [4.8, -0.44, -0.6], width: 7.5, height: 3.14, depth: 7.5, yaw: -0.3 },
      robot: { x: 3.6, z: 1.0, height: 1.35, yaw: 0.5 },
      moon: [20, 34, -150],
    },
    /*
     * A portrait phone sees a third of the desktop width. The perch and robot
     * stand right of the phone camera's line of sight, below the copy; the
     * range slides left so its tallest peak and the moon stay above them.
     */
    mobile: {
      mountains: { position: [-10, -0.3, -66], width: 120, height: 30, depth: 34, yaw: 0 },
      flank: { position: [-36, -0.3, -58], width: 90, height: 24, depth: 26, yaw: 2.6 },
      perch: { position: [4.3, -0.38, -1.5], width: 6.4, height: 2.68, depth: 6.4, yaw: -0.3 },
      robot: { x: 3.45, z: -0.3, height: 1.2, yaw: 0.5 },
      moon: [12, 30, -150],
    },
  }),
  /*
   * The base haze is the night air, not a lit band. In pale lavender
   * (0x6f5e8e) and this thick it glowed along the foot of the range, brighter
   * than the water below it, and that strip is what lifted the peaks off the
   * surface. Dark and thinner, the feet run down into their own reflection.
   */
  mountainFog: {
    color: sceneColors.aubergine,
    distance: 44 * RANGE_RECESSION,
    density: 0.011 / RANGE_RECESSION,
    height: 13 * RANGE_RECESSION,
    heightDensity: 0.35,
    maxAmount: 0.85,
    lowColor: 0x302a3c,
    valleyMist: 0.22,
  },
  // Both are applied after the albedo is matched to the footer stone.
  mountainShade: 1,
  perchShade: 1,
  // Cool, not violet: the moon's own disc keeps the lavender.
  moonlight: { color: 0x9ea2c6, intensity: 1.1, position: [40, 45, -140] },
  moon: {
    size: 80 * RANGE_RECESSION,
    color: 0xf6f0ff,
    haloColor: 0xb89ce6,
    intensity: 1,
  },
  robotLight: { color: 0xb9a3d9, intensity: 0.6, offset: [-1.2, 1.4, 1.6] },
};

const camera = { desktop: cameraConfig } as const;

/*
 * The bio on a narrow screen. From the landscape camera's eye a phone sees
 * only about 25° across, and anything 14° right of the line of sight stands
 * off the right edge, with the dust streaming in from nowhere. Same eye,
 * turned a little right and up, so the lower right of the frame under the
 * sentence is open water: the rift stands there (rift.ts, further out and
 * nearer the middle on narrow screens) and the words visibly come out of
 * it.
 */
const NARROW_BIO_AIM = { x: 1.5, pitch: (13 * Math.PI) / 180 };
const narrowBioCamera: Partial<CameraComposition> = {
  target: [NARROW_BIO_AIM.x, 1.55 + 9.86 * Math.tan(NARROW_BIO_AIM.pitch), -1.36],
  offset: [-NARROW_BIO_AIM.x, -9.86 * Math.tan(NARROW_BIO_AIM.pitch), 9.86],
};
const aboutCamera = {
  desktop: cameraConfig,
  tablet: narrowBioCamera,
  mobile: narrowBioCamera,
} as const;

/*
 * The hero stands at the same eye point as the landscape camera but looks up
 * a little less (6.7° instead of 9.6°), which lifts the far edge of the water
 * from 72% to 68% of the viewport, where the approved composition has it.
 * Only the hero's own rest uses this; every other chapter is unchanged.
 */
const heroCameraConfig: CameraComposition = {
  ...cameraConfig,
  target: [0, 2.701, -1.360344639557681],
  offset: [0, -1.151, 9.860344639557681],
};
/*
 * Phones and portrait tablets see a narrow slice of the view. There the hero
 * camera stands 2.2 units to the right and turns a few degrees further right,
 * so the perch and the robot can stand clear of the line the journey flies
 * along (to the left of them) and still be in frame below the copy.
 */
const narrowHeroCamera: Partial<CameraComposition> = {
  target: [2.9, 2.701, -1.360344639557681],
  offset: [-0.7, -1.151, 9.860344639557681],
};
const heroCamera = {
  desktop: heroCameraConfig,
  tablet: narrowHeroCamera,
  mobile: narrowHeroCamera,
} as const;

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
/*
 * Selected Work on desktop stands lower and a little further back than the
 * landscape camera: the eye 1.3 above the water rather than 1.55, pitched up
 * a touch more, on a slightly wider lens. From there the stone's crown and its
 * rubble skirt both fit the frame, and the range behind rises above the water
 * instead of being looked down onto. The horizon moves from 72% to about 74%.
 */
const workCameraConfig: CameraComposition = {
  ...cameraConfig,
  target: [0, 3.61, -1.36],
  offset: [0, -2.31, 11.36],
  fov: 46,
};
const workCamera = {
  desktop: workCameraConfig,
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
    fallbackHorizonPercent: 68,
    camera: heroCamera,
    lighting: environmentLightingConfig,
    horizonLights: heroHorizonLightConfig,
    fog: heroAtmosphereConfig,
    mist: heroMistConfig,
    water: floorConfig,
    particles: heroParticleConfig,
    // The hero's rock is the robot's perch, in heroLandscapeConfig.
    rockInstanceIds: [],
    reducedMotion,
  },
  "selected-work": {
    sectionId: "selected-work",
    fallbackHorizonPercent: 76,
    camera: workCamera,
    lighting: workLightingConfig,
    horizonLights: workHorizonLightConfig,
    fog: horizonAtmosphereConfig,
    mist: lowMistConfig,
    water: floorConfig,
    particles: workParticleConfig,
    rockInstanceIds: [],
    reducedMotion,
  },
  about: {
    sectionId: "about",
    fallbackHorizonPercent: 80,
    camera: aboutCamera,
    lighting: environmentLightingConfig,
    horizonLights: horizonLightConfig,
    fog: horizonAtmosphereConfig,
    mist: lowMistConfig,
    water: floorConfig,
    particles: aboutParticleConfig,
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
    mist: lowMistConfig,
    water: floorConfig,
    particles: footerParticleConfig,
    rockInstanceIds: ["footer-dominant-right"],
    reducedMotion,
  },
} as const satisfies Readonly<Record<SectionId, SceneSectionConfig>>;

/*
 * Where each chapter's composition stands in the one shared world.
 *
 * Every section camera, rock transform and light above is authored as if the
 * viewer stood at the origin looking down -z. A frame moves that composition
 * into place, so at rest each chapter looks exactly as composed.
 *
 * Selected Work is the fixed point: the first stone stands at (2.7, 0, -6.4),
 * the second at (-18, 0, -24), and the range spans z -45 to -83. The hero
 * stands 40 units back across the water. From there the stones are lost in
 * the scene fog (far 58) and the range is a distant ridge.
 *
 * After the second stone the viewer turns to face back across the water
 * (+z), so How I Work and Contact are composed facing that way (yaw π), on a
 * lane 12 units to the left of the approach. That keeps both clear of the
 * stones, puts the Contact rock at (-22, 56.5), behind the hero camera where
 * the hero never sees it, and keeps every chapter in front of the mountain
 * range rather than walking into it.
 */
export const chapterFrames = {
  hero: { origin: [-24.7, 0, 28.2], yaw: 0 },
  "selected-work": { origin: [0, 0, 0], yaw: 0 },
  about: { origin: [-12, 0, 22.5], yaw: Math.PI },
  footer: { origin: [-12, 0, 46.5], yaw: Math.PI },
} as const satisfies Readonly<Record<SectionId, ChapterFrame>>;

/*
 * The arrival: from the hero to the first stone, one continuous shot.
 *
 * Each keyframe is a composition meant to hold up as a still. `at` is the
 * share of the arrival's scroll (top of the page to the first settle);
 * `speed` is how fast the camera is still travelling as it passes, in world
 * units per whole arrival. Zero means it stands still there.
 *
 *   01 establishing  low on the shore behind the perch. The first stone
 *                    stands out of frame to the right, directly behind the
 *                    perch's crest, the one part of the grounded rock tall
 *                    enough to hide it
 *   02 first move    a truck right, turning with it: the perch and robot
 *                    slide left across the frame and the crest comes in on
 *                    the right with the stone behind it. Only the tip of
 *                    the stone's crown clears the crest; the screen is hidden
 *   03 discovery     the truck carries on: by parallax the stone slides out
 *                    from behind the crest's right shoulder, first a glimpse
 *                    of the screen, then about half of it. The camera
 *                    lingers here but never stops
 *   —  pass          still trucking right, behind and past the perch, which
 *                    slides out of frame and leaves the stone whole
 *   04 approach      the fastest stretch, rising toward the stone
 *   05 arrival       low and a little left of the stone, looking up at it;
 *                    a long deceleration ends in a settle
 *
 * The hero composition stands where the camera -> crest -> stone line runs
 * through the second keyframe, so the stone is never faded in: it is solid
 * the whole way and only ever hidden by the rock or the frame. Every keyframe
 * up to the approach is authored in the hero frame, so it stays with the
 * perch.
 */
const heroArrival = (
  at: number,
  speed: number,
  eye: Vector3Tuple,
  target: Vector3Tuple,
): ArrivalKeyframe => ({ at, speed, ...poseInFrame(chapterFrames.hero, { eye, target, fov: 34 }) });

// Frozen (2026-09-25): see docs/camera-system.md before changing any value.
const desktopArrival: readonly ArrivalKeyframe[] = [
  heroArrival(0, 0, [0.4, 0.8, 11], [0.4, 2.05, -2]),
  heroArrival(0.26, 10, [2, 0.6, 8.5], [4.7, 1.85, -4.2]),
  heroArrival(0.5, 8, [3.2, 0.65, 8.7], [8.7, 1.9, -3.1]),
  heroArrival(0.62, 70, [9.8, 1.2, 7.9], [14.2, 2.6, -4.3]),
  // From the heading's reveal the camera climbs forward over
  // the water toward the range, the ridges sinking through the frame, until it
  // holds among the peaks for Quill & Pigeon.
  { at: 0.7, eye: [-11, 5.5, 26], target: [-0.6, 9, -12.6], fov: 34 },
  { at: 0.78, eye: [-11, 15, 13], target: [3.6, 21, -55], fov: 34 },
  { at: 0.86, eye: [-9, 28, 2], target: [6.6, 35, -96], fov: 34 },
  { at: 0.93, eye: [-7.6, 43, -6], target: [8.5, 50, -125], fov: 34 },
  { at: 1, speed: 0, ...quillSettle },
];

/*
 * Pass-through points; the camera does not stop at these.
 *
 * approach    hero frame. Early in the move forward, already easing left of
 *             the perch so the rock and robot slide out of the right edge.
 * arrival     hero frame. Crossing the open water toward the far view of the
 *             first stone, left of the perch so it is left well behind.
 * departure   world. From the last stone the camera turns left, away from
 *             both stones, until it faces back across the water toward How I
 *             Work.
 *
 * Below the desktop breakpoint the arrival still runs hero → approach →
 * arrival → far view → settle, now without stopping at the far view.
 */
export const journeyWaypoints = {
  approach: { eye: [-3.3, 1.5, 6.0], target: [-3.0, 2.65, -3.9], fov: 42 },
  arrival: { eye: [-3, 3.2, -8], target: [1.8, 5.2, -43], fov: 43 },
  departure: [
    { eye: [-36, 4.5, 26], target: [-62, 4, 32], fov: 38 },
    { eye: [-18, 2.6, 10], target: [-12, 3, 34], fov: 42 },
  ],
  /*
   * How I Work to Contact, composed in the bio's frame. The camera leaves the
   * doorway behind it: it rises and drifts left out over the water, looking
   * away across the dark, then glides on and turns to find the Contact rock.
   * Both points keep the doorway outside the frame.
   */
  passage: [
    poseInFrame(chapterFrames.about, { eye: [-3.2, 3.4, 2.5], target: [-9, 3.8, -16], fov: 42 }),
    poseInFrame(chapterFrames.about, { eye: [-3.8, 3, -7], target: [3, 3.4, -32], fov: 42 }),
  ],
} as const satisfies Readonly<{
  approach: PosePoint;
  arrival: PosePoint;
  departure: readonly PosePoint[];
  passage: readonly PosePoint[];
}>;

/** The arrival keyframes for a viewport. */
export function arrivalKeyframes(viewport: SceneViewport): readonly ArrivalKeyframe[] {
  if (viewport === "desktop") return desktopArrival;
  const stacked = monolithConfig.stations.stacked[0]!;
  // Speeds are left to the timeline: it carries the pace through each point.
  return [
    { at: 0, ...chapterRest("hero", viewport) },
    { at: 0.14, ...poseInFrame(chapterFrames.hero, journeyWaypoints.approach) },
    { at: 0.34, ...poseInFrame(chapterFrames.hero, journeyWaypoints.arrival) },
    // The climb toward the peaks, then the elevated hold.
    { at: 0.55, eye: [-18, 14, 8], target: [-6, 24, -110], fov: 44 },
    { at: 0.78, eye: [-10, 36, -2], target: [2, 58, -130], fov: 45 },
    { at: 1, speed: 0, ...stacked.settle },
  ];
}

/*
 * The departure, from the first stone to the second: compression, passage,
 * release. `at` is the share of the travel between the two holds; the details
 * have already left while the camera stood still.
 *
 *   0     Quill & Pigeon, settled
 *   —     first move: a truck left, rising and turning a little with it; the
 *         stone slides to the middle and fills it
 *   —     passage: drawing back as it trucks, the stone's edge crosses the
 *         right of the frame and goes
 *   —     release: rising and drawing back as it goes; Survue comes in from
 *         the left as the first stone clears the right. From out here the two
 *         stand only 35 to 45 degrees apart, so one of them is always in a
 *         52-degree frame: the hand-over is as late as the geometry allows
 *   —     discovery: about 60 out, looking a little down, so the distant
 *         stone stands dark against the pale haze on the water, just right
 *         of centre and under half the view's height
 *   —     halfway: nearer, still high, Survue centred, the water wide
 *   —     three quarters: lower, Survue easing right
 *   1     settled: down at the settle's height, Survue on the right third,
 *         the left of the frame left open for its details
 *
 *   From the discovery on the path is a diagonal, not a straight push: it
 *   comes forward, trucks left and descends at once, and the aim eases from
 *   centre to the right third, while the speed falls steadily to the settle.
 *
 * The second stone is kept back until the departure begins, when it stands
 * out of frame to the left (see the reveal in monolith.ts); it is only ever
 * brought into view by the camera turning and moving, never faded in.
 */
// Frozen (2026-09-25): see docs/camera-system.md before changing any value.
const desktopDeparture: readonly ArrivalKeyframe[] = [
  // The glide between the projects stays up among the peaks.
  { at: 0, speed: 0, ...quillSettle },
  { at: 0.5, eye: [-26, 57, -12], target: [-22, 64, -160], fov: 34 },
  { at: 1, speed: 0, ...survueSettle },
];

/**
 * The way from each stone to the next, by the index of the stone arrived at.
 * Null where the travel is the stations' own approach points instead.
 */
export function departureKeyframes(
  viewport: SceneViewport,
): readonly (readonly ArrivalKeyframe[] | null)[] {
  return viewport === "desktop" ? [null, desktopDeparture] : [];
}

/*
 * The bio's two shots, built from the poses they join so they hold for every
 * layout. Both run on the same keyframe timeline as the frozen journey: even
 * pacing along the path, a sine ease out of one rest and into the next, and
 * the view turning at a steady rate as the camera travels rather than all at
 * once.
 *
 * toBio     from the last stone, a wide right-hand turn over the open water:
 *           the camera comes about, the stones slide away to the left, and it
 *           settles facing back across the dark toward the bio and its
 *           doorway. 185° of turn over the whole runway, never a whip.
 * toContact from the bio straight on out over the water: a gentle rise and a
 *           drift left, so the doorway slides past on the right and out of
 *           frame by parallax, then down again into Contact. No turn at all.
 */
type ShotShape = Readonly<{
  /** How far the path keeps each rest's heading before curving, in world units. */
  reach: number;
  /** Eye offset at the middle of the shot, in world units, eased in and out. */
  sway: Vector3Tuple;
  /** Pitch, in radians, added at the middle of the shot (negative looks down). */
  tilt: number;
  /** Distance of the aim ahead of the eye, between the rests. */
  aim: number;
}>;

const SHOT_KEYS = 11;

function composeShot(from: PosePoint, to: PosePoint, shape: ShotShape): ArrivalKeyframe[] {
  const heading = (pose: PosePoint) => {
    const dx = pose.target[0] - pose.eye[0];
    const dz = pose.target[2] - pose.eye[2];
    const length = Math.hypot(dx, dz) || 1;
    return [dx / length, dz / length] as const;
  };
  const pitchOf = (pose: PosePoint) => {
    const dx = pose.target[0] - pose.eye[0];
    const dy = pose.target[1] - pose.eye[1];
    const dz = pose.target[2] - pose.eye[2];
    return Math.atan2(dy, Math.hypot(dx, dz));
  };
  const [sx, sz] = heading(from);
  const [ex, ez] = heading(to);

  // The ground path: a cubic leaving along the first heading, arriving along the last.
  const p0 = [from.eye[0], from.eye[2]] as const;
  const p1 = [p0[0] + sx * shape.reach, p0[1] + sz * shape.reach] as const;
  const p3 = [to.eye[0], to.eye[2]] as const;
  const p2 = [p3[0] - ex * shape.reach, p3[1] - ez * shape.reach] as const;
  const bezier = (t: number) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ] as const;
  };

  // Arc length, and the path's own heading, unwrapped, so the turn goes the way it curves.
  const STEPS = 400;
  const lengths = [0];
  const yaws = [Math.atan2(sx, sz)];
  let previous = bezier(0);
  for (let step = 1; step <= STEPS; step += 1) {
    const point = bezier(step / STEPS);
    lengths.push(lengths[step - 1]! + Math.hypot(point[0] - previous[0], point[1] - previous[1]));
    const raw = Math.atan2(point[0] - previous[0], point[1] - previous[1]);
    const last = yaws[step - 1]!;
    yaws.push(last + (((raw - last + Math.PI * 3) % (Math.PI * 2)) - Math.PI));
    previous = point;
  }
  const total = lengths[STEPS]!;
  const endYaw = Math.atan2(ex, ez);
  const startYaw = yaws[0]!;
  // The path's total turn decides the direction; the rests decide the exact angles.
  const travelled = yaws[STEPS]! - startYaw;
  const turn =
    travelled + (((endYaw - (startYaw + travelled) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const paramAt = (share: number) => {
    const wanted = share * total;
    let index = 1;
    while (index < STEPS && lengths[index]! < wanted) index += 1;
    const before = lengths[index - 1]!;
    const span = lengths[index]! - before || 1;
    return (index - 1 + (wanted - before) / span) / STEPS;
  };

  const startPitch = pitchOf(from);
  const endPitch = pitchOf(to);
  const keys: ArrivalKeyframe[] = [];
  for (let key = 0; key < SHOT_KEYS; key += 1) {
    const share = key / (SHOT_KEYS - 1);
    if (key === 0) {
      keys.push({ at: 0, speed: 0, ...from });
      continue;
    }
    if (key === SHOT_KEYS - 1) {
      keys.push({ at: 1, speed: 0, ...to });
      continue;
    }
    const [x, z] = bezier(paramAt(share));
    const bell = Math.sin(Math.PI * share);
    const ease = (1 - Math.cos(Math.PI * share)) / 2;
    const eye: Vector3Tuple = [
      x + shape.sway[0] * bell,
      from.eye[1] + (to.eye[1] - from.eye[1]) * ease + shape.sway[1] * bell,
      z + shape.sway[2] * bell,
    ];
    // The view turns with distance travelled, so it turns as steadily as it moves.
    const yaw = startYaw + turn * share;
    const pitch = startPitch + (endPitch - startPitch) * share + shape.tilt * bell;
    const reachOut = Math.cos(pitch) * shape.aim;
    const target: Vector3Tuple = [
      eye[0] + Math.sin(yaw) * reachOut,
      eye[1] + Math.sin(pitch) * shape.aim,
      eye[2] + Math.cos(yaw) * reachOut,
    ];
    // Sine-eased in time: the timeline leaves and arrives at rest and peaks midway.
    const at = Math.acos(1 - 2 * share) / Math.PI;
    const speed = total * (Math.PI / 2) * Math.sin(Math.PI * at);
    keys.push({ at, speed, eye, target, fov: from.fov + (to.fov - from.fov) * ease });
  }
  return keys;
}

/*
 * After the last project the camera sinks back to the
 * water, still facing the range, so the peaks rise back over the horizon as
 * it comes down. It lands on the approved water-level pose, from which the
 * approved turn to the bio runs unchanged.
 */
const stackedSurvueWater: PosePoint = { eye: [-34, 3.2, 2.5], target: [-30, 3.4, -14], fov: 46 };

export function waterSettle(viewport: SceneViewport): PosePoint {
  return viewport === "desktop" ? survueWaterSettle : stackedSurvueWater;
}

export function descentKeyframes(viewport: SceneViewport): readonly ArrivalKeyframe[] {
  if (viewport === "desktop") {
    return [
      { at: 0, speed: 0, ...survueSettle },
      { at: 0.35, eye: [-44, 36, 2], target: [-58, 44, -160], fov: 34 },
      { at: 0.7, eye: [-40.5, 17, 15], target: [-42, 19, -120], fov: 34 },
      { at: 1, speed: 0, ...survueWaterSettle },
    ];
  }
  const high = monolithConfig.stations.stacked[1]!.settle;
  return [
    { at: 0, speed: 0, ...high },
    { at: 0.45, eye: [-39, 26, 0], target: [-44, 30, -150], fov: 46 },
    { at: 1, speed: 0, ...stackedSurvueWater },
  ];
}

/** Screens of scroll the descent takes, before the turn to the bio (matches Statement.module.css). */
export const DESCENT_SCREENS = { desktop: 1, narrow: 0.65 } as const;

export type BioShots = Readonly<{
  toBio: readonly ArrivalKeyframe[];
  toContact: readonly ArrivalKeyframe[];
}>;

export function bioShots(lastSettle: PosePoint, about: PosePoint, contact: PosePoint): BioShots {
  return {
    toBio: composeShot(lastSettle, about, { reach: 15, sway: [0, 1.4, 0], tilt: 0, aim: 20 }),
    toContact: composeShot(about, contact, {
      reach: 8,
      sway: [2.4, 1.5, 0],
      tilt: -0.06,
      aim: 16,
    }),
  };
}

/** The Selected Work stations for a viewport: desktop, or stacked below it. */
export function workStations(viewport: SceneViewport): readonly WorkStation[] {
  return monolithConfig.stations[viewport === "desktop" ? "desktop" : "stacked"];
}

/** The resting pose of a chapter, in world space. */
export function chapterRest(sectionId: SectionId, viewport: SceneViewport): PosePoint {
  const camera = resolveCamera(sectionId, viewport);
  return poseInFrame(chapterFrames[sectionId], {
    eye: [
      camera.target[0] + camera.offset[0],
      camera.target[1] + camera.offset[1],
      camera.target[2] + camera.offset[2],
    ],
    target: camera.target,
    fov: camera.fov,
  });
}

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
