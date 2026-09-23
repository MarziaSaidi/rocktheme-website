/**
 * Scene configuration.
 *
 * The scene never reads CSS. These values mirror the semantic design tokens by
 * name so a change in `src/styles/tokens.css` has one obvious counterpart here.
 * Nothing in this file, or anywhere under `src/webgl`, may reference a project,
 * a slug, a label or any other portfolio fact.
 */

/** Mirrors the brand colours in `src/styles/tokens.css`. */
export const sceneColors = {
  /** --brand-aubergine */
  aubergine: 0x100b18,
  /** --brand-midnight */
  midnight: 0x191126,
  /** --brand-porcelain */
  porcelain: 0xf4eefa,
  /** --brand-lavender */
  lavender: 0xb793d2,
  /** --brand-botanical */
  botanical: 0xa8c947,
  /** --brand-gold */
  gold: 0xe6b84a,
  /** --brand-reflection */
  reflection: 0x715a92,
  /** Dark wet-surface base, kept distinct from the sky. */
  waterNear: 0x1b1424,
} as const;

export const particleConfig = {
  /** Density budgets per megapixel, with independent ceilings by quality tier. */
  density: {
    high: { perMegapixel: 3000, max: 4100 },
    medium: { perMegapixel: 1700, max: 2200 },
    low: { perMegapixel: 750, max: 1000 },
    mobileFactor: 0.62,
    reducedMotionFactor: 0.42,
  },
  /** One non-periodic current, specified as viewport-relative control points. */
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
  /** Dense core height; only a small fraction escapes into faint wisps. */
  corridorHeight: 0.1,
  wispFraction: 0.055,
  wispSpread: 0.14,
  /** Branches ease away and back, preserving each particle's assigned lane. */
  branches: [
    { split: 0.18, merge: 0.73, offset: -0.065, fraction: 0.105 },
    { split: 0.43, merge: 1.08, offset: 0.055, fraction: 0.085 },
  ],
  seed: 0x7a31d4,
  /** Only nearby points part gently around the pointer. All values are CSS px. */
  pointer: {
    awareness: 142,
    orbit: 72,
    contact: 28,
    awarenessForce: 58,
    divideForce: 155,
    splitForce: 390,
    contactForce: 175,
  },
  /** Base rightward drift in px per second, scaled by particle depth. */
  driftSpeed: 58,
  /** Curl-noise sampling scale. Lower is smoother. */
  flowScale: 0.001,
  /** Upward drift in px per second, so the stream sweeps rather than tracks flat. */
  rise: 3,
  /** Curl-noise strength in px per second. */
  flowStrength: 5,
  /** How fast the field evolves. */
  flowTimeScale: 0.045,
  /** Velocity damping per second. */
  damping: 2.4,
  /** Steering strength back towards the flow field. */
  followStrength: 2.7,
  /** How firmly displaced particles ease back to their assigned current. */
  pathReturn: 1.15,
  /** Seconds for a disturbed particle to rejoin the field. */
  recoverySeconds: 1.4,
  /** Fraction of a contact-zone particle's chance to flash gold each event. */
  goldChance: 0.004,
  /** Seconds a particle stays gold. */
  goldSeconds: 0.2,
  /** Distance in px that particles keep away from an obstacle rect. */
  obstaclePadding: 26,
  /** Distance in px over which an obstacle starts to bend the flow. */
  obstacleInfluence: 76,
  /** Steering strength away from obstacles. */
  obstacleStrength: 165,
  /** Edge fade width in px. */
  edgeFade: 90,
  /** Point size range in px before depth scaling. */
  sizeRange: [1.2, 2.45],
  /*
   * Focus attraction. When a plane becomes the active one, particles inside
   * this radius of its edges stream towards it and gather. The scene is given
   * a rectangle only; it never learns which project the rectangle belongs to.
   */
  focusRadius: 110,
  focusStrength: 13,
  /** Seconds for the gathering to reach full strength, and to release again. */
  focusEase: 0.9,
} as const;

/** Kept as an alias for existing scene checks and pointer consumers. */
export const pointerZones = particleConfig.pointer;

export const floorConfig = {
  /** Horizon position as a fraction of viewport height. */
  horizon: 0.72,
  /** Reflection distortion strength in UV space. Kept very small. */
  distortion: 0.014,
  /** Seconds for the surface drift to travel one noise period. */
  driftSeconds: 46,
  /** Screen-space travel in CSS pixels per second: distant, then foreground. */
  rippleTravelPxPerSecond: [1.05, 2.3],
  /** Maximum shallow ripple displacement in CSS pixels. */
  rippleDisplacementPx: 1.9,
  /** Ripples only respond in the lower fraction of the viewport. */
  pointerZone: 0.34,
  /** Maximum ripple radius in px. */
  rippleRadius: 180,
  /** Seconds a ripple takes to fade out. */
  rippleSeconds: 2.6,
  /** Minimum seconds between ripples so movement never splashes constantly. */
  rippleInterval: 0.42,
} as const;

/** A source and its water reflection are configured together. Width is CSS px. */
export const horizonLightConfig = {
  depth: -47,
  focusGain: 0.18,
  focusEase: 1.2,
  sources: [
    {
      position: 0.13,
      color: 0xc9b2e5,
      intensity: 0.64,
      reflectionLength: 0.18,
      width: 18,
      shimmer: 0.05,
      phase: 0.2,
    },
    {
      position: 0.37,
      color: 0xd4c2f0,
      intensity: 0.9,
      reflectionLength: 0.24,
      width: 26,
      shimmer: 0.07,
      phase: 1.8,
    },
    {
      position: 0.61,
      color: 0xdcc8f2,
      intensity: 1.0,
      reflectionLength: 0.27,
      width: 32,
      shimmer: 0.06,
      phase: 3.7,
    },
    {
      position: 0.72,
      color: 0xcbb4e9,
      intensity: 0.78,
      reflectionLength: 0.21,
      width: 22,
      shimmer: 0.08,
      phase: 5.1,
    },
  ],
} as const;

/** Low-lying atmosphere at the shared waterline. Positions are screen fractions. */
export const horizonAtmosphereConfig = {
  depth: -48,
  baseY: 0.38,
  hazeHeight: 2.5,
  hazeBelow: 1.1,
  hazeOpacity: 0.16,
  glowHeight: 3.5,
  glowBelow: 0.65,
  glowOpacity: 0.1,
  waterlineOpacity: 0.22,
  fogDensity: 0.004,
  plumes: [
    { x: 0.08, width: 0.085, height: 4.2, opacity: 0.26, speed: 0.75 },
    { x: 0.19, width: 0.055, height: 3.1, opacity: 0.23, speed: 0.92 },
    { x: 0.31, width: 0.07, height: 5.3, opacity: 0.22, speed: 0.68 },
    { x: 0.39, width: 0.045, height: 2.8, opacity: 0.27, speed: 1.06 },
    { x: 0.52, width: 0.075, height: 4.6, opacity: 0.24, speed: 0.81 },
    { x: 0.63, width: 0.055, height: 3.8, opacity: 0.29, speed: 0.7 },
    { x: 0.76, width: 0.09, height: 5.0, opacity: 0.22, speed: 0.88 },
    { x: 0.89, width: 0.06, height: 3.3, opacity: 0.25, speed: 1.02 },
  ],
} as const;

export type RockChapter = "hero" | "work" | "footer";

export const rockConfig: Readonly<{
  parallax: number;
  chapters: Record<
    RockChapter,
    Readonly<{
      url: string;
      position: readonly [number, number, number];
      rotation: number;
      width: number;
      heightRatio: number;
      mobile: Readonly<{
        position: readonly [number, number, number];
        width: number;
        heightRatio: number;
      }>;
    }>
  >;
}> = {
  parallax: 0.1,
  chapters: {
    hero: {
      url: "/assets/rocks/hero-rock.glb",
      position: [10.5, -0.08, -12],
      rotation: -0.45,
      width: 9,
      heightRatio: 0.5,
      mobile: { position: [3.8, 0.05, -12], width: 5.5, heightRatio: 0.8 },
    },
    work: {
      url: "/assets/rocks/selected-work-rock.glb",
      position: [-6.2, -0.22, -0.5],
      rotation: 0.52,
      width: 4.8,
      heightRatio: 1.15,
      mobile: { position: [-1.8, -0.24, -1.1], width: 2.6, heightRatio: 0.9 },
    },
    footer: {
      url: "/assets/rocks/footer-rock.glb",
      position: [10, -0.08, -10],
      rotation: -0.3,
      width: 8,
      heightRatio: 0.65,
      mobile: { position: [3.8, 0.05, -10], width: 5.5, heightRatio: 0.7 },
    },
  },
};

export const cameraConfig = {
  fov: 42,
  near: 0.1,
  far: 220,
  /** Eye height above the floor plane in world units. */
  height: 1.55,
  /** How far the camera sits from the origin. */
  distance: 8.5,
} as const;
