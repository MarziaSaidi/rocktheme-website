"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { sectionHref } from "@/config/sections";
import { STATIONS } from "@/cabin/stations";
import type { MarziaTheme } from "@/cabin/scenery";
import type { CabinState, CabinWorld as World } from "@/cabin/world";

import { CabinStick } from "./CabinStick";
import styles from "./CabinWorld.module.css";

type Status = "loading" | "ready" | "failed" | "lost";

/** How long the how-to-move hint stays before only the × remains. */
const EXIT_HINT_MS = 7000;

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
        if (!disposed) setStatus("failed");
      });

    return () => {
      disposed = true;
      mounted?.dispose();
      world.current = null;
      canvas.remove();
    };
  }, [router, backHref, attempt]);

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
      aria-label="Winter cabin"
    >
      <div ref={host} className={styles.host} />

      {status === "loading" && <p className={styles.notice}>Building the cabin…</p>}
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
