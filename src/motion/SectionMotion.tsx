"use client";

import { useEffect } from "react";

import { setSceneFocus } from "@/webgl/sceneFocus";

/**
 * Section-level motion runtime.
 *
 * Two jobs, both cheap and both reversible.
 *
 * 1. Marks a section `data-in-view` once it has entered the viewport, so its
 *    reveal plays when it is actually looked at and any looping animation is
 *    idle while it is off screen. The mark is sticky for reveals: a section
 *    that has arrived does not replay when scrolled past and back.
 *
 * 2. Optionally publishes one element's rectangle to the scene, so the
 *    particle field gathers around it. The channel carries geometry only; the
 *    scene never learns what the rectangle contains.
 *
 * Without JavaScript the section simply renders in its settled state: the CSS
 * treats the absence of `data-in-view` as "not animating", not as "hidden".
 */

type SectionMotionProps = Readonly<{
  /** Section to observe. */
  sectionId: string;
  /** Optional selector, inside the section, for the element to trace. */
  traceSelector?: string;
  /** Fraction of the section that must be visible before it counts. */
  threshold?: number;
}>;

export function SectionMotion({ sectionId, traceSelector, threshold = 0.25 }: SectionMotionProps) {
  useEffect(() => {
    const section = document.getElementById(sectionId);

    if (!section) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const traced = traceSelector ? section.querySelector<HTMLElement>(traceSelector) : null;

    let tracing = false;
    let frame = 0;

    const publishTrace = () => {
      frame = 0;

      if (!traced || !tracing) {
        return;
      }

      const box = traced.getBoundingClientRect();
      setSceneFocus({ x: box.left, y: box.top, width: box.width, height: box.height });
    };

    const scheduleTrace = () => {
      if (frame === 0 && tracing) {
        frame = requestAnimationFrame(publishTrace);
      }
    };

    const stopTracing = () => {
      if (!tracing) {
        return;
      }

      tracing = false;

      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }

      window.removeEventListener("scroll", scheduleTrace);
      window.removeEventListener("resize", scheduleTrace);
      setSceneFocus(null);
    };

    const startTracing = () => {
      // Reduced motion keeps the field still, so it never chases a word.
      if (tracing || !traced || reducedMotion.matches) {
        return;
      }

      tracing = true;
      window.addEventListener("scroll", scheduleTrace, { passive: true });
      window.addEventListener("resize", scheduleTrace);
      scheduleTrace();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          // Sticky: a reveal that has played does not play again.
          section.dataset.inView = "";
          delete section.dataset.offScreen;
          startTracing();
        } else {
          // Looping animations idle off screen; the reveal mark stays.
          section.dataset.offScreen = "";
          stopTracing();
        }
      },
      { threshold },
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
      stopTracing();
      delete section.dataset.inView;
      delete section.dataset.offScreen;
    };
  }, [sectionId, traceSelector, threshold]);

  return null;
}
