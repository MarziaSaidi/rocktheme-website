import type { ResponsiveOverrides, SceneViewport } from "@/config/responsive";
import type { SectionId } from "@/config/sections";

import type { PosePoint } from "./core/chapterFrame";

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
  /**
   * How visible the horizon glow is, 0 to 1 (default 1), eased on a chapter
   * change. The water's reflection of the sources is unaffected.
   */
  level?: number;
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

/**
 * Aerial perspective for geometry past the scene fog's far distance, which
 * linear fog would erase outright. Distances are world units from the viewer.
 */
export type DistanceFogConfig = Readonly<{
  /** The DOM background the canvas composites over, so ridges sink into it. */
  color: number;
  /** Nothing nearer than this is fogged at all. */
  distance: number;
  /** Exponential-squared density beyond `distance`. */
  density: number;
  /** World height over which the extra haze at the base thins out. */
  height: number;
  /** Extra haze at the waterline, 0 to 1, on top of the distance term. */
  heightDensity: number;
  /** Ceiling, so the furthest silhouette never disappears entirely. */
  maxAmount: number;
  /**
   * Colour of the haze at the waterline, where mist lit from the horizon sits
   * between the ridges. Defaults to `color`.
   */
  lowColor?: number;
}>;

/**
 * Low mist lying on the water: a stack of horizontal noise slices fixed in the
 * world. Perspective does the depth work: the slices converge into a dense
 * band at the horizon and separate into soft banks nearer the viewer.
 */
export type LowMistConfig = Readonly<{
  /** Output (sRGB) colour of lit mist. Kept near the background, never white. */
  color: number;
  /** Peak opacity where every slice overlaps. 0 hides the mist. */
  opacity: number;
  /** 0 to 1. Higher fills more of the surface; lower leaves open water. */
  density: number;
  /** Ceiling far out, where the mist banks up round the mountain bases. */
  height: number;
  /** Ceiling near the viewer. Capped under the camera's eye line. */
  nearHeight: number;
  /** World units per second the banks drift. */
  speed: number;
  /** Drift heading on the water, radians from +x. */
  direction: number;
  /** Feature size of the two noise fields, as world frequencies. */
  noiseScale: Readonly<{ large: number; small: number }>;
  /**
   * Clear water near the viewer, the span over which the ceiling rises from
   * `nearHeight` to `height`, and a soft end before the mist's far edge.
   */
  distance: Readonly<{ near: Vector2Tuple; rise: Vector2Tuple; far: Vector2Tuple }>;
  /** Slices and noise octaves per viewport; mobile gets fewer of each. */
  detail: ResponsiveOverrides<Readonly<{ slices: number; octaves: number }>>;
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
  /** How present the stream is, 0 to 1 (default 1). Eased on a chapter change. */
  presence?: number;
  /**
   * When set, the field is a trail instead of a full-width stream: particles
   * flow along fixed strands whose control points are pinned to named screen
   * anchors, so the river stays put while the particles in it move.
   */
  trail?: ParticleTrailConfig;
}>;

/**
 * A control point on a trail strand. `at` is a position in the anchor
 * rectangle's own fractions (0 to 1 inside it; outside is allowed). `width` is
 * the strand's width there in CSS px, authored at a 900px-tall viewport.
 * `front` is the share of particles drawn above the page as they pass here.
 */
export type ParticleTrailPoint = Readonly<{
  anchor: string;
  at: Vector2Tuple;
  width: number;
  front?: number;
}>;

/** One strand, listed upstream first. Particles enter at the first point. */
export type ParticleTrailStrand = Readonly<{
  points: readonly ParticleTrailPoint[];
  /** Share of the particles that flow along this strand. */
  weight: number;
  alpha?: number;
}>;

export type ParticleTrailConfig = Readonly<{
  strands: readonly ParticleTrailStrand[];
  /** Speed along the strand, CSS px per second. */
  speed: Vector2Tuple;
  /** Shares of the particles in the loose edge and escaping the trail; the rest are core. */
  edgeFraction: number;
  escapeFraction: number;
  /** Seconds an escaped particle takes to drift off and fade. */
  escapeSeconds: Vector2Tuple;
  /** Perpendicular wobble, as a share of the local width, and its rate in rad/s. */
  wobble: number;
  wobbleRate: Vector2Tuple;
  /** Opacity ceiling for particles drawn over the content. */
  frontAlpha: number;
  /** Multiplies the quality tier's particle count. */
  countScale: number;
}>;

export type SceneSectionConfig = Readonly<{
  sectionId: SectionId;
  fallbackHorizonPercent: number;
  camera: ResponsiveOverrides<CameraComposition>;
  lighting: EnvironmentLightingConfig;
  horizonLights: HorizonLightConfig;
  fog: FogConfig;
  mist: LowMistConfig;
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

/**
 * The Selected Work monolith: one stone, two display faces, and the mountain
 * range behind it. Face geometry is in the stone's own model units, measured
 * from the supplied GLB, so the screens sit on its real faces.
 */
export type MonolithFace = Readonly<{
  /**
   * Face plane in the aligned model frame, seen from that face:
   * depth = offset + slope × height + across × sideways.
   */
  offset: number;
  slope: number;
  across: number;
}>;

export type MonolithPlacement = Readonly<{
  position: Vector3Tuple;
  /** Uniform height scale; the stone's own proportions are kept on y. */
  height: number;
  /** Footprint scale relative to height. Applied equally to x and z. */
  girth: number;
  /** Fixed yaw so the screen face meets the settled camera with a little depth. */
  yaw: number;
  /** Screen height and centre, in the stone's model units. */
  screenHeight: number;
  screenCenterY: number;
}>;

export type MountainPlacement = Readonly<{
  position: Vector3Tuple;
  scale: Vector3Tuple;
  yaw: number;
}>;

/**
 * One stop of the Selected Work journey. The camera comes in through
 * `approach` (for the first stone, its first point is the far view where the
 * stage pins) and stands still at `settle` while the project is shown.
 */
export type WorkStation = Readonly<{
  approach: readonly PosePoint[];
  settle: PosePoint;
}>;

export type MonolithConfig = Readonly<{
  sectionId: SectionId;
  stone: Readonly<{
    source: `/assets/selected-work/${string}.glb`;
    /** Rotation that turns the stone's faces onto the model axes. */
    alignYaw: number;
    /** Pillar axis in the aligned frame. */
    axis: Vector2Tuple;
  }>;
  /** One stone per featured project, in project order, each at its own place. */
  stones: readonly ResponsiveOverrides<MonolithPlacement>[];
  mountains: Readonly<{
    source: `/assets/selected-work/${string}.glb`;
    placement: ResponsiveOverrides<MountainPlacement>;
    fog: DistanceFogConfig;
    /** Multiplies the range's albedo after it is matched to the footer stone. */
    shade: number;
  }>;
  screen: Readonly<{
    /** Width over height of the screen images, kept after the girth scale. */
    aspect: number;
    /** Stone left visible between screen and housing edge. */
    bezel: number;
    /** How far the housing sits into the stone behind the face plane. */
    housingDepth: number;
    /** Housing face clearance above the stone's highest point. */
    clearance: number;
    offColor: number;
    /** Charcoal of the stone itself, for the housing's exposed lip. */
    housingColor: number;
    rimColor: number;
    glowColor: number;
    glowIntensity: number;
    /** The wide face the screen is set into. */
    face: MonolithFace;
  }>;
  key: Readonly<{ color: number; intensity: number; position: Vector3Tuple }>;
  /** The camera's stops, one per stone. Stacked layouts get their own framing. */
  stations: Readonly<Record<"desktop" | "stacked", readonly WorkStation[]>>;
}>;

/**
 * A model scaled to a world footprint. `width` is the span across x, `depth`
 * along z and `height` up y, each after the model is turned by `yaw`.
 */
export type LandscapeModelPlacement = Readonly<{
  position: Vector3Tuple;
  width: number;
  height: number;
  depth: number;
  yaw: number;
  /** Mirrored across its own x axis, so a second copy reads as new ground. */
  mirror?: boolean;
}>;

export type HeroRobotPlacement = Readonly<{
  /** Where the robot sits, in the hero frame. Its height is found on the rock. */
  x: number;
  z: number;
  /** World height of the seated figure. */
  height: number;
  /** Turn about +y; 0 faces the viewer. */
  yaw: number;
}>;

export type HeroLandscapePlacement = Readonly<{
  mountains: LandscapeModelPlacement;
  /** A second copy of the range, nearer and to the left. */
  flank: LandscapeModelPlacement;
  perch: LandscapeModelPlacement;
  robot: HeroRobotPlacement;
  /** Where the moon hangs; it moves in with the rest on narrow views. */
  moon: Vector3Tuple;
}>;

/**
 * The hero landscape: the mountain range across the back of the view, the rock
 * in the right foreground and the robot seated on it. Positions are in the
 * hero chapter frame.
 */
export type HeroLandscapeConfig = Readonly<{
  sectionId: SectionId;
  sources: Readonly<{
    mountains: `/assets/hero/${string}.glb`;
    perch: `/assets/hero/${string}.glb`;
    robot: `/assets/hero/${string}.glb`;
  }>;
  placement: ResponsiveOverrides<HeroLandscapePlacement>;
  /** Aerial perspective on the range, which stands past the scene fog. */
  mountainFog: DistanceFogConfig;
  /** Multiplies the range's albedo after it is matched to the footer stone. */
  mountainShade: number;
  /** Multiplies the perch rock's albedo after it is matched to the footer stone. */
  perchShade: number;
  /**
   * Moonlight from behind the range, toward the viewer. It rims every ridge,
   * the crown of the perch and the robot's head from the same direction the
   * glow in the sky comes from. `position` is the direction it comes from.
   */
  moonlight: Readonly<{ color: number; intensity: number; position: Vector3Tuple }>;
  /**
   * The moon itself, behind the range: a small bright disc in a wide soft
   * halo. It stands in the world, so the peaks in front of it cut into it.
   */
  moon: Readonly<{
    /** World diameter of the halo; the disc is a small share of it. */
    size: number;
    color: number;
    haloColor: number;
    intensity: number;
  }>;
  /** A dim local light that separates the robot from the rock behind it. */
  robotLight: Readonly<{
    color: number;
    intensity: number;
    /** Offset from the robot, in multiples of its height. */
    offset: Vector3Tuple;
  }>;
}>;
