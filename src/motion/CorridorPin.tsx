"use client";

import { useEffect } from "react";

import { sceneMediaQueries } from "@/config/responsive";
import { sectionAnchors, type SectionId } from "@/config/sections";
import { emitSoundEvent } from "@/sound/soundEvents";
import { setSceneFocus } from "@/webgl/sceneFocus";

/**
 * Pins the corridor and maps vertical scroll onto horizontal travel.
 *
 * This is a progressive enhancement and nothing else. Without it the corridor
 * is a native horizontally scrollable list that works with a trackpad, a
 * scrollbar, the keyboard and no JavaScript at all. With it, the section pins
 * and the page's own scroll advances the corridor.
 *
 * It never calls preventDefault and never captures wheel or touch events, so
 * the page can always be scrolled past. Scroll position is the only input, and
 * the section releases normally at both ends.
 *
 * The component reads the DOM by data attribute and knows nothing about
 * projects: how many there are, what they are called, or what order they are
 * in. It measures whatever it finds.
 */

type CorridorPinProps = Readonly<{
  /** The section to pin. */
  sectionId: SectionId;
}>;

const ITEM_SELECTOR = "[data-corridor-item]";
/**
 * Where the active plane sits across the viewport. The corridor is offset so
 * the first plane starts on this line and the last one ends on it, which keeps
 * the computed active index and the plane you are actually looking at in step.
 */
const FOCUS_LINE = 0.32;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type Measured = {
  element: HTMLElement;
  /** Screen x with the track at rest, so the live rect is baseX + translate. */
  baseX: number;
  y: number;
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function CorridorPin({ sectionId }: CorridorPinProps) {
  useEffect(() => {
    const section = document.getElementById(sectionAnchors[sectionId]);

    if (!section) {
      return;
    }

    const desktop = window.matchMedia(sceneMediaQueries.desktop);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);

    let pinned = false;
    let frame = 0;
    let measured: Measured[] = [];
    let travel = 0;
    let offset = 0;
    let activeIndex = -1;
    let resizeObserver: ResizeObserver | null = null;

    const pin = section.querySelector<HTMLElement>("[data-corridor-pin]");
    const track = section.querySelector<HTMLElement>("[data-corridor-track]");
    const scroller = track?.parentElement ?? null;

    if (!pin || !track) {
      return;
    }

    const items = () => Array.from(section.querySelectorAll<HTMLElement>(ITEM_SELECTOR));

    const measure = () => {
      const list = items();

      if (list.length === 0) {
        measured = [];
        travel = 0;
        return;
      }

      // Measure with the track at rest so the offsets are stable, then derive
      // every live position arithmetically instead of re-reading layout.
      const previous = track.style.transform;
      track.style.transform = "none";

      measured = list.map((element) => {
        const box = element.getBoundingClientRect();
        return { element, baseX: box.left, y: box.top, width: box.width, height: box.height };
      });

      const centre = (item: Measured) => item.baseX + item.width / 2;
      const first = measured[0]!;
      const last = measured[measured.length - 1]!;

      // Travel carries the last plane's centre onto the line the first one
      // started on, so progress and active index describe the same plane.
      travel = Math.max(0, centre(last) - centre(first));
      offset = window.innerWidth * FOCUS_LINE - centre(first);

      track.style.transform = previous;
      section.style.setProperty("--corridor-travel", `${travel}px`);
      section.style.setProperty("--corridor-offset", `${offset}px`);
      section.style.setProperty("--corridor-count", String(list.length));
    };

    const applyState = (index: number) => {
      measured.forEach((item, position) => {
        const distance = Math.abs(position - index);
        item.element.dataset.state =
          distance === 0 ? "active" : distance === 1 ? "near" : "distant";
      });
    };

    const publishFocus = (index: number, translate: number) => {
      const item = measured[index];

      if (!item) {
        setSceneFocus(null);
        return;
      }

      setSceneFocus({
        x: item.baseX + translate,
        y: item.y,
        width: item.width,
        height: item.height,
      });
    };

    const render = () => {
      frame = 0;

      if (!pinned || measured.length === 0) {
        return;
      }

      const box = pin.getBoundingClientRect();

      /*
       * Release the environment when the corridor is off screen. Without this
       * the scene keeps gathering particles around, and lighting a beacon for,
       * a plane nobody can see.
       */
      if (box.bottom <= 0 || box.top >= window.innerHeight) {
        if (activeIndex !== -1) {
          setSceneFocus(null);
          activeIndex = -1;
        }
        return;
      }

      const range = pin.offsetHeight - window.innerHeight;
      const progress = range > 0 ? clamp(-box.top / range, 0, 1) : 0;
      const translate = offset - progress * travel;

      section.style.setProperty("--corridor-progress", progress.toFixed(5));

      const next = Math.round(progress * (measured.length - 1));

      if (next !== activeIndex) {
        const arriving = activeIndex !== -1;
        activeIndex = next;
        applyState(next);
        section.style.setProperty("--corridor-active", String(next + 1));

        /*
         * The plane that just locked into place, and the one now coming up
         * behind it. `step` picks the horizon-light pitch, so moving through
         * the corridor builds a chord instead of repeating one note.
         */
        emitSoundEvent("project:active", { step: next });
        if (arriving && next + 1 < measured.length) {
          emitSoundEvent("project:approach", { intensity: 0.7 });
        }
      }

      publishFocus(activeIndex, translate);
    };

    const schedule = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(render);
      }
    };

    /**
     * Keyboard access. Focusing a plane scrolls the page to the position that
     * makes it the active one, which both reveals it and keeps the corridor in
     * step. This corrects the browser's own focus scrolling rather than
     * fighting it, so nothing is trapped.
     */
    const handleFocusIn = (event: FocusEvent) => {
      if (!pinned || measured.length < 2) {
        return;
      }

      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const item = target.closest<HTMLElement>(ITEM_SELECTOR);

      if (!item) {
        return;
      }

      const index = measured.findIndex((entry) => entry.element === item);

      if (index < 0) {
        return;
      }

      const range = pin.offsetHeight - window.innerHeight;
      const wanted = (index / (measured.length - 1)) * range;
      const top = window.scrollY + pin.getBoundingClientRect().top + wanted;

      /*
       * "instant" rather than "auto": the document sets scroll-behavior:
       * smooth, and "auto" defers to it, so tabbing would animate the corridor
       * for a second before the focused plane arrived.
       */
      window.scrollTo({ top, behavior: "instant" });
      schedule();
    };

    /** A project is being opened. Fires once, on the real navigation. */
    const handleOpen = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest(`${ITEM_SELECTOR} a[href]`)) {
        emitSoundEvent("project:open");
      }
    };

    const enable = () => {
      if (pinned) {
        return;
      }

      pinned = true;
      section.dataset.pinned = "";
      /*
       * Pinned, the corridor is no longer a scroll container, so its tab stop
       * would be a focus target that does nothing. The planes inside stay
       * reachable either way.
       */
      scroller?.removeAttribute("tabindex");
      measure();
      activeIndex = -1;
      render();

      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", handleResize);
      section.addEventListener("focusin", handleFocusIn);
      section.addEventListener("click", handleOpen);

      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(track);
    };

    const disable = () => {
      if (!pinned) {
        return;
      }

      pinned = false;

      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }

      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", handleResize);
      section.removeEventListener("focusin", handleFocusIn);
      section.removeEventListener("click", handleOpen);
      resizeObserver?.disconnect();
      resizeObserver = null;

      delete section.dataset.pinned;
      scroller?.setAttribute("tabindex", "0");
      section.style.removeProperty("--corridor-progress");
      section.style.removeProperty("--corridor-travel");
      section.style.removeProperty("--corridor-offset");
      section.style.removeProperty("--corridor-count");
      section.style.removeProperty("--corridor-active");
      measured.forEach((item) => {
        delete item.element.dataset.state;
      });
      measured = [];
      activeIndex = -1;
      setSceneFocus(null);
    };

    function handleResize() {
      if (!pinned) {
        return;
      }

      measure();
      activeIndex = -1;
      schedule();
    }

    const sync = () => {
      if (desktop.matches && !reducedMotion.matches) {
        enable();
      } else {
        disable();
      }
    };

    sync();
    desktop.addEventListener("change", sync);
    reducedMotion.addEventListener("change", sync);

    return () => {
      desktop.removeEventListener("change", sync);
      reducedMotion.removeEventListener("change", sync);
      disable();
    };
  }, [sectionId]);

  return null;
}
