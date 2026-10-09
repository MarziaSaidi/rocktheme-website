"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { SectionId } from "@/config/sections";

import { subscribeHomeSection, type HomeSection } from "./sectionState";
import { subscribeWorkStation, type WorkStation } from "./workChannel";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Where the visitor is, as the header shows it (docs/typography-motion-system.md,
 * Navigation): the section the camera is in on the home page, Selected Work on
 * a case study, and the shown project's number while one is shown. Shared by
 * the desktop nav, the phone bar's label and the phone menu.
 */
export function useCurrentPlace(): Readonly<{
  current: SectionId | null;
  /** "01 / 02" while a project is shown on the home page, otherwise null. */
  counter: string | null;
}> {
  const pathname = usePathname();
  const [section, setSection] = useState<HomeSection>("hero");
  const [station, setStation] = useState<WorkStation | null>(null);
  const onCaseStudy = pathname.startsWith("/work/");
  const onHome = pathname === "/";

  useEffect(() => {
    if (!onHome) return;
    return subscribeHomeSection(setSection);
  }, [onHome]);

  useEffect(() => subscribeWorkStation(setStation), []);

  const current: SectionId | null = onCaseStudy ? "selected-work" : onHome ? section : null;
  const counter =
    onHome && current === "selected-work" && station
      ? `${pad(station.station + 1)} / ${pad(station.count)}`
      : null;
  return { current, counter };
}
