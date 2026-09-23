"use client";

import { useEffect } from "react";

import { createPointerSource } from "./pointerSource";

/**
 * Gold pointer ring.
 *
 * The centre point is written straight from the pointer sample with no easing,
 * so it is always exactly under the physical cursor. Only the ring eases, and
 * only slightly, which is what the direction means by the cursor never lagging
 * far enough to feel inaccurate.
 *
 * It only appears for a fine pointer. On touch and pen the native cursor and
 * default behaviour are untouched, and the native cursor is only hidden once
 * this component has actually painted a ring.
 */

const INTERACTIVE_SELECTOR =
  'a[href], button, [role="button"], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/** Ring diameter in px at rest and over an interactive target. */
const REST_SIZE = 48;
const ACTIVE_SIZE = 72;
/** Ring easing per frame. Low enough to feel weighted, high enough to track. */
const RING_EASE = 0.22;

export function CustomCursor() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    let root: HTMLDivElement | null = null;
    let ring: HTMLDivElement | null = null;
    let dot: HTMLDivElement | null = null;
    let pointerSource: ReturnType<typeof createPointerSource> | null = null;
    let unsubscribe: (() => void) | null = null;
    let frame = 0;
    let hitTestTimer = 0;

    let ringX = 0;
    let ringY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let size = REST_SIZE;
    let targetSize = REST_SIZE;
    let visible = false;

    const tick = () => {
      if (!ring || !dot) {
        frame = 0;
        return;
      }

      ringX += (pointerX - ringX) * RING_EASE;
      ringY += (pointerY - ringY) * RING_EASE;
      size += (targetSize - size) * RING_EASE;

      ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0) translate(-50%, -50%)`;
      ring.style.width = `${size.toFixed(2)}px`;
      ring.style.height = `${size.toFixed(2)}px`;
      // The dot is never eased. It is the true pointer position.
      dot.style.transform = `translate3d(${pointerX.toFixed(2)}px, ${pointerY.toFixed(2)}px, 0) translate(-50%, -50%)`;

      const settled =
        Math.abs(pointerX - ringX) < 0.1 &&
        Math.abs(pointerY - ringY) < 0.1 &&
        Math.abs(targetSize - size) < 0.1;

      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const requestFrame = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(tick);
      }
    };

    const teardownVisuals = () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (hitTestTimer !== 0) {
        window.clearTimeout(hitTestTimer);
        hitTestTimer = 0;
      }
      unsubscribe?.();
      unsubscribe = null;
      pointerSource?.destroy();
      pointerSource = null;
      root?.remove();
      root = null;
      ring = null;
      dot = null;
      delete document.documentElement.dataset.customCursor;
      visible = false;
    };

    const scheduleHitTest = () => {
      if (hitTestTimer !== 0) {
        return;
      }

      // Hit testing is comparatively expensive, so it runs on a short timer
      // rather than on every pointer event.
      hitTestTimer = window.setTimeout(() => {
        hitTestTimer = 0;
        const element = document.elementFromPoint(pointerX, pointerY);
        const interactive = element?.closest(INTERACTIVE_SELECTOR) ?? null;
        const next = interactive ? ACTIVE_SIZE : REST_SIZE;

        if (next !== targetSize) {
          targetSize = next;
          root?.toggleAttribute("data-cursor-interactive", Boolean(interactive));
          requestFrame();
        }
      }, 60);
    };

    const setupVisuals = () => {
      if (root) {
        return;
      }

      root = document.createElement("div");
      root.dataset.cursorRoot = "";
      root.setAttribute("aria-hidden", "true");

      ring = document.createElement("div");
      ring.dataset.cursorRing = "";

      dot = document.createElement("div");
      dot.dataset.cursorDot = "";

      root.append(ring, dot);
      document.body.append(root);

      pointerSource = createPointerSource();
      unsubscribe = pointerSource.subscribe((sample) => {
        pointerX = sample.x;
        pointerY = sample.y;

        if (!visible) {
          // Jump the ring into place on the first sample so it never flies in
          // from the origin, and only then hide the native cursor.
          ringX = pointerX;
          ringY = pointerY;
          visible = true;
          root?.toggleAttribute("data-cursor-visible", true);
          document.documentElement.dataset.customCursor = "";
        }

        root?.toggleAttribute("data-cursor-outside", !sample.inside);
        scheduleHitTest();
        requestFrame();
      });
    };

    const sync = () => {
      if (finePointer.matches) {
        setupVisuals();
      } else {
        teardownVisuals();
      }
    };

    sync();
    finePointer.addEventListener("change", sync);

    return () => {
      finePointer.removeEventListener("change", sync);
      teardownVisuals();
    };
  }, []);

  return null;
}
