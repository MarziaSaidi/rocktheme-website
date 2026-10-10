"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { emitSoundEvent } from "@/sound/soundEvents";
import { createBioHandoff, type HandoffWord } from "./bioHandoff";

const TURNS = [0.3, 0.62] as const;
const PINNED = 0.02;
type Passage = {
  element: HTMLElement;
  copy: HTMLElement;
  title: HTMLElement;
  words: HandoffWord[];
  hide: gsap.core.Tween | null;
};

/** Scroll chooses the thought; elapsed time owns recognition and falling matter. */
export function BioStory() {
  useEffect(() => {
    const story = document.querySelector<HTMLElement>("[data-bio-story]");
    if (!story) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    let disposed = false;
    void document.fonts.ready.then(() => {
      if (disposed) return;
      // Short viewports use normal document flow, with every paragraph visible.
      media.add("(prefers-reduced-motion: no-preference) and (min-height: 700px)", () => {
        story.dataset.motion = "ready";
        const handoff = createBioHandoff();
        const clock = () => performance.now() / 1000;
        const tick = () => handoff.tick(clock());
        gsap.ticker.add(tick);
        const passages: Passage[] = [
          ...story.querySelectorAll<HTMLElement>("[data-bio-passage]"),
        ].map((element) => ({
          element,
          copy: element.querySelector<HTMLElement>("[data-bio-copy]")!,
          title: element.querySelector<HTMLElement>("h2,h3")!,
          words: [...element.querySelectorAll<HTMLElement>("[data-title-word]")].map((element) => ({
            element,
          })),
          hide: null,
        }));
        let active = -1;
        passages.forEach((passage) => passage.element.setAttribute("aria-hidden", "true"));
        let lastChange = -Infinity;
        let revision = 0;
        const show = (next: number) => {
          if (next === active) return;
          const now = clock();
          const rapid = now - lastChange < 0.45;
          lastChange = now;
          const previous = passages[active];
          const incoming = passages[next];
          const turn = ++revision;
          active = next;
          if (previous) {
            delete previous.element.dataset.active;
            previous.element.setAttribute("aria-hidden", "true");
            previous.hide?.kill();
            handoff.cancel(previous);
            gsap.killTweensOf([
              previous.title,
              previous.copy,
              ...previous.words.map((w) => w.element),
            ]);
            gsap.to(previous.copy, { opacity: 0, y: -4, duration: 0.18, ease: "power1.in" });
            const hide = () => {
              if (active !== passages.indexOf(previous)) delete previous.element.dataset.on;
            };
            // Keep glyph release and the existing world-space water simulation intact.
            // Overlapping transitions fade the old title promptly; world grains finish independently.
            const falling =
              !rapid &&
              handoff.crumble(previous, previous.words, { start: now, direction: 1, onDone: hide });
            gsap.to(previous.title, {
              opacity: 0,
              duration: rapid ? 0.12 : 0.24,
              ease: "power1.in",
            });
            if (!falling) previous.hide = gsap.delayedCall(0.24, hide);
          }
          if (!incoming) return;
          incoming.hide?.kill();
          handoff.cancel(incoming);
          gsap.killTweensOf([
            incoming.title,
            incoming.copy,
            ...incoming.words.map((w) => w.element),
          ]);
          incoming.words.forEach(({ element }) => {
            delete element.dataset.dust;
            element.style.setProperty("--dust", "1");
          });
          incoming.element.dataset.on = "";
          incoming.element.dataset.active = "";
          incoming.element.removeAttribute("aria-hidden");
          gsap.set(incoming.title, { opacity: 0, y: 0 });
          gsap.set(incoming.copy, { opacity: 0, y: 4 });
          if (!rapid) handoff.form(incoming, incoming.words, { start: now, direction: 1 });
          // The entire passage is readable within 300ms; there is no per-word reading gate.
          gsap.to(incoming.title, {
            opacity: 1,
            duration: rapid ? 0.12 : 0.24,
            delay: rapid ? 0 : 0.06,
            ease: "power1.out",
          });
          gsap.to(incoming.copy, {
            opacity: 1,
            y: 0,
            duration: rapid ? 0.12 : 0.24,
            delay: rapid ? 0 : 0.06,
            ease: "power1.out",
            onComplete: () => {
              if (turn === revision) emitSoundEvent("statement:read");
            },
          });
        };
        const sync = () => {
          const box = story.getBoundingClientRect();
          const viewport = window.innerHeight;
          const progress = -box.top / Math.max(1, story.offsetHeight - viewport);
          const pinned = box.top <= viewport * PINNED && box.bottom >= viewport * (1 - PINNED);
          show(!pinned ? -1 : progress < TURNS[0] ? 0 : progress < TURNS[1] ? 1 : 2);
        };
        const trigger = ScrollTrigger.create({
          trigger: story,
          start: "top bottom",
          end: "bottom top",
          onUpdate: sync,
          onRefresh: sync,
        });
        sync();
        return () => {
          trigger.kill();
          gsap.ticker.remove(tick);
          handoff.destroy();
          passages.forEach((passage) => {
            passage.hide?.kill();
            gsap.killTweensOf([
              passage.title,
              passage.copy,
              ...passage.words.map((w) => w.element),
            ]);
            gsap.set([passage.title, passage.copy], { clearProps: "opacity,transform" });
            delete passage.element.dataset.on;
            delete passage.element.dataset.active;
            passage.element.removeAttribute("aria-hidden");
            passage.words.forEach(({ element }) => {
              delete element.dataset.dust;
              element.style.removeProperty("--dust");
            });
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
