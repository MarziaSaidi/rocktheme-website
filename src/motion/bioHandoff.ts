/**
 * The bio's dust.
 *
 * Each passage's title is sampled into grains, one for a share of the lit
 * pixels of its glyphs, each knowing its word and how high in that word it
 * sits. The rift breathes them: they come out of the low mouth of the crack
 * and go back in through its upper reach (the other way round when the
 * visitor scrolls back up, so leaving rewinds arriving). Every word is shown
 * as far as its own dust has landed, from the bottom edge up, and crumbles
 * from the bottom edge when it goes.
 *
 * Two titles have a signature. "snap": the word's dust holds as a loose,
 * breathing cloud until the rest of the title has landed, then snaps in.
 * "print": its dust settles on the letters as a faint draft and a head prints
 * the word solid, left to right, as it lands.
 *
 * On the way the dust swirls: a slow, turning flow (a curl field, so it
 * never bunches up or thins out) carries every grain off its arc and back
 * onto it by the time it lands. Some grains lift towards the viewer mid-flight.
 *
 * This decides where every grain is. When the scene is running it draws them
 * inside the world, at the rift's depth, with focus and motion streaks, where
 * the stone hides them going in and the water reflects them (see `@/webgl/bioDustChannel`). Otherwise, or with
 * `IN_SCENE` off, they are drawn here on a plain canvas.
 *
 * The page's text stays the text: this sets `--dust` (0 → 1) and `data-dust`
 * on each title word, which the stylesheet turns into a mask.
 */
import { BIO_DUST_STRIDE, publishBioDust, sceneDrawsBioDust } from "@/webgl/bioDustChannel";
import { breatheRift, getRiftAnchor, type RiftAnchor } from "@/webgl/riftChannel";

export type TitleSignature = "snap" | "print";
export type HandoffWord = Readonly<{ element: HTMLElement; signature?: TitleSignature }>;

export type BioHandoff = Readonly<{
  /** The words stream out of the rift and land; false when there is no rift to stream from. */
  form: (owner: object, words: readonly HandoffWord[], options: FlightOptions) => boolean;
  /** The words crumble and go back into the rift; false when there is no rift. */
  crumble: (owner: object, words: readonly HandoffWord[], options: FlightOptions) => boolean;
  /** Drops the owner's grains where they are. */
  cancel: (owner: object) => void;
  /** How fast the page is scrolling, px/s: fast scrolling draws the grains out into streaks. */
  setScrollSpeed: (pixelsPerSecond: number) => void;
  tick: (now: number) => void;
  destroy: () => void;
}>;

type FlightOptions = Readonly<{
  /** Seconds, on the same clock as `tick`. */
  start: number;
  /** 1 scrolling down the page, -1 back up. */
  direction: 1 | -1;
  onDone?: () => void;
}>;

/**
 * The switch: true draws the dust inside the 3D scene (depth, focus, streaks,
 * reflection) whenever the scene is running;
 * false always draws it flat on the page's own canvas.
 */
const IN_SCENE = true;

/** The most grains one title is drawn with. */
const MAX_GRAINS = { wide: 6000, compact: 3200 } as const;
/** Seconds between words, in reading order arriving and last word first leaving. */
const WORD_STAGGER = { in: 0.045, out: 0.05 } as const;
/** How long a word takes to crumble from its bottom edge to its top. */
const CRUMBLE_SECONDS = 0.4;
/** How long landed grains linger on their letters before the solid word alone remains. */
const SETTLE_SECONDS = 0.45;
const SNAP = { after: 0.12, seconds: 0.26, overshoot: 1.25 } as const;
const PRINT_SECONDS = 0.55;
/** Of the crack's points, low to high: the share at each end the dust uses. */
const LANE_SHARE = 1 / 3;
/** The swirl: how far it carries a grain off its arc (px) and the size of its eddies (1/px). */
const FLOW = { reach: 30, scale: 0.0065, drift: 0.22 } as const;
/**
 * Streak length as exposure in seconds: half a frame at rest (a film camera's
 * half-open shutter). Only a real flick, from `from` up to `fast` px/s of
 * scroll, lengthens it, up to `full`; ordinary scrolling never does.
 */
const EXPOSURE = { rest: 1 / 120, full: 0.02, from: 2400, fast: 5000 } as const;
/** Grains drawn at once across every flight. */
const CAPACITY = 16000;

const LAVENDER = [183, 147, 210] as const;
const MOONLIT = [196, 170, 240] as const;
const PORCELAIN = [244, 238, 250] as const;
const COLOUR_STEPS = 4;
const ALPHA_STEPS = 6;

type Word = {
  element: HTMLElement;
  signature: TitleSignature | null;
  left: number;
  top: number;
  width: number;
  height: number;
  total: number;
  landed: number;
  start: number;
  snapAt: number;
  printAt: number;
  flashed: boolean;
};

type Flight = {
  owner: object;
  kind: "in" | "out";
  words: Word[];
  count: number;
  homeX: Float32Array;
  homeY: Float32Array;
  /** Where a grain flies to: its letter, or for "snap" a place in the loose cloud. */
  holdX: Float32Array;
  holdY: Float32Array;
  t0: Float32Array;
  duration: Float32Array;
  seed: Float32Array;
  word: Uint16Array;
  /** Which point of the crack each grain uses, and how far from it. */
  lane: Uint8Array;
  laneX: Float32Array;
  laneY: Float32Array;
  absorbed: Uint8Array;
  /** Where each grain was last frame, for its velocity. */
  lastX: Float32Array;
  lastY: Float32Array;
  arc: number;
  onDone?: () => void;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smooth = (from: number, to: number, value: number) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const outBack = (t: number, k: number) => 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2;
const bezier = (from: number, control: number, to: number, t: number) =>
  (1 - t) * (1 - t) * from + 2 * (1 - t) * t * control + t * t * to;
/** How far a grain may lift towards the viewer: most hardly at all, a few a long way. */
const liftOf = (seed: number) => ((seed * 7.31) % 1) ** 2;

/**
 * The swirl at a point: the curl of a slowly turning stream function, so the
 * flow neither gathers nor spreads the dust. Unit strength, about.
 */
function swirl(x: number, y: number, t: number): [number, number] {
  const k = FLOW.scale;
  const a = x * k + t * FLOW.drift;
  const b = y * k - t * FLOW.drift * 0.7;
  const c = (x + y) * k * 1.7 - t * FLOW.drift * 1.3;
  // ψ = sin a · cos b + 0.5 sin c; v = (∂ψ/∂y, −∂ψ/∂x), divided by k.
  const dy = -Math.sin(a) * Math.sin(b) + 0.85 * Math.cos(c);
  const dx = Math.cos(a) * Math.cos(b) + 0.85 * Math.cos(c);
  return [dy, -dx];
}

function palette() {
  const fills: string[] = [];
  for (let c = 0; c < COLOUR_STEPS; c += 1) {
    const t = c / (COLOUR_STEPS - 1);
    const [from, to, u] =
      t < 0.5 ? [LAVENDER, MOONLIT, t * 2] : [MOONLIT, PORCELAIN, (t - 0.5) * 2];
    const rgb = from.map((value, k) => Math.round(value + (to[k]! - value) * u));
    for (let a = 0; a < ALPHA_STEPS; a += 1) {
      fills.push(`rgba(${rgb.join(",")},${((a + 1) / ALPHA_STEPS).toFixed(3)})`);
    }
  }
  return fills;
}

/** The crack's points on screen, low to high, or its centre alone. */
function crack(anchor: RiftAnchor) {
  return anchor.path && anchor.path.length > 0 ? anchor.path : [{ x: anchor.x, y: anchor.y }];
}

export function createBioHandoff(): BioHandoff {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.bioHandoff = "";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    mixBlendMode: "screen",
    zIndex: "25",
  });
  document.body.appendChild(canvas);
  const context = canvas.getContext("2d")!;
  const scratch = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const fills = palette();
  const buckets: number[][] = fills.map(() => []);
  let flights: Flight[] = [];
  let lastAnchor: RiftAnchor | null = null;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
  };
  resize();
  window.addEventListener("resize", resize);

  const anchorNow = () => {
    const anchor = getRiftAnchor();
    if (anchor && anchor.presence > 0.2) lastAnchor = anchor;
    return lastAnchor;
  };

  /** Every lit pixel of each word in its settled place, sampled down to the budget. */
  function sample(words: readonly HandoffWord[]) {
    const measured = words.map(({ element, signature }) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const pad = 6;
      const w = Math.ceil(box.width + pad * 2);
      const h = Math.ceil(box.height + pad * 2);
      scratch.canvas.width = w;
      scratch.canvas.height = h;
      scratch.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if ("letterSpacing" in scratch) scratch.letterSpacing = style.letterSpacing;
      scratch.fillStyle = "#fff";
      const text = element.textContent ?? "";
      const metrics = scratch.measureText(text);
      const content = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      const lineBox = parseFloat(style.lineHeight) || box.height;
      scratch.fillText(text, pad, pad + (lineBox - content) / 2 + metrics.fontBoundingBoxAscent);
      const data = scratch.getImageData(0, 0, w, h).data;
      const points: number[] = [];
      let top = h;
      let bottom = 0;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          if (data[(y * w + x) * 4 + 3]! > 130) {
            points.push(box.left - pad + x, box.top - pad + y);
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }
      return {
        element,
        signature,
        box,
        points,
        top: box.top - pad + top,
        span: Math.max(1, bottom - top),
      };
    });
    const lit = measured.reduce((sum, word) => sum + word.points.length / 2, 0);
    const budget = width < 700 ? MAX_GRAINS.compact : MAX_GRAINS.wide;
    return { measured, keep: Math.min(1, budget / Math.max(1, lit)) };
  }

  function launch(
    owner: object,
    kind: "in" | "out",
    input: readonly HandoffWord[],
    options: FlightOptions,
  ) {
    const anchor = anchorNow();
    if (!anchor) return false;
    cancel(owner);
    const { measured, keep } = sample(input);
    const points = crack(anchor);
    const laneSize = Math.max(1, Math.round(points.length * LANE_SHARE));
    // Out of the low mouth and back through the upper reach; reversed going back up.
    const fromLow = (kind === "in") === options.direction > 0;
    const homeX: number[] = [];
    const homeY: number[] = [];
    const t0: number[] = [];
    const duration: number[] = [];
    const seed: number[] = [];
    const word: number[] = [];
    const lane: number[] = [];
    const laneX: number[] = [];
    const laneY: number[] = [];
    const last = measured.length - 1;
    const words: Word[] = measured.map((m, index) => ({
      element: m.element,
      signature: kind === "in" ? (m.signature ?? null) : null,
      left: m.box.left,
      top: m.box.top,
      width: m.box.width,
      height: m.box.height,
      total: 0,
      landed: 0,
      start:
        options.start +
        (kind === "in" ? index * WORD_STAGGER.in : (last - index) * WORD_STAGGER.out),
      snapAt: 0,
      printAt: 0,
      flashed: false,
    }));
    measured.forEach((m, index) => {
      const owned = words[index]!;
      for (let k = 0; k < m.points.length; k += 2) {
        if (Math.random() > keep) continue;
        const x = m.points[k]!;
        const y = m.points[k + 1]!;
        // 0 at the word's bottom edge, 1 at its top: it fills and crumbles bottom first.
        const height = 1 - (y - m.top) / m.span;
        const s = Math.random();
        homeX.push(x);
        homeY.push(y);
        seed.push(s);
        word.push(index);
        if (kind === "in") {
          t0.push(owned.start + height * 0.08 + s * 0.14);
          duration.push(1.0 + Math.random() * 0.3);
        } else {
          t0.push(owned.start + height * CRUMBLE_SECONDS + s * 0.05);
          duration.push(0.95 + Math.random() * 0.35);
        }
        const pick = Math.floor(Math.random() * laneSize);
        lane.push(fromLow ? pick : points.length - 1 - pick);
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * 18;
        laneX.push(Math.cos(angle) * radius);
        laneY.push(Math.sin(angle) * radius);
        owned.total += 1;
      }
    });
    const count = homeX.length;
    const holdX = new Float32Array(count);
    const holdY = new Float32Array(count);
    let landsBy = options.start;
    const printArrivals = new Map<Word, number[]>();
    for (let i = 0; i < count; i += 1) {
      const owned = words[word[i]!]!;
      if (!owned.signature) landsBy = Math.max(landsBy, t0[i]! + duration[i]!);
      if (owned.signature === "print") {
        const list = printArrivals.get(owned) ?? [];
        list.push(t0[i]! + duration[i]!);
        printArrivals.set(owned, list);
      }
    }
    // The head sets off as the word's dust starts to settle, so printing is part
    // of the landing rather than a pause after it.
    for (const [owned, arrivals] of printArrivals) {
      arrivals.sort((a, b) => a - b);
      owned.printAt = arrivals[Math.floor(arrivals.length * 0.25)]!;
    }
    for (let i = 0; i < count; i += 1) {
      const owned = words[word[i]!]!;
      if (owned.signature === "snap") {
        owned.snapAt = landsBy + SNAP.after;
        const angle = Math.random() * Math.PI * 2;
        const radius = 6 + Math.random() * 22;
        holdX[i] = homeX[i]! + Math.cos(angle) * radius * 1.4;
        holdY[i] = homeY[i]! + Math.sin(angle) * radius * 0.8;
      } else {
        holdX[i] = homeX[i]!;
        holdY[i] = homeY[i]!;
      }
    }
    for (const owned of words) {
      owned.element.dataset.dust = owned.signature === "print" ? "print" : kind;
      owned.element.style.setProperty("--dust", kind === "in" ? "0" : "1");
    }
    flights.push({
      owner,
      kind,
      words,
      count,
      homeX: Float32Array.from(homeX),
      homeY: Float32Array.from(homeY),
      holdX,
      holdY,
      t0: Float32Array.from(t0),
      duration: Float32Array.from(duration),
      seed: Float32Array.from(seed),
      word: Uint16Array.from(word),
      lane: Uint8Array.from(lane),
      laneX: Float32Array.from(laneX),
      laneY: Float32Array.from(laneY),
      absorbed: new Uint8Array(count),
      lastX: new Float32Array(count).fill(Number.NaN),
      lastY: new Float32Array(count).fill(Number.NaN),
      // One sweeping arc: up over the water coming out, lower going back in.
      arc: (kind === "in") === options.direction > 0 ? -0.3 : 0.18,
      onDone: options.onDone,
    });
    if (kind === "in") breatheRift(0.35);
    return true;
  }

  function cancel(owner: object) {
    flights = flights.filter((flight) => flight.owner !== owner);
  }

  const grains = new Float32Array(CAPACITY * BIO_DUST_STRIDE);
  let drawn = 0;
  let scrollSpeed = 0;
  let lastNow = 0;

  const put = (
    x: number,
    y: number,
    size: number,
    colour: number,
    alpha: number,
    vx: number,
    vy: number,
    lift: number,
  ) => {
    if (alpha <= 0.01 || drawn >= CAPACITY) return;
    const g = drawn * BIO_DUST_STRIDE;
    grains[g] = x;
    grains[g + 1] = y;
    grains[g + 2] = size;
    grains[g + 3] = clamp01(colour);
    grains[g + 4] = clamp01(alpha);
    grains[g + 5] = vx;
    grains[g + 6] = vy;
    grains[g + 7] = lift;
    drawn += 1;
  };

  /** The flat fallback: every grain as a small square, batched by colour and alpha. */
  const drawFlat = () => {
    for (let i = 0; i < drawn; i += 1) {
      const g = i * BIO_DUST_STRIDE;
      const c = Math.round(grains[g + 3]! * (COLOUR_STEPS - 1));
      const a = Math.min(ALPHA_STEPS - 1, Math.ceil(grains[g + 4]! * ALPHA_STEPS) - 1);
      buckets[c * ALPHA_STEPS + a]!.push(grains[g]!, grains[g + 1]!, grains[g + 2]!);
    }
    for (let b = 0; b < buckets.length; b += 1) {
      const list = buckets[b]!;
      if (list.length === 0) continue;
      context.fillStyle = fills[b]!;
      context.beginPath();
      for (let k = 0; k < list.length; k += 3) {
        context.rect(list[k]!, list[k + 1]!, list[k + 2]!, list[k + 2]!);
      }
      context.fill();
      list.length = 0;
    }
  };

  /** Draws one flight at `now`; false once it is over. */
  function step(flight: Flight, now: number, delta: number, points: RiftAnchor["path"] & object) {
    const { words } = flight;
    for (const owned of words) owned.landed = 0;
    let alive = false;
    let absorbed = 0;
    for (let i = 0; i < flight.count; i += 1) {
      const u = (now - flight.t0[i]!) / flight.duration[i]!;
      if (u <= 0) {
        alive = true;
        continue;
      }
      const owned = words[flight.word[i]!]!;
      const point = points[Math.min(points.length - 1, flight.lane[i]!)]!;
      const laneX = point.x + flight.laneX[i]!;
      const laneY = point.y + flight.laneY[i]!;
      const s = flight.seed[i]!;
      const [fromX, fromY, toX, toY] =
        flight.kind === "in"
          ? [laneX, laneY, flight.holdX[i]!, flight.holdY[i]!]
          : [flight.homeX[i]!, flight.homeY[i]!, laneX, laneY];
      const dx = toX - fromX;
      const dy = toY - fromY;
      const distance = Math.hypot(dx, dy) || 1;
      const bend = (s - 0.5) * 0.35 * distance;
      const controlX = (fromX + toX) / 2 - (dy / distance) * bend;
      const controlY = (fromY + toY) / 2 + flight.arc * distance + (dx / distance) * bend;
      let x: number;
      let y: number;
      let colour: number;
      let alpha: number;
      let size: number;
      let lift = 0;
      // How much of its motion a grain shows as a streak: none as it settles onto a letter.
      let streak = 1;

      if (flight.kind === "in") {
        const t = Math.min(u, 1);
        // Eased out of the rift, a glide, and a soft landing: smoke, not a shot.
        const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
        // Off the arc mid-flight, exactly on it at both ends.
        const away = Math.sin(Math.PI * eased);
        x = bezier(fromX, controlX, toX, eased);
        y = bezier(fromY, controlY, toY, eased);
        const [fx, fy] = swirl(x, y, now);
        const reach = FLOW.reach * (0.5 + s) * away;
        x += fx * reach;
        y += fy * reach;
        lift = away * liftOf(s);
        streak = clamp01((1 - eased) * 3);
        colour = 0.45 + eased * 0.55;
        // Out of the dark slowly, so grains easing out of the mouth never pile into a glare.
        alpha = smooth(0, 0.28, t);
        size = 1.7 - eased * 0.55;
        if (owned.signature === null) {
          if (u >= 1) {
            owned.landed += 1;
            const after = (now - flight.t0[i]! - flight.duration[i]!) / SETTLE_SECONDS;
            if (after >= 1) continue;
            alpha = 1 - after;
          }
          alive = true;
        } else if (owned.signature === "snap") {
          alive = true;
          if (u >= 1) {
            const v = (now - owned.snapAt) / SNAP.seconds;
            if (v <= 0) {
              x += Math.sin(now * 2.6 + s * 30) * 2.2;
              y += Math.cos(now * 2.1 + s * 22) * 1.6;
              colour = 0.6 + 0.4 * Math.sin(now * 4 + s * 9) ** 2;
            } else if (v < 1) {
              const k = outBack(v, SNAP.overshoot);
              x = flight.holdX[i]! + (flight.homeX[i]! - flight.holdX[i]!) * k;
              y = flight.holdY[i]! + (flight.homeY[i]! - flight.holdY[i]!) * k;
              colour = 1;
              size = 1.4;
            } else {
              const after = (now - owned.snapAt - SNAP.seconds) / 0.4;
              if (after >= 1) continue;
              x = flight.homeX[i]!;
              y = flight.homeY[i]!;
              colour = 1;
              alpha = 1 - after;
            }
          }
        } else {
          alive = true;
          if (u >= 1) {
            const head =
              owned.left - 3 + (owned.width + 6) * clamp01((now - owned.printAt) / PRINT_SECONDS);
            const homeX = flight.homeX[i]!;
            x = homeX;
            y = flight.homeY[i]!;
            colour = 0.55;
            size = 1.25;
            // It lies on its letter as a faint draft until the head prints it.
            alpha = 0.35;
            if (head >= homeX) {
              const printed =
                owned.printAt + ((homeX - owned.left + 3) / (owned.width + 6)) * PRINT_SECONDS;
              const arrived = flight.t0[i]! + flight.duration[i]!;
              const after = (now - Math.max(printed, arrived)) / 0.3;
              if (after >= 1) continue;
              alpha = 1 - after;
              colour = 1;
            }
          }
        }
      } else {
        if (u >= 1) {
          if (!flight.absorbed[i]) {
            flight.absorbed[i] = 1;
            absorbed += 1;
          }
          continue;
        }
        alive = true;
        // It drops a little as it comes loose, then is drawn in faster and faster.
        const eased = u ** 1.8;
        const drop = Math.sin(Math.min(u / 0.35, 1) * Math.PI * 0.5) * 14 * (1 - u);
        const away = Math.sin(Math.PI * u);
        x = bezier(fromX, controlX, toX, eased);
        y = bezier(fromY, controlY, toY, eased) + drop;
        const [fx, fy] = swirl(x, y, now);
        const reach = FLOW.reach * (0.5 + s) * away;
        x += fx * reach;
        y += fy * reach;
        lift = away * liftOf(s);
        streak = clamp01(u * 4);
        colour = 1 - u * 0.95;
        alpha = u < 0.78 ? 1 : (1 - u) / 0.22;
        size = 1.5 - u * 0.7;
      }
      const lastX = flight.lastX[i]!;
      const lastY = flight.lastY[i]!;
      flight.lastX[i] = x;
      flight.lastY[i] = y;
      const moving = delta > 0 && !Number.isNaN(lastX);
      const vx = moving ? Math.max(-4000, Math.min(4000, (x - lastX) / delta)) * streak : 0;
      const vy = moving ? Math.max(-4000, Math.min(4000, (y - lastY) / delta)) * streak : 0;
      put(x, y, size, colour, alpha, vx, vy, lift);
    }
    if (absorbed > 0) breatheRift((absorbed / flight.count) * 1.4);

    // Each word shows as far as its dust has landed.
    for (let index = 0; index < words.length; index += 1) {
      const owned = words[index]!;
      let shown: number;
      if (flight.kind === "out") shown = 1 - clamp01((now - owned.start) / CRUMBLE_SECONDS);
      else if (owned.signature === "snap") {
        shown = clamp01((now - owned.snapAt - SNAP.seconds * 0.6) / 0.1);
        if (shown >= 1 && !owned.flashed) {
          owned.flashed = true;
          owned.element.dataset.flash = "";
        }
      } else if (owned.signature === "print") {
        shown = clamp01((now - owned.printAt) / PRINT_SECONDS);
        if (shown > 0 && shown < 1) {
          const head = owned.left - 3 + (owned.width + 6) * shown;
          const glow = context.createLinearGradient(0, owned.top, 0, owned.top + owned.height);
          glow.addColorStop(0, "rgba(196,170,240,0)");
          glow.addColorStop(0.5, "rgba(244,238,250,0.6)");
          glow.addColorStop(1, "rgba(196,170,240,0)");
          context.fillStyle = glow;
          context.fillRect(head, owned.top - 4, 1.25, owned.height + 8);
          context.fillStyle = "rgba(196,170,240,0.08)";
          context.fillRect(head - 6, owned.top, 12, owned.height);
        }
      } else shown = smooth(0.1, 0.92, owned.landed / Math.max(1, owned.total));
      owned.element.style.setProperty("--dust", shown.toFixed(3));
    }

    if (!alive && flight.kind === "in") {
      for (const owned of words) {
        delete owned.element.dataset.dust;
        owned.element.style.removeProperty("--dust");
      }
    }
    if (!alive) flight.onDone?.();
    return alive;
  }

  return {
    form: (owner, words, options) => launch(owner, "in", words, options),
    crumble: (owner, words, options) => launch(owner, "out", words, options),
    cancel,
    setScrollSpeed: (pixelsPerSecond) => {
      scrollSpeed = Math.abs(pixelsPerSecond);
    },
    tick: (now) => {
      const delta = lastNow > 0 ? Math.min(0.1, now - lastNow) : 0;
      lastNow = now;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      drawn = 0;
      const anchor = flights.length > 0 ? anchorNow() : null;
      if (anchor) {
        const points = crack(anchor);
        flights = flights.filter((flight) => step(flight, now, delta, points));
      }
      const fast = clamp01((scrollSpeed - EXPOSURE.from) / (EXPOSURE.fast - EXPOSURE.from));
      if (IN_SCENE && sceneDrawsBioDust()) {
        publishBioDust({
          grains,
          count: drawn,
          exposure: EXPOSURE.rest + (EXPOSURE.full - EXPOSURE.rest) * fast * fast,
        });
      } else {
        publishBioDust({ grains, count: 0, exposure: EXPOSURE.rest });
        drawFlat();
      }
    },
    destroy: () => {
      window.removeEventListener("resize", resize);
      flights = [];
      publishBioDust(null);
      canvas.remove();
    },
  };
}
