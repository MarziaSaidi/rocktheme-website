/**
 * The decode: characters flicker through symbols in lavender, land as their
 * real letter in moonlit, then ease to the label's own colour, in a wave from
 * left to right (docs/typography-motion-system.md, Signal).
 *
 * It works on `[data-final]` character spans and publishes each one's phase as
 * `data-state` ("hidden" | "scramble" | "accent"); a settled character carries
 * no state, so the label's own hover and focus colours keep working. Styles
 * live with whichever component owns the spans.
 */

export const DECODE_SYMBOLS = "[]{}!@#$%&*+-=<>?/~0123456789";

export type DecodeTiming = Readonly<{
  /** Between one character and the next. */
  stagger: number;
  /** Flickering symbols. */
  scramble: number;
  /** How often a scrambling character changes symbol. */
  flicker: number;
  /** The real letter, still in moonlit. */
  accent: number;
}>;

/** A label arriving: the approved entrance decode. */
export const ENTRANCE_DECODE: DecodeTiming = {
  stagger: 34,
  scramble: 190,
  flicker: 55,
  accent: 150,
};

/**
 * An important action answering hover or focus. However long the label, it is
 * readable again within this budget, so the response never hides the words.
 */
export const ACTION_DECODE_BUDGET = 320;
const ACTION_DECODE: DecodeTiming = { stagger: 22, scramble: 90, flicker: 45, accent: 90 };

/** The action decode fitted to a label of `count` characters. */
export function actionDecode(count: number): DecodeTiming {
  const room = ACTION_DECODE_BUDGET - ACTION_DECODE.scramble - ACTION_DECODE.accent;
  return {
    ...ACTION_DECODE,
    stagger: Math.min(ACTION_DECODE.stagger, room / Math.max(1, count - 1)),
  };
}

type Phase = "hidden" | "scramble" | "accent" | "done";

/** Puts every character in one phase at once (for example, hidden before an entrance). */
export function setDecodePhase(chars: readonly HTMLElement[], phase: Phase) {
  chars.forEach((char) => {
    char.textContent = char.dataset.final ?? "";
    if (phase === "done") delete char.dataset.state;
    else char.dataset.state = phase;
  });
}

/**
 * Plays one decode over `chars`. Returns a function that stops it and settles
 * the text. `fromVisible` is for a label that is already readable (a replay):
 * characters the wave has not reached yet stay as they are instead of vanishing.
 */
export function playDecode(
  chars: readonly HTMLElement[],
  timing: DecodeTiming,
  { fromVisible = false, onDone }: Readonly<{ fromVisible?: boolean; onDone?: () => void }> = {},
): () => void {
  const waiting: Phase = fromVisible ? "done" : "hidden";
  const states: Phase[] = chars.map(() => waiting);
  let frame = 0;
  let stopped = false;
  const start = performance.now();

  // Finished when the last character has passed its accent, whatever phase the others report.
  const total = (chars.length - 1) * timing.stagger + timing.scramble + timing.accent;

  const step = (now: number) => {
    if (stopped) return;
    const elapsed = now - start;
    const settled = elapsed >= total;
    chars.forEach((char, index) => {
      const t = elapsed - index * timing.stagger;
      const phase: Phase =
        t < 0
          ? waiting
          : t < timing.scramble
            ? "scramble"
            : t < timing.scramble + timing.accent
              ? "accent"
              : "done";
      if (phase === "scramble") {
        const slot = Math.floor(t / timing.flicker);
        const pick = Math.abs(Math.sin(index * 12.9898 + slot * 78.233) * 43758.5453) % 1;
        char.textContent = DECODE_SYMBOLS[Math.floor(pick * DECODE_SYMBOLS.length)] ?? "";
      } else if (states[index] === "scramble" || states[index] === "hidden") {
        char.textContent = char.dataset.final ?? "";
      }
      if (phase !== states[index]) {
        states[index] = phase;
        if (phase === "done") delete char.dataset.state;
        else char.dataset.state = phase;
      }
    });
    if (settled) {
      frame = 0;
      onDone?.();
    } else frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);

  return () => {
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    setDecodePhase(chars, "done");
  };
}
