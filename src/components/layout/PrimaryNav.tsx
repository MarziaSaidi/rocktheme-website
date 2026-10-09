"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { SectionId } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";
import { ENTRANCE_DECODE, playDecode, setDecodePhase } from "@/motion/decode";
import { subscribeHomeSection, type HomeSection } from "@/motion/sectionState";
import { subscribeWorkStation, type WorkStation } from "@/motion/workChannel";

import styles from "./SiteHeader.module.css";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The header's section links (docs/typography-motion-system.md, Navigation).
 *
 * A single gold hairline, the lit line, rests under the section the camera is
 * in and slides when it changes; it follows the camera, never the pointer, and
 * it leaves the header at the contact. The current link carries
 * `aria-current="location"`. While a project is shown, a counter after "Work"
 * decodes to its number, in the same beat as the readout sound. A case study
 * belongs to Work.
 */
export function PrimaryNav() {
  const pathname = usePathname();
  const [section, setSection] = useState<HomeSection>("hero");
  const [station, setStation] = useState<WorkStation | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  const onCaseStudy = pathname.startsWith("/work/");
  const onHome = pathname === "/";
  const current: SectionId | null = onCaseStudy ? "selected-work" : onHome ? section : null;

  useEffect(() => {
    if (!onHome) return;
    return subscribeHomeSection(setSection);
  }, [onHome]);

  useEffect(() => subscribeWorkStation(setStation), []);

  const counter =
    onHome && current === "selected-work" && station
      ? `${pad(station.station + 1)} / ${pad(station.count)}`
      : null;

  /*
   * The lit line is one element moved by transform: measured only when the
   * current section, the counter or the viewport changes, never per frame.
   */
  const placeLine = useCallback(() => {
    const line = lineRef.current;
    const nav = navRef.current;
    if (!line || !nav) return;
    const label = current
      ? nav.querySelector<HTMLElement>(`[data-nav-key="${current}"] [data-nav-label]`)
      : null;
    if (!label) {
      line.removeAttribute("data-lit");
      return;
    }
    const box = label.getBoundingClientRect();
    const base = nav.getBoundingClientRect();
    line.style.setProperty("--lit-x", `${(box.left - base.left).toFixed(2)}px`);
    line.style.setProperty("--lit-scale", (box.width / 100).toFixed(4));
    line.setAttribute("data-lit", "");
  }, [current]);

  useLayoutEffect(() => {
    placeLine();
  }, [placeLine, counter]);

  useEffect(() => {
    const onResize = () => placeLine();
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(placeLine);
    return () => window.removeEventListener("resize", onResize);
  }, [placeLine]);

  // The counter decodes each time it shows a new number, hidden before paint.
  useLayoutEffect(() => {
    const element = counterRef.current;
    if (!element || !counter) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chars = [...element.querySelectorAll<HTMLElement>("[data-final]")];
    setDecodePhase(chars, "hidden");
    return playDecode(chars, ENTRANCE_DECODE);
  }, [counter]);

  return (
    <nav ref={navRef} className={styles.nav} aria-label="Primary">
      <ul className={styles.navList}>
        {siteContent.navigation.map((item, index) => (
          <li
            key={item.key}
            className={styles.navItem}
            data-nav-key={item.key}
            style={{ "--nav-index": index + 1 } as CSSProperties}
          >
            <Link
              className={styles.navLink}
              href={item.href}
              aria-current={current === item.key ? "location" : undefined}
            >
              <span data-nav-label="">{item.label}</span>
              {item.key === "selected-work" && counter ? (
                <span ref={counterRef} key={counter} className={styles.counter} aria-hidden="true">
                  {[...counter].map((char, charIndex) =>
                    char === " " ? (
                      " "
                    ) : (
                      <span key={charIndex} className={styles.counterChar} data-final={char}>
                        {char}
                      </span>
                    ),
                  )}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      <span ref={lineRef} className={styles.litLine} aria-hidden="true" />
    </nav>
  );
}
