"use client";

import { useEffect } from "react";

import { createSoundEngine, type SoundEngine } from "./soundEngine";
import { emitSoundEvent } from "./soundEvents";
import {
  getSoundState,
  readStoredPreference,
  setSoundState,
  subscribeSoundState,
} from "./soundStore";

/**
 * Sound host.
 *
 * Owns the engine's whole life. Nothing else in the application constructs an
 * AudioContext, and no component decides when audio may play.
 *
 * Four rules are enforced here rather than trusted to callers:
 *
 * 1. Nothing is audible until the visitor switches sound on. The engine is not
 *    created before that, and the context starts silent regardless.
 * 2. The choice is remembered for the session. On a later page load the
 *    control is restored to "on", but a page load is not a user gesture, so if
 *    the browser refuses to resume the engine waits for the visitor's next
 *    interaction and resumes then. Silence in between.
 * 3. A hidden tab suspends the context.
 * 4. Unmounting disposes every node, listener and the context itself.
 *
 * Exactly one engine exists at a time. `pending` is what guarantees it: two
 * overlapping calls to `sync` would otherwise each build one, and the second
 * would hold the slot while the first waited for a gesture that could never
 * reach it.
 */
export function SoundProvider() {
  useEffect(() => {
    let engine: SoundEngine | null = null;
    /** An engine mid-start. Cleanup must be able to reach it too. */
    let inFlight: SoundEngine | null = null;
    let pending = false;
    let disarm: (() => void) | null = null;
    let disposed = false;

    const armForGesture = () => {
      if (disarm || disposed) {
        return;
      }

      const retry = () => {
        disarm?.();
        void sync();
      };

      window.addEventListener("pointerdown", retry, { once: true });
      window.addEventListener("keydown", retry, { once: true });

      disarm = () => {
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("keydown", retry);
        disarm = null;
      };
    };

    async function sync(): Promise<void> {
      if (disposed || pending) {
        return;
      }

      const { enabled } = getSoundState();

      if (enabled && !engine) {
        pending = true;
        const created = createSoundEngine();

        if (!created) {
          pending = false;
          setSoundState({ enabled: false, unsupported: true });
          return;
        }

        inFlight = created;
        const started = await created.start();
        inFlight = null;

        if (disposed) {
          pending = false;
          await created.destroy();
          return;
        }

        if (!started) {
          // Autoplay policy refused the resume. Drop it and wait for a
          // gesture; the slot must be left empty so the retry can fill it.
          pending = false;
          await created.destroy();
          armForGesture();
          return;
        }

        engine = created;
        pending = false;
        setSoundState({ ready: true });
        emitSoundEvent("environment:start");
        return;
      }

      if (!enabled) {
        disarm?.();

        if (engine) {
          const closing = engine;
          engine = null;
          setSoundState({ ready: false });
          await closing.stop();
          await closing.destroy();
        }
      }
    }

    const handleVisibility = () => {
      if (!engine) {
        return;
      }

      if (document.hidden) {
        void engine.suspend();
      } else {
        void engine.resume();
      }
    };

    const unsubscribe = subscribeSoundState(() => void sync());
    document.addEventListener("visibilitychange", handleVisibility);

    // Restore the remembered choice, then run the same path a press would.
    if (readStoredPreference()) {
      setSoundState({ enabled: true });
    }

    void sync();

    return () => {
      disposed = true;
      disarm?.();
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      void engine?.destroy();
      void inFlight?.destroy();
      engine = null;
      inFlight = null;
      setSoundState({ enabled: false, ready: false });
    };
  }, []);

  return null;
}
