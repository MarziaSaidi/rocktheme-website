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

import { addScrollStop, type ScrollStop } from "@/motion/scrollCatch";
import { emitSoundEvent } from "@/sound/soundEvents";
import { setSceneFocus } from "@/webgl/sceneFocus";
import { detailsPoint, workMoment, workScreens } from "@/webgl/workJourney";

import styles from "./MonolithGallery.module.css";

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

const pad = (value: number) => value.toString().padStart(2, "0");

/**
 * Selected Work gallery.
 *
 * Every project has its own composition station in the landscape, and the
 * page scroll walks the camera from one to the next: far view, approach,
 * settle, details, details gone, travel on. The stage pins for that whole
 * walk; its runway is as long as the journey table in workJourney.ts says.
 *
 * Nothing here takes over the scroll. The stage reads how far through its
 * runway the page is, and the same table the camera follows tells it which
 * project is in view and whether its details belong on screen. So the card can
 * only be present while the camera stands still at its station, scrolling
 * back reverses everything, and every input (wheel, touch, keyboard,
 * scrollbar, the nav) behaves as it does on the rest of the page.
 */
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
  /** Whether the scroll stands in a project's details window. */
  const [inWindow, setInWindow] = useState(false);
  const settled = useCameraSettled();
  /*
   * The details belong on screen only when both hold: the scroll is in the
   * project's window and the camera has actually come to rest there. A scroll
   * position alone does not mean the spring has finished carrying the camera.
   */
  const shown = inWindow && settled;

  // The journey currently features two project composition stations.
  const featured = projects.slice(0, 2);
  const count = featured.length;
  const total = workScreens(count);
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
      const span = box.height - window.innerHeight;
      const screens = span > 0 ? Math.min(1, Math.max(0, -box.top / span)) * total : 0;
      const moment = workMoment(screens, count);
      setActive(moment.project);
      setInWindow(moment.details);
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
  }, [count, total]);

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
        position: () => {
          const span = runway.offsetHeight - window.innerHeight;
          if (span <= 0 || total <= 0) return null;
          const top = runway.getBoundingClientRect().top + window.scrollY;
          return Math.round(top + (detailsPoint(station) / total) * span);
        },
        readFor: PROJECT_READ_MS,
      }),
    );
    stopsRef.current = stops;
    return () => {
      stops.forEach((stop) => stop.remove());
      stopsRef.current = [];
    };
  }, [count, total]);
  useEffect(() => {
    stopsRef.current.forEach((stop, station) => stop.setReady(shown && active === station));
  }, [shown, active]);

  const current = featured[active];
  const visualLayerRef = useRef<HTMLDivElement>(null);
  usePointerParallax(visualLayerRef, shown, current?.slug);

  return (
    <div
      className={styles.runway}
      ref={runwayRef}
      style={{ "--work-screens": total } as CSSProperties}
    >
      <div className={styles.stage}>
        {children}
        <header className={styles.intro}>
          <h2 id={headingId} className={styles.heading}>
            {heading}
          </h2>
        </header>

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

        <div
          className={styles.project}
          role="group"
          aria-roledescription="carousel"
          aria-label={galleryLabel}
          // The second composition is the calmer shot; its details take a beat longer.
          data-pace={active % 2 === 1 ? "calm" : undefined}
        >
          <div className={styles.depthScene}>
            {/* The glass is the rear physical plane. It contains copy only. */}
            <div className={styles.card} data-shown={shown ? "" : undefined} inert={!shown}>
              {/* The thickness of the glass edge catching light (CSS only). */}
              <span className={styles.glassEdge} aria-hidden="true" />
              {current ? (
                <article key={current.slug} aria-label={`${pad(active + 1)} of ${pad(count)}`}>
                  <p className={styles.index} aria-hidden="true">
                    <span>{pad(active + 1)}</span> / {pad(count)}
                  </p>
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

            {/*
             * Project media is a foreground sibling, never part of the glass
             * plane: each piece floats at its own depth in front of it. The
             * pieces stay mounted so the assembly can reverse when the details
             * leave; `data-shown` drives it (MonolithGallery.module.css).
             */}
            {current?.mainVisual ? (
              <div
                key={current.slug}
                ref={visualLayerRef}
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
      </div>
    </div>
  );
}
