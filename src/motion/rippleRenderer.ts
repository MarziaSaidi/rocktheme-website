/**
 * Ripple reveal renderer.
 *
 * Draws a display heading into a texture, exactly where the page sets it, and
 * reveals it on a single travelling wave: the wave bends and leans the glyphs
 * as it passes, splits them into lavender and botanical fringes, and lights
 * them moonlit at its edge. Every distortion is bell-gated, so the first and
 * last frames are the plain heading, and the caller can hand over to the real
 * text without a visible change.
 *
 * The heading itself never moves or changes. This module only adds a canvas
 * beside it for the length of the reveal and removes it again, so the page's
 * text stays the text people read, select and hear.
 *
 * Returns null when WebGL is unavailable; the caller then keeps the heading's
 * own CSS entrance.
 */

export const RIPPLE = {
  /** The reveal's length. */
  durationMs: 1500,
  /** Displacement at the wave, in heading widths. */
  strength: 0.055,
  /** Extra lean across the wave. */
  shear: 0.05,
  /** Wave frequency across the heading. */
  frequency: 9,
  /** How tight the wave packet is. */
  width: 18,
  /** Colour split at the wave. */
  chroma: 0.016,
  /** Moonlit light on the glyphs at the reveal edge. */
  glow: 0.32,
  /** Trailing ghosts. Faint: on the dark sky a strong ghost reads as a shadow. */
  ghost: 0.16,
  /** Room around the text for the wave to spill into, as fractions of its box. */
  padX: 0.14,
  padY: 0.18,
} as const;

/* GSAP's expoScale(10, 2): a burst, then a long exponential settle. */
const expoScale = (x: number) => (10 - 10 * Math.pow(0.2, x)) / 8;

const VERTEX = `attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT = `precision highp float;
uniform sampler2D uTex;
uniform float uP;
uniform float uT;
uniform vec2 uPad;
uniform float uAspect;
uniform float uStrength;
uniform float uShear;
uniform float uFreq;
uniform float uWidth;
uniform float uChroma;
uniform float uGlow;
uniform float uGhost;
varying vec2 vUv;

vec4 tex(vec2 uv) {
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return texture2D(uTex, clamp(uv, 0.0, 1.0)) * inside.x * inside.y;
}

void main() {
  // Brand colours only: lavender #b793d2, botanical #a8c947, moonlit #c4aaf0.
  const vec3 LAVENDER = vec3(0.718, 0.576, 0.824);
  const vec3 BOTANICAL = vec3(0.659, 0.788, 0.278);
  const vec3 MOONLIT = vec3(0.769, 0.667, 0.941);

  float p = clamp(uP, 0.0, 1.0);
  vec2 tuv = (vUv - uPad) / (1.0 - 2.0 * uPad);
  float dist = length(tuv - 0.5);
  float radius = p * 1.2;
  float ring = dist - radius;
  float bell = p * (1.0 - p) * 4.0;
  float wave = sin(ring * uFreq - uT * 1.5) * exp(-ring * ring * uWidth);

  vec2 dir = normalize((tuv - 0.5) * vec2(uAspect, 1.0) + 0.0001);
  dir.x /= uAspect;
  vec2 perp = vec2(-dir.y, dir.x);
  // Push along the radius, plus a lean across it: the glyphs shear as it passes.
  vec2 disp = (dir * uStrength + perp * uShear * sign(tuv.y - 0.5)) * wave * bell;
  vec2 uv = vUv - disp;

  float ca = (abs(wave) * uChroma + 0.004) * bell;
  vec4 R = tex(uv + dir * ca);
  vec4 G = tex(uv);
  vec4 B = tex(uv - dir * ca);

  // Fringes are laid under the glyph as real colour: the compositor clamps
  // light-adding pixels to grey.
  float k = min(1.0, bell * 1.6);
  float fl = R.a * k * 0.85;
  float fb = B.a * k * 0.85;
  vec4 under = vec4(BOTANICAL * fb, fb) + vec4(LAVENDER * fl, fl) * (1.0 - fb);
  vec4 colour = G + under * (1.0 - G.a);

  vec4 E1 = tex(uv + dir * ca * 2.2);
  vec4 E2 = tex(uv - dir * ca * 2.2);
  float ghost = uGhost * bell * smoothstep(0.35, 0.0, abs(ring));
  float g1 = E1.a * ghost;
  float g2 = E2.a * ghost;
  vec4 ghosts = vec4(BOTANICAL * g2, g2) + vec4(LAVENDER * g1, g1) * (1.0 - g2);
  colour = colour + ghosts * (1.0 - colour.a);

  float reveal = smoothstep(radius, radius - 0.15, dist);
  float glow = exp(-abs(ring) * 20.0) * uGlow * bell;
  colour.rgb = mix(colour.rgb, MOONLIT * colour.a, clamp(glow, 0.0, 1.0));
  gl_FragColor = colour * reveal;
}`;

export type RippleRenderer = Readonly<{
  /** Plays the reveal; resolves when the last frame is the plain heading. */
  play: () => Promise<void>;
  /** Jumps to the settled frame and resolves `play` early. */
  finish: () => void;
  /** Removes the canvas and releases the context. */
  destroy: () => void;
}>;

const STRETCH_KEYWORDS: readonly [number, CanvasFontStretch][] = [
  [56.25, "ultra-condensed"],
  [68.75, "extra-condensed"],
  [81.25, "condensed"],
  [93.75, "semi-condensed"],
  [106.25, "normal"],
  [118.75, "semi-expanded"],
  [137.5, "expanded"],
  [175, "extra-expanded"],
];

function stretchKeyword(value: string): CanvasFontStretch {
  const percent = parseFloat(value);
  if (!Number.isFinite(percent)) return "normal";
  return STRETCH_KEYWORDS.find(([limit]) => percent < limit)?.[1] ?? "ultra-expanded";
}

/**
 * The line's fill: a horizontal gradient clipped to the text, or its colour.
 * Computed gradients report their stops in pixels, measured from the line.
 */
function lineFill(
  context: CanvasRenderingContext2D,
  style: CSSStyleDeclaration,
  x: number,
): string | CanvasGradient {
  const clip = style.backgroundClip || style.getPropertyValue("-webkit-background-clip");
  const image = style.backgroundImage;
  if (clip === "text" && image.startsWith("linear-gradient(90deg")) {
    const stops = [...image.matchAll(/(rgba?\([^)]*\))\s+(-?[\d.]+)px/g)].map((match) => ({
      colour: match[1]!,
      at: parseFloat(match[2]!),
    }));
    const last = stops[stops.length - 1];
    if (stops.length >= 2 && last && last.at > 0) {
      const gradient = context.createLinearGradient(x, 0, x + last.at, 0);
      stops.forEach((stop) => gradient.addColorStop(Math.min(1, stop.at / last.at), stop.colour));
      return gradient;
    }
  }
  const colour = style.color;
  return colour === "rgba(0, 0, 0, 0)" ? "#f3f3f5" : colour;
}

export function createRippleRenderer(heading: HTMLElement): RippleRenderer | null {
  const lines = [...heading.querySelectorAll<HTMLElement>("[data-line-index]")];
  const parent = heading.parentElement;
  if (lines.length === 0 || !parent) return null;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;pointer-events:none;z-index:1;";
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    p: uniform("uP"),
    t: uniform("uT"),
    pad: uniform("uPad"),
    aspect: uniform("uAspect"),
  };
  gl.uniform1i(uniform("uTex"), 0);
  gl.uniform1f(uniform("uStrength"), RIPPLE.strength);
  gl.uniform1f(uniform("uShear"), RIPPLE.shear);
  gl.uniform1f(uniform("uFreq"), RIPPLE.frequency);
  gl.uniform1f(uniform("uWidth"), RIPPLE.width);
  gl.uniform1f(uniform("uChroma"), RIPPLE.chroma);
  gl.uniform1f(uniform("uGlow"), RIPPLE.glow);
  gl.uniform1f(uniform("uGhost"), RIPPLE.ghost);
  const texture = gl.createTexture();
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let restorePosition: string | null = null;
  let frame = 0;
  let settle: (() => void) | null = null;
  let finished = false;

  /** Sizes the canvas over the text and paints the heading into the texture. */
  const rasterise = async () => {
    const inner = lines[0]!.querySelector<HTMLElement>("[data-line-inner]") ?? lines[0]!;
    const style = getComputedStyle(inner);
    const size = parseFloat(style.fontSize);
    const font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
    await document.fonts.load(font).catch(() => undefined);

    if (getComputedStyle(parent).position === "static") {
      restorePosition = parent.style.position;
      parent.style.position = "relative";
    }

    // The text's own box: the union of its lines, not the heading's column.
    const boxes = lines.map((line) => line.getBoundingClientRect());
    const left = Math.min(...boxes.map((b) => b.left));
    const top = Math.min(...boxes.map((b) => b.top));
    const right = Math.max(...boxes.map((b) => b.right));
    const bottom = Math.max(...boxes.map((b) => b.bottom));
    const width = right - left;
    const height = bottom - top;
    const padX = width * RIPPLE.padX;
    const padY = height * RIPPLE.padY;
    const cssW = width + padX * 2;
    const cssH = height + padY * 2;
    const origin = parent.getBoundingClientRect();
    canvas.style.left = `${left - padX - origin.left - parent.clientLeft}px`;
    canvas.style.top = `${top - padY - origin.top - parent.clientTop}px`;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const source = document.createElement("canvas");
    source.width = canvas.width;
    source.height = canvas.height;
    const context = source.getContext("2d");
    if (!context) return;
    context.scale(dpr, dpr);
    context.font = font;
    // Neither is in every browser; the width match below covers the gap.
    if ("fontStretch" in context) context.fontStretch = stretchKeyword(style.fontStretch);
    if ("letterSpacing" in context) {
      context.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
    }
    context.textBaseline = "alphabetic";
    const metrics = context.measureText("H");
    const ascent = metrics.fontBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent;
    const upper = style.textTransform === "uppercase";

    lines.forEach((line, index) => {
      const lineInner = line.querySelector<HTMLElement>("[data-line-inner]") ?? line;
      const lineStyle = getComputedStyle(lineInner);
      const node = [...lineInner.childNodes].find((child) => child.nodeType === Node.TEXT_NODE);
      const raw = (node?.textContent ?? lineInner.textContent ?? "").trim();
      if (!raw) return;
      const text = upper ? raw.toUpperCase() : raw;

      // The text's rendered width, trailing space excluded.
      let want = 0;
      if (node) {
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, (node.textContent ?? "").trimEnd().length);
        want = range.getBoundingClientRect().width;
      }
      const box = boxes[index]!;
      const x = box.left - left + padX;
      const lineHeight = parseFloat(lineStyle.lineHeight) || size;
      const baseline = box.top - top + padY + (lineHeight - (ascent + descent)) / 2 + ascent;
      const got = context.measureText(text).width;

      context.fillStyle = lineFill(context, lineStyle, x);
      context.save();
      context.translate(x, 0);
      // Match the page's width exactly, so the hand-over never shifts a glyph.
      if (want > 0 && got > 0) context.scale(want / got, 1);
      context.fillText(text, 0, baseline);
      context.restore();
    });

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(u.pad, padX / cssW, padY / cssH);
    gl.uniform1f(u.aspect, width / height);
  };

  const draw = (progress: number, seconds: number) => {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.p, progress);
    gl.uniform1f(u.t, seconds);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  return {
    play: async () => {
      finished = false;
      heading.insertAdjacentElement("afterend", canvas);
      await rasterise();
      if (finished) return;
      draw(0, 0);
      await new Promise<void>((resolve) => {
        settle = resolve;
        const start = performance.now();
        const step = (now: number) => {
          const x = Math.min(1, (now - start) / RIPPLE.durationMs);
          draw(expoScale(x), (now - start) / 1000);
          if (x < 1 && !finished) {
            frame = requestAnimationFrame(step);
          } else {
            finished = true;
            settle = null;
            resolve();
          }
        };
        frame = requestAnimationFrame(step);
      });
    },

    finish: () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      draw(1, 0);
      settle?.();
      settle = null;
    },

    destroy: () => {
      cancelAnimationFrame(frame);
      finished = true;
      settle?.();
      settle = null;
      canvas.remove();
      if (restorePosition !== null) parent.style.position = restorePosition;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
