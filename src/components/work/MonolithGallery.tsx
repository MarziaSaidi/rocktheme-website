"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { emitSoundEvent } from "@/sound/soundEvents";
import { setMonolithFaces } from "@/webgl/monolithChannel";
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

export type GalleryProject = Readonly<{
  slug: string;
  title: string;
  role: string;
  /** Short facts already in the project record, such as its type and year. */
  meta: readonly string[];
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

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** Screens either side of a project's viewing point that still count as "at" it. */
const AT_PROJECT = 0.05;

const pad = (value: number) => value.toString().padStart(2, "0");

/**
 * Selected Work gallery.
 *
 * Every project has its own stone in the landscape, and the page scroll walks
 * the camera from one to the next: far view, approach, settle, details,
 * details gone, travel on. The stage pins for that whole walk; its runway is
 * as long as the journey table in workJourney.ts says.
 *
 * Nothing here takes over the scroll. The stage reads how far through its
 * runway the page is, and the same table the camera follows tells it which
 * project is in view and whether its details belong on screen. So the card can
 * only be present while the camera stands still at its own stone, scrolling
 * back reverses everything, and every input (wheel, touch, keyboard,
 * scrollbar, the nav) behaves as it does on the rest of the page.
 *
 * The Previous and Next buttons scroll to a project's viewing point.
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
  const screensRef = useRef(0);
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
  /** Whether there is a project to step back to, or on to. */
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(true);

  // One stone per project; the scene has two.
  const featured = projects.slice(0, 2);
  const count = featured.length;
  const total = workScreens(count);
  const faces = featured.map((project) => project.image.src).join("\n");

  useEffect(() => {
    setMonolithFaces(faces ? faces.split("\n") : []);
    // Particles used to be steered toward a plane here; nothing does now.
    setSceneFocus(null);
  }, [faces]);

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
      screensRef.current = screens;
      const moment = workMoment(screens, count);
      setActive(moment.project);
      setInWindow(moment.details);
      setCanPrevious(screens > detailsPoint(0) + AT_PROJECT);
      setCanNext(screens < detailsPoint(count - 1) - AT_PROJECT);
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

  /** Scrolls the page to where project `index` is shown with its details. */
  const goTo = useCallback(
    (index: number) => {
      const runway = runwayRef.current;
      if (!runway || index < 0 || index >= count || total === 0) return;
      const box = runway.getBoundingClientRect();
      const span = box.height - window.innerHeight;
      const top = window.scrollY + box.top + (detailsPoint(index) / total) * span;
      const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    },
    [count, total],
  );

  const step = (direction: 1 | -1) => {
    const at = screensRef.current;
    const indices = featured.map((_, index) => index);
    const next =
      direction > 0
        ? indices.find((index) => detailsPoint(index) > at + AT_PROJECT)
        : indices.findLast((index) => detailsPoint(index) < at - AT_PROJECT);
    if (next !== undefined) goTo(next);
  };

  const current = featured[active];

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
         * stone: set on the water, in the hero's display type, gone before
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

        {/*
         * The stones are drawn by the scene. Without WebGL, or if the stone
         * fails to load, the same screen images stand in their place.
         */}
        <div className={styles.fallback} aria-hidden="true">
          {featured.map((project, index) => (
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

        {/*
         * The stones are composed on alternate sides of the frame, so the
         * details alternate too: right of the first, left of the second. The
         * side only changes while the card is away.
         */}
        <div
          className={styles.project}
          role="group"
          aria-roledescription="carousel"
          aria-label={galleryLabel}
          data-side={active % 2 === 1 ? "start" : "end"}
          // The second stone's arrival is the calmer shot; its details take a beat longer.
          data-pace={active % 2 === 1 ? "calm" : undefined}
        >
          {/*
           * One composed reveal: the glass forms slowly while the content
           * arrives in hierarchy, and leaves in reverse (motion.css).
           */}
          <div className={styles.card} data-shown={shown ? "" : undefined} inert={!shown}>
            {current ? (
              <article key={current.slug} aria-label={`${pad(active + 1)} of ${pad(count)}`}>
                {active === 0 ? (
                  // Reduced motion never passes through the chapter title's
                  // window, so the first card carries the chapter name instead.
                  <p className={styles.chapterLine} aria-hidden="true">
                    {heading}
                  </p>
                ) : null}
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
          <p className={styles.scroll}>
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
              onClick={() => step(-1)}
              aria-label={previousLabel}
              aria-disabled={canPrevious ? undefined : true}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className={styles.step}
              onClick={() => step(1)}
              aria-label={nextLabel}
              aria-disabled={canNext ? undefined : true}
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
