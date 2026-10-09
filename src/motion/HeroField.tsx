"use client";

import { useEffect } from "react";

import { createPointerSource } from "./pointerSource";
import styles from "./HeroField.module.css";

/**
 * The hero's mass field (docs/typography-motion-system.md, §5, Hero).
 *
 * Letters near the pointer gain weight and width, the line opens around them
 * so nothing collides, and moonlight gathers where the pointer rests. The
 * approved strength is the 3 px cap: +20 weight and +1.5 width at the centre,
 * which moves no letter more than 2.9 px.
 *
 * It answers only a mouse, only after the headline's ripple has finished, and
 * only while the camera stands at the hero (`--arrival` 0). As the camera starts
 * to move it lets go on fast springs, done before the frozen exit drops the
 * lines into their masks at 0.03. At rest the headline is the server markup:
 * the letters are split into spans only while the field is active, and the
 * original nodes are put back as soon as every spring has settled.
 *
 * Performance guard: weight and width cost layout, so they run only where the
 * scene runs at its high tier, and switch off for the rest of the visit if
 * frames start to slip. The test is the scene's own (src/webgl/core/quality.ts):
 * a frame over the 20 ms budget charges a bucket (at most 50 ms, so one long
 * frame can't trip it), a frame within budget drains it. The scene waits for
 * 1.2 s of net overload before giving up a tier; this optional effect gives up
 * after GUARD.patienceMs, about six slow frames in a row, and leaves the
 * scene's budget alone. Because fast frames drain the bucket, stutter (slow
 * frames between quick ones) never fills it, so the field also gives up after
 * 4 frames over 25 ms within 60; at normal and 2× CPU no frame comes near that. Measured, the moonlight alone still cost a struggling
 * device frames (repainting a clipped gradient over very large type), so the
 * whole field releases on its springs and rests for the visit.
 */

/** The approved 3 px cap. */
const LIFT = { wght: 20, wdth: 1.5 };
/** The headline's rest axes (Hero.module.css). */
const REST = { wght: 860, wdth: 62 };
/** Field shape in ems: horizontal and vertical reach, and the margin around the block. */
const FIELD = { sx: 0.58, sy: 0.42, pad: 0.45 };
/** Spring rates: in, out with the pointer, out with the camera. */
const RATE = { in: 11, out: 5, release: 22 };
/** Steps per letter between rest and full, so a slow drift doesn't re-lay out every frame. */
const LEVELS = 40;
/** Moonlight at full presence. */
const LIGHT = 0.62;
const AT_REST = 0.0005;
/**
 * Settled: a letter within half a step of its target (no visible weight left
 * to change) and the light under half a percent. Waiting for the springs'
 * invisible tail would keep the letters split for seconds.
 */
const SETTLED = { letter: 0.5 / LEVELS, light: 0.005 };
const GUARD = {
  budgetMs: 20,
  maxChargeMs: 50,
  patienceMs: 160,
  /** Stutter: this many frames over `stutterMs` within the last `windowFrames`. */
  stutterMs: 25,
  stutterFrames: 4,
  windowFrames: 60,
};

type Letter = {
  el: HTMLSpanElement;
  s: number;
  v: number;
  q: number;
  cx: number;
  cy: number;
  grow: number;
};

type Line = {
  inner: HTMLElement;
  mask: HTMLElement;
  saved: ChildNode[];
  row: HTMLSpanElement;
  fill: string;
  fillSize: string;
  letters: Letter[];
  left: number;
  top: number;
  offset: number;
  lit: boolean;
  dirty: boolean;
};

const spring = (s: number, v: number, target: number, omega: number, dt: number) => {
  const a = omega * omega * (target - s) - 2 * omega * v;
  const next = v + a * dt;
  return [s + next * dt, next] as const;
};

/** Each character's left edge in a text node, relative to `box`. */
function lefts(node: Text, box: HTMLElement) {
  const base = box.getBoundingClientRect().left;
  const range = document.createRange();
  const out: number[] = [];
  for (let i = 0; i < node.length; i += 1) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    out.push(range.getBoundingClientRect().left - base);
  }
  return out;
}

export function HeroField({ targetId }: Readonly<{ targetId: string }>) {
  useEffect(() => {
    const heading = document.getElementById(targetId);
    const capable = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    if (!heading || !capable.matches) return;
    const root = document.documentElement;

    let lines: Line[] = [];
    let split = false;
    let em = 0;
    let field: { l: number; r: number; t: number; b: number } | null = null;
    let px = -1e4;
    let py = -1e4;
    let lx = 0;
    let ly = 0;
    let inside = false;
    let presence = 0;
    let presenceV = 0;
    let frame = 0;
    let last = 0;
    let guardTripped = false;
    let overBudgetMs = 0;
    const stutters: number[] = [];

    const arrival = () => parseFloat(root.style.getPropertyValue("--arrival")) || 0;
    const ready = () => heading.dataset.ripple === "done";
    const axesAllowed = () => !guardTripped && root.dataset.sceneTier === "high";

    const fieldRect = () => {
      if (!field) {
        const box = heading.getBoundingClientRect();
        const pad = FIELD.pad * parseFloat(getComputedStyle(heading).fontSize);
        field = { l: box.left - pad, r: box.right + pad, t: box.top - pad, b: box.bottom + pad };
      }
      return field;
    };

    const doSplit = () => {
      if (split) return;
      em = parseFloat(getComputedStyle(heading).fontSize);
      // Room inside each line's mask for letters that grow, whole pixels.
      const room = Math.ceil(em * 0.2);
      const found = [...heading.querySelectorAll<HTMLElement>("[data-line-inner]")];
      lines = [];
      for (const inner of found) {
        const text = inner.firstChild;
        const mask = inner.parentElement;
        if (!(text instanceof Text) || !mask) continue;
        // Kerning is measured, then replaced by margins, so no letter jumps when split.
        const kerned = lefts(text, inner);
        const style = getComputedStyle(inner);
        inner.style.fontKerning = "none";
        const plain = lefts(text, inner);
        const row = document.createElement("span");
        row.className = styles.row!;
        // The fill moves to the row, so the row can slide as one piece under it.
        row.style.backgroundImage = style.backgroundImage;
        row.style.backgroundSize = style.backgroundSize;
        row.style.backgroundRepeat = style.backgroundRepeat;
        row.style.paddingInlineEnd = style.paddingInlineEnd;
        const letters = [...text.data].map((char, index) => {
          const el = document.createElement("span");
          el.className = styles.letter!;
          el.textContent = char;
          if (index > 0) {
            const delta = kerned[index]! - kerned[index - 1]! - (plain[index]! - plain[index - 1]!);
            if (Math.abs(delta) > 0.01) el.style.marginLeft = `${(delta / em).toFixed(4)}em`;
          }
          row.append(el);
          return { el, s: 0, v: 0, q: 0, cx: 0, cy: 0, grow: 0 };
        });
        lines.push({
          inner,
          mask,
          saved: [...inner.childNodes],
          row,
          fill: style.backgroundImage,
          fillSize: style.backgroundSize,
          letters,
          left: 0,
          top: 0,
          offset: 0,
          lit: false,
          dirty: false,
        });
        inner.style.backgroundImage = "none";
        inner.style.paddingInlineEnd = "0";
        // The mask clips sideways by clip-path instead of overflow, so the
        // room costs no layout (a padding and negative margin moved its box,
        // which counts as a layout shift). Vertically it clips exactly as before.
        mask.style.overflow = "visible";
        mask.style.clipPath = `inset(0 -${room}px)`;
        mask.style.maxWidth = "none";
        inner.replaceChildren(row);
      }
      // Every measurement happens here, once: never per frame.
      for (const line of lines) {
        const box = line.row.getBoundingClientRect();
        line.left = box.left;
        line.top = box.top;
        for (const letter of line.letters) {
          const r = letter.el.getBoundingClientRect();
          letter.cx = r.left + r.width / 2;
          letter.cy = r.top + r.height / 2;
          letter.grow = r.width;
        }
      }
      // Each letter's extra advance at full lift, from one forced layout.
      const all = lines.flatMap((line) => line.letters);
      all.forEach(({ el }) => {
        el.style.setProperty("--w", String(REST.wght + LIFT.wght));
        el.style.setProperty("--d", String(REST.wdth + LIFT.wdth));
      });
      all.forEach((letter) => {
        letter.grow = letter.el.getBoundingClientRect().width - letter.grow;
      });
      all.forEach(({ el }) => {
        el.style.removeProperty("--w");
        el.style.removeProperty("--d");
      });
      split = lines.length > 0;
    };

    // Back to the server markup, exactly: the original nodes, not a copy.
    const unsplit = () => {
      if (!split) return;
      for (const line of lines) {
        line.inner.replaceChildren(...line.saved);
        line.inner.style.removeProperty("font-kerning");
        line.inner.style.removeProperty("background-image");
        line.inner.style.removeProperty("padding-inline-end");
        line.mask.style.removeProperty("overflow");
        line.mask.style.removeProperty("clip-path");
        line.mask.style.removeProperty("max-width");
        for (const element of [line.inner, line.mask]) {
          if (!element.getAttribute("style")) element.removeAttribute("style");
        }
      }
      lines = [];
      split = false;
    };

    const tripGuard = () => {
      guardTripped = true;
      // Readable in the inspector and by the checks: the field is light only now.
      heading.dataset.fieldGuard = "tripped";
      // Nothing holds the loop open any more: it releases, unsplits and parks.
      inside = false;
      for (const line of lines) {
        line.letters.forEach((letter) => {
          letter.q = 0;
          letter.el.style.removeProperty("--w");
          letter.el.style.removeProperty("--d");
        });
        line.offset = 0;
        line.row.style.removeProperty("translate");
      }
    };

    const setStone = (on: boolean) => root.toggleAttribute("data-cursor-stone", on);

    const tick = (now: number) => {
      const elapsed = last ? now - last : 1000 / 60;
      last = now;
      // Every frame the field runs counts, at any tier; the loop's first frame
      // after waking has no previous frame to measure from.
      if (!guardTripped && elapsed < 500) {
        overBudgetMs =
          elapsed > GUARD.budgetMs
            ? overBudgetMs + Math.min(elapsed, GUARD.maxChargeMs)
            : Math.max(0, overBudgetMs - elapsed);
        stutters.push(elapsed > GUARD.stutterMs ? 1 : 0);
        if (stutters.length > GUARD.windowFrames) stutters.shift();
        const stuttering = stutters.reduce((sum, slow) => sum + slow, 0) >= GUARD.stutterFrames;
        if (overBudgetMs >= GUARD.patienceMs || stuttering) tripGuard();
      }
      const dt = Math.min(elapsed / 1000, 1 / 30);
      const atRest = arrival() < AT_REST;
      if (!atRest) inside = false;
      // Once the guard trips, the field lets go on its springs and stays at rest.
      const on = ready() && atRest && inside && !guardTripped;
      setStone(on);
      const sx = FIELD.sx * em;
      const sy = FIELD.sy * em;
      const axes = axesAllowed();
      let moving = false;

      for (const line of lines) {
        for (const letter of line.letters) {
          let target = 0;
          if (on) {
            const dx = px - letter.cx;
            const dy = py - letter.cy;
            target = Math.exp(-((dx * dx) / (2 * sx * sx) + (dy * dy) / (2 * sy * sy)));
          }
          const rate = target > letter.s ? RATE.in : atRest ? RATE.out : RATE.release;
          [letter.s, letter.v] = spring(letter.s, letter.v, target, rate, dt);
          if (letter.s < 0) {
            letter.s = 0;
            letter.v = 0;
          }
          if (Math.abs(target - letter.s) > SETTLED.letter || Math.abs(letter.v) > 0.01)
            moving = true;
          // Leaving with the camera rounds down, so the last step is gone before the exit.
          const step = atRest ? Math.round(letter.s * LEVELS) : Math.floor(letter.s * LEVELS);
          const q = axes ? step / LEVELS : 0;
          if (q !== letter.q) {
            letter.q = q;
            line.dirty = true;
            if (q === 0) {
              letter.el.style.removeProperty("--w");
              letter.el.style.removeProperty("--d");
            } else {
              letter.el.style.setProperty("--w", (REST.wght + q * LIFT.wght).toFixed(2));
              letter.el.style.setProperty("--d", (REST.wdth + q * LIFT.wdth).toFixed(3));
            }
          }
        }
      }

      const want = on ? 1 : 0;
      // The light leaves with the camera as quickly as the letters do.
      const lightRate = want > presence ? 7 : atRest ? 4 : RATE.release;
      [presence, presenceV] = spring(presence, presenceV, want, lightRate, dt);
      if (Math.abs(want - presence) > SETTLED.light || Math.abs(presenceV) > 0.01) moving = true;
      const follow = 1 - Math.exp(-9 * dt);
      lx += (px - lx) * follow;
      ly += (py - ly) * follow;

      for (const line of lines) {
        if (line.dirty) {
          line.dirty = false;
          // The line opens around the letters carrying the most weight, from
          // the calibrated growth: arithmetic only, so no layout is read here.
          let before = 0;
          let sum = 0;
          let acc = 0;
          for (const letter of line.letters) {
            const grow = letter.q * letter.grow;
            const shift = before + grow / 2;
            before += grow;
            sum += letter.s;
            acc -= letter.s * shift;
          }
          line.offset = sum > 0.001 ? acc / sum : 0;
          if (Math.abs(line.offset) < 0.02) line.row.style.removeProperty("translate");
          else line.row.style.translate = `${line.offset.toFixed(2)}px 0`;
        }
        const alpha = presence * LIGHT;
        if (alpha > 0.001 || line.lit) {
          line.lit = alpha > 0.001;
          const x = (lx - line.left - line.offset).toFixed(1);
          const y = (ly - line.top).toFixed(1);
          const core = Math.round(alpha * 100);
          const edge = Math.round(alpha * 45);
          line.row.style.backgroundImage = line.lit
            ? `radial-gradient(1.25em 1.05em at ${x}px ${y}px, color-mix(in srgb, var(--color-text-moonlit) ${core}%, transparent) 0%, color-mix(in srgb, var(--color-text-moonlit) ${edge}%, transparent) 45%, transparent 100%), ${line.fill}`
            : line.fill;
          line.row.style.backgroundSize = line.lit ? `100% 100%, ${line.fillSize}` : line.fillSize;
        }
      }

      if (moving || inside) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        last = 0;
        setStone(false);
        unsplit();
      }
    };

    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const pointer = createPointerSource();
    const unsubscribe = pointer.subscribe((sample) => {
      if (!ready() || guardTripped) return;
      if (arrival() >= AT_REST || !sample.inside) {
        field = null;
        if (inside) {
          inside = false;
          wake();
        }
        return;
      }
      px = sample.x;
      py = sample.y;
      const box = fieldRect();
      const near = px > box.l && px < box.r && py > box.t && py < box.b;
      if (!near && !inside) return;
      if (!split) doSplit();
      const was = inside;
      inside = near;
      if (inside && !was && presence < 0.02) {
        lx = px;
        ly = py;
      }
      wake();
    });
    // The camera starting to move is a release, not a cut: the springs let go.
    const onScroll = () => {
      field = null;
      if (split) wake();
    };
    const onResize = () => {
      field = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      inside = false;
      presence = 0;
      presenceV = 0;
      setStone(false);
      unsplit();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      unsubscribe();
      pointer.destroy();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      onResize();
      delete heading.dataset.fieldGuard;
    };
  }, [targetId]);

  return null;
}
