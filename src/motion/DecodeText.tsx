"use client";

import { useEffect, useRef } from "react";

import styles from "./DecodeText.module.css";

/**
 * Mono microcopy that decodes into place.
 *
 * Each character flickers through symbols in lavender, lands as its real
 * letter in moonlit, then eases to the label's own colour, in a wave from left
 * to right. The label's words stay in the document as plain text for
 * assistive technology; only the visual copy animates.
 *
 * It starts with the label's own entrance: once the page is no longer inert
 * (the visitor is through the doorway), at the moment an ancestor's CSS
 * entrance begins, or, for a label with no entrance, when it scrolls into
 * view. A label that is already on screen when the page loads is left alone.
 * Without JavaScript, or with reduced motion, it is simply the text.
 */

const SYMBOLS = "[]{}!@#$%&*+-=<>?/~0123456789";
const TIMING = {
  /** Between one character and the next. */
  stagger: 34,
  /** Flickering symbols. */
  scramble: 190,
  /** How often a scrambling character changes symbol. */
  flicker: 55,
  /** The real letter, still in moonlit. */
  accent: 150,
};
const VIEW_THRESHOLD = 0.6;

type DecodeTextProps = Readonly<{ text: string }>;

type CharState = "hidden" | "scramble" | "accent" | "done";

/** The CSS entrance on this label or just above it, if it has one. */
function entranceOf(element: HTMLElement): CSSAnimation | null {
  let node: HTMLElement | null = element;
  for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
    const animation = node
      .getAnimations()
      .find((item): item is CSSAnimation => item instanceof CSSAnimation);
    if (animation) return animation;
  }
  return null;
}

export function DecodeText({ text }: DecodeTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const chars = [...root.querySelectorAll<HTMLElement>("[data-final]")];
    const states: CharState[] = chars.map(() => "done");
    let frame = 0;
    let timer = 0;
    let disposed = false;
    const cleanups: (() => void)[] = [];

    const setAll = (state: CharState) => {
      chars.forEach((char, index) => {
        states[index] = state;
        char.textContent = char.dataset.final ?? "";
        if (state === "done") delete char.dataset.state;
        else char.dataset.state = state;
      });
    };

    const decode = () => {
      const start = performance.now();
      const step = (now: number) => {
        if (disposed) return;
        const elapsed = now - start;
        let settled = true;
        chars.forEach((char, index) => {
          const t = elapsed - index * TIMING.stagger;
          const state: CharState =
            t < 0
              ? "hidden"
              : t < TIMING.scramble
                ? "scramble"
                : t < TIMING.scramble + TIMING.accent
                  ? "accent"
                  : "done";
          if (state !== "done") settled = false;
          if (state === "scramble") {
            const slot = Math.floor(t / TIMING.flicker);
            const pick = Math.abs(Math.sin(index * 12.9898 + slot * 78.233) * 43758.5453) % 1;
            char.textContent = SYMBOLS[Math.floor(pick * SYMBOLS.length)] ?? "";
          } else if (states[index] === "scramble") {
            char.textContent = char.dataset.final ?? "";
          }
          if (state !== states[index]) {
            states[index] = state;
            if (state === "done") delete char.dataset.state;
            else char.dataset.state = state;
          }
        });
        if (!settled) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    const begin = () => {
      const entrance = entranceOf(root);
      if (entrance) {
        const delay = Number(entrance.effect?.getTiming().delay ?? 0);
        const now = Number(entrance.currentTime ?? 0);
        if (now > delay + 120) {
          // Already arrived before this ran: leave it be.
          setAll("done");
          return;
        }
        timer = window.setTimeout(decode, Math.max(0, delay - now));
        return;
      }
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          if (entry.intersectionRatio >= VIEW_THRESHOLD) {
            observer.disconnect();
            decode();
          }
        },
        { threshold: [VIEW_THRESHOLD] },
      );
      observer.observe(root);
      cleanups.push(() => observer.disconnect());
    };

    // Decide before the first paint whether this label will decode at all.
    const gate = root.closest("[inert]");
    const onScreen = () => {
      const box = root.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    };
    if (!gate && !entranceOf(root) && onScreen()) return;
    setAll("hidden");

    if (gate) {
      const watch = new MutationObserver(() => {
        if (!gate.hasAttribute("inert")) {
          watch.disconnect();
          begin();
        }
      });
      watch.observe(gate, { attributes: true, attributeFilter: ["inert"] });
      cleanups.push(() => watch.disconnect());
    } else {
      begin();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      cleanups.forEach((cleanup) => cleanup());
      setAll("done");
    };
  }, [text]);

  return (
    <span ref={ref} className={styles.decode}>
      <span className={styles.visuallyHidden}>{text}</span>
      <span aria-hidden="true">
        {[...text].map((char, index) =>
          char === " " ? (
            " "
          ) : (
            <span key={index} className={styles.char} data-final={char}>
              {char}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
