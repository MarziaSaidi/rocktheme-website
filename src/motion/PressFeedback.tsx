"use client";

import { useEffect } from "react";

/**
 * Lets `:active` press states show on iOS.
 *
 * Safari on iPhone only applies `:active` to an element once some touchstart
 * listener exists above it. Links and buttons across the site compress a
 * little when pressed (docs/typography-motion-system.md, §4), and on a phone
 * that press is the main response, so one passive, empty listener on the
 * document turns it on everywhere.
 */
export function PressFeedback() {
  useEffect(() => {
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);
  return null;
}
