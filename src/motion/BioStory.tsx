"use client";

import { useEffect } from "react";

/** Reserve the approved scroll map immediately; fetch motion near its chapter. */
export function BioStory() {
  useEffect(() => {
    const story = document.querySelector<HTMLElement>("[data-bio-story]");
    if (!story) return;
    const motion = matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 520px)");
    let disposed = false;
    let requested = false;
    let cleanRuntime: (() => void) | undefined;
    const load = () => {
      if (requested || !motion.matches) return;
      requested = true;
      observer.disconnect();
      void import("./bioStoryRuntime")
        .then(({ mountBioStory }) => {
          if (!disposed) cleanRuntime = mountBioStory();
        })
        .catch(() => {
          // Keep the semantic static story if its optional motion chunk fails.
          if (!disposed) delete story.dataset.motion;
        });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: "300% 0px" },
    );
    const prepare = () => {
      if (disposed || requested) return;
      if (motion.matches) {
        story.dataset.motion = "pending";
        observer.observe(story);
      } else {
        observer.disconnect();
        delete story.dataset.motion;
      }
    };
    void document.fonts.ready.then(prepare);
    motion.addEventListener("change", prepare);
    return () => {
      disposed = true;
      observer.disconnect();
      motion.removeEventListener("change", prepare);
      cleanRuntime?.();
      delete story.dataset.motion;
    };
  }, []);
  return null;
}
