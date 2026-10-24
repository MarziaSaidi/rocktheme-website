"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";
import { publishWorkStation, takeWorkFocus } from "@/motion/workChannel";
import { publishJourneyView } from "@/webgl/journeyChannel";

import { LogoDust } from "./LogoDust";
import styles from "./WorkIndex.module.css";
import { rememberWorkReturn, takeWorkReturn } from "./workReturn";

export type IndexProject = Readonly<{
  slug: string;
  title: string;
  year: string;
  role: string;
  category: string;
  href: string;
  /** The project's own wordmark, drawn in particles; null shows the title instead. */
  wordmark: Readonly<{ src: string; width: number; aspect: number }> | null;
}>;

/** How long a change of project keeps further input waiting, in ms. */
const SWAP_MS = 1500;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The Work index: the first thing the site shows.
 *
 * Nothing scrolls. The page names the project on show and the camera stands at
 * that project's hold in the landscape; the wheel, the arrow keys, a swipe or
 * the index itself move to the next one, and the camera flies there while the
 * wordmark comes apart and the next one gathers. The index loops: past the
 * last project comes the first again, and before the first, the last.
 */
export function WorkIndex({ projects }: Readonly<{ projects: readonly IndexProject[] }>) {
  const [current, setCurrent] = useState(0);
  const busyUntil = useRef(0);
  const count = projects.length;
  const marks = useMemo(() => projects.map((item) => item.wordmark), [projects]);

  const ctaRef = useRef<HTMLAnchorElement>(null);
  // Both are read, and cleared, once: kept here so an effect run twice still has them.
  const arrival = useRef<{ slug: string | null; focus: boolean } | null>(null);

  // Coming back from a case study lands on the project it opened, and a
  // keyboard arrival lands on the shown project's case study link.
  useEffect(() => {
    arrival.current ??= { slug: takeWorkReturn(), focus: takeWorkFocus() };
    const { slug, focus } = arrival.current;
    const index = slug ? projects.findIndex((project) => project.slug === slug) : -1;
    // Applied a frame later, still before the scene and the marks have loaded.
    const frame = requestAnimationFrame(() => {
      if (index > 0) setCurrent(index);
      if (focus) ctaRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [projects]);

  useEffect(() => {
    publishJourneyView({ kind: "work", station: current, count });
    publishWorkStation({ station: current, count });
  }, [current, count]);

  useEffect(
    () => () => {
      publishJourneyView(null);
      publishWorkStation(null);
    },
    [],
  );

  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  const go = useCallback(
    (next: number) => {
      const now = performance.now();
      if (next === currentRef.current || next < 0 || next >= count) return;
      if (now < busyUntil.current) return;
      busyUntil.current = now + SWAP_MS;
      setCurrent(next);
    },
    [count],
  );

  /** One project on, or back, round the loop. */
  const step = useCallback(
    (direction: number) => go((currentRef.current + direction + count) % count),
    [go, count],
  );

  // The page itself never scrolls: wheel, keys and swipes step through the index.
  useEffect(() => {
    let wheelSum = 0;
    let wheelAt = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const now = performance.now();
      if (now - wheelAt > 400) wheelSum = 0;
      wheelAt = now;
      wheelSum += event.deltaY;
      if (Math.abs(wheelSum) < 40) return;
      const direction = Math.sign(wheelSum);
      wheelSum = 0;
      step(direction);
    };
    const keys: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      PageDown: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
      PageUp: -1,
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const direction = keys[event.key];
      if (!direction) return;
      event.preventDefault();
      step(direction);
    };
    let touchY: number | null = null;
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    const onTouchEnd = (event: TouchEvent) => {
      const end = event.changedTouches[0]?.clientY;
      if (touchY === null || end === undefined) return;
      const distance = touchY - end;
      touchY = null;
      if (Math.abs(distance) < 40) return;
      step(Math.sign(distance));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [step]);

  const project = projects[current];
  if (!project) return null;

  return (
    <section
      id={sectionAnchors["selected-work"]}
      className={styles.stage}
      data-scene-section="selected-work"
      aria-labelledby="work-title"
    >
      <EnvironmentLayer sectionId="selected-work" />
      <LogoDust marks={marks} current={current} className={styles.dust} />

      <h1 id="work-title" className={styles.hidden}>
        {siteContent.work.displayHeading}
      </h1>

      <div className={styles.index}>
        <p className={styles.label} aria-hidden="true">
          Index
        </p>
        <ol className={styles.list} aria-label={siteContent.work.galleryLabel}>
          {projects.map((item, index) => (
            <li key={item.slug}>
              <button
                type="button"
                className={styles.item}
                aria-current={index === current ? "true" : undefined}
                onClick={() => go(index)}
              >
                <span className={styles.name}>{item.title}</span>
                <span className={styles.year}>{item.year}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* Without its wordmark, a project still shows its name at the centre. */}
      {project.wordmark ? null : (
        <p className={styles.fallbackTitle} aria-hidden="true">
          {project.title}
        </p>
      )}

      <div className={styles.detail} key={project.slug}>
        <p className={styles.role} aria-live="polite">
          <span className={styles.hidden}>{project.title}: </span>
          {project.role} <span aria-hidden="true">·</span> {project.category}
        </p>
        <Link
          ref={ctaRef}
          className={styles.cta}
          href={project.href}
          onClick={() => rememberWorkReturn(project.slug)}
        >
          {siteContent.work.viewLabel}
          <span className={styles.ctaHidden}> — {project.title}</span>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        </Link>
      </div>

      <div className={styles.foot}>
        <p className={styles.progress}>
          <span className={styles.ticks} aria-hidden="true">
            {projects.map((item, index) => (
              <i key={item.slug} data-on={index === current ? "" : undefined} />
            ))}
          </span>
          <span>
            {pad(current + 1)} / {pad(count)}
          </span>
        </p>
        <ul className={styles.links}>
          <li>
            <a href={siteContent.email.href}>{siteContent.email.label}</a>
          </li>
          <li>
            <a href={siteContent.linkedIn.href} target="_blank" rel="noreferrer">
              {siteContent.linkedIn.label}
            </a>
          </li>
          <li>
            <a href={siteContent.github.href} target="_blank" rel="noreferrer">
              {siteContent.github.label}
            </a>
          </li>
        </ul>
        <p className={styles.cue} aria-hidden="true">
          <span className={styles.cueWheel}>Scroll</span>
          <span className={styles.cueTouch}>Swipe</span>
          <i />
        </p>
      </div>
    </section>
  );
}
