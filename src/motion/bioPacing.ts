/**
 * How much scroll each beat of the bio gets.
 *
 * The story's progress (0 to 1) is not spread evenly over its height: every
 * beat gets a planned length, in screens, so nothing drags. Passage one reads
 * in a screen, each of the three render passes gets about a screen, the
 * stillness half a screen, and the name the rest.
 *
 * BioStory turns its passages on this progress and RenderPasses places its
 * stops on it, so the two can never drift apart.
 */

/** Screens of scroll into the pinned story… */
const SCREENS = [0, 1.0, 2.0, 3.0, 4.0, 4.5, 5.5] as const;
/** …and the story progress reached at each. */
const PROGRESS = [0, 0.32, 0.455, 0.555, 0.655, 0.67, 1] as const;

/** The story's height in viewport heights: its scroll plus the pinned screen. */
export const STORY_SCREENS = SCREENS[SCREENS.length - 1]! + 1;

function bend(x: number, from: readonly number[], to: readonly number[]) {
  const last = from.length - 1;
  let i = 1;
  while (i < last && x > from[i]!) i++;
  const a = from[i - 1]!,
    b = from[i]!;
  return to[i - 1]! + ((x - a) / (b - a)) * (to[i]! - to[i - 1]!);
}

/** Where the visitor is in the story, 0 to 1 while it is pinned (beyond either end outside it). */
export function storyProgress(story: HTMLElement) {
  return bend(-story.getBoundingClientRect().top / window.innerHeight, SCREENS, PROGRESS);
}

/** The page offset at which the story reads a given progress. */
export function scrollForProgress(story: HTMLElement, progress: number) {
  const top = story.getBoundingClientRect().top + window.scrollY;
  return top + bend(progress, PROGRESS, SCREENS) * window.innerHeight;
}
