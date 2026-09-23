"use client";

import { useEffect } from "react";

import { pointerMotion } from "./motionConfig";

type PointerDepthProps = Readonly<{
  /** Element that receives the pointer custom properties. */
  targetId: string;
}>;

const clamp = (value: number) => Math.min(1, Math.max(-1, value));

/**
 * Drives the hero's shallow pointer parallax.
 *
 * It writes two unitless custom properties onto the hero root and lets CSS turn
 * them into a 1-3 degree rotation per plane. React state is never touched on a
 * frame, so hydration and re-rendering stay out of the animation path.
 *
 * Tracking only attaches when the visitor has a fine pointer, has not asked for
 * reduced motion, the hero is on screen, and the document is visible. It starts
 * after the entrance animations have finished so the planes settle before they
 * respond. Everything is torn down on unmount.
 */
export function PointerDepth({ targetId }: PointerDepthProps) {
  useEffect(() => {
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    const reducedMotion = window.matchMedia(pointerMotion.reducedMotionQuery);
    const finePointer = window.matchMedia(pointerMotion.finePointerQuery);

    let disposed = false;
    let listening = false;
    let onScreen = true;
    let frame = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const write = () => {
      target.style.setProperty(pointerMotion.xVariable, currentX.toFixed(4));
      target.style.setProperty(pointerMotion.yVariable, currentY.toFixed(4));
    };

    const tick = () => {
      const deltaX = targetX - currentX;
      const deltaY = targetY - currentY;

      if (
        Math.abs(deltaX) < pointerMotion.restThreshold &&
        Math.abs(deltaY) < pointerMotion.restThreshold
      ) {
        currentX = targetX;
        currentY = targetY;
        write();
        frame = 0;
        return;
      }

      currentX += deltaX * pointerMotion.smoothing;
      currentY += deltaY * pointerMotion.smoothing;
      write();
      frame = requestAnimationFrame(tick);
    };

    const requestFrame = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(tick);
      }
    };

    const stopFrame = () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }

      targetX = clamp((event.clientX / window.innerWidth) * 2 - 1);
      targetY = clamp((event.clientY / window.innerHeight) * 2 - 1);
      requestFrame();
    };

    const settleToRest = () => {
      targetX = 0;
      targetY = 0;
      requestFrame();
    };

    const startListening = () => {
      if (listening) {
        return;
      }

      listening = true;
      target.setAttribute(pointerMotion.activeAttribute, "");
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      document.addEventListener("pointerleave", settleToRest);
    };

    const stopListening = () => {
      if (!listening) {
        return;
      }

      listening = false;
      target.removeAttribute(pointerMotion.activeAttribute);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", settleToRest);
      stopFrame();
      currentX = 0;
      currentY = 0;
      targetX = 0;
      targetY = 0;
      target.style.removeProperty(pointerMotion.xVariable);
      target.style.removeProperty(pointerMotion.yVariable);
    };

    const sync = () => {
      if (disposed) {
        return;
      }

      const allowed = finePointer.matches && !reducedMotion.matches && onScreen && !document.hidden;

      if (allowed) {
        startListening();
      } else {
        stopListening();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        sync();
      },
      { threshold: 0 },
    );

    observer.observe(target);
    reducedMotion.addEventListener("change", sync);
    finePointer.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);

    /*
     * Wait for the entrance animations to finish before tracking, read from the
     * running animations themselves rather than a duplicated timeline constant.
     */
    const running =
      typeof target.getAnimations === "function"
        ? target.getAnimations({ subtree: true }).map((animation) => animation.finished)
        : [];

    void Promise.allSettled(running).then(sync);

    return () => {
      disposed = true;
      observer.disconnect();
      reducedMotion.removeEventListener("change", sync);
      finePointer.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      stopListening();
    };
  }, [targetId]);

  return null;
}
