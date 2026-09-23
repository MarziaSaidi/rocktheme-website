import { PREFERENCE_KEY } from "./soundConfig";

/**
 * Sound preference store.
 *
 * A tiny external store rather than React context, so the control in the
 * header and the engine host elsewhere in the tree stay in step without
 * threading a provider through every component between them.
 *
 * The preference lives in `sessionStorage`: the direction asks for the choice
 * to be remembered during the session, not permanently. Storage access is
 * wrapped because it throws in private modes with site data blocked.
 */

export type SoundState = Readonly<{
  /** The visitor has asked for sound. */
  enabled: boolean;
  /** The engine exists and the context is running. */
  ready: boolean;
  /** No Web Audio in this browser. The control hides itself. */
  unsupported: boolean;
}>;

let state: SoundState = { enabled: false, ready: false, unsupported: false };
const serverState: SoundState = { enabled: false, ready: false, unsupported: false };
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getSoundState(): SoundState {
  return state;
}

/** Server render always reports the off state, which is the correct default. */
export function getServerSoundState(): SoundState {
  return serverState;
}

export function subscribeSoundState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSoundState(next: Partial<SoundState>): void {
  const merged = { ...state, ...next };

  if (
    merged.enabled === state.enabled &&
    merged.ready === state.ready &&
    merged.unsupported === state.unsupported
  ) {
    return;
  }

  state = merged;
  notify();
}

export function readStoredPreference(): boolean {
  try {
    return window.sessionStorage.getItem(PREFERENCE_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeStoredPreference(enabled: boolean): void {
  try {
    window.sessionStorage.setItem(PREFERENCE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable. The preference simply does not survive a reload.
  }
}
