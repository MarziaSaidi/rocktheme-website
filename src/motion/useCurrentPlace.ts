"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { SectionId } from "@/config/sections";

import { subscribeWorkStation, type WorkStation } from "./workChannel";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Where the visitor is, as the header shows it (docs/typography-motion-system.md,
 * Navigation): Work on the Work index and on a case study, About on the About
 * page, and the shown project's number on the index. Shared by the desktop
 * nav, the phone bar's label and the phone menu.
 */
export function useCurrentPlace(): Readonly<{
  current: SectionId | null;
  /** "01 / 02" while the Work index shows a project, otherwise null. */
  counter: string | null;
}> {
  const pathname = usePathname();
  const [station, setStation] = useState<WorkStation | null>(null);
  const onWork = pathname === "/" || pathname.startsWith("/work/");
  const onAbout = pathname === "/about";

  useEffect(() => subscribeWorkStation(setStation), []);

  const current: SectionId | null = onWork ? "selected-work" : onAbout ? "about" : null;
  const counter =
    pathname === "/" && station ? `${pad(station.station + 1)} / ${pad(station.count)}` : null;
  return { current, counter };
}
