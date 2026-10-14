"use client";

import { useEffect, useId, useRef } from "react";
import { gsap } from "gsap";
import styles from "./ActionContent.module.css";

/** Text and textured edges share the enclosing action's existing behavior. */
export function ActionContent({
  text,
  arrow,
  filled = false,
}: Readonly<{ text: string; arrow?: string; filled?: boolean }>) {
  const root = useRef<HTMLSpanElement>(null);
  const borderRect = useRef<SVGRectElement>(null);
  const hoverRect = useRef<SVGRectElement>(null);
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    const action = root.current?.closest<HTMLElement>("a, button");
    if (!action) return;
    const sizeBorders = () => {
      const box = action.getBoundingClientRect();
      borderRect.current?.setAttribute("width", String(Math.max(0, box.width - 1)));
      borderRect.current?.setAttribute("height", String(Math.max(0, box.height - 1)));
      hoverRect.current?.setAttribute("width", String(box.width + 7));
      hoverRect.current?.setAttribute("height", String(box.height + 7));
    };
    const observer = new ResizeObserver(sizeBorders);
    observer.observe(action);
    sizeBorders();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const progress = { value: 0 };
    const update = () =>
      action.style.setProperty(
        "--cloud-x",
        `${(Math.round((1 - progress.value) * 59) / 59) * 100}%`,
      );
    const animate = (target: number) => {
      if (action.matches(":disabled")) return;
      if (reduced.matches) {
        progress.value = target;
        update();
        return;
      }
      gsap.to(progress, {
        value: target,
        duration: (target > progress.value ? 0.7 : 0.35) * Math.abs(target - progress.value),
        ease: "none",
        overwrite: true,
        onUpdate: update,
      });
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "touch") animate(1);
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType !== "touch") animate(0);
    };
    const focus = () => animate(1);
    const blur = () => animate(0);
    action.addEventListener("pointerenter", enter);
    action.addEventListener("pointerleave", leave);
    action.addEventListener("focus", focus);
    action.addEventListener("blur", blur);
    update();
    return () => {
      observer.disconnect();
      gsap.killTweensOf(progress);
      action.removeEventListener("pointerenter", enter);
      action.removeEventListener("pointerleave", leave);
      action.removeEventListener("focus", focus);
      action.removeEventListener("blur", blur);
    };
  }, []);
  return (
    <span ref={root} className={styles.content} data-filled={filled ? "" : undefined}>
      <svg className={styles.border} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={`edge-tint-${id}`} colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="texture" />
            <feFlood floodColor="var(--brand-lavender)" result="lavender" />
            <feComposite in="lavender" in2="texture" operator="in" />
          </filter>
          <pattern id={`edge-${id}`} width="300" height="300" patternUnits="userSpaceOnUse">
            <image
              href="/interface/grain.webp"
              width="300"
              height="300"
              filter={`url(#edge-tint-${id})`}
            />
          </pattern>
        </defs>
        <rect
          ref={borderRect}
          x="0.5"
          y="0.5"
          width="1"
          height="1"
          rx="3.5"
          fill="none"
          stroke={`url(#edge-${id})`}
        />
      </svg>
      <svg className={styles.hover} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={`hover-edge-tint-${id}`} colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="texture" />
            <feFlood floodColor="var(--brand-lavender)" result="lavender" />
            <feComposite in="lavender" in2="texture" operator="in" />
          </filter>
          <pattern id={`hover-edge-${id}`} width="300" height="300" patternUnits="userSpaceOnUse">
            <image
              href="/interface/grain.webp"
              width="300"
              height="300"
              filter={`url(#hover-edge-tint-${id})`}
            />
          </pattern>
        </defs>
        <rect
          ref={hoverRect}
          x="0.5"
          y="0.5"
          width="1"
          height="1"
          rx="4.25"
          fill="none"
          stroke={`url(#hover-edge-${id})`}
        />
      </svg>
      <span className={styles.text}>
        <span>{text}</span>
        <span aria-hidden="true">{text}</span>
      </span>
      {arrow && (
        <span className={styles.icon} data-left={arrow === "←" ? "" : undefined}>
          <span>{arrow}</span>
          <span aria-hidden="true">{arrow}</span>
        </span>
      )}
    </span>
  );
}
