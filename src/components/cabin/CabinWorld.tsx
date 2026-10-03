"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { sectionHref } from "@/config/sections";
import { STATIONS } from "@/cabin/stations";
import { bridgeZoom } from "@/cabin/worldCapture";
import { getHandoff, releaseHandoff } from "@/cabin/worldHandoff";
import type { MarziaTheme } from "@/cabin/scenery";
import type { CabinState, CabinWorld as World } from "@/cabin/world";

import { CabinStick } from "./CabinStick";
import styles from "./CabinWorld.module.css";

type Status = "loading" | "ready" | "failed" | "lost";

/** How long the how-to-move hint stays before only the × remains. */
const EXIT_HINT_MS = 7000;
/*
 * How this visit began, read once per mount: "rift:<time>" straight out of
 * the homepage's rift (its picture is still over the page, see
 * src/cabin/worldHandoff.ts), "capture" for the capture script (development
 * only), or "" for the front door. Cached so letting the picture go doesn't
 * change it mid-visit.
 */
let arrivalCache: string | null = null;

function readArrival(): string {
  if (arrivalCache !== null) return arrivalCache;
  arrivalCache = "";
  try {
    if (
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("capture") === "arrival"
    ) {
      arrivalCache = "capture";
      return arrivalCache;
    }
    const handoff = getHandoff();
    if (handoff && !handoff.leaving) arrivalCache = `rift:${handoff.at}`;
  } catch {
    // No storage: the front door.
  }
  return arrivalCache;
}

const noSubscription = () => () => {};

/**
 * The "know me better" cabin.
 *
 * Nothing on screen tells the visitor where to go. They explore like in a
 * game: the view follows the mouse (and keeps turning at the screen's
 * edges), W A S D, the arrow keys or scrolling walk, and a click walks to
 * whatever was clicked. A compass stick in the bottom-right walks and
 * turns too, on desktop and phones; otherwise the only control is the × to leave (or Esc).
 * Keyboard and screen-reader users get the places and MARZIA's theme as
 * buttons that appear only when focused.
 */
export function CabinWorld() {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [state, setState] = useState<CabinState>({ current: "arrival", travelling: false });
  const [theme, setTheme] = useState<MarziaTheme | null>(null);
  const [exitHint, setExitHint] = useState(true);
  // Bumped to rebuild the world after the browser drops its GPU context.
  const [attempt, setAttempt] = useState(0);
  const backHref = sectionHref("about");
  const currentWorld = useCallback(() => world.current, []);
  const arrival = useSyncExternalStore(noSubscription, readArrival, () => "");
  const handoffAt = arrival.startsWith("rift:") ? Number(arrival.slice(5)) : null;
  const capture = arrival === "capture";
  // The live world has drawn its first frame.
  const [live, setLive] = useState(false);

  // A later visit reads its own arrival afresh.
  useEffect(
    () => () => {
      arrivalCache = null;
    },
    [],
  );

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    setStatus("loading");
    let disposed = false;
    let mounted: World | null = null;

    // A fresh canvas for every mount. A canvas holds a single WebGL context,
    // so a reused one would be shared with the previous mount, and releasing
    // that mount's context would take the live one with it.
    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas!;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "A snowy clearing with a small log cabin and the word MARZIA standing in the snow. Move the mouse to look, click or use W A S D to walk.",
    );
    container.appendChild(canvas);

    import("@/cabin/world")
      .then(({ mountCabinWorld }) =>
        mountCabinWorld({
          canvas,
          onState: setState,
          onExit: () => router.push(backHref),
          onMarziaTheme: setTheme,
          onLost: () => {
            if (!disposed) setStatus("lost");
          },
          arrival:
            handoffAt !== null
              ? { kind: "rift", zoom: () => bridgeZoom(Date.now() - handoffAt) }
              : capture
                ? { kind: "capture" }
                : undefined,
          onFirstFrame: () => {
            if (disposed) return;
            setLive(true);
            // The live world shows the picture's view: the picture can go.
            releaseHandoff();
          },
        }),
      )
      .then((instance) => {
        if (disposed) {
          instance.dispose();
          return;
        }
        mounted = instance;
        world.current = instance;
        setStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("Cabin: could not start the 3D world", error);
        // Uncover the page, so the way back shows.
        releaseHandoff();
        if (!disposed) setStatus("failed");
      });

    return () => {
      disposed = true;
      mounted?.dispose();
      world.current = null;
      canvas.remove();
    };
  }, [router, backHref, attempt, handoffAt, capture]);

  // Once the world is up, the hint shows for a moment and then leaves only the ×.
  useEffect(() => {
    if (status !== "ready") return;
    const timer = window.setTimeout(() => setExitHint(false), EXIT_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  return (
    <section
      className={styles.stage}
      data-cabin-page=""
      data-status={status}
      data-live={live ? "true" : "false"}
      data-arrival={handoffAt !== null ? "rift" : capture ? "capture" : undefined}
      aria-label="Winter cabin"
    >
      <div ref={host} className={styles.host} />

      {/* The way in carries its own picture across; it never shows a loading line. */}
      {status === "loading" && handoffAt === null && !capture && (
        <p className={styles.notice}>Building the cabin…</p>
      )}
      {status === "lost" && (
        <div className={styles.notice} role="alert">
          <p>The 3D view was interrupted by the browser.</p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => setAttempt((count) => count + 1)}
          >
            Reload the cabin
          </button>
        </div>
      )}
      {status === "failed" && (
        <div className={styles.notice} role="alert">
          <p>This browser couldn’t start the 3D cabin.</p>
          <Link href={backHref}>Back to the site</Link>
        </div>
      )}

      <div className={styles.exit}>
        <span
          className={styles.exitHint}
          data-hidden={exitHint ? "false" : "true"}
          aria-hidden="true"
        >
          <span className={styles.desktopOnly}>
            Move the mouse to look · click, W A S D or the stick to walk ·{" "}
          </span>
          <span className={styles.touchOnly}>Drag to look · tap or the stick to walk · </span>
          Esc or × to leave
        </span>
        <Link href={backHref} className={styles.close} aria-label="Leave the cabin">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
      </div>

      {status === "ready" && (
        <>
          <CabinStick world={currentWorld} />
          {/* The mountain on the horizon is a CC BY photograph: its credit must be visible. */}
          <p className={styles.credit}>
            Mountain:{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Himalayas,_Ama_Dablam,_Nepal.jpg"
              target="_blank"
              rel="noreferrer"
            >
              Vyacheslav Argenberg
            </a>
            ,{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
          </p>
          <nav className={styles.places} aria-label="Places in the cabin world">
            {STATIONS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-current={entry.id === state.current ? "location" : undefined}
                onClick={() => world.current?.goTo(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </nav>

          {state.current === "marzia" && theme && (
            <div className={styles.theme} role="group" aria-label="MARZIA colour theme">
              {(["light", "dark"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={theme === option}
                  onClick={() => world.current?.setMarziaTheme(option)}
                >
                  {option === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
