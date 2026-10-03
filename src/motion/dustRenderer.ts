/**
 * The bio's dust.
 *
 * The sentence is sampled into grains, one for every few lit pixels of its
 * glyphs, each knowing its word and where in that word it sits. The grains
 * live in the rift. When the bio arrives they stream out of it in
 * reading order, ribbon by ribbon, and settle onto their letters, and the
 * real words fade in under them from the bottom up. When the visitor scrolls
 * on, the words crumble from the bottom edge, last word first, and the dust
 * drifts down, gathers into wisps and goes slowly back into the dark.
 *
 * The rift is where they come from: they stream out of the crack itself and
 * go back into it. A few more break away from it all the time (more while the visitor is near or holding
 * on), drift a little way towards the sentence and fade: the same grains,
 * drawn by the same pass, before and after the sentence has formed.
 *
 * The page's text stays the text: this only draws a canvas over it and sets
 * `--whole` on each word, which the stylesheet turns into a mask.
 *
 * Returns null when WebGL is unavailable; the sentence then simply stays.
 */

export type DustDoor = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Where the rift's plume dissolves near the peak, on screen. When given,
   * every grain leaves from (and goes back to) its own point among these,
   * and idle grains break away from them all the while.
   */
  path?: readonly Readonly<{ x: number; y: number }>[];
  /** How much is flowing through the rift: 0 at rest, up to 2 fully held. */
  energy?: number;
}>;

export type DustFrame = Readonly<{
  /** Seconds since the dust began. */
  now: number;
  delta: number;
  /** Where the sentence is on screen. */
  left: number;
  top: number;
  /** The opening the dust flies from and back to. */
  door: DustDoor;
  /** How visible the rift is; grains inside it fade with it. */
  doorPresence: number;
  /** 0 → 1 as the visitor scrolls the sentence away; below 0 it stays whole. */
  leave: number;
}>;

export type BioDust = Readonly<{
  /** Starts the sentence streaming out of the rift. */
  form: (now: number) => void;
  /** Puts every grain back in the rift and hides the words. */
  reset: () => void;
  formed: () => boolean;
  /** Whether every word of the sentence has all but landed: it reads whole. */
  whole: () => boolean;
  /** Grains in flight, so the caller keeps drawing until they land. */
  busy: () => boolean;
  update: (frame: DustFrame) => void;
  /** Samples the sentence again, after a resize or a change of fonts. */
  resample: () => void;
  destroy: () => void;
}>;

const IN_DOOR = 0;
const FORMING = 1;
const SETTLED = 2;
const LEAVING = 3;

/** Grains per lit pixel of the glyphs, and the most there may be. */
const DENSITY = 0.3;
const MAX_GRAINS = 15000;
/**
 * Idle grains: the few that break away from the plume all the while, and how
 * many a second at rest and fully held.
 */
const IDLE_GRAINS = 120;
const IDLE_RATE = { rest: 1.4, full: 22 } as const;

/** Stagger between words as the sentence forms, in seconds. */
const WORD_STAGGER = 0.11;
/** Flight out of the rift, and back into it (slower), in seconds. */
const FORM_SECONDS: readonly [number, number] = [1.5, 2.4];
const LEAVE_SECONDS: readonly [number, number] = [3.2, 4.8];
/** A landed grain fades into its letter over this long. */
const SETTLE_SECONDS = 0.45;
/** Ribbons per word, so the dust flies in strands, not a cloud. */
const STRANDS = 4;

const VERTEX = `attribute vec2 aPos;
attribute float aSize;
attribute float aAlpha;
attribute float aWarm;
attribute vec2 aTint;
uniform vec2 uResolution;
varying float vAlpha;
varying float vWarm;
varying vec2 vTint;
void main() {
  vec2 clip = aPos / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = aSize;
  vAlpha = aAlpha;
  vWarm = aWarm;
  vTint = aTint;
}`;

/*
 * Brand colours where the grains are the words: lavender in flight, moonlit,
 * porcelain at the burning edge. Where they have just left the rift's
 * vapour they still carry its colour (vTint: how much, and which), and
 * settle into the brand's as they fly.
 */
const FRAGMENT = `precision mediump float;
varying float vAlpha;
varying float vWarm;
varying vec2 vTint;
const vec3 BLUE = vec3(0.36, 0.64, 1.0);
const vec3 CYAN = vec3(0.42, 0.95, 1.0);
const vec3 PINK = vec3(1.0, 0.55, 0.88);
const vec3 VIOLET = vec3(0.62, 0.42, 1.0);
const vec3 LAVENDER = vec3(0.718, 0.576, 0.824);
const vec3 MOONLIT = vec3(0.769, 0.667, 0.941);
const vec3 PORCELAIN = vec3(0.957, 0.933, 0.98);
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  // A hard bright core in a soft halo, so where grains gather they glow.
  float core = exp(-d * d * 14.0) + exp(-d * d * 3.0) * 0.28;
  vec3 colour = mix(mix(LAVENDER, MOONLIT, smoothstep(0.0, 0.5, vWarm)), PORCELAIN, smoothstep(0.5, 1.0, vWarm));
  float h = vTint.y;
  vec3 vapour = h < 0.33 ? mix(BLUE, CYAN, h * 3.0) : h < 0.66 ? mix(CYAN, PINK, (h - 0.33) * 3.0) : mix(PINK, VIOLET, (h - 0.66) * 3.0);
  // A white-hot centre on the vapour's colour.
  vapour = mix(vapour, vec3(1.0), exp(-d * d * 20.0) * 0.6);
  colour = mix(colour, vapour, vTint.x);
  float a = core * vAlpha * (1.0 + vTint.x * 0.4);
  gl_FragColor = vec4(colour * a, a);
}`;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** A small seeded random, so the dust falls the same way each visit. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createBioDust(heading: HTMLElement, onLost: () => void): BioDust | null {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.bioDust = "";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "25",
  });
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const STRIDE = 7;
  const attribute = (name: string, size: number, offset: number) => {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
  };
  attribute("aPos", 2, 0);
  attribute("aSize", 1, 2);
  attribute("aAlpha", 1, 3);
  attribute("aWarm", 1, 4);
  attribute("aTint", 2, 5);
  const resolution = gl.getUniformLocation(program, "uResolution");
  gl.enable(gl.BLEND);
  // Added light: where the wisps gather they glow.
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  const lost = (event: Event) => {
    event.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", lost);
  document.body.appendChild(canvas);

  // ------------------------------------------------------------- the grains
  let count = 0;
  /** The sentence's middle, relative to its box, for the idle grains' heading. */
  let sentenceX = 0;
  let sentenceY = 0;
  let homeX = new Float32Array(0);
  let homeY = new Float32Array(0);
  let word = new Uint16Array(0);
  /** 0 at the top of its word, 1 at the bottom. */
  let depth = new Float32Array(0);
  let state = new Uint8Array(0);
  let t = new Float32Array(0);
  let duration = new Float32Array(0);
  let startX = new Float32Array(0);
  let startY = new Float32Array(0);
  let fromDoor = new Uint8Array(0);
  let posX = new Float32Array(0);
  let posY = new Float32Array(0);
  let readyAt = new Float32Array(0);
  let threshold = new Float32Array(0);
  let seedA = new Float32Array(0);
  let seedB = new Float32Array(0);
  /** Which of its word's few ribbons the grain flies in, −1 to 1. */
  let strandOf = new Float32Array(0);
  let doorU = new Float32Array(0);
  let doorV = new Float32Array(0);
  let vertices = new Float32Array(0);

  let wordSpans: HTMLElement[][] = [];
  let wordTotal = new Uint32Array(0);
  let wordSettled = new Uint32Array(0);
  let wordWhole = new Float32Array(0);
  let wordWritten = new Float32Array(0);
  let words = 0;

  let formStart: number | null = null;

  const writeWhole = (index: number, value: number) => {
    if (Math.abs(wordWritten[index]! - value) < 0.004 && value !== 0 && value !== 1) return;
    if (wordWritten[index] === value) return;
    wordWritten[index] = value;
    for (const span of wordSpans[index] ?? []) span.style.setProperty("--whole", value.toFixed(3));
  };

  const sample = () => {
    const box = heading.getBoundingClientRect();
    const spans = [...heading.querySelectorAll<HTMLElement>("[data-word]")];
    words = spans.reduce((most, span) => Math.max(most, Number(span.dataset.word) + 1), 0);
    wordSpans = Array.from({ length: words }, () => []);
    for (const span of spans) wordSpans[Number(span.dataset.word)]!.push(span);

    const width = Math.max(1, Math.ceil(box.width));
    const height = Math.max(1, Math.ceil(box.height));
    const scratch = document.createElement("canvas");
    scratch.width = width;
    scratch.height = height;
    const context = scratch.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const style = getComputedStyle(heading);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    if ("letterSpacing" in context) context.letterSpacing = style.letterSpacing;
    context.fillStyle = "#fff";
    context.textBaseline = "alphabetic";

    // Each word set exactly where the page sets it.
    const rects: { word: number; x: number; y: number; w: number; h: number }[] = [];
    for (const span of spans) {
      const text = span.textContent ?? "";
      if (!text.trim()) continue;
      const rect = span.getBoundingClientRect();
      const metrics = context.measureText(text);
      const content = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      const x = rect.left - box.left;
      const top = rect.top - box.top + (rect.height - content) / 2;
      context.fillText(text, x, top + metrics.fontBoundingBoxAscent);
      rects.push({
        word: Number(span.dataset.word),
        x,
        y: rect.top - box.top,
        w: rect.width,
        h: rect.height,
      });
    }

    const pixels = context.getImageData(0, 0, width, height).data;
    let lit = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 140) lit++;
    const wanted = Math.min(MAX_GRAINS, Math.round(lit * DENSITY));
    const chance = lit > 0 ? wanted / lit : 0;
    const roll = random(0x5eed);

    const xs: number[] = [];
    const ys: number[] = [];
    const ws: number[] = [];
    const ds: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3]! <= 140 || roll() > chance) continue;
        const owner = rects.find(
          (r) => x >= r.x - 1 && x <= r.x + r.w + 1 && y >= r.y && y <= r.y + r.h,
        );
        if (!owner) continue;
        xs.push(x + roll() - 0.5);
        ys.push(y + roll() - 0.5);
        ws.push(owner.word);
        ds.push(Math.min(1, Math.max(0, (y - owner.y) / Math.max(1, owner.h))));
      }
    }

    count = xs.length;
    sentenceX = xs.reduce((sum, value) => sum + value, 0) / Math.max(1, xs.length);
    sentenceY = ys.reduce((sum, value) => sum + value, 0) / Math.max(1, ys.length);
    homeX = Float32Array.from(xs);
    homeY = Float32Array.from(ys);
    word = Uint16Array.from(ws);
    depth = Float32Array.from(ds);
    state = new Uint8Array(count);
    t = new Float32Array(count);
    duration = new Float32Array(count);
    startX = new Float32Array(count);
    startY = new Float32Array(count);
    fromDoor = new Uint8Array(count);
    posX = new Float32Array(count);
    posY = new Float32Array(count);
    readyAt = new Float32Array(count);
    threshold = new Float32Array(count);
    seedA = new Float32Array(count);
    seedB = new Float32Array(count);
    strandOf = new Float32Array(count);
    doorU = new Float32Array(count);
    doorV = new Float32Array(count);
    vertices = new Float32Array((count + IDLE_GRAINS) * STRIDE);
    wordTotal = new Uint32Array(words);
    wordSettled = new Uint32Array(words);
    wordWhole = new Float32Array(words);
    wordWritten = new Float32Array(words).fill(-1);

    for (let i = 0; i < count; i++) {
      seedA[i] = roll();
      seedB[i] = roll();
      strandOf[i] = (Math.floor(roll() * STRANDS) / (STRANDS - 1)) * 2 - 1;
      // Spread over the opening, so the dust comes out of the whole dark.
      const angle = roll() * Math.PI * 2;
      const radius = Math.sqrt(roll());
      doorU[i] = Math.cos(angle) * radius;
      doorV[i] = Math.sin(angle) * radius;
      wordTotal[word[i]!]!++;
      // Crumbling: last word first, and in each word the bottom edge first.
      const order = (words - 1 - word[i]!) / Math.max(1, words);
      const local = (1 - depth[i]!) * 0.75 + roll() * 0.25;
      threshold[i] = 0.02 + (order * 0.6 + local * 0.4) * 0.94;
    }
  };

  const doorPoint = (index: number, door: DustDoor, out: { x: number; y: number }) => {
    // From the plume's dissolving top: each grain its own speck of it.
    const path = door.path;
    if (path && path.length > 0) {
      const pick =
        path[Math.min(path.length - 1, Math.floor(((doorU[index]! + 1) / 2) * path.length))]!;
      out.x = pick.x + doorV[index]! * 7;
      out.y = pick.y + doorU[index]! * 5;
      return;
    }
    out.x = door.x + doorU[index]! * door.width * 0.3;
    out.y = door.y + door.height * 0.08 + doorV[index]! * door.height * 0.32;
  };

  const settleAll = (formed: boolean, leave: number) => {
    for (let i = 0; i < count; i++) {
      const home = formed && leave < threshold[i]!;
      state[i] = home ? SETTLED : IN_DOOR;
      t[i] = home ? SETTLE_SECONDS : 0;
    }
  };

  sample();
  for (let w = 0; w < words; w++) writeWhole(w, 0);

  // ------------------------------------------------------------- idle grains
  const idle = {
    alive: new Uint8Array(IDLE_GRAINS),
    x: new Float32Array(IDLE_GRAINS),
    y: new Float32Array(IDLE_GRAINS),
    toX: new Float32Array(IDLE_GRAINS),
    toY: new Float32Array(IDLE_GRAINS),
    age: new Float32Array(IDLE_GRAINS),
    life: new Float32Array(IDLE_GRAINS),
    seed: new Float32Array(IDLE_GRAINS),
  };
  let idleDue = 0;
  let idleCount = 0;

  /**
   * Breaks a few grains away from the plume's top, drifts them a little way
   * towards the sentence, and draws them. Returns the next free vertex.
   */
  const updateIdle = (frame: DustFrame, dt: number, ratio: number, drawn: number) => {
    const path = frame.door.path;
    if (path && path.length > 0 && frame.doorPresence > 0.3 && frame.leave < 0.5) {
      const energy = Math.min(2, frame.door.energy ?? 0);
      idleDue += dt * (IDLE_RATE.rest + (IDLE_RATE.full - IDLE_RATE.rest) * (energy / 2));
      while (idleDue >= 1) {
        idleDue -= 1;
        const slot = idle.alive.indexOf(0);
        if (slot < 0) break;
        const from = path[Math.floor(Math.random() * path.length)]!;
        idle.alive[slot] = 1;
        idle.x[slot] = from.x + (Math.random() - 0.5) * 10;
        idle.y[slot] = from.y + (Math.random() - 0.5) * 8;
        // A short way towards the sentence: a hint of where they are going.
        const reach = 0.12 + Math.random() * 0.28;
        idle.toX[slot] = idle.x[slot]! + (frame.left + sentenceX - idle.x[slot]!) * reach;
        idle.toY[slot] = idle.y[slot]! + (frame.top + sentenceY - idle.y[slot]!) * reach;
        idle.age[slot] = 0;
        idle.life[slot] = 2.2 + Math.random() * 1.8;
        idle.seed[slot] = Math.random();
      }
    }
    idleCount = 0;
    for (let k = 0; k < IDLE_GRAINS; k++) {
      if (!idle.alive[k]) continue;
      idle.age[k] = idle.age[k]! + dt;
      const p = idle.age[k]! / idle.life[k]!;
      if (p >= 1) {
        idle.alive[k] = 0;
        continue;
      }
      idleCount++;
      // Up out of the plume first, then drifting towards the words.
      const e = smooth(p);
      const lift = Math.sin(Math.PI * Math.min(1, p * 1.6)) * (18 + idle.seed[k]! * 22);
      const x =
        idle.x[k]! + (idle.toX[k]! - idle.x[k]!) * e + Math.sin(p * 6 + idle.seed[k]! * 20) * 4;
      const y = idle.y[k]! + (idle.toY[k]! - idle.y[k]!) * e - lift;
      const alpha = smooth(p / 0.15) * (1 - smooth((p - 0.55) / 0.45)) * 0.9 * frame.doorPresence;
      // Still the vapour's colour, cooling as they drift.
      drawn = write(
        drawn,
        x,
        y,
        (1.3 + idle.seed[k]! * 1.1) * ratio * 2.6,
        alpha,
        0.15 + idle.seed[k]! * 0.3,
        1 - smooth((p - 0.4) / 0.6) * 0.5,
        idle.seed[k]!,
      );
    }
    return drawn;
  };

  // ------------------------------------------------------------- the frame
  const door = { x: 0, y: 0 };
  let inFlight = 0;

  const update = (frame: DustFrame) => {
    const { now, delta, left, top, leave } = frame;
    const dt = Math.min(0.05, Math.max(0, delta));
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    const backingWidth = Math.round(viewWidth * ratio);
    const backingHeight = Math.round(viewHeight * ratio);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }

    wordSettled.fill(0);
    inFlight = 0;
    let drawn = 0;

    for (let i = 0; i < count; i++) {
      const homeScreenX = left + homeX[i]!;
      const homeScreenY = top + homeY[i]!;
      const wantHome = formStart !== null && now >= readyAt[i]! && leave < threshold[i]!;
      const s = state[i]!;

      // ------------------------------------------------ changes of course
      if (s === IN_DOOR && wantHome) {
        state[i] = FORMING;
        fromDoor[i] = 1;
        t[i] = 0;
        duration[i] = FORM_SECONDS[0] + seedB[i]! * (FORM_SECONDS[1] - FORM_SECONDS[0]);
      } else if ((s === SETTLED || s === FORMING) && !wantHome) {
        state[i] = LEAVING;
        startX[i] = s === SETTLED ? homeScreenX : posX[i]!;
        startY[i] = s === SETTLED ? homeScreenY : posY[i]!;
        t[i] = 0;
        duration[i] = LEAVE_SECONDS[0] + seedA[i]! * (LEAVE_SECONDS[1] - LEAVE_SECONDS[0]);
      } else if (s === LEAVING && wantHome) {
        state[i] = FORMING;
        fromDoor[i] = 0;
        startX[i] = posX[i]!;
        startY[i] = posY[i]!;
        t[i] = 0;
        duration[i] = FORM_SECONDS[0] * 0.8;
      }

      const current = state[i]!;
      if (current === IN_DOOR) continue;

      if (current === SETTLED) {
        wordSettled[word[i]!]!++;
        t[i] = t[i]! + dt;
        posX[i] = homeScreenX;
        posY[i] = homeScreenY;
        if (t[i]! >= SETTLE_SECONDS) continue;
        // Landed: a last glint, fading into the letter.
        const fade = 1 - t[i]! / SETTLE_SECONDS;
        drawn = write(drawn, homeScreenX, homeScreenY, ratio * (1.3 + seedA[i]!), fade * 0.7, 1);
        continue;
      }

      inFlight++;
      t[i] = Math.min(1, t[i]! + dt / duration[i]!);
      const progress = t[i]!;
      doorPoint(i, frame.door, door);

      // A cubic from where the grain is to where it is going; ribbons share
      // their word's arc, each grain a little apart within it.
      const forming = current === FORMING;
      const x0 = forming ? (fromDoor[i] ? door.x : startX[i]!) : startX[i]!;
      const y0 = forming ? (fromDoor[i] ? door.y : startY[i]!) : startY[i]!;
      const x3 = forming ? homeScreenX : door.x;
      const y3 = forming ? homeScreenY : door.y;
      const dx = x3 - x0;
      const dy = y3 - y0;
      const distance = Math.hypot(dx, dy) || 1;
      const wordSwing = Math.sin(word[i]! * 2.399) * 0.5 + 0.5;
      const strand = strandOf[i]!;
      // Close to its ribbon; a few strays wander further.
      const stray = (seedA[i]! - 0.5) * (seedB[i]! > 0.85 ? 34 : 7);
      let x1: number;
      let y1: number;
      let x2: number;
      let y2: number;
      if (forming) {
        // Out of the dark and up in an arc, coming down onto the letter.
        x1 = x0 + dx * 0.3;
        y1 = y0 + dy * 0.1 - distance * (0.16 + wordSwing * 0.18);
        x2 = x3 - dx * 0.18;
        y2 = y3 - distance * (0.08 + strand * 0.04);
      } else {
        // Falling away from the letter first, like ash, then drawn home.
        x1 = x0 + strand * 22;
        y1 = y0 + 70 + wordSwing * 50 + strand * 20;
        x2 = x3 - dx * 0.35;
        y2 = y3 - dy * 0.35 + distance * (0.08 + wordSwing * 0.12);
      }
      // Breaking away is slow: the grain lingers, glowing, then lets go.
      const e = forming ? smooth(progress) : progress * progress * (3 - 2 * progress);
      const inv = 1 - e;
      let x = inv * inv * inv * x0 + 3 * inv * inv * e * x1 + 3 * inv * e * e * x2 + e * e * e * x3;
      let y = inv * inv * inv * y0 + 3 * inv * inv * e * y1 + 3 * inv * e * e * y2 + e * e * e * y3;

      // The wisp: the ribbon ripples across its path and frays mid-flight.
      const nx = -dy / distance;
      const ny = dx / distance;
      const bell = Math.sin(Math.PI * e);
      const phase = word[i]! * 1.7 + strand * 1.3;
      const ripple =
        Math.sin(e * Math.PI * 2.6 + phase + now * 0.9) * (forming ? 18 : 30) +
        strand * (forming ? 16 : 30) +
        stray +
        Math.sin(now * 2.3 + seedB[i]! * 40) * 2;
      x += nx * ripple * bell;
      y += ny * ripple * bell;
      posX[i] = x;
      posY[i] = y;

      let alpha: number;
      let warm: number;
      let size: number;
      // Straight out of the vapour a grain still carries its colour; by the
      // words it is the brand's again. Going back, it takes the colour on.
      const tint =
        fromDoor[i] || !forming
          ? forming
            ? 1 - smooth(progress / 0.55)
            : smooth((progress - 0.45) / 0.55)
          : 0;
      if (forming) {
        alpha = smooth(progress / 0.12) * (fromDoor[i] ? smooth(frame.doorPresence * 1.5) : 1);
        warm = 0.25 + progress * 0.65;
        size = 1.2 + seedA[i]! * 0.9 - progress * 0.3;
        if (progress >= 1) {
          state[i] = SETTLED;
          t[i] = 0;
        }
      } else {
        // The burning edge: bright as it breaks away, cooling to lavender,
        // fading as it passes into the dark.
        alpha = (1 - smooth((progress - 0.78) / 0.22)) * (0.45 + 0.55 * frame.doorPresence);
        warm = Math.max(0, 1 - progress * 4) * 0.9 + 0.12;
        size = 1.4 + seedA[i]! * 1.0 - progress * 0.6;
        if (progress >= 1) {
          state[i] = IN_DOOR;
          t[i] = 0;
        }
      }
      drawn = write(
        drawn,
        x,
        y,
        size * ratio * 2.6 * (1 + tint * 0.3),
        alpha * 0.85,
        warm,
        tint,
        seedB[i]!,
      );
    }

    drawn = updateIdle(frame, dt, ratio, drawn);

    // The words under the dust: whole where their grains have landed.
    const rate = 1 - Math.exp(-dt * 9);
    for (let w = 0; w < words; w++) {
      const target =
        wordTotal[w]! > 0 ? wordSettled[w]! / wordTotal[w]! : formStart === null ? 0 : 1;
      wordWhole[w] = wordWhole[w]! + (target - wordWhole[w]!) * rate;
      if (Math.abs(target - wordWhole[w]!) < 0.003) wordWhole[w] = target;
      writeWhole(w, wordWhole[w]!);
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (drawn > 0) {
      gl.uniform2f(resolution, viewWidth, viewHeight);
      gl.bufferData(gl.ARRAY_BUFFER, vertices.subarray(0, drawn * STRIDE), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.POINTS, 0, drawn);
    }
  };

  function write(
    at: number,
    x: number,
    y: number,
    size: number,
    alpha: number,
    warm: number,
    tint = 0,
    hue = 0,
  ) {
    if (alpha <= 0.004) return at;
    const offset = at * STRIDE;
    vertices[offset] = x;
    vertices[offset + 1] = y;
    vertices[offset + 2] = size;
    vertices[offset + 3] = alpha;
    vertices[offset + 4] = warm;
    vertices[offset + 5] = tint;
    vertices[offset + 6] = hue;
    return at + 1;
  }

  return {
    form: (now) => {
      if (formStart !== null) return;
      formStart = now;
      for (let i = 0; i < count; i++) {
        // Reading order, and in each word from the bottom up.
        readyAt[i] = now + word[i]! * WORD_STAGGER + (1 - depth[i]!) * 0.3 + seedB[i]! * 0.25;
      }
    },
    reset: () => {
      formStart = null;
      settleAll(false, 0);
      wordWhole.fill(0);
      for (let w = 0; w < words; w++) writeWhole(w, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    formed: () => formStart !== null,
    whole: () => formStart !== null && wordWhole.every((value) => value >= 0.9),
    busy: () => inFlight > 0 || idleCount > 0,
    resample: () => {
      const formed = formStart !== null;
      sample();
      // Whatever had formed is simply there; whatever was in the door stays.
      settleAll(formed, -1);
      if (formed) {
        formStart = -Infinity;
        readyAt.fill(-Infinity);
      }
      for (let w = 0; w < words; w++) {
        wordWhole[w] = formed ? 1 : 0;
        writeWhole(w, wordWhole[w]!);
      }
    },
    update,
    destroy: () => {
      canvas.removeEventListener("webglcontextlost", lost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
      for (const spans of wordSpans) for (const span of spans) span.style.removeProperty("--whole");
    },
  };
}
