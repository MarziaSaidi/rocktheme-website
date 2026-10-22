"use client";

import { useEffect, useRef } from "react";

import styles from "./ScrollProgress.module.css";

type ScrollProgressProps = Readonly<{
  /**
   * `page` follows the document and sits fixed on the right edge.
   * `panel` follows the scroller it is placed inside (its parent element)
   * and pins itself to that scroller's lower right corner.
   */
  variant: "page" | "panel";
}>;

/** How long after the last scroll the line settles back to its resting dim. */
const SETTLE_MS = 900;

/**
 * Replaces the native scrollbar: a short line that fills as you read, with a
 * two-digit percentage beneath it. It brightens while scrolling, dims at rest,
 * and hides entirely when there is nothing to scroll. Decorative only — the
 * scroll itself stays native, so keyboard and assistive tech are unaffected.
 */
export function ScrollProgress({ variant }: ScrollProgressProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const fill = fillRef.current;
    const value = valueRef.current;
    if (!root || !fill || !value) return;

    const scroller = variant === "page" ? null : root.parentElement;
    if (variant === "panel" && !scroller) return;

    const read = () => {
      const el = scroller ?? document.documentElement;
      const range = el.scrollHeight - el.clientHeight;
      const top = scroller ? scroller.scrollTop : window.scrollY;
      return { range, progress: range > 0 ? Math.min(1, Math.max(0, top / range)) : 0 };
    };

    let frame = 0;
    let settle = 0;
    let last = -1;

    const paint = () => {
      frame = 0;
      const { range, progress } = read();
      // The page line only earns its place on a long page; a short overflow
      // (a case study's footer) would just sit beside the panel's own line.
      const minRange = scroller ? 4 : window.innerHeight * 0.5;
      const scrollable = range > minRange;
      root.dataset.scrollable = scrollable ? "true" : "false";
      // Before the first scroll a light runs down the panel line: a hint that
      // the copy continues. Any scroll stills it into the progress line.
      if (scroller) root.dataset.hint = scrollable && scroller.scrollTop <= 4 ? "true" : "false";
      if (progress === last) return;
      last = progress;
      fill.style.transform = `scaleY(${progress})`;
      value.textContent = String(Math.round(progress * 100)).padStart(2, "0");
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onScroll = () => {
      schedule();
      root.dataset.active = "true";
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        root.dataset.active = "false";
      }, SETTLE_MS);
    };

    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });

    // Content and viewport changes alter the range without any scrolling.
    const resize = new ResizeObserver(schedule);
    resize.observe(scroller ?? document.documentElement);
    if (scroller) {
      for (const child of scroller.children) resize.observe(child);
    } else {
      resize.observe(document.body);
    }

    paint();

    return () => {
      target.removeEventListener("scroll", onScroll);
      resize.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
    };
  }, [variant]);

  return (
    <div
      ref={rootRef}
      className={`${styles.progress} ${variant === "page" ? styles.page : styles.panel}`}
      data-scrollable="false"
      data-active="false"
      data-hint="false"
      aria-hidden="true"
    >
      <span className={styles.track}>
        <span ref={fillRef} className={styles.fill} />
      </span>
      <span ref={valueRef} className={styles.value}>
        00
      </span>
    </div>
  );
}
