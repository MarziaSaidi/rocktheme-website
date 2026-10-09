"use client";

import { useEffect } from "react";

import { createFrameGuard } from "./frameGuard";
import { createPointerSource } from "./pointerSource";

/**
 * Contact: the invitation answers back (docs/typography-motion-system.md, §5).
 *
 * - The headline: once its ripple has finished (never during it), moonlight
 *   follows the pointer across the letters. Anton has no axes, so light is
 *   all it does.
 * - The plane listens: as the pointer approaches it leans toward it, within
 *   2° of its shipped pose, instead of snapping between two angles. It stays
 *   quieter than the headline, which remains the section's strongest light.
 * - The waveform: with the pointer on the plane, a moonlit band brightens the
 *   line at the pointer's x, like a level meter.
 *
 * Mouse only, and only while the footer is on screen; boxes are read when the
 * pointer arrives and on scroll or resize, never once per frame. Every loop
 * parks when settled, and the headline goes back to plain type. If frames
 * start to slip while it answers (the shared frame guard, frameGuard.ts), all
 * three let go and rest for the visit, as the hero's field does.
 */

/** Lean at the edge of the reach, in degrees (SiteFooter.module.css applies it). */
const SPRING = 4.5;
/** The lean answers the pointer approaching from this far, in plane sizes. */
const REACH = { x: 0.9, y: 1.4 };
/**
 * The headline's light: its margin, in px, and strength. 65% of the first
 * cut (0.7), so it answers the pointer without competing with the headline.
 */
const HEADLINE = { pad: 40, light: 0.455 };
/** The waveform's viewBox width (SiteFooter.tsx). */
const WAVE_WIDTH = 320;

const spring = (s: number, v: number, target: number, omega: number, dt: number) => {
  const a = omega * omega * (target - s) - 2 * omega * v;
  const next = v + a * dt;
  return [s + next * dt, next] as const;
};

export function ContactListen({ targetId }: Readonly<{ targetId: string }>) {
  useEffect(() => {
    const heading = document.getElementById(targetId);
    const footer = heading?.closest("footer");
    const plane = footer?.querySelector<HTMLElement>("[data-contact-plane]");
    const wave = plane?.querySelector<SVGSVGElement>("svg");
    const band = wave?.querySelector<SVGLinearGradientElement>("linearGradient");
    const capable = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    if (!heading || !footer || !plane || !wave || !band || !capable.matches) return;
    const inners = [...heading.querySelectorAll<HTMLElement>("[data-line-inner]")];

    // Boxes, read when needed and dropped on scroll or resize.
    let boxes: {
      heading: DOMRect;
      inners: DOMRect[];
      plane: DOMRect;
      wave: DOMRect;
    } | null = null;
    const read = () =>
      (boxes ??= {
        heading: heading.getBoundingClientRect(),
        inners: inners.map((inner) => inner.getBoundingClientRect()),
        plane: plane.getBoundingClientRect(),
        wave: wave.getBoundingClientRect(),
      });

    let px = 0;
    let py = 0;
    // Headline light.
    let lit = false;
    let light = 0;
    let lightTarget = 0;
    let lx = 0;
    let ly = 0;
    // Plane lean and waveform band.
    let leanX = 0;
    let leanY = 0;
    let leanVX = 0;
    let leanVY = 0;
    let leanTX = 0;
    let leanTY = 0;
    let approach = false;
    let glow = 0;
    let glowTarget = 0;
    let bandX = 0;
    let bandTarget = 0;
    let frame = 0;
    let last = 0;

    const ripple = () => heading.dataset.ripple === "done";

    const clearHeadline = () => {
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

    const paint = () => {
      // Headline: a soft disc of moonlight over the porcelain fill.
      if (light > 0.002 && ripple()) {
        const { inners: rects } = read();
        lit = true;
        inners.forEach((inner, index) => {
          const box = rects[index]!;
          const alpha = Math.round(light * HEADLINE.light * 100);
          inner.style.color = "transparent";
          inner.style.setProperty("-webkit-background-clip", "text");
          inner.style.backgroundClip = "text";
          inner.style.backgroundImage = `radial-gradient(1.4em 1.1em at ${(lx - box.left).toFixed(1)}px ${(ly - box.top).toFixed(1)}px, color-mix(in srgb, var(--color-text-moonlit) ${alpha}%, transparent) 0%, transparent 100%), linear-gradient(var(--color-text-primary), var(--color-text-primary))`;
        });
      } else {
        clearHeadline();
      }
      // Plane.
      // Held while the pointer is near, so the hover pose never cuts in mid-lean.
      const leaning = approach || Math.abs(leanX) + Math.abs(leanY) > 0.0005;
      if (leaning) {
        plane.dataset.lean = "";
        plane.style.setProperty("--lean-x", leanX.toFixed(4));
        plane.style.setProperty("--lean-y", leanY.toFixed(4));
      } else if (plane.dataset.lean !== undefined) {
        delete plane.dataset.lean;
        plane.style.removeProperty("--lean-x");
        plane.style.removeProperty("--lean-y");
      }
      // Waveform band.
      if (glow > 0.002) {
        wave.dataset.band = "";
        wave.style.setProperty("--band-glow", glow.toFixed(3));
        band.setAttribute("x1", (bandX - 48).toFixed(1));
        band.setAttribute("x2", (bandX + 48).toFixed(1));
      } else if (wave.dataset.band !== undefined) {
        delete wave.dataset.band;
        wave.style.removeProperty("--band-glow");
      }
    };

    const guard = createFrameGuard();
    // The guard tripped: everything lets go on its own springs, then parks.
    const rest = () => {
      footer.dataset.contactGuard = "tripped";
      lightTarget = 0;
      approach = false;
      leanTX = leanTY = 0;
      glowTarget = 0;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30) || 1 / 60;
      if (last !== 0 && !guard.tripped && guard.sample(now - last)) rest();
      last = now;
      if (!ripple()) {
        light = 0;
        lightTarget = 0;
      }
      const follow = 1 - Math.exp(-10 * dt);
      lx += (px - lx) * follow;
      ly += (py - ly) * follow;
      light += (lightTarget - light) * (1 - Math.exp(-(lightTarget > light ? 7 : 3.5) * dt));
      [leanX, leanVX] = spring(leanX, leanVX, leanTX, SPRING, dt);
      [leanY, leanVY] = spring(leanY, leanVY, leanTY, SPRING, dt);
      bandX += (bandTarget - bandX) * (1 - Math.exp(-14 * dt));
      glow += (glowTarget - glow) * (1 - Math.exp(-(glowTarget > glow ? 10 : 4) * dt));
      paint();
      const moving =
        Math.abs(lightTarget - light) > 0.002 ||
        (light > 0.002 && Math.abs(px - lx) + Math.abs(py - ly) > 0.3) ||
        Math.abs(leanTX - leanX) + Math.abs(leanTY - leanY) + Math.abs(leanVX) + Math.abs(leanVY) >
          0.0005 ||
        Math.abs(glowTarget - glow) > 0.002 ||
        (glow > 0.002 && Math.abs(bandTarget - bandX) > 0.3);
      if (moving) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        last = 0;
        // Settled exactly, so nothing is left a hair off its shipped pose.
        if (lightTarget === 0) light = 0;
        if (leanTX === 0 && leanTY === 0) leanX = leanY = leanVX = leanVY = 0;
        if (glowTarget === 0) glow = 0;
        paint();
      }
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const pointer = createPointerSource();
    let unsubscribe: (() => void) | null = null;
    const onPointer = (sample: { x: number; y: number; inside: boolean }) => {
      if (guard.tripped) return;
      px = sample.x;
      py = sample.y;
      const box = read();
      // The headline, after its ripple.
      const h = box.heading;
      const nearHeading =
        sample.inside &&
        ripple() &&
        px > h.left - HEADLINE.pad &&
        px < h.right + HEADLINE.pad &&
        py > h.top - HEADLINE.pad &&
        py < h.bottom + HEADLINE.pad;
      if (nearHeading && lightTarget === 0 && light < 0.02) {
        lx = px;
        ly = py;
      }
      lightTarget = nearHeading ? 1 : 0;
      // The plane leans toward an approaching pointer.
      const p = box.plane;
      const cx = p.left + p.width / 2;
      const cy = p.top + p.height / 2;
      const near =
        sample.inside &&
        Math.abs(px - cx) < p.width * REACH.x &&
        Math.abs(py - cy) < p.height * REACH.y;
      approach = near;
      leanTX = near ? Math.max(-1, Math.min(1, (px - cx) / (p.width / 2))) : 0;
      leanTY = near ? Math.max(-1, Math.min(1, (py - cy) / (p.height / 2))) : 0;
      // The waveform answers only with the pointer on the plane.
      const onPlane = sample.inside && px > p.left && px < p.right && py > p.top && py < p.bottom;
      glowTarget = onPlane ? 1 : 0;
      if (box.wave.width > 0) {
        const x = ((px - box.wave.left) / box.wave.width) * WAVE_WIDTH;
        if (onPlane && glow < 0.02) bandX = x;
        bandTarget = x;
      }
      wake();
    };

    // Listening only while the footer is on screen.
    const visible = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        boxes = null;
        unsubscribe ??= pointer.subscribe(onPointer);
      } else {
        unsubscribe?.();
        unsubscribe = null;
        lightTarget = 0;
        approach = false;
        leanTX = leanTY = 0;
        glowTarget = 0;
        wake();
      }
    });
    visible.observe(footer);
    const forget = () => {
      boxes = null;
    };
    // The ripple replays each time the invitation returns: the light never plays over it.
    const rippleWatch = new MutationObserver(() => {
      if (!ripple()) {
        light = 0;
        lightTarget = 0;
        clearHeadline();
      }
    });
    rippleWatch.observe(heading, { attributes: true, attributeFilter: ["data-ripple"] });
    window.addEventListener("scroll", forget, { passive: true });
    window.addEventListener("resize", forget);

    return () => {
      visible.disconnect();
      rippleWatch.disconnect();
      unsubscribe?.();
      pointer.destroy();
      window.removeEventListener("scroll", forget);
      window.removeEventListener("resize", forget);
      if (frame) cancelAnimationFrame(frame);
      light = leanX = leanY = glow = 0;
      approach = false;
      paint();
      delete footer.dataset.contactGuard;
    };
  }, [targetId]);

  return null;
}
