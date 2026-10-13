import {
  createThunderSelector,
  thunderDistance,
  THUNDER,
  THUNDER_SAMPLES,
  THUNDER_DISABLED_SAMPLES,
} from "./thunder";
import { getSoundState } from "./soundStore";
import { thunderAudit } from "./thunderAudit";
import { FADE_SECONDS, MASTER_GAIN } from "./soundConfig";
import { createSceneAudio } from "./sceneAudio";
import { subscribeSoundEvents, type SoundEvent, type SoundEventDetail } from "./soundEvents";

/**
 * Sound engine.
 *
 * Owns the AudioContext, the bus graph, the looping music, and every playing
 * cue. Web Audio stays inside the sound boundary.
 *
 * Local recordings are decoded after the sound-on gesture. Background music
 * loops as a decoded buffer, while reading filters and interaction playback
 * live in sceneAudio. Weather retains its separate calibrated output.
 *
 * The graph:
 *
 *   music      → reading filters ─┐
 *   cues       → cue gain  ──┤
 *   thunder    → separate calibrated weather output → destination
 *
 * A limiter sits on the output so no combination of cues can spike, and every
 * voice disconnects itself when it finishes.
 */

type Voice = {
  stop: (release?: number, reason?: string) => void;
  endsAt: number;
  retiring?: boolean;
};

export type SoundEngine = Readonly<{
  /**
   * Fades the mix up. Resolves true only when the context actually reached
   * `running`; a browser may refuse to resume outside a user gesture, and the
   * caller needs to know so it can wait for one.
   */
  start: () => Promise<boolean>;
  /** Fades the mix down and parks the context. */
  stop: () => Promise<void>;
  /** Suspends while the tab is hidden, without tearing anything down. */
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
  /** Lowers the music while a case study is being read. */
  setReading: (reading: boolean) => void;
  /** Only the main portfolio may own weather voices. */
  setWeatherActive: (active: boolean) => void;
  /** Disconnects every node, removes every listener, closes the context. */
  destroy: () => Promise<void>;
  /** Live counts, for verification. */
  stats: () => {
    voices: number;
    state: AudioContextState | "closed";
    suppressed: number;
    samples: number;
    thunderVoices: number;
    thunderSamples: number;
  };
}>;

export function createSoundEngine(): SoundEngine | null {
  const AudioContextClass =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

  if (!AudioContextClass) {
    return null;
  }

  const context = new AudioContextClass();

  // ------------------------------------------------------------- bus graph
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = window.matchMedia("(pointer: coarse)").matches ? -3 : -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  const outputTrim = context.createGain();
  outputTrim.gain.value = 0.7;
  const makeup = context.createGain();
  makeup.gain.value = window.matchMedia("(pointer: coarse)").matches
    ? 10 ** ((-0.6 * (limiter.threshold.value - limiter.threshold.value / 20)) / 20)
    : 1;
  outputTrim.connect(limiter).connect(makeup).connect(context.destination);

  const master = context.createGain();
  // Silent until start(). Nothing is audible before the visitor asks for it.
  master.gain.value = 0;
  master.connect(outputTrim);

  const cueBus = context.createGain();
  cueBus.gain.value = 1;
  cueBus.connect(master);

  const sceneAudio = createSceneAudio(context, cueBus);
  const voices = sceneAudio.voices;
  let suppressed = 0;
  const weatherMusicGain = context.createGain();
  weatherMusicGain.gain.value = 1;
  weatherMusicGain.connect(master);
  const resetThunderMusic = () => {
    const now = context.currentTime;
    weatherMusicGain.gain.cancelAndHoldAtTime(now);
    weatherMusicGain.gain.linearRampToValueAtTime(1, now + 0.2);
    thunderAudit("music:thunder-reset", { restoreAt: now + 0.2 });
  };

  // ------------------------------------------------------------- storm audio
  const thunderBus = context.createGain();
  thunderBus.gain.value = 1;
  const thunderOutput = context.createGain();
  thunderOutput.gain.value = 0.7;
  const thunderLimiter = context.createDynamicsCompressor();
  thunderLimiter.threshold.value = window.matchMedia("(pointer: coarse)").matches ? -3 : -1;
  thunderLimiter.knee.value = 0;
  thunderLimiter.ratio.value = 20;
  thunderLimiter.attack.value = 0.003;
  thunderLimiter.release.value = 0.25;
  const thunderMakeup = context.createGain();
  thunderMakeup.gain.value = window.matchMedia("(pointer: coarse)").matches
    ? 10 ** ((-0.6 * (thunderLimiter.threshold.value - thunderLimiter.threshold.value / 20)) / 20)
    : 1;
  thunderBus
    .connect(thunderOutput)
    .connect(thunderLimiter)
    .connect(thunderMakeup)
    .connect(context.destination);
  const thunderBuffers = new Map<number, AudioBuffer>();
  const thunderVoices = new Set<Voice>();
  const seenStrikes = new Set<number>();
  const selectThunder = createThunderSelector();
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let weatherActive = false;
  let thunderLoading: AbortController | null = null;
  let thunderLoadTask: Promise<void> | null = null;

  const balanceThunder = (preserveAttack = false) => {
    if (destroyed || !running || !weatherActive || document.hidden || motionQuery.matches) return;
    const now = context.currentTime;
    thunderBus.gain.cancelAndHoldAtTime(now);
    const target = 1;
    if (preserveAttack && thunderVoices.size === 1) thunderBus.gain.setValueAtTime(target, now);
    else thunderBus.gain.linearRampToValueAtTime(target, now + 0.08);
  };
  const cancelThunder = (reason = "weather-stop") => {
    resetThunderMusic();
    thunderAudit("cancel:all", { reason, activeVoices: thunderVoices.size, state: context.state });
    thunderBus.gain.cancelAndHoldAtTime(context.currentTime);
    thunderBus.gain.linearRampToValueAtTime(0, context.currentTime + THUNDER.fadeOut);
    thunderVoices.forEach((voice) => voice.stop(THUNDER.fadeOut, reason));
    thunderVoices.clear();
  };
  const loadThunder = (): Promise<void> => {
    if (thunderLoadTask) return thunderLoadTask;
    if (destroyed || !weatherActive || motionQuery.matches || !running) return Promise.resolve();
    const controller = new AbortController();
    thunderLoading = controller;
    const signal = controller.signal;
    const task = Promise.all(
      THUNDER_SAMPLES.map(async (name, index) => {
        if (THUNDER_DISABLED_SAMPLES.includes(name) || thunderBuffers.has(index)) return;
        try {
          let response = await fetch(`/weather/thunder/${name}.opus`, { signal });
          let buffer: AudioBuffer;
          try {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            buffer = await context.decodeAudioData(await response.arrayBuffer());
          } catch {
            if (signal.aborted) return;
            response = await fetch(`/weather/thunder/${name}.webm`, { signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            buffer = await context.decodeAudioData(await response.arrayBuffer());
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (!signal.aborted && !destroyed && weatherActive && !motionQuery.matches) {
            thunderBuffers.set(index, buffer);
            thunderAudit("buffer:decoded", { index, kept: true, duration: buffer.duration });
          }
        } catch (error) {
          thunderAudit("buffer:failed", { index, aborted: signal.aborted, reason: String(error) });
        }
      }),
    )
      .then(() => undefined)
      .finally(() => {
        // An aborted old generation must never clear a newer route's load handle.
        if (thunderLoading === controller) {
          thunderLoading = null;
          thunderLoadTask = null;
        }
      });
    thunderLoadTask = task;
    return task;
  };
  const abortThunderLoad = () => {
    thunderLoading?.abort();
    thunderLoading = null;
    thunderLoadTask = null;
  };
  const handleMotion = () => {
    if (motionQuery.matches) {
      cancelThunder("reduced-motion");
      abortThunderLoad();
      thunderBuffers.clear();
    } else if (weatherActive) void loadThunder();
  };
  motionQuery.addEventListener("change", handleMotion);

  const playThunder = (detail: SoundEventDetail) => {
    const audit = (stage: string, extra: Record<string, unknown> = {}) =>
      thunderAudit(stage, {
        weatherEventId: detail.weatherEventId,
        firstVisibleAt: detail.firstVisibleAt,
        state: context.state,
        running,
        weatherActive,
        voices: voices.size + thunderVoices.size,
        interactionVoices: voices.size,
        thunderVoices: thunderVoices.size,
        buffers: thunderBuffers.size,
        ...extra,
      });
    audit("decision:received");
    const reason = destroyed
      ? "disposed"
      : !running || !getSoundState().enabled
        ? "muted"
        : !weatherActive || window.location.pathname !== "/"
          ? "not-main-page"
          : document.hidden
            ? "hidden"
            : motionQuery.matches
              ? "reduced-motion"
              : context.state !== "running"
                ? `context-${context.state}`
                : null;
    if (reason) {
      audit("decision:ineligible", { reason });
      return;
    }
    const eventId = detail.weatherEventId;
    if (eventId !== undefined && seenStrikes.has(eventId)) {
      audit("decision:duplicate", { reason: "already-scheduled" });
      return;
    }
    // Retry incomplete loads on the next real strike; use a ready recording now.
    // No late replay and no independent weather clock.
    if (thunderBuffers.size < THUNDER_SAMPLES.length - THUNDER_DISABLED_SAMPLES.length)
      void loadThunder();
    const plan = selectThunder(
      thunderDistance(detail.intensity ?? 0.8),
      detail.intensity ?? 0.8,
      detail.storm,
      [...thunderBuffers.keys()],
    );
    const buffer = plan && thunderBuffers.get(plan.index);
    if (!plan || !buffer) {
      suppressed++;
      audit("decision:unavailable", { reason: "no-decoded-recordings" });
      return;
    }
    const now = context.currentTime;
    thunderVoices.forEach((voice) => {
      if (voice.endsAt <= now) thunderVoices.delete(voice);
    });
    // Interaction voices have their own existing budget. They cannot discard a storm.
    // At capacity, release the oldest tail smoothly while preserving this new impact.
    if (thunderVoices.size >= THUNDER.maxConcurrent) {
      const oldest = [...thunderVoices].find((voice) => !voice.retiring);
      if (oldest) {
        oldest.retiring = true;
        oldest.stop(THUNDER.overflowFadeOut, "overlap-tail-release");
        audit("overlap:tail-release", {
          release: THUNDER.overflowFadeOut,
          protectedImpact: THUNDER.impactProtection,
        });
      }
    }
    if (eventId !== undefined) {
      seenStrikes.add(eventId);
      if (seenStrikes.size > 64) seenStrikes.delete(seenStrikes.values().next().value!);
    }
    const source = context.createBufferSource();
    audit("source:created", {
      index: plan.index,
      sample: THUNDER_SAMPLES[plan.index],
      delay: plan.delay,
    });
    source.buffer = buffer;
    source.playbackRate.value = plan.rate;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = plan.lowpass;
    filter.Q.value = 1;
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = plan.highpass;
    highpass.Q.value = 0.707;
    const gain = context.createGain();
    const start = now + plan.delay;
    const duration = buffer.duration / plan.rate;
    gain.gain.setValueAtTime(plan.gain, start);
    source.connect(filter).connect(highpass).connect(gain).connect(thunderBus);
    let cancelled = false;
    const voice: Voice = {
      endsAt: start + duration,
      stop: (release = THUNDER.fadeOut, cancellation = "weather-stop") => {
        cancelled = true;
        const time =
          cancellation === "overlap-tail-release"
            ? Math.max(context.currentTime, start + THUNDER.impactProtection)
            : context.currentTime;
        audit("source:cancelled", { reason: cancellation, release, releaseAt: time });
        gain.gain.cancelAndHoldAtTime(time);
        gain.gain.linearRampToValueAtTime(0, time + release);
        try {
          source.stop(time + release);
        } catch {
          /* Already ended. */
        }
      },
    };
    source.onended = () => {
      thunderVoices.delete(voice);
      audit("source:completed", { cancelled });
      source.disconnect();
      filter.disconnect();
      highpass.disconnect();
      gain.disconnect();
      if (thunderVoices.size) balanceThunder();
    };
    thunderVoices.add(voice);
    balanceThunder(true);
    source.start(start);
    audit("source:started", { index: plan.index, start, audioNow: context.currentTime, duration });
  };

  // --------------------------------------------------------------- the cues
  const play = (event: SoundEvent, detail: SoundEventDetail) => {
    if (event === "weather:stop") {
      cancelThunder();
      return;
    }
    if (event === "weather:lightning") {
      playThunder(detail);
      return;
    }
    sceneAudio.handle(event);
  };

  // ------------------------------------------------------------- lifecycle
  let unsubscribe: (() => void) | null = null;
  let running = false;
  let destroyed = false;

  const fadeMaster = (target: number, seconds: number) => {
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.linearRampToValueAtTime(target, now + seconds);
  };

  return {
    start: async () => {
      if (destroyed) {
        return false;
      }

      if (running) {
        return context.state === "running";
      }

      await Promise.race([
        context.resume().catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 300)),
      ]);
      if (context.state !== "running") return false;
      master.gain.setValueAtTime(MASTER_GAIN, context.currentTime);
      sceneAudio.start();
      unsubscribe = subscribeSoundEvents(play);
      running = true;
      return true;
    },

    stop: async () => {
      if (destroyed || !running) {
        return;
      }

      running = false;
      cancelThunder("muted");
      sceneAudio.stop();
      unsubscribe?.();
      unsubscribe = null;
      fadeMaster(0, FADE_SECONDS.out);

      // Let the fade finish before the bed is torn down, so it never clicks.
      await new Promise((resolve) => window.setTimeout(resolve, FADE_SECONDS.out * 1000 + 60));

      voices.forEach((voice) => voice.stop());
      voices.clear();
      await context.suspend();
    },

    suspend: async () => {
      cancelThunder("hidden");
      if (destroyed || context.state !== "running") {
        return;
      }
      sceneAudio.suspend();
      await context.suspend();
    },

    setWeatherActive: (active: boolean) => {
      if (destroyed || active === weatherActive) return;
      weatherActive = active;
      if (active) {
        if (!motionQuery.matches) loadThunder();
      } else {
        cancelThunder("navigation");
        abortThunderLoad();
        thunderBuffers.clear();
      }
    },

    setReading: (next: boolean) => {
      if (destroyed) return;
      sceneAudio.setReading(next);
    },

    resume: async () => {
      if (destroyed || !running || context.state !== "suspended") {
        return;
      }
      // Hidden-tab cancellation must not resume even the release tail.
      thunderBus.gain.cancelScheduledValues(context.currentTime);
      thunderBus.gain.setValueAtTime(0, context.currentTime);
      weatherMusicGain.gain.cancelScheduledValues(context.currentTime);
      weatherMusicGain.gain.setValueAtTime(1, context.currentTime);
      await context.resume();
      sceneAudio.resume();
    },

    destroy: async () => {
      if (destroyed) {
        return;
      }

      destroyed = true;
      running = false;
      cancelThunder("disposed");
      abortThunderLoad();
      thunderBuffers.clear();
      motionQuery.removeEventListener("change", handleMotion);
      sceneAudio.destroy();
      unsubscribe?.();
      unsubscribe = null;
      voices.forEach((voice) => {
        try {
          voice.stop();
        } catch {
          // Already ended.
        }
      });
      voices.clear();

      thunderBus.disconnect();
      thunderOutput.disconnect();
      thunderLimiter.disconnect();
      thunderMakeup.disconnect();
      cueBus.disconnect();
      weatherMusicGain.disconnect();
      master.disconnect();
      limiter.disconnect();
      outputTrim.disconnect();
      makeup.disconnect();

      if (context.state !== "closed") {
        await context.close();
      }
    },

    stats: () => ({
      voices: voices.size + thunderVoices.size,
      state: destroyed ? "closed" : context.state,
      suppressed,
      samples: sceneAudio.buffers.size,
      thunderVoices: thunderVoices.size,
      thunderSamples: thunderBuffers.size,
    }),
  };
}
