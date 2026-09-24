"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  getServerSoundState,
  getSoundState,
  readStoredPreference,
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
  /*
   * Off unless this session already chose otherwise. Read through the store so
   * the server render and the first client render agree, with the local choice
   * taking over the moment the visitor picks one.
   */
  const [soundChoice, setSoundChoice] = useState<boolean | null>(null);
  const exitTimer = useRef<number | null>(null);
  const sound = useSyncExternalStore(subscribeSoundState, getSoundState, getServerSoundState);
  const storedEntry = useSyncExternalStore(subscribeEntry, hasEntered, () => false);
  const storedSound = useSyncExternalStore(subscribeSoundState, readStoredPreference, () => false);
  const entered = storedEntry || forcedEntered;
  const soundWanted = soundChoice ?? storedSound;

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
              <button
                className={styles.enter}
                type="button"
                onClick={() => enter(soundWanted && !sound.unsupported)}
                disabled={leaving}
              >
                ENTER EXPERIENCE
              </button>

              <div className={styles.sound} role="group" aria-label="Sound">
                {sound.unsupported ? (
                  <span className={styles.soundNote}>SOUND UNAVAILABLE</span>
                ) : (
                  <>
                    <button
                      className={styles.soundChoice}
                      type="button"
                      aria-pressed={soundWanted}
                      onClick={() => setSoundChoice(true)}
                      disabled={leaving}
                    >
                      SOUND ON
                    </button>
                    <span className={styles.soundDivider} aria-hidden="true">
                      /
                    </span>
                    <button
                      className={styles.soundChoice}
                      type="button"
                      aria-pressed={!soundWanted}
                      onClick={() => setSoundChoice(false)}
                      disabled={leaving}
                    >
                      SOUND OFF
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
