"use client";

import { useEffect } from "react";

import { stableViewportHeight } from "@/config/viewport";
import { BIO_DWELL, getRiftAnchor } from "@/webgl/riftChannel";

import { addScrollStop, type ScrollStop } from "./scrollCatch";
import { createBioDust, type BioDust as Dust, type DustDoor } from "./dustRenderer";

/**
 * Plays the bio's dust: the sentence streams out of the rift when the
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

/** With no rift to come from (it may be off screen), it forms anyway after this long. */
const DOORLESS_AFTER = 1.4;

/**
 * A fast scroll stops on the bio and stays until every word has come out of
 * the rift and stands whole, then long enough to read the whole sentence
 * (scrollCatch.ts). The streaming takes about 4 s after the camera turns in,
 * so the backstop sits well past it: the hold never lets go mid-sentence.
 */
const BIO_READ_MS = 1200;
const BIO_MAX_HOLD_MS = 12000;

export function BioDust({ sectionId, selector }: BioDustProps) {
  useEffect(() => {
    const section = document.getElementById(sectionId);
    const heading = section?.querySelector<HTMLElement>(selector);
    if (!section || !heading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let dust: Dust | null = null;
    let stop: ScrollStop | null = null;
    let disposed = false;
    let frame = 0;
    let last = 0;
    let clock = 0;
    let near = false;
    let inViewFor = 0;
    /** Where the rift was last seen, so the dust still knows the way home. */
    let lastDoor: DustDoor | null = null;

    const giveUp = () => {
      stop?.remove();
      stop = null;
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
      const steady = stableViewportHeight();
      const leave = (steady / 2 - centre) / (BIO_DWELL * steady * 0.85);

      const anchor = getRiftAnchor();
      if (anchor) lastDoor = anchor;
      const door = lastDoor ?? {
        // Off the right edge, at the sentence's height.
        x: window.innerWidth * 1.06,
        y: view * 0.55,
        width: 120,
        height: 200,
      };
      const presence = anchor?.presence ?? (lastDoor ? 0 : 1);

      // Only once the sentence is well up the screen: by then the camera has
      // come about and is settling, so the dust flies to words that are there.
      const visible = box.bottom > 0 && box.top + box.height / 2 < view * 0.72;
      inViewFor = visible ? inViewFor + Math.min(0.05, delta) : 0;
      if (!dust.formed() && visible && leave < 1) {
        if ((anchor && anchor.presence > 0.6) || inViewFor > DOORLESS_AFTER) dust.form(clock);
      }
      // Back up above the bio, with the rift gone: ready to form again.
      if (dust.formed() && box.top > view * 1.1 && !anchor) {
        dust.reset();
        lastDoor = null;
      }

      stop?.setReady(dust.whole() && leave < 0.5);

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
      // Where the camera rests on the bio: the sentence centred (SceneCanvas.tsx).
      stop = addScrollStop({
        position: () => {
          const box = heading.getBoundingClientRect();
          const steady = stableViewportHeight();
          const end = document.documentElement.scrollHeight - steady;
          return Math.round(Math.min(end, box.top + window.scrollY + box.height / 2 - steady / 2));
        },
        readFor: BIO_READ_MS,
        maxHold: BIO_MAX_HOLD_MS,
      });
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
      stop?.remove();
      dust?.destroy();
      delete heading.dataset.dust;
    };
  }, [sectionId, selector]);

  return null;
}
