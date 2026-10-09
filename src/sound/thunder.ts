/** Audio-only distance/character shaping. It never advances the weather clock. */
export const THUNDER_SAMPLES = [
  "distant-valley",
  "soft-roll",
  "deep-front",
  "mountain-echo",
  "low-canopy",
  "rolling-strike",
] as const;
export const THUNDER = {
  delay: [0, 2.5],
  gainDb: 3.5,
  musicDuck: { depthDb: 5, attack: 0.18, bodyFraction: 0.6, maxBody: 18, recover: 5 },
  /** Two sustained tails; initial impacts remain protected during brief overlaps. */
  maxConcurrent: 2,
  impactProtection: 3.2,
  fadeOut: 0.015,
  storm: { hero: 0.55, "selected-work": 0.45, about: 0.48, footer: 0.6 },
} as const;
const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
/** Infer one audio-only distance from the approved flash strength; never roll a separate delay.
 * Strong strikes: 7–37 m. Weaker strikes: 274–858 m. */
export function thunderDistance(intensity: number) {
  const strength = clamp(intensity);
  const metres =
    strength >= 0.88
      ? 7 + ((1 - strength) / 0.12) * 30
      : 274 + clamp((0.88 - strength) / 0.23) * 584;
  return metres / 858;
}
/** A shuffled character pool prevents repeats and avoids a fixed audible cycle. */
export function createThunderSelector(random: () => number = Math.random) {
  const bags = new Map<string, number[]>();
  let last = -1;
  return (
    distance: number,
    intensity: number,
    storm = 0.55,
    available: readonly number[] = [0, 1, 2, 3, 4, 5],
  ) => {
    const preferred = clamp(distance) <= 0.06 ? [2, 3, 5] : [0, 1, 4];
    const matching = available.filter((index) => preferred.includes(index));
    const candidates = matching.length ? matching : [...available];
    if (!candidates.length) return null;
    const key = [...candidates].sort().join(",");
    let bag = bags.get(key);
    if (!bag?.length) {
      bag = [...candidates];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j]!, bag[i]!];
      }
      if (bag.length > 1 && bag.at(-1) === last)
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!];
      bags.set(key, bag);
    }
    let index = bag.pop()!;
    if (index === last && candidates.length > 1) {
      const alternate = candidates.find((value) => value !== last)!;
      // Preserve the displaced choice for a later strike while avoiding a repeat after a pool change.
      const at = bag.indexOf(alternate);
      if (at >= 0) bag.splice(at, 1);
      bag.unshift(index);
      index = alternate;
    }
    last = index;
    const far = clamp(distance),
      strength = clamp(intensity);
    return {
      index,
      delay: THUNDER.delay[0] + far * (THUNDER.delay[1] - THUNDER.delay[0]),
      distanceMetres: far * 2.5 * 343,
      gain:
        (0.76 - far * 0.34) *
        (0.6 + strength * 0.4) *
        (0.7 + clamp(storm) * 0.3) *
        10 ** (THUNDER.gainDb / 20),
      lowpass: 12000 - far * 7000,
      rate: 1,
    };
  };
}
