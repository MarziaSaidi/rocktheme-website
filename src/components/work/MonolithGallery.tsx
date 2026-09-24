"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { emitSoundEvent } from "@/sound/soundEvents";
import {
  monolithDuration,
  setMonolithFaces,
  setMonolithPresent,
  setMonolithTimeline,
  type MonolithTimeline,
} from "@/webgl/monolithChannel";
import { setSceneFocus } from "@/webgl/sceneFocus";
import { monolithConfig } from "@/webgl/sceneConfig";

import styles from "./MonolithGallery.module.css";

export type GalleryProject = Readonly<{
  slug: string;
  title: string;
  role: string;
  description: string;
  href: string;
  image: Readonly<{ src: string; alt: string }>;
}>;

type MonolithGalleryProps = Readonly<{
  projects: readonly GalleryProject[];
  headingId: string;
  heading: string;
  galleryLabel: string;
  viewLabel: string;
  scrollLabel: string;
  previousLabel: string;
  nextLabel: string;
  continueLabel: string;
  continueHref: string;
  /** Backdrop drawn behind the stage, pinned with it. */
  children?: ReactNode;
}>;

type Phase = "idle" | "out" | "in";

/** Wheel events closer together than this belong to one gesture. */
const GESTURE_GAP_MS = 180;
/** Accumulated wheel distance, in pixels, that counts as deliberate. */
const WHEEL_THRESHOLD = 28;
/** Finger travel, in pixels, that counts as a deliberate swipe. */
const SWIPE_THRESHOLD = 48;
const TEXT_OUT_MS = 300;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const pad = (value: number) => value.toString().padStart(2, "0");

/**
 * Selected Work gallery.
 *
 * The stone has two faces, so the gallery has two views: standing in front of
 * it (the first project) and standing behind it (the second). Moving between
 * them is a walk round the stone; the stone itself never moves.
 *
 * One controller handles every input. While the stage is pinned:
 *   forward in front of the stone   walks round to the back
 *   forward behind the stone        is left to the page, which scrolls on
 *   backward behind the stone       walks back round to the front
 *   backward in front of the stone  is left to the page, which scrolls back
 * So the gallery never loops and never holds the page for more than the one
 * walk. Each accepted input publishes one timeline to the monolith channel;
 * the camera, the screens and the text below all follow it.
 *
 * Keyboard scrolling, the scrollbar, the nav and the Continue link always move
 * the page. The Previous and Next buttons walk round the stone.
 */
export function MonolithGallery({
  projects,
  headingId,
  heading,
  galleryLabel,
  viewLabel,
  scrollLabel,
  previousLabel,
  nextLabel,
  continueLabel,
  continueHref,
  children,
}: MonolithGalleryProps) {
  const runwayRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(0);
  const busyUntilRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  // One project per face.
  const shown = projects.slice(0, 2);
  const count = shown.length;
  const frontImage = shown[0]?.image.src ?? "";
  const backImage = shown[1]?.image.src ?? "";

  const walkTo = useCallback(
    (toView: number) => {
      const now = performance.now();
      const fromView = viewRef.current;
      if (count < 2 || now < busyUntilRef.current || toView === fromView) return;

      const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      const { timing } = monolithConfig;
      const timeline: MonolithTimeline = {
        fromView,
        toView,
        startedAt: now,
        reduced,
        timing: {
          fadeOutMs: reduced ? timing.reducedFadeOutMs : timing.fadeOutMs,
          orbitMs: timing.orbitMs,
          fadeInMs: reduced ? timing.reducedFadeInMs : timing.fadeInMs,
        },
      };
      const total = monolithDuration(timeline);
      const arrive = total - timeline.timing.fadeInMs;

      viewRef.current = toView;
      busyUntilRef.current = now + total;
      setMonolithTimeline(timeline);
      setPhase("out");

      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [
        // The new project's text arrives as the viewer comes to a stop.
        window.setTimeout(
          () => {
            setActive(toView);
            setPhase("in");
          },
          Math.max(TEXT_OUT_MS, arrive),
        ),
        window.setTimeout(() => {
          setPhase("idle");
          emitSoundEvent("project:active", { step: toView });
        }, total),
      ];
    },
    [count],
  );

  /** Tells the scene the viewer stands in front of the stone, at rest. */
  const publishFront = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    viewRef.current = 0;
    busyUntilRef.current = 0;
    setMonolithTimeline({
      fromView: 0,
      toView: 0,
      startedAt: 0,
      reduced: false,
      timing: { fadeOutMs: 0, orbitMs: 0, fadeInMs: 1 },
    });
  }, []);

  /** Back in front of the stone at once, with no walk. */
  const resetToFront = useCallback(() => {
    publishFront();
    setActive(0);
    setPhase("idle");
  }, [publishFront]);

  // The faces, and a clean slate whenever the gallery mounts.
  useEffect(() => {
    setMonolithFaces([frontImage, backImage]);
    publishFront();
    // The corridor used to steer particles toward a plane; nothing does now.
    setSceneFocus(null);

    const timers = timersRef.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [frontImage, backImage, publishFront]);

  // Section-scoped scroll handling. Listeners exist only while it is on screen.
  useEffect(() => {
    const runway = runwayRef.current;
    if (!runway || count < 2) return;

    const pinned = () => {
      const box = runway.getBoundingClientRect();
      return box.top <= 1 && box.bottom >= window.innerHeight - 1;
    };
    const busy = () => performance.now() < busyUntilRef.current;
    /** Does input in this direction walk round the stone from here? */
    const walks = (direction: number) =>
      direction > 0 ? viewRef.current === 0 : viewRef.current === 1;

    let lastWheel = 0;
    let accumulated = 0;
    let direction = 0;
    /** The current gesture may not start a walk. */
    let spent = true;
    /** The current gesture started a walk, or arrived during one: hold it. */
    let held = false;

    const handleWheel = (event: WheelEvent) => {
      // Pinch-zoom and horizontal swipes are never ours.
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const now = performance.now();
      const fresh = now - lastWheel > GESTURE_GAP_MS;
      lastWheel = now;
      const isPinned = pinned();
      const sign = Math.sign(event.deltaY);

      if (fresh || sign !== direction) {
        accumulated = 0;
        direction = sign;
        // A gesture that began before the stage pinned is the one that
        // scrolled the visitor here. It must not also walk round the stone.
        spent = !isPinned || busy();
        held = isPinned && busy();
      }

      if (!isPinned || sign === 0) return;
      if (!held && !walks(sign)) return;

      // The page stays put and the gallery answers instead.
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      accumulated += Math.abs(event.deltaY) * scale;

      if (!spent && !busy() && walks(sign) && accumulated >= WHEEL_THRESHOLD) {
        spent = true;
        held = true;
        walkTo(viewRef.current + sign);
      }
    };

    let touchStartY = 0;
    let touchPinned = false;
    let touchBusy = false;

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
      touchPinned = pinned();
      touchBusy = busy();
    };

    // Finger travelling up is a forward scroll; down is backward.
    const touchDirection = (y: number) => (y < touchStartY ? 1 : y > touchStartY ? -1 : 0);

    const handleTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? touchStartY;
      const sign = touchDirection(y);
      if (touchPinned && pinned() && event.cancelable && (touchBusy || walks(sign))) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const y = event.changedTouches[0]?.clientY ?? touchStartY;
      const sign = touchDirection(y);
      if (
        touchPinned &&
        !touchBusy &&
        walks(sign) &&
        Math.abs(touchStartY - y) >= SWIPE_THRESHOLD
      ) {
        walkTo(viewRef.current + sign);
      }
      touchPinned = false;
    };

    /*
     * The stone stands in the landscape only while the stage is in place:
     * pinned, or within a fifth of a screen of it. Handing over at the
     * chapter midpoint instead put the stone over the hero's text while the
     * page was still scrolling.
     */
    let presenceFrame = 0;
    const syncPresence = () => {
      presenceFrame = 0;
      const box = runway.getBoundingClientRect();
      const slack = window.innerHeight * 0.2;
      setMonolithPresent(box.top <= slack && box.bottom >= window.innerHeight - slack);
    };
    const schedulePresence = () => {
      if (presenceFrame === 0) presenceFrame = requestAnimationFrame(syncPresence);
    };

    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener("scroll", schedulePresence, { passive: true });
        window.addEventListener("resize", schedulePresence);
        syncPresence();
        // Window-level so the fixed header above the stage is covered too.
        window.addEventListener("wheel", handleWheel, { passive: false });
        runway.addEventListener("touchstart", handleTouchStart, { passive: true });
        runway.addEventListener("touchmove", handleTouchMove, { passive: false });
        runway.addEventListener("touchend", handleTouchEnd);
      } else {
        window.removeEventListener("scroll", schedulePresence);
        window.removeEventListener("resize", schedulePresence);
        if (presenceFrame !== 0) cancelAnimationFrame(presenceFrame);
        presenceFrame = 0;
        setMonolithPresent(false);
        window.removeEventListener("wheel", handleWheel);
        runway.removeEventListener("touchstart", handleTouchStart);
        runway.removeEventListener("touchmove", handleTouchMove);
        runway.removeEventListener("touchend", handleTouchEnd);
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      listen(entry.isIntersecting);
      /*
       * Left upward (by the nav or the keyboard) while behind the stone: the
       * next visit from above starts in front, where a forward scroll walks.
       */
      if (!entry.isIntersecting && entry.boundingClientRect.top > 0 && viewRef.current !== 0) {
        resetToFront();
      }
    });
    observer.observe(runway);

    return () => {
      observer.disconnect();
      listen(false);
    };
  }, [walkTo, resetToFront, count]);

  const current = shown[active];

  return (
    <div className={styles.runway} ref={runwayRef}>
      <div className={styles.stage}>
        {children}
        <header className={styles.intro}>
          <h2 id={headingId} className={styles.heading}>
            {heading}
          </h2>
          <p className={styles.counter} aria-hidden="true">
            <span data-phase={phase}>{pad(active + 1)}</span> / {pad(count)}
          </p>
        </header>

        {/*
         * The stone is drawn by the scene. Without WebGL, or if the stone
         * fails to load, the same screen images stand in its place.
         */}
        <div className={styles.fallback} aria-hidden="true">
          {shown.map((project, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={project.slug}
              className={styles.fallbackScreen}
              src={project.image.src}
              alt=""
              data-active={index === active ? "" : undefined}
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>

        <div
          className={styles.project}
          role="group"
          aria-roledescription="carousel"
          aria-label={galleryLabel}
        >
          <div className={styles.copy} data-phase={phase} aria-live="polite">
            {current ? (
              <article key={current.slug} aria-label={`${pad(active + 1)} of ${pad(count)}`}>
                <h3 className={styles.title}>{current.title}</h3>
                <p className={styles.role}>{current.role}</p>
                <p className={styles.description}>{current.description}</p>
                <p className={styles.hidden}>{current.image.alt}</p>
                <Link
                  className={styles.view}
                  href={current.href}
                  onClick={() => emitSoundEvent("project:open")}
                >
                  {viewLabel}
                  <span className={styles.hidden}>: {current.title}</span>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                </Link>
              </article>
            ) : null}
          </div>
        </div>

        <div className={styles.controls}>
          <p className={styles.scroll} data-ready={phase === "idle" ? "" : undefined}>
            <svg className={styles.scrollIcon} viewBox="0 0 24 24" aria-hidden="true">
              {/* An open circle, 300° of arc, ending in a small arrowhead. */}
              <path d="M12 3.5a8.5 8.5 0 1 1-7.36 4.25" />
              <path d="M1.6 9 4.64 7.75 5.07 11" />
            </svg>
            <span>{scrollLabel}</span>
          </p>

          <div className={styles.steps}>
            <button
              type="button"
              className={styles.step}
              onClick={() => walkTo(0)}
              aria-label={previousLabel}
              aria-disabled={phase !== "idle" || active === 0 ? true : undefined}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className={styles.step}
              onClick={() => walkTo(1)}
              aria-label={nextLabel}
              aria-disabled={phase !== "idle" || active === count - 1 ? true : undefined}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <a className={styles.continue} href={continueHref}>
            {continueLabel}
            <span aria-hidden="true"> ↓</span>
          </a>
        </div>
      </div>
    </div>
  );
}
