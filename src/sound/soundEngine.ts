import {
  BACKGROUND_TRACK,
  CUES,
  FADE_SECONDS,
  LAYER_GAIN,
  LIGHT_SCALE,
  MASTER_GAIN,
  MUSIC_GAIN,
  VOICE_LIMITS,
  type SoundLayer,
} from "./soundConfig";
import { subscribeSoundEvents, type SoundEvent, type SoundEventDetail } from "./soundEvents";

/**
 * Procedural sound engine.
 *
 * Owns the AudioContext, the bus graph, the looping music, and every scheduled
 * voice. It is the only place in the codebase that touches Web Audio.
 *
 * Interaction cues are synthesised from oscillators and a shared noise buffer.
 * The music is an HTML media element routed through the same master gain so
 * enabling, muting, and tab visibility affect the whole mix together.
 *
 * The graph:
 *
 *   music + voices → master gain → limiter → destination
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
  /** Disconnects every node, removes every listener, closes the context. */
  destroy: () => Promise<void>;
  /** Live counts, for verification. */
  stats: () => { voices: number; state: AudioContextState | "closed"; suppressed: number };
}>;

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 2);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  // Brown-ish noise: softer and lower than white, closer to air than hiss.
  let last = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[index] = last * 3.5;
  }

  return buffer;
}

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
  const noiseBuffer = createNoiseBuffer(context);

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

  const layers = {} as Record<SoundLayer, GainNode>;
  (Object.keys(LAYER_GAIN) as SoundLayer[]).forEach((layer) => {
    const node = context.createGain();
    node.gain.value = LAYER_GAIN[layer];
    node.connect(master);
    layers[layer] = node;
  });

  // ------------------------------------------------------- background music
  const music = new Audio(BACKGROUND_TRACK);
  music.loop = true;
  music.preload = "none";
  const musicSource = context.createMediaElementSource(music);
  const musicGain = context.createGain();
  musicGain.gain.value = MUSIC_GAIN;
  musicSource.connect(musicGain).connect(master);

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

  const track = (stop: () => void, duration: number) => {
    const voice: Voice = { stop, endsAt: context.currentTime + duration + 0.1 };
    voices.add(voice);
    window.setTimeout(() => voices.delete(voice), (duration + 0.2) * 1000);
  };

  /** Short envelope used by every cue. Attack, hold, exponential release. */
  const envelope = (gain: GainNode, peak: number, duration: number, attack = 0.012) => {
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  };

  const oscillatorVoice = (
    layer: SoundLayer,
    type: OscillatorType,
    from: number,
    to: number,
    peak: number,
    duration: number,
  ) => {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    if (to !== from) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration * 0.8);
    }

    const gain = context.createGain();
    envelope(gain, peak, duration);
    oscillator.connect(gain).connect(layers[layer]);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };

    track(() => oscillator.stop(), duration);
  };

  const noiseVoice = (
    layer: SoundLayer,
    filterType: BiquadFilterType,
    fromHz: number,
    toHz: number,
    peak: number,
    duration: number,
    q = 1,
  ) => {
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    // A random offset so repeated grains never sound identical.
    const offset = Math.random() * (noiseBuffer.duration - duration - 0.05);

    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(fromHz, now);
    if (toHz !== fromHz) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), now + duration * 0.85);
    }

    const gain = context.createGain();
    envelope(gain, peak, duration, 0.006);
    source.connect(filter).connect(gain).connect(layers[layer]);
    source.start(now, Math.max(0, offset));
    source.stop(now + duration + 0.05);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    track(() => source.stop(), duration);
  };

  // --------------------------------------------------------------- the cues
  const play = (event: SoundEvent, detail: SoundEventDetail) => {
    const now = context.currentTime;
    reap(now);

    const cooldown = VOICE_LIMITS.cooldownSeconds[event];
    const previous = lastFired.get(event) ?? -Infinity;

    // Two hard limits. Rapid pointer movement and rapid project navigation
    // both hit these rather than stacking voices.
    if (now - previous < cooldown || voices.size >= VOICE_LIMITS.maxConcurrent) {
      suppressed += 1;
      return;
    }

    lastFired.set(event, now);

    const cue = CUES[event];
    const intensity = Math.min(1, Math.max(0, detail.intensity ?? 1));
    const peak = cue.peak * (0.4 + intensity * 0.6);

    switch (event) {
      case "environment:start":
        // One soft swell as the world wakes. Not a stinger.
        oscillatorVoice("atmosphere", "sine", 110, 55, peak * 0.5, cue.duration);
        break;

      case "particles:contact":
        // A tiny granular tick. Short enough that repetition reads as texture.
        noiseVoice(
          "particles",
          "bandpass",
          2200 + Math.random() * 2600,
          1800,
          peak,
          cue.duration,
          6,
        );
        break;

      case "project:approach":
        // A filtered low sweep: the plane arriving, not a riser.
        noiseVoice("planes", "lowpass", 180, 900, peak * 0.7, cue.duration, 0.7);
        break;

      case "project:active": {
        // A muted mechanical lock, plus one sparse horizon-light tone so
        // consecutive projects form a chord rather than a repeated note.
        noiseVoice("planes", "bandpass", 420, 240, peak, cue.duration, 2.5);
        oscillatorVoice("planes", "sine", 96, 72, peak * 0.5, cue.duration * 0.8);

        const step = detail.step ?? 0;
        const pitch =
          LIGHT_SCALE[((step % LIGHT_SCALE.length) + LIGHT_SCALE.length) % LIGHT_SCALE.length]!;
        oscillatorVoice("lights", "sine", pitch, pitch, peak * 0.42, 1.8);
        break;
      }

      case "project:open":
        // Reverse suction, then silence. The filter closes rather than booms.
        noiseVoice("planes", "lowpass", 1600, 140, peak * 0.8, cue.duration, 0.6);
        break;

      case "water:ripple":
        // A soft low droplet. A pitch glide, never a splash sample.
        oscillatorVoice("water", "sine", 420, 170, peak, cue.duration);
        break;

      case "contact:hover":
        // The warmest sound in the experience: a sustained fifth.
        oscillatorVoice("contact", "sine", 196, 196, peak * 0.6, cue.duration);
        oscillatorVoice("contact", "sine", 294, 294, peak * 0.32, cue.duration * 0.9);
        break;

      case "contact:open":
        // One warm chord resolving. The invitation, answered.
        oscillatorVoice("contact", "sine", 130.81, 130.81, peak * 0.6, cue.duration);
        oscillatorVoice("contact", "sine", 196, 196, peak * 0.42, cue.duration * 0.95);
        oscillatorVoice("contact", "sine", 261.63, 261.63, peak * 0.3, cue.duration * 0.85);
        break;
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
      const playback = music.play().then(
        () => true,
        () => false,
      );

      await Promise.race([
        context.resume().catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 300)),
      ]);

      if (context.state !== "running") {
        music.pause();
        return false;
      }

      const playing = await Promise.race([
        playback,
        new Promise<false>((resolve) => window.setTimeout(() => resolve(false), 8000)),
      ]);

      if (!playing) {
        music.pause();
        return false;
      }

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
      music.pause();
      voices.forEach((voice) => voice.stop());
      voices.clear();
      await context.suspend();
    },

    suspend: async () => {
      if (destroyed || context.state !== "running") {
        return;
      }
      music.pause();
      await context.suspend();
    },

    resume: async () => {
      if (destroyed || !running || context.state !== "suspended") {
        return;
      }
      await context.resume();
      await music.play().catch(() => undefined);
    },

    destroy: async () => {
      if (destroyed) {
        return;
      }

      destroyed = true;
      running = false;
      unsubscribe?.();
      unsubscribe = null;
      music.pause();
      music.removeAttribute("src");
      music.load();
      voices.forEach((voice) => {
        try {
          voice.stop();
        } catch {
          // Already ended.
        }
      });
      voices.clear();
      lastFired.clear();

      (Object.keys(layers) as SoundLayer[]).forEach((layer) => layers[layer].disconnect());
      musicSource.disconnect();
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
    }),
  };
}
