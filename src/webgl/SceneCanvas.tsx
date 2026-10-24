"use client";

import { useEffect, useRef, useState } from "react";

import { sceneViewportForWidth } from "@/config/responsive";
import { isSectionId, sectionAnchors, type SectionId } from "@/config/sections";
import { stableViewportHeight } from "@/config/viewport";
import { createPointerSource } from "@/motion/pointerSource";

import styles from "./SceneCanvas.module.css";
import { bioLeaveScroll, bioRestScroll } from "./riftChannel";
import { afterDoorway, subscribeEntryArrival } from "./entryChannel";
import { subscribeJourneyView, type JourneyView } from "./journeyChannel";
import { subscribeSceneFocus } from "./sceneFocus";
import { detailsPoint, workScreens, workStretchesFor } from "./workJourney";
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
 * If WebGL is unavailable, unsupported, or the context stays lost, this renders
 * an empty canvas and sets `data-scene-fallback`, which brings in the CSS
 * environment layer. The page is complete either way.
 */

/** Elements carrying this attribute are flowed around by the particle field. */
const OBSTACLE_SELECTOR = "[data-scene-obstacle]";
/** Named rectangles a particle trail is composed against. */
const ANCHOR_SELECTOR = "[data-scene-anchor]";
/** A page canvas above the content, for particles that pass in front of it. */
const FRONT_LAYER_SELECTOR = "canvas[data-scene-front-layer]";

/*
 * Where the Selected Work stretch begins in the journey, in screens. Nothing
 * reaches the arrival before it any more, so only its being positive matters.
 */
const WORK_START_SCREENS = 2.3;

type SceneCanvasProps = Readonly<{
  /** Exposes stats for the development overlay. */
  onStats?: (stats: EnvironmentStats) => void;
  /** How many projects stand in Selected Work, which sets the length of its stretch. */
  workCount: number;
}>;

export function SceneCanvas({ onStats, workCount }: SceneCanvasProps) {
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
    let unsubscribeView: (() => void) | null = null;
    let statsTimer = 0;
    let recoveryTimer = 0;
    let obstacleFrame = 0;
    let disposed = false;

    const root = document.documentElement;

    /*
     * The CSS stand-in environment stays hidden until this is called. It is
     * for a scene that cannot run, not a placeholder while one loads.
     */
    const showFallback = () => {
      window.clearTimeout(recoveryTimer);
      recoveryTimer = 0;
      root.dataset.sceneFallback = "";
    };
    const hideFallback = () => {
      window.clearTimeout(recoveryTimer);
      recoveryTimer = 0;
      delete root.dataset.sceneFallback;
    };

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
     * The camera journey's offsets. Selected Work is laid out in the journey
     * at exactly the length its stretches give it (workJourney.ts), so every
     * hold, travel and the descent after it play as authored. The About page's
     * own scroll starts where the descent ends, at the water: its sections are
     * measured from the page, so a change of copy or breakpoint moves the bio's
     * rests with it.
     */
    let view: JourneyView | null = null;
    let descentEnd = 0;
    const measureStops = (): JourneyStops => {
      // The small viewport: steady while a phone's browser bars come and go.
      const viewport = stableViewportHeight();
      const stretches = workStretchesFor(sceneViewportForWidth(window.innerWidth));
      const workStart = WORK_START_SCREENS * viewport;
      const workEnd = workStart + workScreens(workCount, stretches) * viewport;
      // The descent after the last project (DESCENT_SCREENS in sceneConfig.ts).
      // Kept inline so this module stays free of the scene code.
      descentEnd = workEnd + (window.innerWidth >= 1024 ? 1 : 0.65) * viewport;
      const about = document.getElementById(sectionAnchors.about);
      const end = Math.max(0, document.documentElement.scrollHeight - viewport);
      // The mountain stays beside the full bio story. Measure its flow box,
      // never its sticky text, so resize and return visits share the same stops.
      const aboutRest = about ? descentEnd + bioRestScroll(about, viewport) : descentEnd + viewport;
      const contact = Math.max(aboutRest, descentEnd + end);
      return {
        workStart,
        workEnd,
        descentEnd,
        about: aboutRest,
        aboutLeave: about
          ? Math.min(contact, descentEnd + bioLeaveScroll(about, viewport))
          : aboutRest,
        contact,
      };
    };

    /** The offset the camera should stand at: the shown project's hold, or the page's scroll. */
    const journeyOffset = () => {
      if (view?.kind === "work") {
        const viewport = stableViewportHeight();
        const stretches = workStretchesFor(sceneViewportForWidth(window.innerWidth));
        return (WORK_START_SCREENS + detailsPoint(view.station, stretches)) * viewport;
      }
      return descentEnd + window.scrollY;
    };

    const syncJourney = () => {
      environment?.setJourneyStops(measureStops());
      environment?.setScroll(journeyOffset());
    };

    const handleScroll = () => {
      if (view?.kind !== "work") environment?.setScroll(journeyOffset());
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
      // The entry doorway downloads first; the landscape follows it.
      await afterDoorway();
      if (disposed) {
        return;
      }
      let createEnvironment: typeof import("./core/environment").createEnvironment;
      try {
        ({ createEnvironment } = await import("./core/environment"));
      } catch {
        // The scene chunk failed to load: the stand-in is the environment.
        showFallback();
        return;
      }

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
        onCameraSettled: (settled) => {
          // Project details enter only once the camera is really at rest.
          root.toggleAttribute("data-camera-settled", settled);
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
          /*
           * Browsers usually hand a lost context back within a moment. Hold
           * the stand-in off for that moment, so a brief loss reads as the
           * scene dimming and returning rather than a swap to stripes and
           * back. Only a context that stays lost brings the stand-in in.
           */
          window.clearTimeout(recoveryTimer);
          recoveryTimer = window.setTimeout(showFallback, 3000);
        },
        onContextRestored: () => {
          hideFallback();
          root.dataset.sceneActive = "";
          setActive(true);
          syncChapter();
        },
      });

      if (!environment) {
        // No WebGL. The CSS environment layer is the environment.
        showFallback();
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

      unsubscribeView = subscribeJourneyView((next) => {
        view = next;
        syncJourney();
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

      window.clearTimeout(recoveryTimer);
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
      unsubscribeView?.();
      unsubscribePointer?.();
      pointerSource?.destroy();
      environment?.destroy();

      delete root.dataset.sceneActive;
      delete root.dataset.sceneFallback;
      delete root.dataset.sceneTier;
      delete root.dataset.monolithFailed;
      delete root.dataset.journey;
      delete root.dataset.arrived;
      delete root.dataset.cameraSettled;
      root.style.removeProperty("--scene-beacon-glow");
      root.style.removeProperty("--arrival");
    };
  }, [onStats, workCount]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      data-scene-canvas={active ? "" : undefined}
      aria-hidden="true"
    />
  );
}
