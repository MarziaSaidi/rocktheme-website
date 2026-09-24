"use client";

import { useEffect, useRef, useState } from "react";

import { isSectionId, type SectionId } from "@/config/sections";
import { createPointerSource } from "@/motion/pointerSource";

import styles from "./SceneCanvas.module.css";
import { subscribeSceneFocus } from "./sceneFocus";
import type { Environment, EnvironmentStats } from "./core/environment";
import type { ObstacleRect } from "./modules/particleField";

/**
 * React leaf for the environment scene.
 *
 * It measures the DOM, mounts the canvas and manages the lifecycle. It passes
 * the scene plain rectangles and pointer samples, never components, never
 * project records. The heavy modules arrive through a dynamic import so nothing
 * from three.js is in the initial bundle.
 *
 * If WebGL is unavailable, unsupported, or the context is lost, this renders an
 * empty canvas, `data-scene-active` is never set, and the CSS environment layer
 * stays visible. The page is complete either way.
 */

/** Elements carrying this attribute are flowed around by the particle field. */
const OBSTACLE_SELECTOR = "[data-scene-obstacle]";

type SceneCanvasProps = Readonly<{
  /** Exposes stats for the development overlay. */
  onStats?: (stats: EnvironmentStats) => void;
}>;

export function SceneCanvas({ onStats }: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let environment: Environment | null = null;
    let pointerSource: ReturnType<typeof createPointerSource> | null = null;
    let unsubscribePointer: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let unsubscribeFocus: (() => void) | null = null;
    let statsTimer = 0;
    let obstacleFrame = 0;
    let disposed = false;

    const root = document.documentElement;

    const measureObstacles = (): ObstacleRect[] => {
      const nodes = document.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR);
      const rects: ObstacleRect[] = [];

      nodes.forEach((node) => {
        const box = node.getBoundingClientRect();

        // Skip anything scrolled out of view; the field only needs what is on
        // screen, and off-screen rects would waste avoidance checks.
        if (box.bottom < 0 || box.top > window.innerHeight || box.width === 0) {
          return;
        }

        rects.push({ x: box.left, y: box.top, width: box.width, height: box.height });
      });

      return rects;
    };

    const scheduleObstacleSync = () => {
      if (obstacleFrame !== 0) {
        return;
      }

      obstacleFrame = requestAnimationFrame(() => {
        obstacleFrame = 0;
        environment?.setObstacles(measureObstacles());
        syncChapter();
      });
    };

    const syncChapter = () => {
      let best: SectionId | null = null;
      let bestVisible = 0;
      document.querySelectorAll<HTMLElement>("[data-scene-section]").forEach((node) => {
        // Fallback layers are display:none while WebGL owns the backdrop, so
        // measure their owning section rather than the hidden layer itself.
        const rect = (node.closest("section, footer") ?? node).getBoundingClientRect();
        const visible = Math.max(
          0,
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
        );
        if (visible > bestVisible) {
          bestVisible = visible;
          best = isSectionId(node.dataset.sceneSection) ? node.dataset.sceneSection : null;
        }
      });
      environment?.setSection(best);
      if (document.hidden || bestVisible === 0) environment?.stop();
      else environment?.start();
    };

    const handleVisibility = () => {
      if (!environment) {
        return;
      }

      if (document.hidden) {
        environment.stop();
      } else {
        syncChapter();
      }
    };

    void (async () => {
      const { createEnvironment } = await import("./core/environment");

      if (disposed) {
        return;
      }

      environment = createEnvironment({
        canvas,
        reducedMotion: reducedMotionQuery.matches,
        onBeaconIntensity: (intensity) => {
          // The beacons light the DOM project edges through this one variable.
          root.style.setProperty("--scene-beacon-glow", intensity.toFixed(3));
        },
        onQualityChange: (settings) => {
          root.dataset.sceneTier = settings.tier;
        },
        onContextLost: () => {
          delete root.dataset.sceneActive;
          setActive(false);
        },
        onContextRestored: () => {
          root.dataset.sceneActive = "";
          setActive(true);
          syncChapter();
        },
      });

      if (!environment) {
        // No WebGL. The CSS environment layer remains the environment.
        return;
      }

      root.dataset.sceneActive = "";
      setActive(true);

      environment.resize(canvas.clientWidth, canvas.clientHeight);
      environment.setObstacles(measureObstacles());
      syncChapter();

      pointerSource = createPointerSource();
      unsubscribePointer = pointerSource.subscribe((sample) => {
        environment?.setPointer(sample);
      });

      // Sections publish the rectangle the environment should respond to.
      unsubscribeFocus = subscribeSceneFocus((rect) => {
        environment?.setFocus(rect);
      });

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        environment?.resize(entry.contentRect.width, entry.contentRect.height);
        scheduleObstacleSync();
      });
      resizeObserver.observe(canvas);

      window.addEventListener("scroll", scheduleObstacleSync, { passive: true });
      document.addEventListener("visibilitychange", handleVisibility);
      reducedMotionQuery.addEventListener("change", scheduleObstacleSync);

      syncChapter();

      if (onStats) {
        statsTimer = window.setInterval(() => {
          const current = environment?.stats();
          if (current) {
            onStats(current);
          }
        }, 500);
      }
    })();

    return () => {
      disposed = true;

      if (statsTimer !== 0) {
        window.clearInterval(statsTimer);
      }
      if (obstacleFrame !== 0) {
        cancelAnimationFrame(obstacleFrame);
      }

      window.removeEventListener("scroll", scheduleObstacleSync);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotionQuery.removeEventListener("change", scheduleObstacleSync);

      resizeObserver?.disconnect();
      unsubscribeFocus?.();
      unsubscribePointer?.();
      pointerSource?.destroy();
      environment?.destroy();

      delete root.dataset.sceneActive;
      delete root.dataset.sceneTier;
      root.style.removeProperty("--scene-beacon-glow");
    };
  }, [onStats]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      data-scene-canvas={active ? "" : undefined}
      aria-hidden="true"
    />
  );
}
