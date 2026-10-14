"use client";

import { useEffect, useRef } from "react";

import { emitSoundEvent } from "@/sound/soundEvents";
import { scrollForProgress, storyProgress } from "@/motion/bioPacing";
import {
  preparePasses,
  readPassInfo,
  setPassView,
  setStillness,
  type PassInfo,
  type RenderPass,
} from "@/webgl/renderPassChannel";

import styles from "./RenderPasses.module.css";

/**
 * The bio's second passage, "Sometimes it's a prototype / a product / an
 * entire world", shown the way the world beside it was made.
 *
 * Scrolling through the passage plays three stops: Draw (the rock as lines),
 * Build (as the computer reads it), Light (as you see it). A seam sweeps
 * between them. The passage's own key words are the controls: hover or focus
 * one to see its pass, click or tap it to go there; the underline under the
 * active word fills as you read. Once a pass has settled, a handle lets the
 * visitor drag the seam to compare it with another.
 *
 * Then the world holds still for a beat, and the name arrives.
 */

type Zone = Readonly<{
  id: number;
  pass: RenderPass;
  from: number;
  to: number;
  name?: string;
  line?: string;
}>;

/** Stops in story progress (see bioPacing); passage two spans 0.32 to 0.67. */
const ZONES: readonly Zone[] = [
  { id: 0, pass: "light", from: -Infinity, to: 0.375 },
  { id: 1, pass: "sketch", from: 0.375, to: 0.455, name: "Draw", line: "First, I draw the shape." },
  {
    id: 2,
    pass: "engine",
    from: 0.455,
    to: 0.555,
    name: "Build",
    line: "Then I build it, so the computer understands it.",
  },
  {
    id: 3,
    pass: "light",
    from: 0.555,
    to: 0.655,
    name: "Light",
    line: "Then I add light, and it becomes real.",
  },
  { id: 4, pass: "light", from: 0.655, to: Infinity },
];
const STEPS = ZONES.slice(1, 4);
/** The words of the passage that act as its steps. */
const KEYWORDS = [/^prototype/i, /^product/i, /^world/i] as const;
/** What the compare handle shows beside each settled pass. */
const PARTNER: Partial<Record<number, RenderPass>> = { 1: "light", 2: "light", 3: "sketch" };
const NAMES: Record<RenderPass, string> = { sketch: "Draw", engine: "Build", light: "Light" };
const INTRO = "Here’s how I made this world. Keep scrolling.";
const SWEEP_MS = 1500;
const PREVIEW_MS = 850;
/**
 * The stillness before the name: a beat in time, not a stretch of scroll. It
 * plays once as the visitor scrolls down past `at`, so stopping anywhere never
 * leaves the world dimmed. Scrolling back above it lets it play again.
 */
const STILL = { at: 0.656, inMs: 450, holdMs: 1100, outMs: 1600 } as const;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const zoneAt = (p: number) => ZONES.find((zone) => p >= zone.from && p < zone.to) ?? ZONES[0]!;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
/** SVG strokes that draw on: pathLength 1, dashoffset from 1 to 0. */
const drawn = (r: number) =>
  `pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - clamp(r)).toFixed(3)}"`;
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

type Frame = Readonly<{
  first: RenderPass;
  second: RenderPass;
  split: number;
  sweeping: boolean;
  comparing: boolean;
}>;

export function RenderPasses() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const story = document.querySelector<HTMLElement>("[data-bio-story]");
    const passage = document.querySelector<HTMLElement>(
      '[data-bio-passage][data-moment="possibilities"]',
    );
    if (!root || !story || !passage) return;

    const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
    const layers = {
      sketch: $<HTMLElement>('[data-layer="sketch"]'),
      engine: $<HTMLElement>('[data-layer="engine"]'),
      light: $<HTMLElement>('[data-layer="light"]'),
    };
    const seam = $<HTMLElement>("[data-seam]");
    const grip = $<HTMLButtonElement>("[data-grip]");
    const gripHint = $<HTMLElement>("[data-grip] i");
    const sides = [
      $<HTMLElement>('[data-side="first"]'),
      $<HTMLElement>('[data-side="second"]'),
    ] as const;
    const note = $<HTMLElement>("[data-note]");
    const steps = [...root.querySelectorAll<HTMLButtonElement>("[data-step]")];
    const code = $<HTMLElement>("[data-code]");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const vertical = () => window.innerWidth < 768;

    // ---------------------------------------------------------- state
    let zone = 0;
    let sweep: { from: number; to: number; t0: number; dir: 1 | -1; ms: number } | null = null;
    let preview: number | null = null;
    let drag: number | null = null;
    let release: { split: number; t0: number } | null = null;
    let hinted = false;
    const enteredAt: Partial<Record<RenderPass, number>> = {};
    let frame: Frame = {
      first: "light",
      second: "light",
      split: 1,
      sweeping: false,
      comparing: false,
    };

    const startSweep = (to: number, now: number) => {
      const from = sweep ? sweep.to : zone;
      if (from === to) return;
      sweep = {
        from,
        to,
        t0: now,
        dir: to > from ? 1 : -1,
        ms: reduced.matches ? 0 : preview != null ? PREVIEW_MS : SWEEP_MS,
      };
      drag = null;
      release = null;
      if (ZONES[from]!.pass !== ZONES[to]!.pass) emitSoundEvent("statement:pass");
    };

    const resolve = (p: number, now: number): Frame => {
      const scrolled = zoneAt(p).id;
      const target = preview != null && scrolled >= 1 && scrolled <= 3 ? preview : scrolled;
      if (target !== (sweep ? sweep.to : zone)) startSweep(target, now);
      if (sweep) {
        const t = sweep.ms ? clamp((now - sweep.t0) / sweep.ms) : 1;
        const a = ZONES[sweep.from]!.pass;
        const b = ZONES[sweep.to]!.pass;
        if (t >= 1) {
          zone = sweep.to;
          sweep = null;
        } else if (a !== b) {
          const e = easeInOut(t);
          // Forward, the new pass arrives from the left (top); back, from the right (bottom).
          return sweep.dir > 0
            ? { first: b, second: a, split: e, sweeping: true, comparing: false }
            : { first: a, second: b, split: 1 - e, sweeping: true, comparing: false };
        }
      }
      const pass = ZONES[zone]!.pass;
      const partner = PARTNER[zone];
      if (partner && drag != null)
        return { first: pass, second: partner, split: drag, sweeping: false, comparing: true };
      if (partner && release) {
        const t = clamp((now - release.t0) / 650);
        if (t >= 1) release = null;
        else {
          const split = release.split + (1 - release.split) * (1 - Math.pow(1 - t, 4));
          return { first: pass, second: partner, split, sweeping: false, comparing: true };
        }
      }
      return { first: pass, second: pass, split: 1, sweeping: false, comparing: false };
    };

    // ---------------------------------------------------------- controls
    const goTo = (id: number) => {
      const target = ZONES[id]!;
      window.scrollTo({
        top: scrollForProgress(story, target.from + (target.to - target.from) * 0.3),
        behavior: reduced.matches ? "auto" : "smooth",
      });
    };
    let leaveTimer = 0;
    const cleanups: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
    ) => {
      target.addEventListener(type, handler as EventListener);
      cleanups.push(() => target.removeEventListener(type, handler as EventListener));
    };
    let hovered = -1;
    steps.forEach((step, i) => {
      const id = i + 1;
      on(step, "click", (event) => {
        preview = null;
        goTo(id);
        if ((event as MouseEvent).detail) step.blur();
      });
      const show = () => {
        window.clearTimeout(leaveTimer);
        hovered = i;
        preview = id;
      };
      // Gliding from word to word never snaps back in between.
      const hide = () => {
        hovered = -1;
        leaveTimer = window.setTimeout(() => (preview = null), 120);
      };
      on(step, "pointerenter", () => finePointer.matches && show());
      on(step, "pointerleave", hide);
      on(step, "focus", show);
      on(step, "blur", hide);
    });
    on(window, "keydown", (event) => {
      if (!root.dataset.active || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "1" || event.key === "2" || event.key === "3") {
        goTo(Number(event.key));
        event.preventDefault();
      }
    });

    let dragging = false;
    const dragAt = (event: PointerEvent) =>
      vertical()
        ? clamp(event.clientY / window.innerHeight, 0.04, 1)
        : clamp(event.clientX / window.innerWidth, 0.04, 1);
    on(grip, "pointerdown", (event) => {
      if (sweep || !PARTNER[zone]) return;
      dragging = true;
      hinted = true;
      grip.setPointerCapture(event.pointerId);
      grip.dataset.on = "";
      drag = dragAt(event);
      release = null;
      event.preventDefault();
    });
    on(grip, "pointermove", (event) => {
      if (dragging) drag = dragAt(event);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      delete grip.dataset.on;
      release = { split: drag ?? 1, t0: performance.now() };
      drag = null;
    };
    on(grip, "pointerup", endDrag);
    on(grip, "pointercancel", endDrag);
    on(grip, "keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      hinted = true;
      drag = clamp((drag ?? 1) + (event.key === "ArrowLeft" ? -0.1 : 0.1), 0.04, 1);
      if (drag >= 1) drag = null;
      event.preventDefault();
    });

    // ---------------------------------------------------------- drawing
    let noteKey = "";
    const setNote = (key: string, html: string) => {
      if (key === noteKey) return;
      noteKey = key;
      note.querySelectorAll("span").forEach((span) => {
        span.dataset.state = "out";
        window.setTimeout(() => span.remove(), 600);
      });
      if (!html) return;
      const span = document.createElement("span");
      span.dataset.state = "in";
      span.innerHTML = html;
      note.appendChild(span);
      requestAnimationFrame(() => requestAnimationFrame(() => delete span.dataset.state));
    };

    const callout = (
      svg: string[],
      tags: string[],
      point: { x: number; y: number } | null,
      dx: number,
      dy: number,
      r: number,
      html: string,
    ) => {
      if (!point) return;
      const { x, y } = point;
      const tx = x + dx;
      const ty = y + dy;
      const ex = tx + (dx > 0 ? 28 : -28);
      const o = smooth(0, 0.25, r);
      svg.push(
        `<circle cx="${x}" cy="${y}" r="2.5" class="${styles.dot}" fill-opacity="${o}"/>` +
          `<circle cx="${x}" cy="${y}" r="${4 + 4 * smooth(0, 0.4, r)}" class="${styles.ring}" stroke-opacity="${0.6 * o}"/>` +
          `<polyline points="${x},${y} ${tx},${ty} ${ex},${ty}" class="${styles.leader}" ${drawn(r * 1.6 - 0.1)}/>`,
      );
      const t = smooth(0.55, 1, r);
      const anchor =
        dx > 0 ? `left:${ex + 8}px` : `right:${window.innerWidth - ex + 8}px;text-align:right`;
      tags.push(
        `<div class="${styles.tag}" style="${anchor};top:${ty - 10}px;opacity:${t};transform:translateY(${(1 - t) * 6}px)">${html}</div>`,
      );
    };

    const redlines = (r: number) => {
      const words = [...passage.querySelectorAll<HTMLElement>("[data-title-word]")];
      const title = words[0]?.closest("h1,h2,h3");
      const rects = words
        .map((word) => word.getBoundingClientRect())
        .filter((rect) => rect.width > 0);
      if (!title || !rects.length) return "";
      const style = getComputedStyle(title);
      const left = Math.min(...rects.map((rect) => rect.left));
      const right = Math.max(...rects.map((rect) => rect.right));
      const top = Math.min(...rects.map((rect) => rect.top));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      const size = parseFloat(style.fontSize);
      const leading = parseFloat(style.lineHeight) || size * 1.2;
      const baselines = [...new Set(rects.map((rect) => Math.round(rect.bottom)))].sort(
        (a, b) => a - b,
      );
      let out = "";
      baselines.forEach((y, i) => {
        const base = y - size * 0.22;
        out += `<line x1="${left - 24}" x2="${right + 32}" y1="${base}" y2="${base}" class="${styles.baseline}" ${drawn(r * 1.4 - i * 0.12)}/>`;
      });
      out += `<line x1="${left - 16}" x2="${left - 16}" y1="${top}" y2="${bottom}" class="${styles.measure}" ${drawn(r * 1.3)}/>`;
      out += `<line x1="${left}" x2="${right}" y1="${top - 16}" y2="${top - 16}" class="${styles.measure}" ${drawn(r * 1.3)}/>`;
      const o = smooth(0.55, 1, r).toFixed(2);
      out += `<text x="${right + 10}" y="${top - 12}" class="${styles.svgLabel}" fill-opacity="${o}">${Math.round(right - left)} PX</text>`;
      out += `<text x="${left - 24}" y="${bottom + 24}" class="${styles.svgLabel}" fill-opacity="${o}">SOURCE SERIF 4 · ${size.toFixed(0)} / ${leading.toFixed(0)}</text>`;
      return out;
    };

    let codeLines: string[] | null = null;
    const shaderLines = (info: PassInfo) => {
      if (codeLines) return codeLines;
      const source = info.waterShader;
      const at = source.indexOf("void main");
      codeLines = (at >= 0 ? source.slice(at) : source)
        .split("\n")
        .map((line) => line.replace(/\s+$/, ""))
        .filter((line) => line.trim() && !/^\s*(\/\*|\*)/.test(line))
        .slice(0, 16)
        .map((line) =>
          escape(line).replace(
            /\b(float|vec2|vec3|vec4|void|uniform|mix|smoothstep|normalize|dot)\b/g,
            "<em>$1</em>",
          ),
        );
      return codeLines;
    };

    // The passage's own words are the steps.
    const placeSteps = (show: boolean, p: number, current: number) => {
      const words = [...passage.querySelectorAll<HTMLElement>("[data-title-word]")];
      const found = KEYWORDS.map((pattern) =>
        words.find((word) => pattern.test((word.textContent ?? "").trim())),
      );
      const rects = found.map((word) => word?.getBoundingClientRect());
      const ready = show && rects.every((rect) => rect && rect.width > 0);
      if (!ready) {
        delete root.dataset.active;
        return;
      }
      root.dataset.active = "";
      steps.forEach((step, i) => {
        const rect = rects[i]!;
        const text = (found[i]!.textContent ?? "").trim();
        // The full stop is not part of the word's underline.
        const trim = /[.,]$/.test(text) ? rect.width / text.length : 0;
        step.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width - trim}px;height:${rect.height}px`;
        const zoneOf = STEPS[i]!;
        step.toggleAttribute("data-on", current === i + 1);
        step.style.setProperty(
          "--fill",
          preview != null ? "1" : clamp((p - zoneOf.from) / (zoneOf.to - zoneOf.from)).toFixed(3),
        );
      });
      const lines = [...passage.querySelectorAll<HTMLElement>('[class*="titleLine"]')].map((line) =>
        line.getBoundingClientRect(),
      );
      note.style.left = `${Math.min(...lines.map((rect) => rect.left))}px`;
      note.style.top = `${Math.max(...lines.map((rect) => rect.bottom)) + 30}px`;
    };

    // Each line of the passage lights with its own pass; all three once the world is lit again.
    const lines = () => [...passage.querySelectorAll<HTMLElement>('[class*="titleLine"]')];
    const focusLines = (current: number, now: number) => {
      const all = zone === 3 && !sweep && now - (enteredAt.light ?? now) > 2200;
      const active = current >= 1 && current <= 3 ? current - 1 : -1;
      lines().forEach((line, i) => {
        line.style.transition = "opacity .8s cubic-bezier(.2,.7,.2,1)";
        line.style.opacity =
          active === -1 || all || active === i ? "1" : hovered === i ? "0.62" : "0.28";
      });
    };

    // ---------------------------------------------------------- loop
    let raf = 0;
    let tick = 0;
    let lastProgress = Number.NaN;
    let stillSince: number | null = null;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      tick++;
      const motion = story.dataset.motion === "ready";
      const p = motion ? storyProgress(story) : -1;
      preparePasses(motion && p > -1.2 && p < 1.2);
      const info = readPassInfo();
      // No WebGL, or the passes are not ready yet: the passage reads as plain text.
      const usable = motion && Boolean(info?.ready);
      frame = usable
        ? resolve(p, now)
        : { first: "light", second: "light", split: 1, sweeping: false, comparing: false };
      const isVertical = vertical();
      setPassView({
        first: frame.first,
        second: frame.second,
        split: frame.split,
        vertical: isVertical,
      });
      if (!motion || Number.isNaN(lastProgress)) stillSince = null;
      else if (lastProgress < STILL.at && p >= STILL.at && !reduced.matches) stillSince = now;
      else if (p < STILL.at - 0.02) stillSince = null;
      lastProgress = motion ? p : Number.NaN;
      let still = 0;
      if (stillSince !== null) {
        const t = now - stillSince;
        const release = STILL.inMs + STILL.holdMs;
        still = smooth(0, STILL.inMs, t) * (1 - smooth(release, release + STILL.outMs, t));
        if (t > release + STILL.outMs) stillSince = null;
      }
      setStillness(still);

      // From just before the first sweep to the end of the lit stop.
      const inPassage = usable && p > 0.3 && p < ZONES[3]!.to;
      const current = sweep ? sweep.to : zone;
      placeSteps(inPassage, p, current);
      if (inPassage) {
        const z = ZONES[current]!;
        setNote(
          `n${current === 0 ? "intro" : current}`,
          current === 0 ? INTRO : `<em>0${current} · ${z.name}</em>${z.line}`,
        );
        focusLines(current, now);
      } else {
        setNote("", "");
        if (tick % 10 === 0) lines().forEach((line) => (line.style.opacity = ""));
      }

      // seam
      const W = window.innerWidth;
      const H = window.innerHeight;
      const span = isVertical ? H : W;
      const split = frame.split * span;
      root.toggleAttribute("data-vertical", isVertical);
      seam.style.opacity = frame.sweeping || frame.comparing ? "1" : "0";
      seam.toggleAttribute("data-back", Boolean(sweep && sweep.dir < 0));
      seam.style.transform = isVertical ? `translateY(${split}px)` : `translateX(${split}px)`;

      // compare handle
      const canCompare = inPassage && !sweep && Boolean(PARTNER[zone]);
      const at = frame.comparing ? split : span - 34;
      grip.style.opacity = canCompare ? "1" : "0";
      grip.tabIndex = canCompare ? 0 : -1;
      grip.style.pointerEvents = canCompare ? "auto" : "none";
      grip.style.transform = isVertical ? `translateY(${at}px)` : `translateX(${at}px)`;
      gripHint.style.opacity = hinted || frame.comparing ? "0" : "1";
      const showSides = frame.comparing && Math.min(split, span - split) > 90;
      sides.forEach((side, i) => {
        side.style.opacity = showSides ? "1" : "0";
        if (!showSides) return;
        side.textContent = NAMES[i === 0 ? frame.first : frame.second];
        if (isVertical) {
          side.style.left = "24px";
          side.style.top = `${i === 0 ? split - 26 : split + 14}px`;
          side.style.transform = "none";
        } else {
          side.style.left = `${i === 0 ? split - 14 : split + 14}px`;
          side.style.top = "96px";
          side.style.transform = i === 0 ? "translateX(-100%)" : "none";
        }
      });

      // annotations live only in the part of the screen their pass occupies
      for (const pass of ["sketch", "engine", "light"] as const) {
        const layer = layers[pass];
        const onFirst = frame.first === pass;
        const onSecond = frame.second === pass;
        const lightNote = pass === "light" && zone === 3 && !sweep;
        if (
          !inPassage ||
          (!onFirst && !onSecond) ||
          (pass === "light" && !lightNote) ||
          frame.comparing
        ) {
          layer.style.display = "none";
          delete enteredAt[pass];
          continue;
        }
        layer.style.display = "";
        enteredAt[pass] ??= now;
        const a = onFirst ? 0 : split;
        const b = onSecond ? span : split;
        layer.style.clipPath = isVertical
          ? `inset(${a}px 0 ${H - b}px 0)`
          : `inset(0 ${W - b}px 0 ${a}px)`;
      }
      if (!inPassage || !info || tick % 2) return;
      const reveal = (pass: RenderPass, delay = 0) =>
        clamp((now - (enteredAt[pass] ?? now) - delay) / 900);

      if (layers.sketch.style.display !== "none") {
        const svg = [redlines(reveal("sketch", 150))];
        const tags: string[] = [];
        callout(
          svg,
          tags,
          info.riftPeak,
          -60,
          -230,
          reveal("sketch", 450),
          `<span class="${styles.plain}">Each line is an edge of the rock.</span><span>${fmt(info.riftPoints)} points</span>`,
        );
        layers.sketch.querySelector("svg")!.innerHTML = svg.join("");
        layers.sketch.querySelector("[data-tags]")!.innerHTML = tags.join("");
        const c = info.camera;
        layers.sketch.querySelector("[data-readout]")!.textContent =
          `camera ${c.x.toFixed(1)} · ${c.y.toFixed(1)} · ${c.z.toFixed(1)}   fov ${c.fov.toFixed(0)}°`;
      }
      if (layers.engine.style.display !== "none") {
        const all = shaderLines(info);
        const shown = Math.min(
          all.length,
          Math.floor(Math.max(0, now - (enteredAt.engine ?? now) - 500) / 60),
        );
        code.innerHTML = `<span>// the water you just saw: its live fragment shader</span>\n${all.slice(0, shown).join("\n")}`;
        const svg: string[] = [];
        const tags: string[] = [];
        callout(
          svg,
          tags,
          info.riftPeak,
          -60,
          -230,
          reveal("engine", 400),
          `<span class="${styles.plain}">The colours show which way each side is facing.</span><span>so light knows where to land</span>`,
        );
        layers.engine.querySelector("svg")!.innerHTML = svg.join("");
        layers.engine.querySelector("[data-tags]")!.innerHTML = tags.join("");
        layers.engine.querySelector("[data-readout]")!.textContent =
          `${fmt(info.triangles)} triangles · ${info.drawCalls} draw calls`;
      }
      if (layers.light.style.display !== "none") {
        const svg: string[] = [];
        const tags: string[] = [];
        callout(
          svg,
          tags,
          info.portal,
          -230,
          150,
          reveal("light", 500),
          `<span class="${styles.plain}">It’s real. Press and hold the rift to step inside.</span><span>my world</span>`,
        );
        layers.light.querySelector("svg")!.innerHTML = svg.join("");
        layers.light.querySelector("[data-tags]")!.innerHTML = tags.join("");
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(leaveTimer);
      cleanups.forEach((cleanup) => cleanup());
      setPassView(null);
      setStillness(0);
      preparePasses(false);
      lines().forEach((line) => {
        line.style.opacity = "";
        line.style.transition = "";
      });
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      {(["sketch", "engine", "light"] as const).map((pass) => (
        <div
          key={pass}
          className={styles.layer}
          data-layer={pass}
          style={{ display: "none" }}
          aria-hidden="true"
        >
          {pass === "engine" ? <div className={styles.code} data-code="" /> : null}
          <svg className={styles.svg} />
          <div data-tags="" />
          {pass !== "light" ? <div className={styles.readout} data-readout="" /> : null}
        </div>
      ))}
      <div className={styles.seam} data-seam="" aria-hidden="true" />
      <div className={styles.side} data-side="first" aria-hidden="true" />
      <div className={styles.side} data-side="second" aria-hidden="true" />
      <button
        type="button"
        className={styles.grip}
        data-grip=""
        aria-label="Compare with another pass"
        tabIndex={-1}
      >
        <span aria-hidden="true">⟷</span>
        <i>Drag to see before and after</i>
      </button>
      <nav className={styles.steps} aria-label="How this world was made">
        {STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            className={styles.step}
            data-step=""
            aria-label={`Step ${step.id}, ${step.name}: ${step.line}`}
          >
            <b />
          </button>
        ))}
      </nav>
      <p className={styles.note} data-note="" aria-live="polite" />
    </div>
  );
}
