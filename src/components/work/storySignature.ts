/**
 * Case-study story titles, by project (docs/typography-motion-system.md, §5).
 *
 * - **Ink** (Quill & Pigeon): each title line is written in left to right by
 *   a feathered wipe, about 520 ms a line, the next starting 90 ms before the
 *   last ends. The glyphs never move. A story's emphasis (the phrase that
 *   names the correction) is ruled under in botanical once the title lands.
 * - **Approach** (Survue): the title arrives light and loose and closes in to
 *   its resting weight and tracking over 640 ms; nothing moves sideways. A
 *   story's emphasis (the word the urgency lives in) steps through three
 *   weights, one per risk level, and rests on the middle one.
 *
 * Everything is measured here once per story, before its first paint (the
 * workspace calls this from a layout effect, after it numbers the lines).
 * A title below the fold, as on a phone, waits unseen and starts when it
 * comes on screen. The stylesheet does the motion; reduced motion shows the
 * settled title at once. Without JavaScript nothing is marked and the title
 * simply stands.
 */

export type TitleSignature = "ink" | "approach";

const INK = { lineMs: 520, overlapMs: 90, minWordMs: 90, ruleAfterMs: 120, ruleStaggerMs: 140 };
/** The emphasis word's resting weight in an approach title (CaseStudyWorkspace.module.css). */
const APPROACH_EMPHASIS_WEIGHT = "620";

/** The words of `text`, as the workspace splits them. */
const split = (text: string) => text.split(/\s+/).filter(Boolean);

export function prepareStoryTitle(
  story: HTMLElement,
  signature: TitleSignature | undefined,
  emphasis: string | undefined,
): () => void {
  const title = story.querySelector("h2");
  const words = title ? [...title.querySelectorAll<HTMLElement>("[data-word]")] : [];
  if (!title || !signature || words.length === 0) return () => {};
  story.dataset.signature = signature;

  // The emphasis, as a run of whole words in the title.
  const phrase = emphasis ? split(emphasis) : [];
  const start = phrase.length
    ? words.findIndex((_, index) =>
        phrase.every((part, offset) => words[index + offset]?.textContent === part),
      )
    : -1;
  const marked = start >= 0 ? words.slice(start, start + phrase.length) : [];
  marked.forEach((word) => (word.dataset.emphasis = ""));

  // Reduced motion: the settled title at once, emphasis included; nothing to measure.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    story.dataset.ready = "";
    story.dataset.settled = "";
    return () => {};
  }

  const cleanups: (() => void)[] = [];

  if (signature === "ink") {
    // Each line's extent, from one read of every word's box.
    const boxes = words.map((word) => word.getBoundingClientRect());
    const lineOf = words.map((word) => Number(word.style.getPropertyValue("--line") || 0));
    const lines = new Map<number, { left: number; right: number }>();
    boxes.forEach((box, index) => {
      const extent = lines.get(lineOf[index]!) ?? { left: Infinity, right: -Infinity };
      extent.left = Math.min(extent.left, box.left);
      extent.right = Math.max(extent.right, box.right);
      lines.set(lineOf[index]!, extent);
    });
    const first = Math.min(...lines.keys());
    words.forEach((word, index) => {
      const extent = lines.get(lineOf[index]!)!;
      const width = extent.right - extent.left || 1;
      const lineAt = (lineOf[index]! - first) * (INK.lineMs - INK.overlapMs);
      const box = boxes[index]!;
      word.style.setProperty(
        "--ink-at",
        `${Math.round(lineAt + ((box.left - extent.left) / width) * INK.lineMs)}ms`,
      );
      // A little longer than the pen takes to cross it, so the feather overlaps.
      word.style.setProperty(
        "--ink-dur",
        `${Math.round(Math.max(INK.minWordMs, (box.width / width) * INK.lineMs * 1.6))}ms`,
      );
    });
    const landed = (lines.size - 1) * (INK.lineMs - INK.overlapMs) + INK.lineMs + INK.ruleAfterMs;
    marked.forEach((word, offset) =>
      word.style.setProperty("--rule-at", `${landed + offset * INK.ruleStaggerMs}ms`),
    );
  }

  if (signature === "approach") {
    // Every word keeps its resting width while it closes in, so no line
    // reflows; the emphasis is measured at its heavier resting weight.
    marked.forEach((word) => (word.style.fontWeight = APPROACH_EMPHASIS_WEIGHT));
    const widths = words.map((word) => word.getBoundingClientRect().width);
    marked.forEach((word) => word.style.removeProperty("font-weight"));
    words.forEach((word, index) =>
      word.style.setProperty("--word-w", `${widths[index]!.toFixed(2)}px`),
    );
    // Settled, the words go back to plain layout: the shipped title exactly.
    const last = words.at(-1)!;
    const settle = (event: AnimationEvent) => {
      if (event.target !== last || !event.animationName.includes("approach")) return;
      story.dataset.settled = "";
      words.forEach((word) => word.style.removeProperty("--word-w"));
    };
    last.addEventListener("animationend", settle);
    cleanups.push(() => last.removeEventListener("animationend", settle));
  }

  // Start now if the title is on screen, otherwise when it comes into view.
  const box = title.getBoundingClientRect();
  if (box.top < window.innerHeight && box.bottom > 0) {
    story.dataset.ready = "";
  } else {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        story.dataset.ready = "";
      },
      { threshold: 0.6 },
    );
    observer.observe(title);
    cleanups.push(() => observer.disconnect());
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}

/**
 * The least time an autoplaying story stays up (docs/typography-motion-system.md,
 * §11): its words at 230 a minute, plus 1.5 s to look at the visual, and never
 * under 6 s.
 */
export function readingSeconds(texts: readonly (string | undefined)[]): number {
  const count = texts.reduce((sum, text) => sum + (text ? split(text).length : 0), 0);
  return Math.max(6, (count / 230) * 60 + 1.5);
}
