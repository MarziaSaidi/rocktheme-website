"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import {
  setDoorwayHold,
  setDoorwayHover,
  subscribeDoorwayRect,
  type DoorwayRect,
} from "@/webgl/doorwayChannel";

import styles from "./SnowDoorwayControl.module.css";

/** Holding this long steps through; letting go sooner cancels. */
const HOLD_MS = 1400;
/** The doorway's daylight opening out to fill the screen. */
const OPEN_MS = 1000;
const CABIN = "/cabin";

/**
 * The way through the snow doorway in the water beside the bio.
 *
 * The doorway itself lives in the 3D scene; this is the real button laid over
 * its opening, following it as the camera moves. Hovering fades the winter
 * daylight in through the dark opening; holding fills, then the daylight
 * opens out from the arch and the cabin page takes over. Nothing about the cabin downloads until the
 * visitor shows interest.
 */
export function SnowDoorwayControl() {
  const router = useRouter();
  const [rect, setRect] = useState<DoorwayRect | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [progress, setProgress] = useState(0);
  const [opening, setOpening] = useState<{ x: number; y: number } | null>(null);
  const holdStart = useRef<number | null>(null);
  const frame = useRef(0);
  const warmed = useRef(false);

  useEffect(() => subscribeDoorwayRect(setRect), []);

  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    router.prefetch(CABIN);
    void import("@/cabin/world");
  }, [router]);

  const engage = (on: boolean) => {
    setEngaged(on);
    setDoorwayHover(on);
    if (on) warm();
  };

  const cancel = useCallback(() => {
    cancelAnimationFrame(frame.current);
    holdStart.current = null;
    setProgress(0);
    setDoorwayHold(0);
  }, []);

  const begin = useCallback(() => {
    if (holdStart.current !== null || opening) return;
    warm();
    holdStart.current = performance.now();
    const tick = (now: number) => {
      if (holdStart.current === null) return;
      const value = Math.min(1, (now - holdStart.current) / HOLD_MS);
      setProgress(value);
      setDoorwayHold(value);
      if (value < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      holdStart.current = null;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setOpening(
        rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : { x: 0, y: 0 },
      );
      window.setTimeout(() => router.push(CABIN), reduced ? 120 : OPEN_MS);
    };
    frame.current = requestAnimationFrame(tick);
  }, [opening, rect, router, warm]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      setDoorwayHover(false);
      setDoorwayHold(0);
    },
    [],
  );

  return (
    <>
      {rect && (
        <button
          type="button"
          className={styles.doorway}
          data-engaged={engaged ? "true" : "false"}
          style={
            {
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              "--progress": progress,
            } as CSSProperties
          }
          aria-label="Step through the doorway into the winter cabin"
          aria-describedby="snow-doorway-hint"
          onPointerEnter={() => engage(true)}
          onPointerLeave={() => {
            engage(false);
            cancel();
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            begin();
          }}
          onPointerUp={cancel}
          onPointerCancel={cancel}
          onFocus={() => engage(true)}
          onBlur={() => {
            engage(false);
            cancel();
          }}
          onKeyDown={(event) => {
            if ((event.key === " " || event.key === "Enter") && !event.repeat) {
              event.preventDefault();
              begin();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === " " || event.key === "Enter") cancel();
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className={styles.label} aria-hidden="true">
            <span className={styles.fill} />
            Hold to step through
          </span>
        </button>
      )}
      <span id="snow-doorway-hint" className={styles.hint}>
        Press and hold
      </span>

      {opening && (
        <div
          className={styles.daylight}
          style={
            { "--origin-x": `${opening.x}px`, "--origin-y": `${opening.y}px` } as CSSProperties
          }
          aria-hidden="true"
        />
      )}
    </>
  );
}
