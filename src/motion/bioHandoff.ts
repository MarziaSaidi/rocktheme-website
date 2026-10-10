/** The bio releases its own glyph dust into the world; gravity belongs to the scene. */
import { queueBioRain, sceneDrawsBioDust } from "@/webgl/bioDustChannel";

export type TitleSignature = "snap" | "print";
export type HandoffWord = Readonly<{ element: HTMLElement; signature?: TitleSignature }>;
type FlightOptions = Readonly<{ start: number; direction: 1 | -1; onDone?: () => void }>;
export type BioHandoff = Readonly<{
  form: (owner: object, words: readonly HandoffWord[], options: FlightOptions) => boolean;
  crumble: (owner: object, words: readonly HandoffWord[], options: FlightOptions) => boolean;
  cancel: (owner: object) => void;
  setScrollSpeed: (pixelsPerSecond: number) => void;
  tick: (now: number) => void;
  destroy: () => void;
}>;

type Release = {
  owner: object;
  words: readonly HandoffWord[];
  starts: number[];
  grains: Float32Array;
  next: number;
  ends: number;
  onDone?: () => void;
};
export function createBioHandoff(): BioHandoff {
  const scratch = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  let releases: Release[] = [];
  /** Every lit pixel of each word in its settled place, sampled down to the budget. */
  function sample(words: readonly HandoffWord[]) {
    const measured = words.map(({ element, signature }) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const pad = 6;
      const w = Math.ceil(box.width + pad * 2);
      const h = Math.ceil(box.height + pad * 2);
      scratch.canvas.width = w;
      scratch.canvas.height = h;
      scratch.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if ("letterSpacing" in scratch) scratch.letterSpacing = style.letterSpacing;
      scratch.fillStyle = "#fff";
      const text = element.textContent ?? "";
      const metrics = scratch.measureText(text);
      const content = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      const lineBox = parseFloat(style.lineHeight) || box.height;
      scratch.fillText(text, pad, pad + (lineBox - content) / 2 + metrics.fontBoundingBoxAscent);
      const data = scratch.getImageData(0, 0, w, h).data;
      const points: number[] = [];
      let top = h;
      let bottom = 0;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if (data[(y * w + x) * 4 + 3]! > 130) {
            points.push(box.left - pad + x, box.top - pad + y);
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }
      return {
        element,
        signature,
        box,
        points,
        top: box.top - pad + top,
        span: Math.max(1, bottom - top),
      };
    });
    const lit = measured.reduce((sum, word) => sum + word.points.length / 2, 0);
    const budget = window.innerWidth < 700 ? 850 : 1700;
    return { measured, keep: Math.min(1, budget / Math.max(1, lit)) };
  }

  const cancel = (owner: object) => {
    releases = releases.filter((release) => release.owner !== owner);
  };
  return {
    // Keep the existing HTML in-place entrance. No particles travel from the portal to words.
    form: () => false,
    crumble: (owner, words, options) => {
      if (!sceneDrawsBioDust()) return false;
      cancel(owner);
      const { measured, keep } = sample(words);
      const grains: number[] = [];
      const starts = measured.map((_, i) => options.start + i * 0.045);
      measured.forEach((word, index) => {
        word.element.dataset.dust = "out";
        for (let k = 0; k < word.points.length; k += 2) {
          if (Math.random() > keep) continue;
          const x = word.points[k]!,
            y = word.points[k + 1]!;
          const row = 1 - (y - word.top) / word.span;
          grains.push(starts[index]! + row * 0.55 + Math.random() * 0.045, x, y, Math.random());
        }
      });
      // Sort once at transition time, not while falling. Each glyph sample is released once.
      const order = Array.from({ length: grains.length / 4 }, (_, i) => i);
      order.sort((a, b) => grains[a * 4]! - grains[b * 4]!);
      const sorted = new Float32Array(grains.length);
      order.forEach((slot, i) => sorted.set(grains.slice(slot * 4, slot * 4 + 4), i * 4));
      releases.push({
        owner,
        words,
        starts,
        grains: sorted,
        next: 0,
        ends: options.start + Math.max(0, words.length - 1) * 0.045 + 0.62,
        onDone: options.onDone,
      });
      return true;
    },
    cancel,
    setScrollSpeed: () => {},
    tick: (now) => {
      for (let i = releases.length - 1; i >= 0; i--) {
        const release = releases[i]!;
        while (release.next < release.grains.length && release.grains[release.next]! <= now) {
          const j = release.next;
          queueBioRain(release.grains[j + 1]!, release.grains[j + 2]!, release.grains[j + 3]!);
          release.next += 4;
        }
        release.words.forEach(({ element }, word) => {
          const visible = 1 - Math.min(1, Math.max(0, (now - release.starts[word]!) / 0.55));
          element.style.setProperty("--dust", visible.toFixed(3));
        });
        if (now >= release.ends) {
          release.onDone?.();
          releases.splice(i, 1);
        }
      }
    },
    destroy: () => {
      releases = [];
    },
  };
}
