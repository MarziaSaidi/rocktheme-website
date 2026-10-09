"use client";

import { useLayoutEffect, useRef } from "react";

import { siteContent } from "@/content/site/siteContent";
import { ENTRANCE_DECODE, playDecode, setDecodePhase } from "@/motion/decode";
import { useCurrentPlace } from "@/motion/useCurrentPlace";

import styles from "./SiteHeader.module.css";

/**
 * The phone bar's place label (docs/typography-motion-system.md, §13, Mobile):
 * the phone header has no section links, so a small mono label beside the
 * wordmark says where the camera is ("Work · 01 / 02"), decoding each time it
 * changes. Phones only (SiteHeader.module.css). It repeats what the menu
 * marks, so assistive technology is not told twice.
 */
export function PhonePlace() {
  const { current, counter } = useCurrentPlace();
  const ref = useRef<HTMLSpanElement>(null);
  const label = siteContent.navigation.find((item) => item.key === current)?.label ?? null;

  // Hidden before paint, then decoded, each time the place changes.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !label) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chars = [...element.querySelectorAll<HTMLElement>("[data-final]")];
    setDecodePhase(chars, "hidden");
    return playDecode(chars, ENTRANCE_DECODE);
  }, [label, counter]);

  if (!label) return null;
  const chars = (text: string) =>
    [...text].map((char, index) =>
      char === " " ? (
        " "
      ) : (
        <span key={index} className={styles.counterChar} data-final={char}>
          {char}
        </span>
      ),
    );
  return (
    <span ref={ref} key={`${label}-${counter ?? ""}`} className={styles.place} aria-hidden="true">
      {chars(label)}
      {counter ? <span className={styles.placeCounter}>{chars(` · ${counter}`)}</span> : null}
    </span>
  );
}
