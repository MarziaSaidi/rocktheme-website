"use client";

import { useEffect } from "react";

import { BIO_DWELL, getDoorwayAnchor } from "@/webgl/doorwayChannel";

import { createBioDust, type BioDust as Dust, type DustDoor } from "./dustRenderer";

/**
 * Plays the bio's dust: the sentence streams out of the snow doorway when the
 * bio arrives, and crumbles back into it as the visitor scrolls on.
 *
 * The heading carries `data-dust` while this runs; the stylesheet masks each
 * word by its `--whole`. Without JavaScript, WebGL, or with reduced motion,
 * nothing is published and the sentence is simply there.
 */

type BioDustProps = Readonly<{
  sectionId: string;
  /** Selector, inside the section, for the sentence. */
  selector: string;
}>;

/** With no doorway to come from (it may be off screen), it forms anyway after this long. */
const DOORLESS_AFTER = 1.4;

export function BioDust({ sectionId, selector }: BioDustProps) {
  useEffect(() => {
    const section = document.getElementById(sectionId);
    const heading = section?.querySelector<HTMLElement>(selector);
    if (!section || !heading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let dust: Dust | null = null;
    let disposed = false;
    let frame = 0;
    let last = 0;
    let clock = 0;
    let near = false;
    let inViewFor = 0;
    /** Where the doorway was last seen, so the dust still knows the way home. */
    let lastDoor: DustDoor | null = null;

    const giveUp = () => {
      dust?.destroy();
      dust = null;
      delete heading.dataset.dust;
      cancelAnimationFrame(frame);
    };

    const tick = (time: number) => {
      frame = 0;
      if (!dust) return;
      const delta = last ? (time - last) / 1000 : 0;
      last = time;
      clock += Math.min(0.05, delta);

      const view = window.innerHeight;
      const box = heading.getBoundingClientRect();
      const centre = box.top + box.height / 2;
      // 0 while the sentence is centred (the camera's rest), 1 once it has
      // risen through the dwell.
      const leave = (view / 2 - centre) / (BIO_DWELL * view * 0.85);

      const anchor = getDoorwayAnchor();
      if (anchor) lastDoor = anchor;
      const door = lastDoor ?? {
        // Off the right edge, at the sentence's height.
        x: window.innerWidth * 1.06,
        y: view * 0.55,
        width: 120,
        height: 200,
      };
      const presence = anchor?.presence ?? (lastDoor ? 0 : 1);

      const visible = box.bottom > 0 && box.top < view;
      inViewFor = visible ? inViewFor + Math.min(0.05, delta) : 0;
      if (!dust.formed() && visible && leave < 1) {
        if ((anchor && anchor.presence > 0.6) || inViewFor > DOORLESS_AFTER) dust.form(clock);
      }
      // Back up above the bio, with the doorway gone: ready to form again.
      if (dust.formed() && box.top > view * 1.1 && !anchor) {
        dust.reset();
        lastDoor = null;
      }

      dust.update({
        now: clock,
        delta,
        left: box.left,
        top: box.top,
        door,
        doorPresence: presence,
        leave,
      });

      if (near || dust.busy()) frame = requestAnimationFrame(tick);
      else last = 0;
    };

    const wake = () => {
      if (frame === 0 && dust) frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        near = Boolean(entry?.isIntersecting);
        if (near) wake();
      },
      { rootMargin: "60% 0px 60% 0px" },
    );

    let resizeTimer = 0;
    const resize = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        dust?.resample();
        wake();
      }, 150);
    });

    void document.fonts.ready.then(() => {
      if (disposed) return;
      dust = createBioDust(heading, giveUp);
      if (!dust) return;
      heading.dataset.dust = "";
      observer.observe(section);
      resize.observe(heading);
      wake();
    });

    return () => {
      disposed = true;
      observer.disconnect();
      resize.disconnect();
      window.clearTimeout(resizeTimer);
      cancelAnimationFrame(frame);
      dust?.destroy();
      delete heading.dataset.dust;
    };
  }, [sectionId, selector]);

  return null;
}
