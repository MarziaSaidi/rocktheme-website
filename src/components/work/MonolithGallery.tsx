"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { sceneMediaQueries } from "@/config/responsive";
import { sectionAnchors } from "@/config/sections";
import { stableViewportHeight } from "@/config/viewport";
import { addScrollStop, type ScrollStop } from "@/motion/scrollCatch";
import { emitSoundEvent } from "@/sound/soundEvents";
import { setSceneFocus } from "@/webgl/sceneFocus";
import {
  NARROW_WORK_STRETCHES,
  WORK_STRETCHES,
  type WorkStretches,
  detailsPoint,
  workMoment,
  workScreens,
} from "@/webgl/workJourney";

import styles from "./MonolithGallery.module.css";
import { rememberWorkReturn, takeWorkReturn } from "./workReturn";

/**
 * Whether the scene's camera stands still. The scene publishes it on the root
 * element as `data-camera-settled` while it drives the journey
 * (`data-journey`); without the scene there is no camera to wait for.
 */
function useCameraSettled(): boolean {
  const [settled, setSettled] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setSettled(!root.hasAttribute("data-journey") || root.hasAttribute("data-camera-settled"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-journey", "data-camera-settled"],
    });
    return () => observer.disconnect();
  }, []);
  return settled;
}

/**
 * Whether the page is in the desktop layout, which has the desktop journey;
 * below it the journey is shorter (workJourney.ts). Matches the scene's own
 * breakpoint, and the runway's height in MonolithGallery.module.css.
 */
function useDesktopJourney(): boolean {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia(sceneMediaQueries.desktop);
    const read = () => setDesktop(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);
  return desktop;
}

/** One floating piece of a project's composition: a real screen, whole or cropped. */
export type GalleryVisual = Readonly<{
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Which part of the screen a cropped tile shows (CSS object-position). */
  crop?: string;
  /**
   * An exact cut of the screen, as fractions of its width and height. The
   * piece takes the cut's proportions and shows only that part.
   */
  frame?: Readonly<{ x: number; y: number; w: number; h: number }>;
  /** The image's `sizes`, when the piece is larger or smaller than usual. */
  sizes?: string;
}>;

/**
 * Pointer parallax for the floating pieces: each moves against the cursor by
 * its own depth (MonolithGallery.module.css, `.parallax`), so moving the
 * pointer shows the air between the pieces and the glass, which never moves.
 * Desktop with a fine pointer only, and only while the details are shown;
 * the offset eases toward the pointer and back to rest when it leaves.
 */
function usePointerParallax(
  layerRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  key: string | undefined,
) {
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !active) return;
    const capable = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    if (!capable.matches) return;

    /** Critically damped approach, as the scroll spring: ~0.6 s, no overshoot. */
    const RATE = 5;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    let last = 0;

    const write = () => {
      layer.style.setProperty("--pointer-x", x.toFixed(4));
      layer.style.setProperty("--pointer-y", y.toFixed(4));
    };
    const tick = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt * RATE);
      x += (targetX - x) * k;
      y += (targetY - y) * k;
      if (Math.abs(targetX - x) + Math.abs(targetY - y) < 0.0005) {
        x = targetX;
        y = targetY;
        frame = 0;
        last = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
      write();
    };
    const run = () => {
      if (frame === 0) frame = requestAnimationFrame(tick);
    };
    // -1..1 across the viewport; the pieces move against the pointer.
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      targetX = -((event.clientX / window.innerWidth) * 2 - 1);
      targetY = -((event.clientY / window.innerHeight) * 2 - 1);
      run();
    };
    const rest = () => {
      targetX = 0;
      targetY = 0;
      run();
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", rest);
    window.addEventListener("blur", rest);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", rest);
      window.removeEventListener("blur", rest);
      if (frame !== 0) cancelAnimationFrame(frame);
      layer.style.removeProperty("--pointer-x");
      layer.style.removeProperty("--pointer-y");
    };
  }, [layerRef, active, key]);
}

/** A piece's image, cut to its `frame` or `crop` when it has one. */
function Piece({
  visual,
  placement,
  sizes,
}: Readonly<{ visual: GalleryVisual; placement: string; sizes: string }>) {
  const { frame } = visual;
  return (
    // The wrapper carries only the pointer parallax; the piece keeps its own pose.
    <div className={styles.parallax} data-depth={placement}>
      <figure
        className={styles.piece}
        data-placement={placement}
        style={
          frame
            ? { aspectRatio: `${frame.w * visual.width} / ${frame.h * visual.height}` }
            : undefined
        }
      >
        <Image
          className={frame ? styles.pieceImageFramed : styles.pieceImage}
          src={visual.src}
          alt={visual.alt}
          width={visual.width}
          height={visual.height}
          sizes={visual.sizes ?? sizes}
          loading="eager"
          style={
            frame
              ? {
                  width: `${100 / frame.w}%`,
                  height: `${100 / frame.h}%`,
                  left: `${(-frame.x / frame.w) * 100}%`,
                  top: `${(-frame.y / frame.h) * 100}%`,
                }
              : visual.crop
                ? { objectPosition: visual.crop }
                : undefined
          }
        />
      </figure>
    </div>
  );
}

export type GalleryProject = Readonly<{
  slug: string;
  title: string;
  role: string;
  /** Short facts already in the project record, such as its type and year. */
  meta: readonly string[];
  description: string;
  href: string;
  mainVisual?: GalleryVisual;
  supportingVisuals?: readonly (GalleryVisual & {
    placement: "back" | "secondary" | "detail";
  })[];
}>;

type MonolithGalleryProps = Readonly<{
  projects: readonly GalleryProject[];
  headingId: string;
  heading: string;
  galleryLabel: string;
  viewLabel: string;
  /** Backdrop drawn behind the stage, pinned with it. */
  children?: ReactNode;
}>;

/** How long a project's card is held on screen when a fast scroll is caught there. */
const PROJECT_READ_MS = 1700;
const PROJECT_SWAP_MS = 1200;

/** The page offset of a project's details point, measured fresh; null when unmeasurable. */
function stationOffset(
  runway: HTMLElement,
  station: number,
  total: number,
  stretches: WorkStretches,
): number | null {
  const span = runway.offsetHeight - stableViewportHeight();
  if (span <= 0 || total <= 0) return null;
  const top = runway.getBoundingClientRect().top + window.scrollY;
  return Math.round(top + (detailsPoint(station, stretches) / total) * span);
}

const pad = (value: number) => value.toString().padStart(2, "0");

/** Selected Work: existing compositions, with one completed horizontal swap per gesture. */
export function MonolithGallery({
  projects,
  headingId,
  heading,
  galleryLabel,
  viewLabel,
  children,
}: MonolithGalleryProps) {
  const runwayRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [swap, setSwap] = useState<{ from: number; to: number; direction: number } | null>(null);
  const swappingRef = useRef(false);
  const readySinceRef = useRef<number | null>(null);
  const lastGestureRef = useRef(-Infinity);
  const touchStartRef = useRef<number | null>(null);
  /** Whether the scroll stands in a project's details window. */
  const [inWindow, setInWindow] = useState(false);
  const settled = useCameraSettled();
  /*
   * The details belong on screen only when both hold: the scroll is in the
   * project's window and the camera has actually come to rest there. A scroll
   * position alone does not mean the spring has finished carrying the camera.
   */
  const shown = swap !== null || (inWindow && settled);

  // The journey currently features two project composition stations.
  const featured = projects.slice(0, 2);
  const count = featured.length;
  const stretches = useDesktopJourney() ? WORK_STRETCHES : NARROW_WORK_STRETCHES;
  const total = workScreens(count, stretches);
  useEffect(() => {
    // Project media belongs to the DOM foreground layer. Keep particles in
    // the landscape instead of steering them toward the visual itself.
    setSceneFocus(null);
  }, []);

  // Journey progress from the runway's position. Listens only while on screen.
  useEffect(() => {
    const runway = runwayRef.current;
    if (!runway || count === 0) return;

    let frame = 0;
    const sync = () => {
      frame = 0;
      const box = runway.getBoundingClientRect();
      const span = box.height - stableViewportHeight();
      const screens = span > 0 ? Math.min(1, Math.max(0, -box.top / span)) * total : 0;
      const moment = workMoment(screens, count, stretches);
      if (!swappingRef.current) {
        setActive(moment.project);
        setInWindow(moment.details);
      }
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(sync);
    };

    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        sync();
      } else {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        if (frame !== 0) cancelAnimationFrame(frame);
        frame = 0;
        setInWindow(false);
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) listen(entry.isIntersecting);
    });
    observer.observe(runway);

    return () => {
      observer.disconnect();
      listen(false);
    };
  }, [count, total, stretches]);

  useEffect(() => {
    if (shown) emitSoundEvent("project:active", { step: active });
  }, [shown, active]);

  /*
   * A fast scroll stops at each project's details point and stays until its
   * card has been on screen long enough to see (scrollCatch.ts). Nothing
   * about the journey itself changes; it only can't be flown past.
   */
  const stopsRef = useRef<ScrollStop[]>([]);
  useEffect(() => {
    const runway = runwayRef.current;
    if (!runway || count === 0) return;
    const stops = Array.from({ length: count }, (_, station) =>
      addScrollStop({
        position: () => stationOffset(runway, station, total, stretches),
        readFor: PROJECT_READ_MS,
        repeatOnCrossing: true,
      }),
    );
    stopsRef.current = stops;
    return () => {
      stops.forEach((stop) => stop.remove());
      stopsRef.current = [];
    };
  }, [count, total, stretches]);
  useEffect(() => {
    stopsRef.current.forEach((stop, station) => stop.setReady(shown && active === station));
  }, [shown, active]);

  useEffect(() => {
    readySinceRef.current = shown && !swap ? performance.now() : null;
  }, [shown, active, swap]);

  // Capture before the general reading stops. Momentum belongs to the current
  // gesture, never to the next project. Navigation and scrollbar jumps stay native.
  useEffect(() => {
    const runway = runwayRef.current;
    if (!runway) return;
    let timer = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const step = (direction: number, event: Event) => {
      const now = performance.now();
      const quiet = now - lastGestureRef.current > 220;
      lastGestureRef.current = now;
      if (swappingRef.current) {
        event.preventDefault();
        return;
      }
      // React's last render can still describe the previous station after a
      // native scroll leaves the stage. Read the actual position before taking
      // over input, especially when returning upward from the footer.
      const box = runway.getBoundingClientRect();
      const span = box.height - stableViewportHeight();
      const screens = span > 0 ? Math.min(1, Math.max(0, -box.top / span)) * total : 0;
      const moment = workMoment(screens, count, stretches);
      if (!moment.details) return;
      if (moment.project !== active || !inWindow) {
        event.preventDefault();
        setActive(moment.project);
        setInWindow(true);
        const entryY = stationOffset(runway, moment.project, total, stretches);
        if (entryY !== null) window.scrollTo({ top: entryY, behavior: "instant" });
        return;
      }
      if (!shown) {
        event.preventDefault();
        return;
      }
      const next = active + direction;
      const ready = readySinceRef.current;
      if (!quiet || ready === null || now - ready < PROJECT_READ_MS) {
        event.preventDefault();
        return;
      }
      if (next < 0 || next >= count) return;
      const y = stationOffset(runway, next, total, stretches);
      if (y === null) return;
      event.preventDefault();
      swappingRef.current = true;
      setSwap({ from: active, to: next, direction });
      // The existing camera spring follows its new station beneath the DOM swap.
      window.scrollTo({ top: y, behavior: "instant" });
      timer = window.setTimeout(
        () => {
          setActive(next);
          setInWindow(true);
          setSwap(null);
          swappingRef.current = false;
        },
        reduced.matches ? 0 : PROJECT_SWAP_MS,
      );
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.defaultPrevented || Math.abs(event.deltaY) < 2) return;
      step(Math.sign(event.deltaY), event);
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName))
      )
        return;
      const direction = ["ArrowDown", "PageDown", " "].includes(event.key)
        ? event.shiftKey
          ? -1
          : 1
        : ["ArrowUp", "PageUp"].includes(event.key)
          ? -1
          : 0;
      if (direction) step(direction, event);
    };
    const touchStart = (event: TouchEvent) => {
      touchStartRef.current = event.touches.length === 1 ? event.touches[0]!.clientY : null;
    };
    const touchMove = (event: TouchEvent) => {
      if (touchStartRef.current === null || event.touches.length !== 1) return;
      const delta = touchStartRef.current - event.touches[0]!.clientY;
      if (Math.abs(delta) < 12) return;
      if (event.cancelable) step(Math.sign(delta), event);
    };
    window.addEventListener("wheel", wheel, { passive: false, capture: true });
    window.addEventListener("keydown", key, true);
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false, capture: true });
    return () => {
      window.clearTimeout(timer);
      if (swappingRef.current) {
        swappingRef.current = false;
        setSwap(null);
      }
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove, true);
    };
  }, [active, shown, inWindow, count, total, stretches]);

  /*
   * Arriving at the gallery by a link (the case study's back link, the nav's
   * Work) lands on the project the visitor opened, on its details point, so
   * they come back to the card they left. With no project to return to it
   * lands at the top of the gallery. Both are instant: the hash's own smooth
   * scroll starts while the scene is still mounting and can stall on the hero.
   */
  useEffect(() => {
    const runway = runwayRef.current;
    if (!runway) return;
    const frame = requestAnimationFrame(() => {
      // Taken whichever way the visitor arrived, so it can't apply to a later visit.
      const slug = takeWorkReturn();
      if (location.hash !== `#${sectionAnchors["selected-work"]}`) return;
      const station = featured.findIndex((project) => project.slug === slug);
      // Read the layout now: the journey hook still reports desktop on its first render.
      const journey = window.matchMedia(sceneMediaQueries.desktop).matches
        ? WORK_STRETCHES
        : NARROW_WORK_STRETCHES;
      const y =
        station >= 0 ? stationOffset(runway, station, workScreens(count, journey), journey) : null;
      if (y !== null) window.scrollTo({ top: y, behavior: "instant" });
      else runway.closest("section")?.scrollIntoView({ behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
    // Once, on arrival: later changes to the journey must not move the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = featured[active];
  const visualLayerRef = useRef<HTMLDivElement>(null);
  usePointerParallax(visualLayerRef, shown, current?.slug);

  return (
    <div
      className={styles.runway}
      ref={runwayRef}
      style={
        {
          "--work-screens": workScreens(count, WORK_STRETCHES),
          "--work-screens-narrow": workScreens(count, NARROW_WORK_STRETCHES),
        } as CSSProperties
      }
    >
      <div className={styles.stage}>
        {children}
        <h2 id={headingId} className={styles.hidden}>
          {heading}
        </h2>

        {/*
         * The chapter's title as the camera crosses the water toward the first
         * project composition: set on the water, in the hero's display type, gone before
         * the camera arrives. Each word rises out of its own mask and drops
         * back into it, paced by the camera; the words never travel sideways.
         * The heading above stays the section's name for assistive technology.
         */}
        <p className={styles.chapterTitle} aria-hidden="true">
          {heading.split(" ").map((word, index) => (
            <span key={`${word}-${index}`} className={styles.chapterWord} data-word={index}>
              <span className={styles.chapterWordInner}>{word}</span>
            </span>
          ))}
        </p>

        {featured.map((current, station) => {
          const visible = swap ? station === swap.from || station === swap.to : station === active;
          if (!visible) return null;
          return (
            <div
              key={current.slug}
              className={styles.project}
              data-swap={swap ? (station === swap.from ? "out" : "in") : undefined}
              style={swap ? ({ "--swap-direction": swap.direction } as CSSProperties) : undefined}
              aria-hidden={swap ? station !== swap.to : !shown}
              inert={!!swap || !shown}
              role="group"
              aria-roledescription="carousel"
              aria-label={galleryLabel}
              // The second composition is the calmer shot; its details take a beat longer.
              data-pace={station % 2 === 1 ? "calm" : undefined}
            >
              <div className={styles.depthScene}>
                {/* The glass is the rear physical plane. It contains copy only. */}
                <div className={styles.card} data-shown={shown ? "" : undefined} inert={!shown}>
                  {/* The thickness of the glass edge catching light (CSS only). */}
                  <span className={styles.glassEdge} aria-hidden="true" />
                  {current ? (
                    <article key={current.slug} aria-label={`${pad(station + 1)} of ${pad(count)}`}>
                      <h3 className={styles.title}>
                        <span className={styles.titleInner}>{current.title}</span>
                      </h3>
                      <p className={styles.role}>{current.role}</p>
                      <p className={styles.description}>{current.description}</p>
                      {current.meta.length > 0 ? (
                        <p className={styles.meta}>{current.meta.join(" · ")}</p>
                      ) : null}
                      <Link
                        className={styles.view}
                        href={current.href}
                        onClick={() => {
                          rememberWorkReturn(current.slug);
                          emitSoundEvent("project:open");
                        }}
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

                {/*
                 * Project media is a foreground sibling, never part of the glass
                 * plane: each piece floats at its own depth in front of it. The
                 * pieces stay mounted so the assembly can reverse when the details
                 * leave; `data-shown` drives it (MonolithGallery.module.css).
                 */}
                {current?.mainVisual ? (
                  <div
                    key={current.slug}
                    ref={station === active ? visualLayerRef : undefined}
                    className={styles.visualLayer}
                    data-project={current.slug}
                    data-shown={shown ? "" : undefined}
                    aria-hidden={!shown}
                  >
                    {current.supportingVisuals?.map((visual) => (
                      <Piece
                        key={visual.src}
                        visual={visual}
                        placement={visual.placement}
                        sizes="(min-width: 1024px) 18vw, 0px"
                      />
                    ))}
                    <Piece
                      visual={current.mainVisual}
                      placement="main"
                      sizes="(min-width: 1024px) 24vw, 0px"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        <span className={styles.hidden} aria-live="polite" aria-atomic="true">
          {shown && !swap ? `${featured[active]?.title}, ${active + 1} of ${count}` : ""}
        </span>
      </div>
    </div>
  );
}
