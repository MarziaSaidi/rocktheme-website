"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  getServerSoundState,
  getSoundState,
  setSoundState,
  subscribeSoundState,
  writeStoredPreference,
} from "@/sound/soundStore";

import { requestEntryArrival } from "@/webgl/entryChannel";

import styles from "./SiteEntry.module.css";
import { IntroDoorway, type IntroDoorwayHandle } from "./IntroDoorway";

const ENTRY_KEY = "marzia-saidi:entered";
const ENTRY_EVENT = "marzia-saidi:entry-change";

function hasEntered(): boolean {
  try {
    // Audible playback is blocked on reload by some browsers. Bring back the
    // choice so a fresh click can reliably start the remembered sound setting.
    return (
      window.sessionStorage.getItem(ENTRY_KEY) === "true" &&
      window.sessionStorage.getItem("marzia-saidi:sound") !== "on"
    );
  } catch {
    return false;
  }
}

function rememberEntry(): void {
  try {
    window.sessionStorage.setItem(ENTRY_KEY, "true");
  } catch {
    // A blocked storage API only means the intro returns on reload.
  }
  window.dispatchEvent(new Event(ENTRY_EVENT));
}

function subscribeEntry(listener: () => void): () => void {
  window.addEventListener(ENTRY_EVENT, listener);
  return () => window.removeEventListener(ENTRY_EVENT, listener);
}

/** How long the gate takes to open onto the hero once the camera has crossed. */
const REVEAL_MS = 380;

export function SiteEntry({ children }: Readonly<{ children: React.ReactNode }>) {
  const [forcedEntered, setForcedEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const gate = useRef<HTMLElement>(null);
  const doorway = useRef<IntroDoorwayHandle>(null);
  const revealTimer = useRef<number | null>(null);
  const sound = useSyncExternalStore(subscribeSoundState, getSoundState, getServerSoundState);
  const storedEntry = useSyncExternalStore(subscribeEntry, hasEntered, () => false);
  const entered = storedEntry || forcedEntered;

  /*
   * While the gate is up, scrolling belongs to it: it walks the camera round
   * the doorway. The page underneath must not move until a choice is made.
   */
  useEffect(() => {
    if (entered) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [entered]);

  useEffect(() => {
    return () => {
      if (revealTimer.current !== null) {
        window.clearTimeout(revealTimer.current);
      }
    };
  }, []);

  /*
   * The camera is through the doorway. The hero camera takes over the last
   * stretch of the journey while the gate opens onto it, then the gate goes.
   */
  const reveal = useCallback(() => {
    if (revealTimer.current !== null) return;
    gate.current?.setAttribute("data-revealing", "");
    requestEntryArrival();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    revealTimer.current = window.setTimeout(
      () => {
        rememberEntry();
        setForcedEntered(true);
      },
      reducedMotion ? 240 : REVEAL_MS,
    );
  }, []);

  /* Both choices are the same entrance; only the sound differs. */
  const enter = (withSound: boolean) => {
    if (leaving) {
      return;
    }

    // This update reaches SoundProvider synchronously, while the click still
    // counts as a user gesture for Web Audio and media playback.
    setSoundState({ enabled: withSound, ready: false });
    writeStoredPreference(withSound);
    window.dispatchEvent(new Event("marzia-saidi:sound-entry"));
    setLeaving(true);
    doorway.current?.enter();
  };

  return (
    <>
      <div className={styles.site} aria-hidden={!entered} inert={!entered}>
        {children}
      </div>

      {!entered && (
        <section
          ref={gate}
          className={styles.gate}
          data-site-entry=""
          data-leaving={leaving ? "" : undefined}
          aria-label="Enter the portfolio"
        >
          <IntroDoorway ref={doorway} surface={gate} onCrossed={reveal} />
          <div className={styles.choices}>
            <button
              className={styles.withSound}
              type="button"
              onClick={() => enter(true)}
              disabled={leaving || sound.unsupported}
              aria-describedby={sound.unsupported ? "entry-sound-note" : undefined}
            >
              ENTER WITH SOUND
            </button>
            <button
              className={styles.withoutSound}
              type="button"
              onClick={() => enter(false)}
              disabled={leaving}
            >
              ENTER WITHOUT SOUND
            </button>
            {sound.unsupported && (
              <span id="entry-sound-note" className={styles.visuallyHidden}>
                Sound is not available in this browser.
              </span>
            )}
          </div>
        </section>
      )}
    </>
  );
}
