import pack from "./scene-audio.json";
import type { SoundEvent } from "./soundEvents";

type Group = keyof typeof pack;
type Voice = { stop: (release?: number) => void; endsAt: number; group: Group };

export function shuffledCycle(size: number, random = Math.random) {
  let bag: number[] = [],
    last = -1;
  return () => {
    if (!bag.length) {
      bag = Array.from({ length: size }, (_, i) => i);
      for (let i = size - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j]!, bag[i]!];
      }
      if (size > 1 && bag[size - 1] === last) {
        const j = Math.floor(random() * (size - 1));
        [bag[size - 1], bag[j]] = [bag[j]!, bag[size - 1]!];
      }
    }
    last = bag.pop()!;
    return last;
  };
}

/** Decoded local recordings, with one shared AudioContext supplied by the sound host. */
export function createSceneAudio(context: AudioContext, output: AudioNode) {
  const buffers = new Map<string, AudioBuffer>();
  const loads = new Map<string, Promise<AudioBuffer | null>>();
  const abort = new AbortController();
  const voices = new Set<Voice>();
  const selectors = new Map<Group, ReturnType<typeof shuffledCycle>>();
  const held = new Map<string, Voice>();
  const holdVersions = new Map<string, number>();
  let enabled = false,
    destroyed = false,
    reading = false,
    portalActive = false,
    hoverMutedUntil = 0,
    generation = 0;
  const load = (path: string): Promise<AudioBuffer | null> => {
    if (destroyed) return Promise.resolve(null);
    if (buffers.has(path)) return Promise.resolve(buffers.get(path)!);
    if (loads.has(path)) return loads.get(path)!;
    const task = (async () => {
      for (const extension of ["opus", "webm"]) {
        try {
          const response = await fetch(`${path}.${extension}`, { signal: abort.signal });
          if (!response.ok) continue;
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          if (destroyed) return null;
          buffers.set(path, buffer);
          return buffer;
        } catch {
          if (abort.signal.aborted) return null;
        }
      }
      return null;
    })();
    loads.set(path, task);
    return task;
  };
  const audit = (group: Group, path: string, rate: number) => {
    if (process.env.NODE_ENV !== "production")
      document.documentElement.dataset.sceneAudio = JSON.stringify({
        group,
        path,
        rate,
        at: performance.now(),
        voices: voices.size,
      });
  };
  const play = async (
    group: Group,
    {
      limit = 0,
      rate = 1,
      volume = 1,
      hold,
    }: { limit?: number; rate?: number; volume?: number; hold?: string } = {},
  ) => {
    if (!enabled || destroyed || document.hidden) return;
    let selector = selectors.get(group);
    if (!selector) {
      selector = shuffledCycle(pack[group].length);
      selectors.set(group, selector);
    }
    const path = pack[group][selector()]!;
    const stamp = generation;
    const holdVersion = hold ? (holdVersions.get(hold) ?? 0) + 1 : 0;
    if (hold) holdVersions.set(hold, holdVersion);
    const buffer = await load(path);
    if (
      !buffer ||
      destroyed ||
      document.hidden ||
      (group !== "soundOff" && (stamp !== generation || !enabled)) ||
      (hold && holdVersions.get(hold) !== holdVersion)
    )
      return;
    if ((group === "activate" || group === "prespawn") && !portalActive) return;
    if (limit) {
      const groupVoices = [...voices].filter((v) => v.group === group);
      while (groupVoices.length >= limit) groupVoices.shift()!.stop(0.06);
    }
    if (hold) held.get(hold)?.stop(0.1);
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain).connect(output);
    let stopped = false;
    const voice: Voice = {
      group,
      endsAt: context.currentTime + buffer.duration / rate,
      stop: (release = 0.06) => {
        if (stopped) return;
        stopped = true;
        gain.gain.cancelAndHoldAtTime(context.currentTime);
        gain.gain.linearRampToValueAtTime(0, context.currentTime + release);
        source.stop(context.currentTime + release);
      },
    };
    voices.add(voice);
    if (hold) held.set(hold, voice);
    source.onended = () => {
      voices.delete(voice);
      if (hold && held.get(hold) === voice) held.delete(hold);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    audit(group, path, rate);
  };
  const musicGain = context.createGain(),
    lowpass = context.createBiquadFilter(),
    highpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 20000;
  lowpass.Q.value = 1;
  highpass.type = "highpass";
  highpass.frequency.value = 10;
  highpass.Q.value = 0.707;
  musicGain.gain.value = 0;
  musicGain.connect(lowpass).connect(highpass).connect(output);
  let music: AudioBufferSourceNode | null = null;
  let musicTimer: number | null = null;
  const audibleVideos = new Set<HTMLMediaElement>();
  const retune = (seconds: number) => {
    const time = context.currentTime;
    for (const [param, target] of [
      [musicGain.gain, audibleVideos.size ? 0 : reading ? 0.4 : 1],
      [lowpass.frequency, reading ? 1400 : 20000],
      [highpass.frequency, reading ? 250 : 10],
    ] as const) {
      param.cancelAndHoldAtTime(time);
      param.linearRampToValueAtTime(target, time + seconds);
    }
    if (process.env.NODE_ENV !== "production")
      document.documentElement.dataset.sceneMusic = JSON.stringify({
        path: pack.music[0],
        loop: Boolean(music?.loop),
        context: context.state,
        reading,
        gain: audibleVideos.size ? 0 : reading ? 0.4 : 1,
        lowpass: reading ? 1400 : 20000,
        highpass: reading ? 250 : 10,
      });
  };
  const startMusic = async (seconds: number) => {
    const stamp = generation,
      buffer = await load(pack.music[0]!);
    if (!buffer || stamp !== generation || !enabled || destroyed) return;
    if (!music) {
      music = context.createBufferSource();
      music.buffer = buffer;
      music.loop = true;
      music.connect(musicGain);
      music.start();
    }
    retune(seconds);
  };
  let portal: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  const stopPortal = () => {
    if (!portal) return;
    const old = portal;
    portal = null;
    old.gain.gain.cancelAndHoldAtTime(context.currentTime);
    old.gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.4);
    old.source.stop(context.currentTime + 0.4);
  };
  const startPortal = async () => {
    const stamp = generation,
      buffer = await load(pack.portalLoop[0]!);
    if (!buffer || stamp !== generation || !enabled || !portalActive || reading || portal) return;
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain).connect(output);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    portal = { source, gain };
    source.start(0, Math.random() * buffer.duration);
    gain.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.4);
  };
  type Category = "main" | "view-project" | "email" | "social" | "to-overview" | "alt" | "sound";
  const category = (el: Element): Category => {
    if (el.hasAttribute("data-sound-control")) return "sound";
    const href = el.getAttribute("href") ?? "";
    if (href.startsWith("mailto:")) return "email";
    if (href.startsWith("/work/")) return "view-project";
    if (href.startsWith("http")) return "social";
    if ((href === "/" || href.startsWith("/#")) && location.pathname.startsWith("/work/"))
      return "to-overview";
    if (el.tagName === "BUTTON") return "alt";
    return "main";
  };
  const randomRate = () => 2 ** (((Math.random() * 2 - 1) * 4) / 12);
  const hover = (kind: Category) => {
    if (performance.now() < hoverMutedUntil) return;
    if (["view-project", "social", "to-overview", "alt"].includes(kind))
      void play("animation", { hold: "animation", volume: reading ? 0.63 : 1 });
    if (kind === "view-project") void play("viewHover", { limit: 3, rate: randomRate() });
    else if (kind === "email") void play("emailHover", { hold: "email" });
    else if (kind === "social") void play("socialHover", { limit: 2, rate: randomRate() });
    else
      void play(
        (
          {
            main: "mainHover",
            alt: "altHover",
            "to-overview": "returnHover",
            sound: "soundHover",
          } as const
        )[kind],
        { limit: 2 },
      );
  };
  const leave = () => {
    holdVersions.forEach((version, key) => holdVersions.set(key, version + 1));
    held.forEach((v) => v.stop(0.1));
    held.clear();
  };
  const target = (event: Event) =>
    event.target instanceof Element ? event.target.closest("a,button") : null;
  const over = (event: PointerEvent) => {
    const el = target(event);
    if (
      event.pointerType === "touch" ||
      !el ||
      el.matches(":disabled") ||
      (event.relatedTarget instanceof Node && el.contains(event.relatedTarget))
    )
      return;
    hover(category(el));
  };
  const out = (event: PointerEvent) => {
    const el = target(event);
    if (el && !(event.relatedTarget instanceof Node && el.contains(event.relatedTarget))) leave();
  };
  const focus = (event: FocusEvent) => {
    const el = target(event);
    if (el?.matches(":focus-visible")) hover(category(el));
  };
  const click = (event: MouseEvent) => {
    const el = target(event);
    if (!el || el.matches(":disabled")) return;
    const kind = category(el);
    // These two actions already publish their semantic events exactly once.
    if (
      kind === "sound" ||
      el.matches("[data-work-view], [data-contact-primary], [data-contact-plane]")
    )
      return;
    hoverMutedUntil = performance.now() + 200;
    void play(
      kind === "social" || kind === "email"
        ? "socialClick"
        : kind === "to-overview"
          ? "returnClick"
          : kind === "alt"
            ? "altClick"
            : "mainClick",
      { rate: kind === "social" || kind === "email" ? randomRate() : 1 },
    );
  };
  const mediaPlay = (event: Event) => {
    if (event.target instanceof HTMLVideoElement && !event.target.muted) {
      audibleVideos.add(event.target);
      retune(0.4);
    }
  };
  const mediaStop = (event: Event) => {
    if (event.target instanceof HTMLVideoElement && audibleVideos.delete(event.target)) retune(0.8);
  };
  const connect = () => {
    document.addEventListener("play", mediaPlay, true);
    document.addEventListener("pause", mediaStop, true);
    document.addEventListener("ended", mediaStop, true);
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", leave);
    document.addEventListener("click", click, true);
  };
  const disconnect = () => {
    document.removeEventListener("play", mediaPlay, true);
    document.removeEventListener("pause", mediaStop, true);
    document.removeEventListener("ended", mediaStop, true);
    document.removeEventListener("pointerover", over);
    document.removeEventListener("pointerout", out);
    document.removeEventListener("focusin", focus);
    document.removeEventListener("focusout", leave);
    document.removeEventListener("click", click, true);
  };
  return {
    voices,
    buffers,
    start: () => {
      enabled = true;
      portalActive = Boolean(document.querySelector('[data-project-station][aria-hidden="false"]'));
      if (portalActive && !reading) void startPortal();
      connect();
      const entering = Boolean(document.querySelector("[data-site-entry][data-leaving]"));
      void play(entering ? "enter" : "soundOn");
      musicTimer = window.setTimeout(() => void startMusic(entering ? 2 : 1), entering ? 2800 : 0);
      // Warm the local pack only after the sound-on gesture.
      void (async () => {
        for (const paths of Object.values(pack)) {
          if (destroyed || !enabled) return;
          await Promise.all(paths.map(load));
        }
      })();
    },
    handle: (event: SoundEvent) => {
      if (event === "project:active") {
        portalActive = true;
        void play("activate", { limit: 2 });
        [...voices].filter((v) => v.group === "prespawn").forEach((v) => v.stop(0.4));
        void play("prespawn", { limit: 2, rate: 2 ** (((Math.random() * 2 - 1) * 0.5) / 12) });
        void startPortal();
      } else if (event === "project:inactive") {
        if (portalActive) void play("deactivate", { limit: 2 });
        portalActive = false;
        [...voices]
          .filter((voice) => voice.group === "prespawn")
          .forEach((voice) => voice.stop(0.4));
        stopPortal();
      } else if (event === "project:open") {
        hoverMutedUntil = performance.now() + 200;
        void play("mainClick");
      } else if (event === "contact:open") void play("socialClick", { rate: randomRate() });
      else if (event === "statement:read") void play("tagline", { limit: 2 });
      else if (event === "statement:pass") void play("tagline", { limit: 1, volume: 0.6 });
      // Entry already plays its dedicated recording at the sound-on gesture.
    },
    setReading: (value: boolean) => {
      if (reading === value) return;
      reading = value;
      audibleVideos.forEach((video) => {
        if (!video.isConnected || video.paused) audibleVideos.delete(video);
      });
      if (music) retune(value ? 0.25 : 0.4);
      if (reading) stopPortal();
      else if (portalActive) void startPortal();
    },
    stop: () => {
      void play("soundOff");
      enabled = false;
      generation++;
      disconnect();
      if (musicTimer !== null) clearTimeout(musicTimer);
      musicTimer = null;
      stopPortal();
    },
    suspend: () => {
      generation++;
      leave();
      voices.forEach((v) => v.stop(0));
    },
    resume: () => {
      if (!music) void startMusic(1);
      if (portalActive && !reading) void startPortal();
    },
    destroy: () => {
      destroyed = true;
      enabled = false;
      generation++;
      disconnect();
      abort.abort();
      if (musicTimer !== null) clearTimeout(musicTimer);
      music?.stop();
      music?.disconnect();
      stopPortal();
      voices.forEach((v) => v.stop(0));
      voices.clear();
      musicGain.disconnect();
      lowpass.disconnect();
      highpass.disconnect();
      buffers.clear();
    },
  };
}
