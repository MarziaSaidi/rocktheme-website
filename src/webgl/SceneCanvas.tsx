"use client";

import { useEffect, useRef, useState } from "react";

import { isSectionId, sectionAnchors, type SectionId } from "@/config/sections";
import { createPointerSource } from "@/motion/pointerSource";

import styles from "./SceneCanvas.module.css";
import { subscribeEntryArrival } from "./entryChannel";
import { subscribeSceneFocus } from "./sceneFocus";
import type { JourneyStops } from "./core/cameraJourney";
import type { Environment, EnvironmentStats } from "./core/environment";
import type { AnchorRects, ObstacleRect } from "./modules/particleField";

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
/** Named rectangles a particle trail is composed against. */
const ANCHOR_SELECTOR = "[data-scene-anchor]";
/** A page canvas above the content, for particles that pass in front of it. */
const FRONT_LAYER_SELECTOR = "canvas[data-scene-front-layer]";

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
    let pageObserver: ResizeObserver | null = null;
    let unsubscribeFocus: (() => void) | null = null;
    let unsubscribeEntry: (() => void) | null = null;
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

    /*
     * Anchors are measured whether or not they are on screen: a trail keeps its
     * place against them as they scroll in.
     */
    const measureAnchors = (): AnchorRects => {
      const anchors: Record<string, ObstacleRect> = {};
      document.querySelectorAll<HTMLElement>(ANCHOR_SELECTOR).forEach((node) => {
        const name = node.dataset.sceneAnchor;
        const box = node.getBoundingClientRect();
        if (!name || box.width === 0) return;
        anchors[name] = { x: box.left, y: box.top, width: box.width, height: box.height };
      });
      return anchors;
    };

    /*
     * The camera journey's scroll ranges, read from the sections themselves so
     * a change of copy, layout or breakpoint moves the rests with it.
     */
    const measureStops = (): JourneyStops | null => {
      const byAnchor = (id: SectionId) => document.getElementById(sectionAnchors[id]);
      const work = byAnchor("selected-work");
      const about = byAnchor("about");
      if (!work || !about) return null;

      const viewport = window.innerHeight;
      const top = (node: HTMLElement) => node.getBoundingClientRect().top + window.scrollY;
      const end = Math.max(0, document.documentElement.scrollHeight - viewport);
      const workStart = top(work);
      const workEnd = Math.max(workStart, workStart + work.offsetHeight - viewport);
      const aboutRest = Math.min(
        end,
        Math.max(workEnd, top(about) + about.offsetHeight / 2 - viewport / 2),
      );
      return { workStart, workEnd, about: aboutRest, contact: Math.max(aboutRest, end) };
    };

    const syncJourney = () => {
      const stops = measureStops();
      if (stops) environment?.setJourneyStops(stops);
      environment?.setScroll(window.scrollY);
    };

    const handleScroll = () => {
      environment?.setScroll(window.scrollY);
      scheduleObstacleSync();
    };

    const scheduleObstacleSync = () => {
      if (obstacleFrame !== 0) {
        return;
      }

      obstacleFrame = requestAnimationFrame(() => {
        obstacleFrame = 0;
        environment?.setObstacles(measureObstacles());
        environment?.setAnchors(measureAnchors());
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
        onArrival: (progress) => {
          /*
           * The titles leave and arrive with the camera, not with the page:
           * `--arrival` runs 0 to 1 from the hero to the first stone, and
           * `data-arrived` marks the camera standing at its first project.
           */
          root.dataset.journey = "";
          root.style.setProperty("--arrival", (progress ?? 1).toFixed(4));
          root.toggleAttribute("data-arrived", progress === null || progress >= 0.97);
        },
        onMonolithFailure: () => {
          // The gallery shows its HTML screen images instead.
          root.dataset.monolithFailed = "";
        },
        onQualityChange: (settings) => {
          root.dataset.sceneTier = settings.tier;
        },
        onContextLost: () => {
          delete root.dataset.sceneActive;
          delete root.dataset.journey;
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
      syncJourney();
      environment.setObstacles(measureObstacles());
      environment.setAnchors(measureAnchors());
      environment.setFrontLayer(document.querySelector<HTMLCanvasElement>(FRONT_LAYER_SELECTOR));
      syncChapter();

      pointerSource = createPointerSource();
      unsubscribePointer = pointerSource.subscribe((sample) => {
        environment?.setPointer(sample);
      });

      // Sections publish the rectangle the environment should respond to.
      unsubscribeFocus = subscribeSceneFocus((rect) => {
        environment?.setFocus(rect);
      });

      unsubscribeEntry = subscribeEntryArrival(() => {
        environment?.beginEntryArrival();
      });

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        environment?.resize(entry.contentRect.width, entry.contentRect.height);
        syncJourney();
        scheduleObstacleSync();
      });
      resizeObserver.observe(canvas);
      // Sections change height as fonts and media settle.
      pageObserver = new ResizeObserver(syncJourney);
      pageObserver.observe(document.body);

      window.addEventListener("scroll", handleScroll, { passive: true });
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

      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotionQuery.removeEventListener("change", scheduleObstacleSync);

      resizeObserver?.disconnect();
      pageObserver?.disconnect();
      unsubscribeFocus?.();
      unsubscribeEntry?.();
      unsubscribePointer?.();
      pointerSource?.destroy();
      environment?.destroy();

      delete root.dataset.sceneActive;
      delete root.dataset.sceneTier;
      delete root.dataset.monolithFailed;
      delete root.dataset.journey;
      delete root.dataset.arrived;
      root.style.removeProperty("--scene-beacon-glow");
      root.style.removeProperty("--arrival");
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
