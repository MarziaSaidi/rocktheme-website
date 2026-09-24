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

export type EnvironmentLightingConfig = Readonly<{
  ambientColor: number;
  ambientIntensity: number;
  edgeColor: number;
  edgeIntensity: number;
  edgePosition: Vector3Tuple;
  fillColor: number;
  fillIntensity: number;
  fillPosition: Vector3Tuple;
  beaconGain: number;
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
  /** Radius of the atmospheric glow, as a fraction of the viewport. */
  spread: number;
  shimmer: number;
  phase: number;
}>;

export type HorizonLightConfig = Readonly<{
  focusGain: number;
  focusEase: number;
  sources: readonly HorizonLightSource[];
}>;

export type FogConfig = Readonly<{
  color: number;
  density: number;
  depth: number;
  baseY: number;
  hazeHeight: number;
  hazeBelow: number;
  hazeOpacity: number;
  glowHeight: number;
  glowBelow: number;
  glowOpacity: number;
  /**
   * One continuous low-lying mist volume hanging over the water. Not a set of
   * discrete plumes: coverage, lift and internal structure all come from
   * layered noise so no silhouette repeats along the horizon.
   */
  mist: Readonly<{
    height: number;
    opacity: number;
    /** Lower values spread coverage across wider stretches of the horizon. */
    coverageScale: number;
    /** Share of the layer that stays pinned to the water surface. */
    cling: number;
    drift: number;
  }>;
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
