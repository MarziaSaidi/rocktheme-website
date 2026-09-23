"use client";

import { useSyncExternalStore } from "react";

import styles from "./SoundToggle.module.css";
import {
  getServerSoundState,
  getSoundState,
  setSoundState,
  subscribeSoundState,
  writeStoredPreference,
} from "./soundStore";

/**
 * Sound on/off control.
 *
 * A real button with a real pressed state, an unambiguous text label, and a
 * waveform that only moves while sound is actually running. The waveform is
 * the visual equivalent the direction asks for: whenever the scene is making
 * sound, something on screen is visibly doing so.
 *
 * Pressing it is the user gesture the engine needs, which is why enabling
 * happens here and nowhere automatic.
 */
export function SoundToggle() {
  const state = useSyncExternalStore(subscribeSoundState, getSoundState, getServerSoundState);

  if (state.unsupported) {
    return null;
  }

  const toggle = () => {
    const next = !state.enabled;
    setSoundState({ enabled: next });
    writeStoredPreference(next);
  };

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-pressed={state.enabled}
      data-running={state.ready ? "" : undefined}
    >
      <span className={styles.label}>Sound {state.enabled ? "on" : "off"}</span>
      <span className={styles.waveform} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
