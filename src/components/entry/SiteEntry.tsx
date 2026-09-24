"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  getServerSoundState,
  getSoundState,
  setSoundState,
  subscribeSoundState,
  writeStoredPreference,
} from "@/sound/soundStore";

import styles from "./SiteEntry.module.css";
import { IntroRock } from "./IntroRock";

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

export function SiteEntry({ children }: Readonly<{ children: React.ReactNode }>) {
  const [forcedEntered, setForcedEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const exitTimer = useRef<number | null>(null);
  const sound = useSyncExternalStore(subscribeSoundState, getSoundState, getServerSoundState);
  const storedEntry = useSyncExternalStore(subscribeEntry, hasEntered, () => false);
  const entered = storedEntry || forcedEntered;

  useEffect(() => {
    return () => {
      if (exitTimer.current !== null) {
        window.clearTimeout(exitTimer.current);
      }
    };
  }, []);

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

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    exitTimer.current = window.setTimeout(
      () => {
        rememberEntry();
        setForcedEntered(true);
      },
      reducedMotion ? 0 : 520,
    );
  };

  return (
    <>
      <div className={styles.site} aria-hidden={!entered} inert={!entered}>
        {children}
      </div>

      {!entered && (
        <section
          className={styles.gate}
          data-site-entry=""
          data-leaving={leaving ? "" : undefined}
          aria-label="Enter the portfolio"
        >
          <div className={styles.shade} aria-hidden="true" />
          <IntroRock />
          <div className={styles.inner}>
            <div className={styles.content}>
              <div className={styles.actions} role="group" aria-label="Choose your sound setting">
                <button
                  className={`${styles.button} ${styles.buttonSound}`}
                  type="button"
                  onClick={() => enter(true)}
                  disabled={sound.unsupported || leaving}
                >
                  {sound.unsupported ? "SOUND UNAVAILABLE" : "ENTER WITH SOUND"}
                </button>
                <button
                  className={`${styles.button} ${styles.buttonSilent}`}
                  type="button"
                  onClick={() => enter(false)}
                  disabled={leaving}
                >
                  ENTER WITHOUT SOUND
                </button>
              </div>
              <p className={styles.note}>Sound is optional.</p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
