"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { getHandoff, releaseHandoff, subscribeHandoff } from "@/cabin/worldHandoff";

import { WorldBridge } from "./WorldBridge";
import styles from "./WorldHandoff.module.css";

/** If /my-world never opens, the picture lets go of the page after this long. */
const STRANDED_MS = 6000;

/**
 * The picture that carries the visitor from the homepage into /my-world.
 * Lives in the root layout so the same element stays on screen across the
 * route change (see src/cabin/worldHandoff.ts).
 */
export function WorldHandoff() {
  const handoff = useSyncExternalStore(subscribeHandoff, getHandoff, () => null);
  const pathname = usePathname();

  // A route change that never happened must not leave the page covered.
  useEffect(() => {
    if (!handoff || handoff.leaving || pathname === "/my-world") return;
    const timer = window.setTimeout(releaseHandoff, STRANDED_MS);
    return () => window.clearTimeout(timer);
  }, [handoff, pathname]);

  if (!handoff) return null;
  return (
    <div className={styles.handoff}>
      <WorldBridge handoffAt={handoff.at} frozen={handoff.leaving} leaving={handoff.leaving} />
    </div>
  );
}
