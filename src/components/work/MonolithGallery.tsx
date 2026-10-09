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
import { SwapGlyph } from "@/components/primitives/SwapGlyph";
import { DecodeText } from "@/motion/DecodeText";
import { ProjectStepper } from "@/motion/projectStepper";
import { isWorkLink, publishWorkStation, takeWorkFocus } from "@/motion/workChannel";
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
import { bindProjectWake } from "./projectWake";
import { rememberWorkReturn, takeWorkReturn } from "./workReturn";

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
  /** Keyboard-only controls: entering the gallery, and stepping between projects. */
  enterLabel: string;
  nextLabel: string;
  previousLabel: string;
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

/**
 * Moves focus to the shown project's case-study link once its card is
 * visible, without scrolling: the camera stays where it is. Gives up after a
 * few seconds (the visitor may have moved on). Returns the cancel.
 */
function focusShownProject(runway: HTMLElement): () => void {
  const until = performance.now() + 3000;
  const look = () => {
    const link = runway.querySelector<HTMLElement>("[data-work-view]");
    if (link && !link.closest("[inert]") && getComputedStyle(link).visibility === "visible") {
      link.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
      return;
    }
    if (performance.now() < until) frame = requestAnimationFrame(look);
  };
  let frame = requestAnimationFrame(look);
  return () => cancelAnimationFrame(frame);
}

/** Selected Work: existing compositions, with one completed horizontal swap per gesture. */
export function MonolithGallery({
  projects,
  headingId,
  heading,
  galleryLabel,
  viewLabel,
  enterLabel,
  nextLabel,
  previousLabel,
  children,
}: MonolithGalleryProps) {
  const runwayRef = useRef<HTMLDivElement>(null);
  /** The controller's keyboard entry and project step, for the keyboard-only controls. */
  const commandRef = useRef<{
    enter: () => void;
    step: (direction: number, event: Event) => void;
  } | null>(null);
  const [active, setActive] = useState(0);
  const [swap, setSwap] = useState<{ from: number; to: number; direction: number } | null>(null);
  /** Whether the visitor is in a controlled project visit. */
  const [inWindow, setInWindow] = useState(false);
  // Once a visit starts, camera motion cannot hide the cards between swaps.
  // Input waits only for the composition's display time and horizontal swap.
  const shown = inWindow;

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

  // This controller lives for the gallery's lifetime, not for one render or
  // one visit. Only it selects projects while the visitor is in the gallery.
  useEffect(() => {
    const runway = runwayRef.current;
    if (!runway || count === 0) return;
    const stepper = new ProjectStepper(count, PROJECT_READ_MS);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let previousY = window.scrollY;
    let expectedY = previousY;
    let lastUserInput = -Infinity;
    let lastDirection = 0;
    let recentFor = 450;
    let touchY: number | null = null;
    let touchUsed = false;
    let timer = 0;
    let pendingTimer = 0;
    let arrivalTimer = 0;
    let pendingScroll = { direction: 0, distance: 0 };
    let correcting = false;
    let jumping = false;
    let cancelFocus = () => {};
    const focusProject = () => {
      cancelFocus();
      cancelFocus = focusShownProject(runway);
    };
    const position = (station: number) => stationOffset(runway, station, total, stretches);
    const movePage = (y: number) => {
      expectedY = y;
      previousY = y;
      correcting = true;
      window.scrollTo({ top: y, behavior: "instant" });
      correcting = false;
    };
    // Only the gesture that crosses into the gallery is consumed. This
    // boundary guard does not reset the display deadline or discard a later
    // gesture's pending request.
    const finishArrivalGesture = () => {
      window.clearTimeout(arrivalTimer);
      stepper.finishArrivalGesture();
    };
    const continueArrivalGesture = () => {
      window.clearTimeout(arrivalTimer);
      arrivalTimer = window.setTimeout(finishArrivalGesture, 180);
    };
    const enter = (station: number, userArrival = false) => {
      const y = position(station);
      if (y === null) return;
      stepper.enter(station, performance.now(), userArrival);
      if (userArrival) continueArrivalGesture();
      else finishArrivalGesture();
      pendingScroll = { direction: 0, distance: 0 };
      setActive(station);
      setSwap(null);
      setInWindow(true);
      movePage(y);
    };
    const leave = () => {
      window.clearTimeout(timer);
      window.clearTimeout(pendingTimer);
      window.clearTimeout(arrivalTimer);
      pendingScroll = { direction: 0, distance: 0 };
      stepper.leave();
      setSwap(null);
      setInWindow(false);
    };
    const crossing = (from: number, to: number) => {
      const first = position(0);
      const last = position(count - 1);
      if (first === null || last === null) return null;
      if (from < first - 1 && to >= first) return 0;
      if (from > last + 1 && to <= last) return count - 1;
      return null;
    };
    const startSwap = () => {
      const transition = stepper.transition;
      if (!transition) return;
      const y = position(transition.to);
      if (y === null) {
        leave();
        return;
      }
      window.clearTimeout(pendingTimer);
      pendingScroll = { direction: 0, distance: 0 };
      // Focus inside the gallery goes with the visitor to the next project.
      const followFocus = runway.contains(document.activeElement);
      setSwap(transition);
      movePage(y);
      timer = window.setTimeout(
        () => {
          stepper.complete();
          setActive(transition.to);
          setSwap(null);
          if (followFocus) focusProject();
        },
        reduced.matches ? 0 : PROJECT_SWAP_MS,
      );
    };
    const schedulePending = () => {
      window.clearTimeout(pendingTimer);
      const delay = stepper.pendingDelay(performance.now());
      if (delay === null) return;
      pendingTimer = window.setTimeout(
        () => {
          const action = stepper.advance(performance.now());
          if (action === "swap") startSwap();
          else if (action === "exit") {
            setInWindow(false);
            // Apply the held request once. Upward exits keep its full distance;
            // downward exits stop within a screen to preserve the About arrival.
            const distance =
              pendingScroll.direction < 0
                ? pendingScroll.distance
                : Math.max(48, Math.min(pendingScroll.distance, stableViewportHeight()));
            movePage(Math.max(0, window.scrollY + pendingScroll.direction * distance));
          } else schedulePending();
        },
        Math.max(1, delay),
      );
    };
    const input = (direction: number, distance: number, event: Event) => {
      if (event.defaultPrevented) return;
      jumping = false;
      const at = performance.now();
      const separateGesture = at - lastUserInput >= 180 || direction !== lastDirection;
      lastUserInput = at;
      lastDirection = direction;
      if (stepper.arrivalGestureActive) {
        if (separateGesture) finishArrivalGesture();
        else {
          event.preventDefault();
          continueArrivalGesture();
          return;
        }
      }
      if (stepper.station === null) {
        const station = crossing(window.scrollY, window.scrollY + direction * distance);
        // Let the About reading stop handle its own chapter first. A later
        // scroll into the work runway catches the gallery's last project.
        const bottom = runway.getBoundingClientRect().bottom + window.scrollY;
        if (station !== null && !(direction < 0 && window.scrollY > bottom)) {
          event.preventDefault();
          enter(station, true);
        }
        return;
      }
      const action = stepper.input(direction, lastUserInput);
      if (action === "exit") {
        window.clearTimeout(pendingTimer);
        setInWindow(false);
        return;
      }
      if (action === "native") return;
      event.preventDefault();
      if (action === "swap") startSwap();
      else if (stepper.pendingDelay(lastUserInput) !== null) {
        pendingScroll = {
          direction,
          distance:
            pendingScroll.direction === direction
              ? Math.max(pendingScroll.distance, distance)
              : distance,
        };
        schedulePending();
      }
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return;
      recentFor = 450;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stableViewportHeight() : 1;
      input(Math.sign(event.deltaY), Math.abs(event.deltaY * unit), event);
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      if (target instanceof HTMLButtonElement && event.key === " ") return;
      if (event.key === "Home" || event.key === "End") {
        jumping = true;
        lastUserInput = -Infinity;
        leave();
        return;
      }
      const direction = ["ArrowDown", "PageDown", " "].includes(event.key)
        ? event.shiftKey
          ? -1
          : 1
        : ["ArrowUp", "PageUp"].includes(event.key)
          ? -1
          : 0;
      if (!direction) return;
      recentFor = 450;
      if (!event.repeat) finishArrivalGesture();
      input(direction, event.key.startsWith("Arrow") ? 40 : stableViewportHeight(), event);
    };
    const touchStart = (event: TouchEvent) => {
      finishArrivalGesture();
      touchY = event.touches.length === 1 ? event.touches[0]!.clientY : null;
      touchUsed = false;
      recentFor = 2000;
      lastUserInput = performance.now();
    };
    const touchMove = (event: TouchEvent) => {
      if (touchY === null || event.touches.length !== 1) return;
      const delta = touchY - event.touches[0]!.clientY;
      if (Math.abs(delta) < 12) return;
      if (touchUsed && stepper.station !== null) {
        if (event.cancelable) event.preventDefault();
        lastUserInput = performance.now();
        if (stepper.arrivalGestureActive) continueArrivalGesture();
        return;
      }
      if (event.cancelable) {
        input(Math.sign(delta), Math.abs(delta), event);
        if (event.defaultPrevented) touchUsed = true;
      }
    };
    const touchEnd = () => {
      touchY = null;
      touchUsed = false;
      finishArrivalGesture();
    };
    const scroll = () => {
      const y = window.scrollY;
      const from = previousY;
      previousY = y;
      if (correcting || jumping) return;
      const userScrolling = performance.now() - lastUserInput < recentFor;
      if (stepper.station !== null) {
        if (Math.abs(y - expectedY) <= 1) return;
        if (userScrolling) movePage(expectedY);
        else leave(); // Explicit navigation or scrollbar dragging stays available.
        return;
      }
      if (userScrolling) {
        const station = crossing(from, y);
        if (station !== null) enter(station, true);
      } else {
        // The case study back link restores an exact station after mounting.
        // It is a new visit too, with the same controller as a wheel arrival.
        for (let station = 0; station < count; station += 1) {
          const target = position(station);
          if (target !== null && Math.abs(y - target) <= 1) {
            enter(station);
            break;
          }
        }
      }
    };
    /*
     * Keyboard entry (docs/typography-motion-system.md, §15): the nearest
     * project's details are placed instantly, as a return from a case study
     * is, and focus moves to its case-study link once the card is shown.
     */
    const enterFromKeyboard = (focus: boolean) => {
      if (stepper.station === null) {
        const y = window.scrollY;
        let nearest = 0;
        for (let station = 1; station < count; station += 1) {
          const at = position(station);
          const previous = position(station - 1);
          if (at !== null && previous !== null && y > (at + previous) / 2) nearest = station;
        }
        enter(nearest);
      }
      if (focus) focusProject();
    };
    commandRef.current = {
      enter: () => enterFromKeyboard(true),
      step: (direction, event) => {
        recentFor = 450;
        finishArrivalGesture();
        input(direction, stableViewportHeight(), event);
      },
    };
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      // Work, and any link to Selected Work followed from the keyboard, lands on a project.
      if (
        link &&
        isWorkLink(link) &&
        (link.hasAttribute("data-work-entry") || event.detail === 0)
      ) {
        event.preventDefault();
        if (location.hash !== link.hash) history.pushState(null, "", link.hash);
        enterFromKeyboard(event.detail === 0);
        return;
      }
      if (link) {
        jumping = true;
        lastUserInput = -Infinity;
        leave();
      }
    };
    const resize = () => {
      if (stepper.station !== null) {
        const y = position(stepper.transition?.to ?? stepper.station);
        if (y !== null) movePage(y);
      }
    };
    // Restore a case-study return or a browser-restored project position.
    const box = runway.getBoundingClientRect();
    const span = box.height - stableViewportHeight();
    const moment = workMoment(
      span > 0 ? Math.min(1, Math.max(0, -box.top / span)) * total : 0,
      count,
      stretches,
    );
    if (moment.details) enter(moment.project);
    window.addEventListener("wheel", wheel, { passive: false, capture: true });
    window.addEventListener("keydown", key, true);
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false, capture: true });
    window.addEventListener("touchend", touchEnd, { passive: true });
    window.addEventListener("touchcancel", touchEnd, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("click", navigate, true);
    window.addEventListener("resize", resize);
    return () => {
      leave();
      cancelFocus();
      commandRef.current = null;
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove, true);
      window.removeEventListener("touchend", touchEnd);
      window.removeEventListener("touchcancel", touchEnd);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("click", navigate, true);
      window.removeEventListener("resize", resize);
    };
  }, [count, total, stretches]);

  useEffect(() => {
    if (shown && !swap) emitSoundEvent("project:active", { step: active });
    // The header's project counter decodes in the same beat.
    publishWorkStation(shown && !swap ? { station: active, count } : null);
  }, [shown, active, swap, count]);

  useEffect(() => () => publishWorkStation(null), []);

  /*
   * Arriving at the gallery by a link (the case study's back link, the nav's
   * Work) lands on the project the visitor opened, on its details point, so
   * they come back to the card they left. With no project to return to it
   * lands on the first project, a usable state for every visitor (§15). Both are instant: the hash's own smooth
   * scroll starts while the scene is still mounting and can stall on the hero.
   */
  useEffect(() => {
    const runway = runwayRef.current;
    if (!runway) return;
    let cancelFocus = () => {};
    const frame = requestAnimationFrame(() => {
      // Taken whichever way the visitor arrived, so it can't apply to a later visit.
      const slug = takeWorkReturn();
      // A keyboard arrival from another page (workChannel.ts) brings focus with it.
      const focus = takeWorkFocus();
      if (location.hash !== `#${sectionAnchors["selected-work"]}`) return;
      const station = featured.findIndex((project) => project.slug === slug);
      // Read the layout now: the journey hook still reports desktop on its first render.
      const journey = window.matchMedia(sceneMediaQueries.desktop).matches
        ? WORK_STRETCHES
        : NARROW_WORK_STRETCHES;
      const y = stationOffset(runway, Math.max(0, station), workScreens(count, journey), journey);
      if (y !== null) window.scrollTo({ top: y, behavior: "instant" });
      else runway.closest("section")?.scrollIntoView({ behavior: "instant" });
      if (focus) cancelFocus = focusShownProject(runway);
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelFocus();
    };
    // Once, on arrival: later changes to the journey must not move the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The shown project wakes as one; never during a swap.
  useEffect(() => {
    const project = runwayRef.current?.querySelector<HTMLElement>(
      `[data-project-station="${active}"]`,
    );
    if (!project || !shown || swap) return;
    return bindProjectWake(project);
  }, [shown, swap, active]);

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
      {/*
       * A keyboard visitor's way in: the next stop after the hero in the tab
       * order, until a project is shown. Fixed to the viewport, so focusing it
       * never scrolls the page (and the camera); shown only while focused.
       */}
      {shown ? null : (
        <button type="button" className={styles.entry} onClick={() => commandRef.current?.enter()}>
          {enterLabel}
          <span className={styles.hidden}>, {count} projects</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
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
              data-project-station={station}
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
                      <h3 className={styles.title} data-wake-title="">
                        <span className={styles.titleInner} data-wake-light="">
                          {current.title}
                        </span>
                      </h3>
                      <p className={styles.role}>{current.role}</p>
                      <p className={styles.description}>{current.description}</p>
                      {current.meta.length > 0 ? (
                        <p className={styles.meta}>{current.meta.join(" · ")}</p>
                      ) : null}
                      <Link
                        className={styles.view}
                        href={current.href}
                        data-cursor="action"
                        data-work-view=""
                        onClick={() => {
                          rememberWorkReturn(current.slug);
                          emitSoundEvent("project:open");
                        }}
                      >
                        {/* An important action: it decodes on hover or focus, never on arrival. */}
                        <DecodeText text={viewLabel} entrance={false} replay />
                        <span className={styles.hidden}>: {current.title}</span>
                        <SwapGlyph direction="right" className={styles.arrow}>
                          →
                        </SwapGlyph>
                      </Link>
                      {/*
                       * Keyboard-only steps between projects, shown only while
                       * focused: the same step a scroll makes, swap and camera
                       * included. Focus follows to the next project's link.
                       */}
                      <div className={styles.steps}>
                        {station > 0 ? (
                          <button
                            type="button"
                            className={styles.step}
                            onClick={(event) => commandRef.current?.step(-1, event.nativeEvent)}
                          >
                            <span aria-hidden="true">↑</span>
                            {previousLabel}
                            <span className={styles.hidden}>: {featured[station - 1]?.title}</span>
                          </button>
                        ) : null}
                        {station < count - 1 ? (
                          <button
                            type="button"
                            className={styles.step}
                            onClick={(event) => commandRef.current?.step(1, event.nativeEvent)}
                          >
                            <span aria-hidden="true">↓</span>
                            {nextLabel}
                            <span className={styles.hidden}>: {featured[station + 1]?.title}</span>
                          </button>
                        ) : null}
                      </div>
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
                    data-wake-visual=""
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
