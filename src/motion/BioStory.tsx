"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

import { emitSoundEvent } from "@/sound/soundEvents";

import { createBioHandoff, type HandoffWord, type TitleSignature } from "./bioHandoff";

/** Where in the story each passage takes over, as a share of the scroll through it. */
const TURNS = [0.32, 0.67] as const;
/** Of a passage's stretch of scroll, where the reading light starts and how long it takes. */
const READING = { from: 0.04, span: 0.62 } as const;
/** Slack, as a share of the viewport, in deciding that the sticky stage is pinned. */
const PINNED = 0.02;
/** Seconds the incoming title waits for the outgoing one, so the streams never cross. */
const HANDOFF_DELAY = 0.7;

type Passage = {
  element: HTMLElement;
  copy: HTMLElement;
  words: HandoffWord[];
  splits: SplitText[];
  sweep: string | null;
};

/**
 * One owner for the bio's motion. Native scroll chooses the passage and moves
 * the reading light; time plays each hand-off, so a quick flick never leaves
 * lines half-way.
 *
 * Leaving, the quiet text goes first (aside, then body) and the title
 * releases its glyph particles into the water last. Arriving, the title
 * reveals in place and the copy rises after it. Reverse scrolling changes
 * the HTML entrance direction; released particles always fall downward.
 */
export function BioStory() {
  useEffect(() => {
    const story = document.querySelector<HTMLElement>("[data-bio-story]");
    if (!story) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    const media = gsap.matchMedia();
    let disposed = false;

    void document.fonts.ready.then(() => {
      if (disposed) return;
      media.add("(prefers-reduced-motion: no-preference) and (min-height: 520px)", () => {
        story.dataset.motion = "ready";
        const handoff = createBioHandoff();
        const clock = () => performance.now() / 1000;
        let trigger: ScrollTrigger | null = null;
        // Only a scroll that is still happening draws the dust out; it fades within a few frames.
        let scrollSpeed = 0;
        let scrolledAt = 0;
        const tick = () => {
          const fresh = performance.now() - scrolledAt < 120;
          scrollSpeed = fresh ? Math.abs(trigger?.getVelocity() ?? 0) : scrollSpeed * 0.8;
          handoff.setScrollSpeed(scrollSpeed);
          handoff.tick(clock());
        };
        gsap.ticker.add(tick);

        const passages: Passage[] = [
          ...story.querySelectorAll<HTMLElement>("[data-bio-passage]"),
        ].map((element) => {
          const copy = element.querySelector<HTMLElement>("[data-bio-copy]")!;
          const terms = new Set((element.dataset.emphasis ?? "").split(" ").filter(Boolean));
          const sweep = element.dataset.sweep ?? null;
          const index = () => {
            const words = [...copy.querySelectorAll<HTMLElement>(".bio-word")];
            copy.style.setProperty("--count", String(words.length));
            words.forEach((word, i) => {
              word.style.setProperty("--i", String(i));
              const bare = (word.textContent ?? "").replace(/[.,;:!?’']+$/u, "");
              if (terms.has(bare)) word.dataset.term = "";
              if (bare === sweep) word.dataset.sweep = "";
            });
          };
          const splits = [...copy.querySelectorAll<HTMLElement>("p")].map((paragraph) =>
            SplitText.create(paragraph, {
              type: "lines,words",
              mask: "lines",
              linesClass: "bio-line",
              wordsClass: "bio-word",
              autoSplit: true,
              // A new width re-splits; the light's indices must follow the new words.
              onSplit: () => requestAnimationFrame(index),
            }),
          );
          index();
          const words = [...element.querySelectorAll<HTMLElement>("[data-title-word]")].map(
            (word) => ({
              element: word,
              signature: word.dataset.signature as TitleSignature | undefined,
            }),
          );
          return { element, copy, words, splits, sweep };
        });
        const linesOf = (passage: Passage) => passage.splits.flatMap((split) => split.lines);
        passages.forEach((passage) => {
          gsap.set(linesOf(passage), { yPercent: 105, opacity: 0 });
          for (const { element } of passage.words) {
            element.dataset.dust = "in";
            element.style.setProperty("--dust", "0");
          }
        });

        /** Without the rift on screen the words still fill and crumble, in place. */
        const fillInPlace = (passage: Passage, mode: "in" | "out", delay: number) => {
          passage.words.forEach(({ element }, i) => {
            element.dataset.dust = mode;
            const order = mode === "in" ? i : passage.words.length - 1 - i;
            gsap.fromTo(
              element,
              { "--dust": mode === "in" ? 0 : 1 },
              {
                "--dust": mode === "in" ? 1 : 0,
                duration: mode === "in" ? 0.7 : 0.3,
                delay: delay + order * 0.05,
                ease: mode === "in" ? "power2.out" : "power2.in",
                onComplete: () => {
                  if (mode === "in") delete element.dataset.dust;
                },
              },
            );
          });
        };

        const sweepWhenRead = (passage: Passage) => {
          if (!passage.sweep) return;
          const read = parseFloat(passage.copy.style.getPropertyValue("--read") || "0");
          const count = passage.copy.querySelectorAll(".bio-word").length;
          passage.copy.querySelectorAll<HTMLElement>(".bio-word[data-sweep]").forEach((word) => {
            if (word.dataset.swept !== undefined) return;
            const i = parseFloat(word.style.getPropertyValue("--i"));
            if ((read * (count + 7) - i) / 2.5 < 1) return;
            word.dataset.swept = "";
            word.dataset.sweeping = "";
            word.addEventListener("animationend", () => delete word.dataset.sweeping, {
              once: true,
            });
          });
        };

        const leave = (passage: Passage, direction: 1 | -1) => {
          delete passage.element.dataset.keep;
          handoff.cancel(passage);
          const [body, aside] = passage.splits;
          gsap.killTweensOf(linesOf(passage));
          gsap.killTweensOf(passage.words.map((word) => word.element));
          const out = { yPercent: -105 * direction, opacity: 0, duration: 0.42, ease: "power2.in" };
          gsap.to(aside?.lines ?? [], { ...out, stagger: 0.03 });
          gsap.to(body?.lines ?? [], { ...out, stagger: 0.03, delay: 0.05 });
          const hide = () => {
            if (passage.element.dataset.keep === undefined) delete passage.element.dataset.on;
          };
          const flew = handoff.crumble(passage, passage.words, {
            start: clock() + 0.1,
            direction,
            onDone: hide,
          });
          if (!flew) {
            fillInPlace(passage, "out", 0.1);
            gsap.delayedCall(0.9, hide);
          }
        };

        const arrive = (passage: Passage, direction: 1 | -1, delay: number) => {
          passage.element.dataset.keep = "";
          handoff.cancel(passage);
          const [body, aside] = passage.splits;
          const lines = linesOf(passage);
          gsap.killTweensOf(lines);
          gsap.killTweensOf(passage.words.map((word) => word.element));
          gsap.set(lines, { yPercent: 105 * direction, opacity: 0 });
          passage.copy.querySelectorAll<HTMLElement>("[data-swept]").forEach((word) => {
            delete word.dataset.swept;
            delete word.dataset.sweeping;
          });
          gsap.delayedCall(delay, () => {
            if (passage.element.dataset.keep !== undefined) passage.element.dataset.on = "";
            emitSoundEvent("statement:read");
          });
          const flew = handoff.form(passage, passage.words, { start: clock() + delay, direction });
          if (!flew) fillInPlace(passage, "in", delay);
          // The title first; the copy rises once the title can be read.
          const rise = { yPercent: 0, opacity: 1, ease: "expo.out" };
          gsap.to(body?.lines ?? [], {
            ...rise,
            duration: 0.95,
            stagger: 0.07,
            delay: delay + 1.0,
          });
          gsap.to(aside?.lines ?? [], {
            ...rise,
            duration: 0.9,
            stagger: 0.06,
            delay: delay + 1.18,
          });
          // Arriving with the passage already read (back up the page) still gets its light.
          gsap.delayedCall(delay + 1.7, () => sweepWhenRead(passage));
        };

        let active = -1;
        const show = (next: number, direction: 1 | -1) => {
          if (next === active) return;
          const previous = passages[active];
          active = next;
          if (previous) leave(previous, direction);
          const incoming = passages[next];
          if (incoming) arrive(incoming, direction, previous ? HANDOFF_DELAY : 0.05);
        };

        const sync = (direction: 1 | -1) => {
          const box = story.getBoundingClientRect();
          const viewport = window.innerHeight;
          const distance = Math.max(1, story.offsetHeight - viewport);
          const progress = -box.top / distance;
          // Only while the stage is pinned: a title that formed before it pinned
          // would ride up the page with the scroll, and one leaving after it
          // unpinned would be carried off before it had crumbled.
          const inScene = box.top <= viewport * PINNED && box.bottom >= viewport * (1 - PINNED);
          const index = !inScene ? -1 : progress < TURNS[0] ? 0 : progress < TURNS[1] ? 1 : 2;
          show(index, direction);
          const passage = passages[index];
          if (!passage) return;
          const bounds = [0, ...TURNS, 1];
          const from = bounds[index]!;
          const to = bounds[index + 1]!;
          const local = Math.min(1, Math.max(0, (progress - from) / (to - from)));
          const read = Math.min(1, Math.max(0, (local - READING.from) / READING.span));
          passage.copy.style.setProperty("--read", read.toFixed(4));
          sweepWhenRead(passage);
        };
        trigger = ScrollTrigger.create({
          trigger: story,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            scrolledAt = performance.now();
            sync(self.direction < 0 ? -1 : 1);
          },
          onRefresh: () => sync(1),
        });
        sync(1);

        return () => {
          trigger?.kill();
          gsap.ticker.remove(tick);
          handoff.destroy();
          passages.forEach((passage) => {
            gsap.killTweensOf(linesOf(passage));
            gsap.killTweensOf(passage.words.map((word) => word.element));
            passage.splits.forEach((split) => split.revert());
            passage.copy.style.removeProperty("--read");
            passage.copy.style.removeProperty("--count");
            delete passage.element.dataset.on;
            delete passage.element.dataset.keep;
            for (const { element } of passage.words) {
              delete element.dataset.dust;
              delete element.dataset.flash;
              element.style.removeProperty("--dust");
            }
          });
          delete story.dataset.motion;
        };
      });
    });
    return () => {
      disposed = true;
      media.revert();
    };
  }, []);
  return null;
}
