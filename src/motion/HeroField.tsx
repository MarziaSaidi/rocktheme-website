"use client";

import { useEffect } from "react";

import { createFrameGuard } from "./frameGuard";
import { createPointerSource } from "./pointerSource";

/**
 * The hero's moonlight (docs/typography-motion-system.md, §5, Hero).
 *
 * The headline is set in Barlow Condensed, a static face with no weight or
 * width axis to answer with, so the field answers in light alone: moonlight
 * gathers where the pointer rests and follows it across the letters, at the
 * same restrained strength as the contact headline's. Nothing is split or
 * re-laid out; the light is painted into each line's own fill.
 *
 * It answers only a mouse, only after the headline's ripple has finished, and
 * only while the camera stands at the hero. As the camera starts to move the
 * light drains with it and is gone by `--arrival` 0.03, before the frozen exit
 * drops the lines into their masks. At rest the headline is the server markup,
 * with no inline style. Over the headline the cursor ring presses to its stone
 * state. The shared frame guard (frameGuard.ts) lets the light go and rests it
 * for the visit if frames start to slip.
 */

/** Light at full presence: the contact headline's softened strength. */
const LIGHT = 0.455;
/** The light's reach in ems, and the field's margin around the block. */
const FIELD = { rx: 1.4, ry: 1.1, pad: 0.45 };
/** Gone by the time the frozen exit starts (Hero.module.css: scroll cue at 0.03). */
const RELEASED_AT = 0.03;
const AT_REST = 0.0005;

export function HeroField({ targetId }: Readonly<{ targetId: string }>) {
  useEffect(() => {
    const heading = document.getElementById(targetId);
    const capable = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    if (!heading || !capable.matches) return;
    const root = document.documentElement;
    const inners = [...heading.querySelectorAll<HTMLElement>("[data-line-inner]")];
    if (inners.length === 0) return;

    // Boxes, read when the pointer arrives and dropped on scroll or resize.
    let boxes: { field: DOMRect; lines: DOMRect[]; em: number } | null = null;
    const read = () =>
      (boxes ??= {
        field: heading.getBoundingClientRect(),
        lines: inners.map((inner) => inner.getBoundingClientRect()),
        em: parseFloat(getComputedStyle(heading).fontSize),
      });
    // The lines' own colour at rest (the redesign's porcelain), read while unlit.
    let fill = "";
    const restFill = () => {
      if (!fill && !lit) fill = getComputedStyle(inners[0]!).color;
      return fill;
    };

    let px = 0;
    let py = 0;
    let lx = 0;
    let ly = 0;
    let inside = false;
    let presence = 0;
    let lit = false;
    let frame = 0;
    let last = 0;
    const guard = createFrameGuard();

    const arrival = () => parseFloat(root.style.getPropertyValue("--arrival")) || 0;
    const ready = () => heading.dataset.ripple === "done";
    const setStone = (on: boolean) => root.toggleAttribute("data-cursor-stone", on);

    const clear = () => {
      if (!lit) return;
      lit = false;
      inners.forEach((inner) => {
        for (const property of [
          "color",
          "background-image",
          "-webkit-background-clip",
          "background-clip",
        ]) {
          inner.style.removeProperty(property);
        }
        if (!inner.getAttribute("style")) inner.removeAttribute("style");
      });
    };

    const paint = (alpha: number) => {
      if (alpha <= 0.002) {
        clear();
        return;
      }
      const base = restFill();
      const { lines, em } = read();
      lit = true;
      const core = Math.round(alpha * 100);
      inners.forEach((inner, index) => {
        const box = lines[index]!;
        inner.style.color = "transparent";
        inner.style.setProperty("-webkit-background-clip", "text");
        inner.style.backgroundClip = "text";
        inner.style.backgroundImage = `radial-gradient(${(FIELD.rx * em).toFixed(1)}px ${(FIELD.ry * em).toFixed(1)}px at ${(lx - box.left).toFixed(1)}px ${(ly - box.top).toFixed(1)}px, color-mix(in srgb, var(--color-text-moonlit) ${core}%, ${base}) 0%, ${base} 100%), linear-gradient(${base}, ${base})`;
      });
    };

    const tick = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30) || 1 / 60;
      if (last !== 0 && !guard.tripped && guard.sample(now - last)) {
        inside = false;
        // Readable in the inspector and by the checks: the light rests for the visit.
        heading.dataset.fieldGuard = "tripped";
      }
      last = now;
      const progress = arrival();
      const atRest = progress < AT_REST;
      if (!atRest) inside = false;
      const on = ready() && atRest && inside && !guard.tripped;
      setStone(on);
      const want = on ? 1 : 0;
      // In fast, out gently with the pointer, and quickly once the camera moves.
      const rate = want > presence ? 7 : atRest && !guard.tripped ? 4 : 22;
      presence += (want - presence) * (1 - Math.exp(-rate * dt));
      const follow = 1 - Math.exp(-9 * dt);
      lx += (px - lx) * follow;
      ly += (py - ly) * follow;
      // Drained with the camera: nothing is left by the time the exit begins.
      const camera = Math.max(0, 1 - progress / RELEASED_AT);
      paint(presence * LIGHT * camera);
      const moving =
        Math.abs(want - presence) > 0.004 ||
        (presence > 0.004 && Math.abs(px - lx) + Math.abs(py - ly) > 0.3);
      if (moving || inside) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        last = 0;
        presence = want;
        setStone(false);
        if (want === 0) clear();
      }
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const pointer = createPointerSource();
    const unsubscribe = pointer.subscribe((sample) => {
      if (!ready() || guard.tripped) return;
      if (arrival() >= AT_REST || !sample.inside) {
        boxes = null;
        if (inside) {
          inside = false;
          wake();
        }
        return;
      }
      px = sample.x;
      py = sample.y;
      const { field, em } = read();
      const pad = FIELD.pad * em;
      const near =
        px > field.left - pad &&
        px < field.right + pad &&
        py > field.top - pad &&
        py < field.bottom + pad;
      if (!near && !inside) return;
      if (near && !inside && presence < 0.02) {
        lx = px;
        ly = py;
      }
      inside = near;
      wake();
    });
    // The camera starting to move releases the light, on its own.
    const onScroll = () => {
      boxes = null;
      if (lit) wake();
    };
    const onResize = () => {
      boxes = null;
      if (!lit) fill = "";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      unsubscribe();
      pointer.destroy();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
      setStone(false);
      clear();
      delete heading.dataset.fieldGuard;
    };
  }, [targetId]);

  return null;
}
