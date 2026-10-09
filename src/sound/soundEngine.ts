import { createThunderSelector, thunderDistance, THUNDER, THUNDER_SAMPLES } from "./thunder";
import { getSoundState } from "./soundStore";
import { thunderAudit } from "./thunderAudit";
import {
  BACKGROUND_TRACK,
  CUE_GAIN,
  CUES,
  FADE_SECONDS,
  MASTER_GAIN,
  MUSIC_CROSSFADE_SECONDS,
  MUSIC_DUCK,
  MUSIC_GAIN,
  READOUT_RATES,
  SAMPLES,
  TRANSITION_PEAK,
  VOICE_LIMITS,
  type SampleName,
} from "./soundConfig";
import { subscribeSoundEvents, type SoundEvent, type SoundEventDetail } from "./soundEvents";

/**
 * Sound engine.
 *
 * Owns the AudioContext, the bus graph, the looping music, and every playing
 * cue. It is the only place in the codebase that touches Web Audio.
 *
 * Cues are short samples, fetched and decoded once the visitor has switched
 * sound on. The music is two alternating HTML media elements, crossfaded at
 * the seam, routed through the same master gain so enabling, muting, and tab
 * visibility affect the whole mix together.
 *
 * The graph:
 *
 *   players ×2 → music gain → weather music duck ─┐
 *   cues       → cue gain  ──┤
 *   thunder    → thunder bus ┴→ master gain → limiter → destination
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
  limiter.threshold.value = -12;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(context.destination);

  const master = context.createGain();
  // Silent until start(). Nothing is audible before the visitor asks for it.
  master.gain.value = 0;
  master.connect(limiter);

  const cueBus = context.createGain();
  cueBus.gain.value = CUE_GAIN;
  cueBus.connect(master);

  // ------------------------------------------------------- background music
  /*
   * Two players take turns. A media element set to loop leaves a short gap at
   * the seam, where the browser seeks back through the MP3's encoder padding,
   * and a steady pad makes that gap audible. Instead, shortly before one
   * player ends, the other starts from the top and the two crossfade.
   */
  const musicGain = context.createGain();
  musicGain.gain.value = MUSIC_GAIN;
  // Separate weather-only stage: reading/transition automation and interaction cues stay independent.
  const weatherMusicGain = context.createGain();
  weatherMusicGain.gain.value = 1;
  musicGain.connect(weatherMusicGain).connect(master);
  let thunderDuckUntil = 0;

  const resetThunderMusic = () => {
    thunderDuckUntil = 0;
    const now = context.currentTime;
    weatherMusicGain.gain.cancelAndHoldAtTime(now);
    weatherMusicGain.gain.linearRampToValueAtTime(1, now + 0.2);
    thunderAudit("music:thunder-reset", { restoreAt: now + 0.2 });
  };

  const duckMusicForThunder = (start: number, duration: number) => {
    const now = context.currentTime;
    const duck = THUNDER.musicDuck;
    const depth = 10 ** (-duck.depthDb / 20);
    const body = Math.min(duck.maxBody, Math.max(8, duration * duck.bodyFraction));
    thunderDuckUntil = Math.max(thunderDuckUntil, start + body);
    // Schedule on the actual source start, including its existing distance delay.
    // Overlapping tails extend one envelope rather than multiplying duck depths.
    const level = weatherMusicGain.gain.value;
    weatherMusicGain.gain.cancelAndHoldAtTime(now);
    weatherMusicGain.gain.setValueAtTime(level, start);
    weatherMusicGain.gain.linearRampToValueAtTime(depth, start + duck.attack);
    weatherMusicGain.gain.setValueAtTime(depth, thunderDuckUntil);
    weatherMusicGain.gain.linearRampToValueAtTime(1, thunderDuckUntil + duck.recover);
    thunderAudit("music:thunder-duck", {
      start,
      depth,
      depthDb: duck.depthDb,
      holdUntil: thunderDuckUntil,
      restoreAt: thunderDuckUntil + duck.recover,
    });
  };

  const players = [0, 1].map(() => {
    const element = new Audio(BACKGROUND_TRACK);
    element.preload = "none";
    const source = context.createMediaElementSource(element);
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(musicGain);
    return { element, source, gain };
  });
  let current = 0;
  let seamWatch: number | null = null;
  /** Players that were sounding when the tab was hidden. */
  let parked: HTMLAudioElement[] = [];

  const FADE_IN = Float32Array.from({ length: 64 }, (_, i) => Math.sin((i / 63) * (Math.PI / 2)));
  const FADE_OUT = Float32Array.from(FADE_IN).reverse();

  const fadePlayer = (gain: GainNode, curve: Float32Array, seconds: number) => {
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueCurveAtTime(curve, now, seconds);
  };

  const watchSeam = () => {
    const outgoing = players[current]!;
    const { duration, currentTime, paused } = outgoing.element;
    if (paused || !Number.isFinite(duration)) return;

    const left = duration - currentTime;
    if (left > MUSIC_CROSSFADE_SECONDS) return;

    current = 1 - current;
    const incoming = players[current]!;
    const span = Math.max(0.3, left - 0.05);
    incoming.element.currentTime = 0;
    void incoming.element.play().catch(() => undefined);
    fadePlayer(incoming.gain, FADE_IN, span);
    fadePlayer(outgoing.gain, FADE_OUT, span);
  };

  const pauseAll = () => players.forEach(({ element }) => element.pause());

  let reading = false;
  const musicLevel = () => MUSIC_GAIN * (reading ? MUSIC_DUCK.reading : 1);

  /** Glide the music to its resting level, from wherever it is now. */
  const settleMusic = (seconds: number) => {
    const now = context.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(musicLevel(), now + seconds);
  };

  /** Dip the music so a transition's bloom lands, then bring it back. */
  const duckFor = (bloomIn: number) => {
    const { depth, fall, recover } = MUSIC_DUCK.transition;
    const now = context.currentTime;
    const bloom = now + Math.max(fall, bloomIn);
    const level = musicLevel();
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, bloom - fall);
    musicGain.gain.linearRampToValueAtTime(level * depth, bloom);
    musicGain.gain.linearRampToValueAtTime(level, bloom + recover);
  };

  // ---------------------------------------------------------------- samples
  const samples = new Map<SampleName, AudioBuffer>();
  const loading = new AbortController();

  // Fetched only now: the engine exists only after the visitor chose sound.
  (Object.keys(SAMPLES) as SampleName[]).forEach((name) => {
    fetch(SAMPLES[name], { signal: loading.signal })
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((decoded) => samples.set(name, decoded))
      .catch(() => {
        // A missing cue is silence, never an error the visitor sees.
      });
  });

  // ------------------------------------------------------------ voice pool
  const voices = new Set<Voice>();
  const lastFired = new Map<SoundEvent, number>();
  let suppressed = 0;

  const reap = (now: number) => {
    voices.forEach((voice) => {
      if (voice.endsAt <= now) {
        voices.delete(voice);
      }
    });
  };

  const sampleVoice = (buffer: AudioBuffer, peak: number, offset: number, rate: number) => {
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;

    const gain = context.createGain();
    // A few milliseconds of fade so entering part way through never clicks.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + (offset > 0 ? 0.06 : 0.004));
    source.connect(gain).connect(cueBus);
    source.start(now, offset);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };

    const duration = (buffer.duration - offset) / rate;
    const voice: Voice = { stop: () => source.stop(), endsAt: now + duration + 0.1 };
    voices.add(voice);
    window.setTimeout(() => voices.delete(voice), (duration + 0.2) * 1000);
  };

  // ------------------------------------------------------------- storm audio
  const thunderBus = context.createGain();
  thunderBus.gain.value = 1;
  thunderBus.connect(master);
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
    const target = 1 / Math.sqrt(Math.max(1, thunderVoices.size));
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
        if (thunderBuffers.has(index)) return;
        try {
          const response = await fetch(`/audio/effects/thunder/${name}.mp3`, { signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
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
    if (thunderBuffers.size < THUNDER_SAMPLES.length) void loadThunder();
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
        oldest.stop(1.2, "overlap-tail-release");
        audit("overlap:tail-release", { release: 1.2, protectedImpact: THUNDER.impactProtection });
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
    filter.Q.value = 0.65;
    const gain = context.createGain();
    const start = now + plan.delay;
    const duration = buffer.duration / plan.rate;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(plan.gain, start + 0.003);
    gain.gain.setValueAtTime(plan.gain, start + Math.max(0.04, duration - 0.7));
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(filter).connect(gain).connect(thunderBus);
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
      gain.disconnect();
      if (thunderVoices.size) balanceThunder();
    };
    thunderVoices.add(voice);
    balanceThunder(true);
    duckMusicForThunder(start, duration);
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
    const now = context.currentTime;
    reap(now);

    const cue = CUES[event];
    const buffer = samples.get(cue.sample);
    const cooldown = VOICE_LIMITS.cooldownSeconds[event];
    const previous = lastFired.get(event) ?? -Infinity;

    if (!buffer || now - previous < cooldown || voices.size >= VOICE_LIMITS.maxConcurrent) {
      suppressed += 1;
      return;
    }
    lastFired.set(event, now);

    const intensity = Math.min(1, Math.max(0, detail.intensity ?? 1));
    const peak = cue.peak * (0.4 + intensity * 0.6);
    const offset = "lead" in cue ? Math.max(0, TRANSITION_PEAK - cue.lead) : 0;
    const step = detail.step ?? 0;
    const rate =
      cue.sample === "readout"
        ? READOUT_RATES[
            ((step % READOUT_RATES.length) + READOUT_RATES.length) % READOUT_RATES.length
          ]!
        : 1;

    sampleVoice(buffer, peak, offset, rate);

    if ("duck" in cue && cue.duck) {
      duckFor(TRANSITION_PEAK - offset);
    }
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

      /*
       * Resuming inside a user gesture is what makes this legal and silent
       * until now. Outside one, Chromium leaves the promise pending forever
       * rather than rejecting, so it is raced against a short timeout. An
       * unbounded await here would stall the caller permanently.
       */
      // Both calls begin in the visitor's click handler. Browsers require a
      // gesture for media playback as well as for the AudioContext.
      const first = players[current]!;
      first.gain.gain.value = 1;
      const playback = first.element.play().then(
        () => true,
        () => false,
      );
      // Unlock the second player while the gesture still counts, so it may
      // start on its own at the seam. Its gain is zero; nothing is heard.
      const second = players[1 - current]!.element;
      second.preload = "auto";
      void second.play().then(
        () => second.pause(),
        () => undefined,
      );

      await Promise.race([
        context.resume().catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 300)),
      ]);

      if (context.state !== "running") {
        pauseAll();
        return false;
      }

      const playing = await Promise.race([
        playback,
        new Promise<false>((resolve) => window.setTimeout(() => resolve(false), 8000)),
      ]);

      if (!playing) {
        pauseAll();
        return false;
      }

      seamWatch = window.setInterval(watchSeam, 250);
      fadeMaster(MASTER_GAIN, FADE_SECONDS.in);
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
      unsubscribe?.();
      unsubscribe = null;
      fadeMaster(0, FADE_SECONDS.out);

      // Let the fade finish before the bed is torn down, so it never clicks.
      await new Promise((resolve) => window.setTimeout(resolve, FADE_SECONDS.out * 1000 + 60));
      if (seamWatch !== null) window.clearInterval(seamWatch);
      seamWatch = null;
      pauseAll();
      voices.forEach((voice) => voice.stop());
      voices.clear();
      await context.suspend();
    },

    suspend: async () => {
      cancelThunder("hidden");
      if (destroyed || context.state !== "running") {
        return;
      }
      parked = players.map(({ element }) => element).filter((element) => !element.paused);
      pauseAll();
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
      if (next === reading || destroyed) return;
      reading = next;
      settleMusic(next ? 1.2 : 2);
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
      await Promise.all(parked.map((element) => element.play().catch(() => undefined)));
      parked = [];
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
      loading.abort();
      unsubscribe?.();
      unsubscribe = null;
      if (seamWatch !== null) window.clearInterval(seamWatch);
      seamWatch = null;
      players.forEach(({ element }) => {
        element.pause();
        element.removeAttribute("src");
        element.load();
      });
      voices.forEach((voice) => {
        try {
          voice.stop();
        } catch {
          // Already ended.
        }
      });
      voices.clear();
      lastFired.clear();

      thunderBus.disconnect();
      cueBus.disconnect();
      players.forEach(({ source, gain }) => {
        source.disconnect();
        gain.disconnect();
      });
      weatherMusicGain.disconnect();
      musicGain.disconnect();
      master.disconnect();
      limiter.disconnect();

      if (context.state !== "closed") {
        await context.close();
      }
    },

    stats: () => ({
      voices: voices.size + thunderVoices.size,
      state: destroyed ? "closed" : context.state,
      suppressed,
      samples: samples.size,
      thunderVoices: thunderVoices.size,
      thunderSamples: thunderBuffers.size,
    }),
  };
}
