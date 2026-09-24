import type { ResponsiveOverrides, SceneViewport } from "@/config/responsive";
import type { SectionId } from "@/config/sections";

export type Vector2Tuple = readonly [number, number];
export type Vector3Tuple = readonly [number, number, number];

export type RockSemanticRole =
  "foreground" | "midground" | "background" | "shoreline" | "dominant-formation";
export type RockLoadingGroup = "entry" | "initial" | "deferred";
export type RockFallback = "css-landscape" | "omit";
export type RockMaterialPresetId = "wet-black-violet";

export type RockAssetDefinition = Readonly<{
  id: string;
  source: `/assets/rocks/${string}.glb`;
  allowedSections: readonly SectionId[];
  role: RockSemanticRole;
  loadingGroup: RockLoadingGroup;
  materialPreset?: RockMaterialPresetId;
  fallback: RockFallback;
  attribution?: string;
}>;

export type RockTransform = Readonly<{
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  /** World scale after the source model has been normalized to one unit. */
  scale: Vector3Tuple;
}>;

export type RockVisibility = Readonly<{
  viewports: readonly SceneViewport[];
  reducedMotion: boolean;
}>;

export type RockInstanceDefinition = Readonly<{
  id: string;
  assetId: string;
  sectionId: SectionId;
  role: RockSemanticRole;
  depthLayer: "foreground" | "midground" | "background";
  renderOrder: number;
  visibility: RockVisibility;
  materialPreset: RockMaterialPresetId;
  reflection: boolean;
  particleInteraction: boolean;
  transform: ResponsiveOverrides<RockTransform>;
}>;

export type CameraComposition = Readonly<{
  target: Vector3Tuple;
  offset: Vector3Tuple;
  fov: number;
  near: number;
  far: number;
}>;

/**
 * Rock illumination only. These are the lights that actually shade geometry;
 * what the eye reads at the horizon is scattering drawn by the atmosphere
 * shaders, which is a separate thing entirely.
 */
export type EnvironmentLightingConfig = Readonly<{
  hemisphereSky: number;
  hemisphereGround: number;
  hemisphereIntensity: number;
  points: readonly Readonly<{
    position: Vector3Tuple;
    color: number;
    intensity: number;
    distance: number;
    decay: number;
  }>[];
  /** How much the beacons lift the point lights as they drift. */
  beaconGain: number;
  /** Linear scene fog, matched to the DOM background so no seam shows. */
  fogNear: number;
  fogFar: number;
}>;

export type HorizonLightSource = Readonly<{
  /** Horizontal placement as a fraction of the viewport. */
  position: number;
  /** Distance behind the origin. Sources sit at different depths on purpose. */
  depth: number;
  /** Height above the water. The mirrored copy of this drives the reflection. */
  elevation: number;
  color: number;
  intensity: number;
  /**
   * World size of the quad the scattering is drawn into. Deliberately much
   * wider than tall: a square quad renders as an orb.
   */
  width: number;
  height: number;
  /** Width of this source's illumination of the mist, in viewport fractions. */
  spread: number;
  shimmer: number;
  phase: number;
  seed: number;
}>;

export type HorizonLightConfig = Readonly<{
  focusGain: number;
  focusEase: number;
  sources: readonly HorizonLightSource[];
}>;

export type FogConfig = Readonly<{
  /** Matched to the DOM background the canvas composites over. */
  color: number;
  /**
   * Overlapping mist sheets at different depths. Individually each is a plane;
   * because their noise, drift, size and opacity all differ they read as one
   * uneven atmospheric field rather than as three objects.
   */
  layers: readonly Readonly<{
    depth: number;
    /** World height of the sheet. Its base is pinned just under the water. */
    height: number;
    widthFactor: number;
    offsetX: number;
    opacity: number;
    seed: number;
    speed: number;
    noiseScale: number;
    heightBias: number;
  }>[];
}>;

export type WaterConfig = Readonly<{
  horizon: number;
  /** Reflection lookup displacement, in UV units per unit of surface slope. */
  distortion: number;
  /** Amplitude multiplier for the broad swell fields. */
  swell: number;
  /** Strength multiplier for the high-frequency micro-normal layer. */
  ripple: number;
  pointerZone: number;
  rippleSeconds: number;
  rippleInterval: number;
}>;

export type ParticleConfig = Readonly<{
  density: Readonly<{
    high: Readonly<{ perMegapixel: number; max: number }>;
    medium: Readonly<{ perMegapixel: number; max: number }>;
    low: Readonly<{ perMegapixel: number; max: number }>;
    mobileFactor: number;
    reducedMotionFactor: number;
  }>;
  path: readonly Vector2Tuple[];
  corridorHeight: number;
  wispFraction: number;
  wispSpread: number;
  branches: readonly Readonly<{
    split: number;
    merge: number;
    offset: number;
    fraction: number;
  }>[];
  seed: number;
  pointer: Readonly<{
    awareness: number;
    orbit: number;
    contact: number;
    awarenessForce: number;
    divideForce: number;
    splitForce: number;
    contactForce: number;
  }>;
  driftSpeed: number;
  flowScale: number;
  rise: number;
  flowStrength: number;
  flowTimeScale: number;
  damping: number;
  followStrength: number;
  pathReturn: number;
  recoverySeconds: number;
  goldChance: number;
  goldSeconds: number;
  obstaclePadding: number;
  obstacleInfluence: number;
  obstacleStrength: number;
  edgeFade: number;
  sizeRange: Vector2Tuple;
  focusRadius: number;
  focusStrength: number;
  focusEase: number;
}>;

export type SceneSectionConfig = Readonly<{
  sectionId: SectionId;
  fallbackHorizonPercent: number;
  camera: ResponsiveOverrides<CameraComposition>;
  lighting: EnvironmentLightingConfig;
  horizonLights: HorizonLightConfig;
  fog: FogConfig;
  water: WaterConfig;
  particles: ParticleConfig;
  rockInstanceIds: readonly string[];
  reducedMotion: Readonly<{
    animateParticles: false;
    animateWater: false;
    animateAtmosphere: false;
    pointerResponse: false;
  }>;
}>;
