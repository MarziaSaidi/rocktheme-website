"use client";

import { useEffect } from "react";

import { sectionAnchors } from "@/config/sections";
import { stableViewportHeight } from "@/config/viewport";
import { bioRestScroll } from "@/webgl/riftChannel";

/**
 * Arriving at #about by a link (leaving /my-world, the nav's About) lands in
 * front of the cracked mountain: the bio's sentence centred, the rift beside
 * it, where the camera rests. Instant, as the gallery's arrival is: the hash's
 * own smooth scroll starts while the scene is still mounting, flies through
 * Selected Work, and stops at the top of the section before the camera has
 * turned to the mountain.
 */
export function AboutArrival() {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (location.hash !== `#${sectionAnchors.about}`) return;
      const about = document.getElementById(sectionAnchors.about);
      if (!about) return;
      window.scrollTo({ top: bioRestScroll(about, stableViewportHeight()), behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}
