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
 *   players ×2 → music gain ─┐
 *   cues       → cue gain  ──┴→ master gain → limiter → destination
 *
 * A limiter sits on the output so no combination of cues can spike, and every
 * voice disconnects itself when it finishes.
 */

type Voice = {
  stop: () => void;
  endsAt: number;
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
  /** Disconnects every node, removes every listener, closes the context. */
  destroy: () => Promise<void>;
  /** Live counts, for verification. */
  stats: () => {
    voices: number;
    state: AudioContextState | "closed";
    suppressed: number;
    samples: number;
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
  musicGain.connect(master);

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

  // --------------------------------------------------------------- the cues
  const play = (event: SoundEvent, detail: SoundEventDetail) => {
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
      if (destroyed || context.state !== "running") {
        return;
      }
      parked = players.map(({ element }) => element).filter((element) => !element.paused);
      pauseAll();
      await context.suspend();
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

      cueBus.disconnect();
      players.forEach(({ source, gain }) => {
        source.disconnect();
        gain.disconnect();
      });
      musicGain.disconnect();
      master.disconnect();
      limiter.disconnect();

      if (context.state !== "closed") {
        await context.close();
      }
    },

    stats: () => ({
      voices: voices.size,
      state: destroyed ? "closed" : context.state,
      suppressed,
      samples: samples.size,
    }),
  };
}
