/** Eight thunder voices share the same shuffled, non-repeating group. */
export const THUNDER_SAMPLES = [
  "thunder-01",
  "thunder-02",
  "thunder-03",
  "thunder-04",
  "thunder-05",
  "thunder-06",
  "thunder-07",
  "thunder-08",
] as const;
export const THUNDER_DISABLED_SAMPLES: readonly string[] = [];
export const THUNDER = {
  delay: [0, 0],
  gainDb: 0,
  musicDuck: { depthDb: 0, attack: 0.18, bodyFraction: 0.6, maxBody: 18, recover: 5 },
  maxConcurrent: 2,
  impactProtection: 0,
  fadeOut: 0.5,
  overflowFadeOut: 0.06,
  storm: {
    hero: 0.5170921887051887,
    "selected-work": 0.5170921887051887,
    about: 0.5170921887051887,
    footer: 0.5170921887051887,
  },
} as const;
export function thunderDistance(intensity: number) {
  void intensity; // Thunder starts with the cloud event, without a distance delay.
  return 0;
}
export function createThunderSelector(random: () => number = Math.random) {
  let bag: number[] = [],
    last = -1,
    key = "";
  return (
    _distance: number,
    intensity: number,
    storm = 0.55,
    available: readonly number[] = THUNDER_SAMPLES.map((_, i) => i),
  ) => {
    void storm; // The same sound group plays across sections.
    if (!available.length) return null;
    const nextKey = [...available].sort().join(",");
    if (!bag.length || nextKey !== key) {
      key = nextKey;
      bag = [...available];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j]!, bag[i]!];
      }
      if (bag.length > 1 && bag.at(-1) === last) {
        const alternate = Math.floor(random() * (bag.length - 1));
        [bag[alternate], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[alternate]!];
      }
    }
    const index = bag.pop()!;
    last = index;
    const strength = Math.max(0, Math.min(1, (intensity - 0.6) / (1.2 - 0.6)));
    return {
      index,
      delay: 0,
      distanceMetres: 0,
      gain: 0.75 + 0.25 * strength,
      lowpass: 20000,
      highpass: 10,
      rate: 0.9 + 0.1 * strength,
    };
  };
}
