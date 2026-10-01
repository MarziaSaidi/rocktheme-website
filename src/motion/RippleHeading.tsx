"use client";

import { useEffect } from "react";

import { createRippleRenderer, type RippleRenderer } from "./rippleRenderer";

/**
 * Plays the ripple reveal on one display heading.
 *
 * `entry`: once the visitor is through the doorway (the page stops being
 * inert), in place of the heading's own line rise. `view`: each time the
 * heading scrolls into view after having left it entirely.
 *
 * The heading's state is published as `data-ripple` and the stylesheet does
 * the rest: `pending` and `playing` hide the real text while the canvas shows
 * it, `done` leaves it exactly as it always is. Without JavaScript, WebGL, or
 * with reduced motion, nothing is published and the heading keeps its CSS
 * entrance.
 */

type RippleHeadingProps = Readonly<{
  /** Id of the DisplayHeading to reveal. */
  targetId: string;
  trigger: "entry" | "view";
}>;

/** Waits the same beat the heading's own rise would have waited. */
const ENTRY_DELAY_VAR = "--motion-display-delay";
/** Share of the heading that must be on screen before it plays. */
const VIEW_THRESHOLD = 0.55;
/** A scroll this far during the reveal settles it at once. */
const SCROLL_ABORT_PX = 48;

function cssDuration(name: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.endsWith("ms") ? value : value * 1000;
}

export function RippleHeading({ targetId, trigger }: RippleHeadingProps) {
  useEffect(() => {
    const heading = document.getElementById(targetId);
    if (!heading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let renderer: RippleRenderer | null = null;
    let disposed = false;
    let playing = false;
    const cleanups: (() => void)[] = [];

    const setState = (state: "pending" | "playing" | "done" | null) => {
      if (state) heading.dataset.ripple = state;
      else delete heading.dataset.ripple;
    };

    const play = async () => {
      if (playing || disposed) return;
      renderer ??= createRippleRenderer(heading);
      if (!renderer) {
        // No WebGL: hand the heading back to its own CSS entrance.
        setState(null);
        return;
      }
      playing = true;
      setState("playing");

      const startY = window.scrollY;
      const onScroll = () => {
        if (Math.abs(window.scrollY - startY) > SCROLL_ABORT_PX) renderer?.finish();
      };
      const onResize = () => renderer?.finish();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);

      await renderer.play();

      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (disposed) return;
      // The settled frame is the plain heading: show the real text under it,
      // let that paint, then take the canvas away.
      setState("done");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          renderer?.destroy();
          renderer = null;
          playing = false;
        }),
      );
    };

    if (trigger === "entry") {
      setState("pending");
      const start = () => {
        const timer = window.setTimeout(() => void play(), cssDuration(ENTRY_DELAY_VAR));
        cleanups.push(() => window.clearTimeout(timer));
      };
      const gate = heading.closest("[inert]");
      if (gate) {
        const watch = new MutationObserver(() => {
          if (!gate.hasAttribute("inert")) {
            watch.disconnect();
            start();
          }
        });
        watch.observe(gate, { attributes: true, attributeFilter: ["inert"] });
        cleanups.push(() => watch.disconnect());
      } else {
        start();
      }
    } else {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry || playing) return;
          const inert = heading.closest("[inert]");
          if (entry.intersectionRatio === 0) {
            // Fully off screen: arm it, unseen, for the next arrival.
            setState("pending");
          } else if (
            entry.intersectionRatio >= VIEW_THRESHOLD &&
            heading.dataset.ripple === "pending" &&
            !inert
          ) {
            void play();
          }
        },
        { threshold: [0, VIEW_THRESHOLD] },
      );
      observer.observe(heading);
      cleanups.push(() => observer.disconnect());
    }

    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
      renderer?.destroy();
      renderer = null;
      setState(null);
    };
  }, [targetId, trigger]);

  return null;
}
