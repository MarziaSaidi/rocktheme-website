import type { SceneCapability } from "./capability";
import { particleConfig } from "../sceneConfig";

/**
 * Quality manager.
 *
 * Picks a starting tier from device hints and viewport area, then watches the
 * measured frame cost and steps down when the scene cannot hold its budget.
 * It only ever steps down: stepping back up invites oscillation, and a stable
 * lower tier looks better than a scene that keeps changing its mind.
 */
export type QualityTier = "low" | "medium" | "high";

export type QualitySettings = Readonly<{
  tier: QualityTier;
  /**
   * Particles per megapixel of viewport. Density rather than a flat count, so
   * a phone does not receive a desktop's worth of particles in a quarter of
   * the area and turn into a wall of green.
   */
  particlesPerMegapixel: number;
  /** Absolute ceiling, so a very large display cannot run away with it. */
  maxParticles: number;
  /** Hard cap on device pixel ratio. */
  pixelRatioCap: number;
  /** Planar reflection resolution, or 0 to disable the reflection pass. */
  reflectionSize: number;
  maxRipples: number;
}>;

const TIERS: Readonly<Record<QualityTier, QualitySettings>> = {
  high: {
    tier: "high",
    particlesPerMegapixel: particleConfig.density.high.perMegapixel,
    maxParticles: particleConfig.density.high.max,
    pixelRatioCap: 2,
    reflectionSize: 512,
    maxRipples: 4,
  },
  medium: {
    tier: "medium",
    particlesPerMegapixel: particleConfig.density.medium.perMegapixel,
    maxParticles: particleConfig.density.medium.max,
    pixelRatioCap: 1.5,
    reflectionSize: 256,
    maxRipples: 3,
  },
  low: {
    tier: "low",
    particlesPerMegapixel: particleConfig.density.low.perMegapixel,
    maxParticles: particleConfig.density.low.max,
    pixelRatioCap: 1,
    reflectionSize: 0,
    maxRipples: 2,
  },
};

const ORDER: readonly QualityTier[] = ["high", "medium", "low"];

/** Frame cost above which the scene is considered to be struggling. */
const BUDGET_MS = 20;
/** Consecutive seconds over budget before a downgrade. */
const PATIENCE_MS = 1200;

export function pickInitialTier(capability: SceneCapability, viewportArea: number): QualityTier {
  const coarse = capability.cores <= 4 || capability.memory <= 4;
  const large = viewportArea > 2_200_000;

  if (!capability.webgl2 || capability.maxTextureSize < 4096 || (coarse && large)) {
    return "low";
  }

  if (coarse || large || capability.devicePixelRatio > 2.5) {
    return "medium";
  }

  return "high";
}

export function settingsFor(tier: QualityTier): QualitySettings {
  return TIERS[tier];
}

/** Particle count for a viewport, from the tier's density and ceiling. */
export function particleCountFor(settings: QualitySettings, viewportArea: number): number {
  const megapixels = viewportArea / 1_000_000;
  const mobileFactor = viewportArea < 550_000 ? particleConfig.density.mobileFactor : 1;
  return Math.max(
    120,
    Math.min(
      settings.maxParticles,
      Math.round(settings.particlesPerMegapixel * megapixels * mobileFactor),
    ),
  );
}

export type QualityManager = Readonly<{
  current: () => QualitySettings;
  /** Feed one frame's cost in milliseconds. Returns the new tier if it changed. */
  sample: (frameMs: number) => QualitySettings | null;
  /** Average frame cost over the sampling window, for reporting. */
  averageFrameMs: () => number;
}>;

export function createQualityManager(initial: QualityTier): QualityManager {
  let settings = TIERS[initial];
  let overBudgetMs = 0;
  let total = 0;
  let count = 0;

  return {
    current: () => settings,
    averageFrameMs: () => (count === 0 ? 0 : total / count),
    sample: (frameMs) => {
      // Ignore absurd deltas from tab switches or breakpoints in the debugger.
      if (frameMs > 500) {
        overBudgetMs = 0;
        return null;
      }

      total += frameMs;
      count += 1;

      if (frameMs > BUDGET_MS) {
        overBudgetMs += frameMs;
      } else {
        overBudgetMs = Math.max(0, overBudgetMs - frameMs);
      }

      if (overBudgetMs < PATIENCE_MS) {
        return null;
      }

      const index = ORDER.indexOf(settings.tier);
      const next = ORDER[index + 1];
      overBudgetMs = 0;

      if (!next) {
        return null;
      }

      settings = TIERS[next];
      total = 0;
      count = 0;
      return settings;
    },
  };
}
