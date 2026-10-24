"use client";

import { useEffect } from "react";

import { publishJourneyView } from "./journeyChannel";

/** Hands the camera to this page's own scroll for as long as the page is shown. */
export function PageJourney() {
  useEffect(() => {
    publishJourneyView({ kind: "page" });
    return () => publishJourneyView(null);
  }, []);

  return null;
}
