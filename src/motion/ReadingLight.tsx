"use client";

import { useEffect } from "react";

import { emitSoundEvent, type SoundEvent } from "@/sound/soundEvents";

/**
 * Scroll-linked reading light.
 *
 * Publishes `--read` (0 → 1) on one element as it travels up the viewport:
 * 0 when its top reaches the lower edge of the reading band, 1 when it reaches
 * the upper edge. The stylesheet turns that into words lighting up in order.
 *
 * Without JavaScript, or with reduced motion, nothing is published and the
 * stylesheet's default (`--read: 1`) leaves the text fully lit.
 *
 * It can also announce the moment the first words begin to light, scrolling
 * down into the text. Scrolling back above it re-arms the cue; a page that
 * loads already part way through does not sound it.
 */

type ReadingLightProps = Readonly<{
  /** Section containing the element. */
  sectionId: string;
  /** Selector, inside the section, for the element to light. */
  selector: string;
  /** Announced as the first words begin to light. */
  startEvent?: SoundEvent;
}>;

/** Viewport fractions where the reading band starts and ends. */
const BAND_START = 0.85;
const BAND_END = 0.35;
/** How far into the band the words have visibly begun to light. */
const START_AT = 0.04;

export function ReadingLight({ sectionId, selector, startEvent }: ReadingLightProps) {
  useEffect(() => {
    const target = document.getElementById(sectionId)?.querySelector<HTMLElement>(selector);
    if (!target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    /** The last reading, or null before the first paint sets a baseline. */
    let last: number | null = null;
    const paint = () => {
      frame = 0;
      const view = window.innerHeight;
      const top = target.getBoundingClientRect().top;
      let read = (BAND_START * view - top) / ((BAND_START - BAND_END) * view);
      // Near the foot of the page the band may be out of reach; finish there.
      const atBottom =
        window.scrollY + view >= document.documentElement.scrollHeight - 2 && read > 0;
      if (atBottom) read = 1;
      const clamped = Math.min(1, Math.max(0, read));
      target.style.setProperty("--read", String(clamped));
      if (startEvent && last !== null && last < START_AT && clamped >= START_AT) {
        emitSoundEvent(startEvent);
      }
      last = clamped;
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(paint);
    };

    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        paint();
      } else {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        if (frame !== 0) cancelAnimationFrame(frame);
        frame = 0;
        paint();
      }
    };

    paint();
    const observer = new IntersectionObserver(([entry]) => listen(Boolean(entry?.isIntersecting)));
    observer.observe(target);

    return () => {
      observer.disconnect();
      listen(false);
      target.style.removeProperty("--read");
    };
  }, [sectionId, selector, startEvent]);

  return null;
}
