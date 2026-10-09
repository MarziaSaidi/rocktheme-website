"use client";

import { useEffect, useRef } from "react";

import { actionDecode, ENTRANCE_DECODE, playDecode, setDecodePhase } from "./decode";

import styles from "./DecodeText.module.css";

/**
 * Mono microcopy that decodes into place.
 *
 * Each character flickers through symbols in lavender, lands as its real
 * letter in moonlit, then eases to the label's own colour, in a wave from left
 * to right. The label's words stay in the document as plain text for
 * assistive technology; only the visual copy animates.
 *
 * `entrance` (on by default) starts with the label's own entrance: once the
 * page is no longer inert (the visitor is through the doorway), at the moment
 * an ancestor's CSS entrance begins, or, for a label with no entrance, when it
 * scrolls into view. A label that is already on screen when the page loads is
 * left alone.
 *
 * `replay` is for the short, closed list of important actions
 * (docs/typography-motion-system.md, §4): the label decodes again when a mouse
 * comes onto its link or button, or keyboard focus does. It is always readable
 * again within ACTION_DECODE_BUDGET, and the same action does not replay within
 * REPLAY_COOLDOWN, so passing over it repeatedly never turns into noise. Touch
 * never triggers it.
 *
 * Without JavaScript, or with reduced motion, it is simply the text.
 */

const VIEW_THRESHOLD = 0.6;
/** The same action does not decode again within this window. */
const REPLAY_COOLDOWN = 4000;

type DecodeTextProps = Readonly<{
  text: string;
  /** Decode with the label's entrance. */
  entrance?: boolean;
  /** Decode again on mouse hover or keyboard focus of the enclosing link or button. */
  replay?: boolean;
}>;

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

export function DecodeText({ text, entrance = true, replay = false }: DecodeTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  /** Whichever decode is running, entrance or replay; there is only ever one. */
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !entrance) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const chars = [...root.querySelectorAll<HTMLElement>("[data-final]")];
    let timer = 0;
    const cleanups: (() => void)[] = [];

    const decode = () => {
      stopRef.current?.();
      stopRef.current = playDecode(chars, ENTRANCE_DECODE, {
        onDone: () => (stopRef.current = null),
      });
    };

    const begin = () => {
      const animation = entranceOf(root);
      if (animation) {
        const delay = Number(animation.effect?.getTiming().delay ?? 0);
        const now = Number(animation.currentTime ?? 0);
        if (now > delay + 120) {
          // Already arrived before this ran: leave it be.
          setDecodePhase(chars, "done");
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
    setDecodePhase(chars, "hidden");

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
      window.clearTimeout(timer);
      cleanups.forEach((cleanup) => cleanup());
      stopRef.current?.();
      stopRef.current = null;
      setDecodePhase(chars, "done");
    };
  }, [text, entrance]);

  useEffect(() => {
    const root = ref.current;
    const target = root?.closest<HTMLElement>("a, button");
    if (!root || !target || !replay) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const chars = [...root.querySelectorAll<HTMLElement>("[data-final]")];
    const timing = actionDecode(chars.length);
    let last = -Infinity;

    const play = () => {
      // Never on top of a decode that is still running (the entrance included).
      if (reduced.matches || stopRef.current) return;
      const now = performance.now();
      if (now - last < REPLAY_COOLDOWN) return;
      last = now;
      stopRef.current = playDecode(chars, timing, {
        fromVisible: true,
        onDone: () => (stopRef.current = null),
      });
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === "mouse") play();
    };
    const onFocus = () => {
      if (target.matches(":focus-visible")) play();
    };

    target.addEventListener("pointerenter", onPointer);
    target.addEventListener("focus", onFocus);
    return () => {
      target.removeEventListener("pointerenter", onPointer);
      target.removeEventListener("focus", onFocus);
    };
  }, [text, replay]);

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
