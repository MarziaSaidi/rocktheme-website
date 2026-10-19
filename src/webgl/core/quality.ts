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
/** Desktop p99 limit: react before several missed frames accumulate. */
const P99_BUDGET_MS = 25;
/** Active delivery window before evaluating its tail latency. */
const PATIENCE_MS = 1200;
/** Frames in the first stretch after start compile programs; they don't count. */
const WARMUP_MS = 3000;

export function pickInitialTier(capability: SceneCapability, viewportArea: number): QualityTier {
  // Safari and Firefox don't expose device memory, so a missing value is not
  // evidence of a small device.
  const coarse = capability.cores <= 4 || (capability.memory > 0 && capability.memory <= 4);
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
  let windowMs = 0;
  let frames: number[] = [];
  let total = 0;
  let count = 0;
  let warmupMs = 0;
  const stepDown = () => {
    windowMs = 0;
    frames = [];
    const next = ORDER[ORDER.indexOf(settings.tier) + 1];
    if (!next) return null;
    settings = TIERS[next];
    total = 0;
    count = 0;
    return settings;
  };

  return {
    current: () => settings,
    averageFrameMs: () => (count === 0 ? 0 : total / count),
    sample: (frameMs) => {
      if (!Number.isFinite(frameMs) || frameMs <= 0) return null;
      // Ignore absurd deltas from tab switches or breakpoints in the debugger.
      if (frameMs > 500) {
        windowMs = 0;
        frames = [];
        return null;
      }

      // Count delivered frame time, not wall time spent hidden or suspended.
      if (warmupMs < WARMUP_MS) {
        warmupMs += frameMs;
        return null;
      }

      total += frameMs;
      count += 1;

      if (frameMs > P99_BUDGET_MS) return stepDown();

      windowMs += frameMs;
      frames.push(frameMs);
      if (windowMs < PATIENCE_MS) return null;
      frames.sort((a, b) => a - b);
      const p95 = frames[Math.ceil(frames.length * 0.95) - 1]!;
      const p99 = frames[Math.ceil(frames.length * 0.99) - 1]!;
      windowMs = 0;
      frames = [];
      // Occasional dropped frames can fail the tail budget while the average
      // stays healthy. Good frames must not erase that evidence.
      if (p95 <= BUDGET_MS && p99 <= P99_BUDGET_MS) return null;
      return stepDown();
    },
  };
}
