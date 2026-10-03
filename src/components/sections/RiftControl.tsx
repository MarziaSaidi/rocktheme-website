"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { prefetchCabin, WORLD_CAPTURE } from "@/cabin/worldCapture";
import { beginHandoff, predecode } from "@/cabin/worldHandoff";
import {
  requestRiftCrossing,
  setRiftEngaged,
  setRiftHold,
  subscribeRiftMoments,
  subscribeRiftRect,
  type RiftRect,
} from "@/webgl/riftChannel";

import styles from "./RiftControl.module.css";

const MY_WORLD = "/my-world";
/** Holding this long goes through; letting go sooner lets it settle back. */
const HOLD_MS = 1400;
/** A touch that travels further than this is a scroll, not a hold. */
const TOUCH_SLOP = 10;
/** A touch only counts as a press once it has stayed put this long. */
const TOUCH_SETTLE_MS = 140;
/** If the scene never reaches the handoff, go anyway after this long. */
const CROSSING_BACKSTOP_MS = 4500;
/** The ring's circumference, for its stroke. */
const RING = 2 * Math.PI * 11;

type Phase = "idle" | "engaged" | "crossing";

/**
 * The way into /my-world: the rift beside the bio.
 *
 * The mountain, its opening and the world beyond are drawn by the scene;
 * this is the real button over the opening, following it on screen. On it
 * (hover, focus or a tap) the page says "Hold to move to the next world";
 * holding fills the ring and the scene answers (the stones close in, the
 * light grows); letting go lets it all settle back. A completed hold flies
 * the camera through. A touch that moves is a scroll and never holds.
 *
 * Once through, the page holds still; as the camera commits to the opening
 * the page's own text stays behind, and when the world beyond fills the
 * screen the same picture is laid over the page and /my-world takes over
 * underneath it (src/cabin/worldHandoff.ts).
 */
export function RiftControl() {
  const router = useRouter();
  const [rect, setRect] = useState<RiftRect | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ id: number; x: number; y: number; timer: number } | null>(null);
  const holding = useRef(false);
  const value = useRef(0);
  const frame = useRef(0);
  const last = useRef(0);
  const crossing = useRef(false);
  const warmed = useRef(false);

  useEffect(
    () =>
      subscribeRiftRect((next) => {
        setRect(next);
        // The rift left the screen (the visitor scrolled on): back to rest.
        if (next || crossing.current) return;
        holding.current = false;
        setPhase("idle");
        setRiftEngaged(false);
      }),
    [],
  );

  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    router.prefetch(MY_WORLD);
    void import("@/cabin/world");
    void predecode(WORLD_CAPTURE.src);
    prefetchCabin();
  }, [router]);

  const engage = useCallback(
    (on: boolean) => {
      if (crossing.current) return;
      setPhase(on ? "engaged" : "idle");
      setRiftEngaged(on);
      if (on) warm();
    },
    [warm],
  );

  const handOff = useCallback(() => {
    // The scene holds the world beyond on screen meanwhile, so waiting for
    // the picture to be decoded costs nothing visible.
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 1200));
    void Promise.race([predecode(WORLD_CAPTURE.src), timeout]).then(() => {
      beginHandoff(Date.now());
      router.push(MY_WORLD);
    });
  }, [router]);

  const goThrough = useCallback(() => {
    if (crossing.current) return;
    crossing.current = true;
    setPhase("crossing");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.dataset.riftLeave = "";
      handOff();
      return;
    }
    requestRiftCrossing();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      stop();
      document.documentElement.dataset.riftLeave = "";
      handOff();
    };
    const stop = subscribeRiftMoments((moment) => {
      // The camera has committed to the opening: the page's own text stays behind.
      if (moment === "leave") document.documentElement.dataset.riftLeave = "";
      if (moment === "handoff") finish();
    });
    window.setTimeout(finish, CROSSING_BACKSTOP_MS);
  }, [handOff]);

  /*
   * The hold, run on its own clock: it fills while held and drains when let
   * go, so a release mid-way settles back rather than snapping.
   */
  const run = useCallback(() => {
    cancelAnimationFrame(frame.current);
    last.current = performance.now();
    const tick = (now: number) => {
      const delta = now - last.current;
      last.current = now;
      const next = holding.current
        ? Math.min(1, value.current + delta / HOLD_MS)
        : Math.max(0, value.current - delta / (HOLD_MS * 0.45));
      value.current = next;
      setProgress(next);
      setRiftHold(next);
      if (next >= 1 && holding.current) {
        holding.current = false;
        goThrough();
        return;
      }
      if (holding.current || next > 0) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [goThrough]);

  const startHold = useCallback(() => {
    if (crossing.current) return;
    engage(true);
    holding.current = true;
    run();
  }, [engage, run]);

  const stopHold = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    run();
  }, [run]);

  // Once through, the page holds still until /my-world has it.
  useEffect(() => {
    if (phase !== "crossing") return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    const block = (event: Event) => event.preventDefault();
    const keys = new Set([" ", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);
    const blockKeys = (event: KeyboardEvent) => {
      if (keys.has(event.key)) event.preventDefault();
    };
    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    window.addEventListener("keydown", blockKeys);
    return () => {
      root.style.overflow = previous;
      delete root.dataset.riftLeave;
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
      window.removeEventListener("keydown", blockKeys);
    };
  }, [phase]);

  // A touch anywhere else lets go of an engaged rift.
  useEffect(() => {
    if (phase !== "engaged") return;
    const away = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      if (button.current?.contains(event.target as Node)) return;
      engage(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [phase, engage]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      setRiftEngaged(false);
      setRiftHold(0);
    },
    [],
  );

  const engaged = phase === "engaged";

  return (
    <>
      {rect && phase !== "crossing" && (
        <button
          ref={button}
          type="button"
          className={styles.rift}
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
          aria-label="Hold to move to the next world: my world, beyond the rift"
          aria-describedby="rift-hint"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") engage(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "mouse") return;
            stopHold();
            engage(false);
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            if (event.pointerType === "mouse") {
              event.currentTarget.setPointerCapture(event.pointerId);
              startHold();
              return;
            }
            // A finger that stays put is a press; one that moves is a scroll.
            const timer = window.setTimeout(startHold, TOUCH_SETTLE_MS);
            touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY, timer };
          }}
          onPointerMove={(event) => {
            const start = touch.current;
            if (!start || start.id !== event.pointerId) return;
            if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TOUCH_SLOP) {
              window.clearTimeout(start.timer);
              touch.current = null;
              stopHold();
            }
          }}
          onPointerUp={() => {
            const start = touch.current;
            touch.current = null;
            stopHold();
            // A quick tap, too short to have become a press: it shows the cue.
            if (start) {
              window.clearTimeout(start.timer);
              engage(true);
            }
          }}
          onPointerCancel={() => {
            // The browser took the touch for a scroll.
            if (touch.current) window.clearTimeout(touch.current.timer);
            touch.current = null;
            stopHold();
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) engage(true);
          }}
          onBlur={() => {
            stopHold();
            engage(false);
          }}
          onKeyDown={(event) => {
            if ((event.key === " " || event.key === "Enter") && !event.repeat) {
              event.preventDefault();
              startHold();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === " " || event.key === "Enter") stopHold();
          }}
          onClick={(event) => event.preventDefault()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className={styles.cue} aria-hidden="true">
            <span className={styles.words}>Hold to move to the next world</span>
            <span className={styles.device}>
              <span className={styles.rule} />
              <svg className={styles.ring} viewBox="0 0 28 28">
                <circle className={styles.track} cx="14" cy="14" r="11" />
                <circle
                  className={styles.fill}
                  cx="14"
                  cy="14"
                  r="11"
                  style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - progress) }}
                />
                <circle className={styles.dot} cx="14" cy="14" r="2.4" />
              </svg>
              <span className={styles.rule} />
            </span>
          </span>
        </button>
      )}
      <span id="rift-hint" className={styles.hint}>
        Press and hold
      </span>
    </>
  );
}
