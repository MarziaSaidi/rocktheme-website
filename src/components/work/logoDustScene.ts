import type * as Three from "three";

/**
 * Wordmarks drawn in particles, for the Work index.
 *
 * Each project's wordmark is sampled into points: dense on the letters, a
 * faint layer behind the face so the mark has depth when it tilts, a loose halo
 * and a few motes. One number per mark, its form, runs from 0 (dust) to 1
 * (the mark). Lowering it lets each grain go at its own moment, ragged edges
 * first, lifting and drifting up; raising it gathers them back. At rest a few
 * grains keep lifting off the edges, slowly.
 *
 * Its own small WebGL layer above the landscape: the scene is untouched.
 */

export type Wordmark = Readonly<{ src: string; width: number; aspect: number }>;

export type LogoDustScene = Readonly<{
  /** Starts the mark at `index` gathering and every other one coming apart. */
  show: (index: number, instant?: boolean) => void;
  /** Gathers the shown mark from dust, once it is built: the index's first appearance. */
  intro: () => Promise<void>;
  resize: (width: number, height: number) => void;
  pointer: (x: number, y: number, inside: boolean) => void;
  setRunning: (running: boolean) => void;
  destroy: () => void;
}>;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function hash(x: number, y: number, seed: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/** Moonlit lavender, the world's own light (--color-text-moonlit). */
const TINT = [196, 170, 240] as const;

/** The mark's size on screen: its desktop width, narrower on a phone. */
function markSize(mark: Wordmark, viewportWidth: number) {
  const width = viewportWidth < 768 ? Math.min(mark.width * 0.5, viewportWidth - 48) : mark.width;
  return { width, height: width / mark.aspect, step: viewportWidth < 768 ? 1.1 : 1.6 };
}

async function sampleMark(
  THREE: typeof Three,
  mark: Wordmark,
  viewportWidth: number,
  seed: number,
) {
  const { width: w, height: h, step } = markSize(mark, viewportWidth);
  const image = await loadImage(mark.src);
  const sw = Math.max(1, Math.round(w / step));
  const sh = Math.max(1, Math.round(h / step));
  // Each cell keeps its strongest coverage of a 3×3 sample, so hairline serifs survive.
  const K = 3;
  const coverage = document.createElement("canvas");
  coverage.width = sw * K;
  coverage.height = sh * K;
  const cx = coverage.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(image, 0, 0, coverage.width, coverage.height);
  const raw = cx.getImageData(0, 0, coverage.width, coverage.height).data;
  const blurred = document.createElement("canvas");
  blurred.width = sw;
  blurred.height = sh;
  const bx = blurred.getContext("2d", { willReadFrequently: true })!;
  bx.filter = "blur(3px)";
  bx.drawImage(image, 0, 0, sw, sh);
  const halo = bx.getImageData(0, 0, sw, sh).data;

  const [tr, tg, tb] = TINT;
  const light = [255 * 0.62 + tr * 0.38, 255 * 0.62 + tg * 0.38, 255 * 0.62 + tb * 0.38];
  const position: number[] = [];
  const colour: number[] = [];
  const random: number[] = [];
  const edge: number[] = [];
  const push = (
    x: number,
    y: number,
    z: number,
    rgb: readonly number[],
    alpha: number,
    r: readonly number[],
    e: number,
  ) => {
    position.push(x, y, z);
    colour.push(rgb[0]! / 255, rgb[1]! / 255, rgb[2]! / 255, alpha);
    random.push(...r);
    edge.push(e);
  };

  const unit = w / mark.width;
  const band = 30 * unit;
  for (let j = 0; j < sh; j += 1) {
    for (let i = 0; i < sw; i += 1) {
      let alpha = 0;
      let best = 0;
      for (let y = 0; y < K; y += 1) {
        for (let x = 0; x < K; x += 1) {
          const q = ((j * K + y) * coverage.width + i * K + x) * 4;
          if (raw[q + 3]! > alpha) {
            alpha = raw[q + 3]!;
            best = q;
          }
        }
      }
      alpha /= 255;
      const r1 = hash(i, j, seed);
      const r2 = hash(j, i, seed + 7);
      const r3 = hash(i + 3, j + 5, seed);
      const x0 = (i + 0.5) * step + (r1 - 0.5) * step * 0.4;
      const y0 = (j + 0.5) * step + (r2 - 0.5) * step * 0.4;
      const n = noise(x0 / 40, y0 / 40, seed);
      const fromEdge = Math.min(x0, w - x0, y0, h - y0);
      const fray = clamp(1 - fromEdge / band + (n - 0.5) * 0.8) * 0.6;
      const X = x0 - w / 2;
      const Y = h / 2 - y0;
      if (alpha > 0.12) {
        // A brand colour in the mark (Survue's chevron) keeps its own colour.
        const branded = raw[best]! - raw[best + 2]! > 60;
        const rgb = branded ? [raw[best]!, raw[best + 1]!, raw[best + 2]!] : light;
        // A few grains always lift off the letters.
        const lift = r3 > 0.985 ? 0.35 + r1 * 0.5 : 0;
        push(
          X,
          Y,
          (r1 - 0.5) * 5,
          rgb,
          0.55 + 0.45 * alpha,
          [r1, r2, r3, n],
          Math.max(r3 > 0.6 ? fray : 0, lift),
        );
        // Depth: a fainter layer behind the face.
        if (r2 < 0.22) push(X, Y, -10 - r3 * 22, rgb, 0.2 + 0.2 * alpha, [r2, r1, r3, n], 0);
      } else {
        const around = halo[(j * sw + i) * 4 + 3]! / 255;
        if (around > 0.05 && r1 < around * 0.22) {
          push(X, Y, (r2 - 0.5) * 50, TINT, 0.1 + around * 0.25, [r1, r2, r3, n], 0.4 + r3 * 0.5);
        }
      }
    }
  }
  // Loose motes around the mark, always drifting.
  for (let m = 0; m < 220; m += 1) {
    const angle = hash(m, 3, seed) * Math.PI * 2;
    const radius = Math.sqrt(hash(m, 5, seed));
    push(
      Math.cos(angle) * radius * (w * 0.62 + 50),
      Math.sin(angle) * radius * (h * 1.4 + 70),
      (hash(m, 15, seed) - 0.5) * 140,
      TINT,
      (0.04 + hash(m, 11, seed) * 0.22) * (radius > 0.5 ? 1 : 0.5),
      [hash(m, 7, seed), hash(m, 9, seed), hash(m, 13, seed), hash(m, 17, seed)],
      0.6 + hash(m, 19, seed) * 0.4,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("aCol", new THREE.Float32BufferAttribute(colour, 4));
  geometry.setAttribute("aRnd", new THREE.Float32BufferAttribute(random, 4));
  geometry.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1));
  return { geometry, step };
}

const vertexShader = /* glsl */ `
  attribute vec4 aCol;
  attribute vec4 aRnd;
  attribute float aEdge;
  uniform float uTime, uForm, uLift, uStep, uPixelRatio, uCameraZ, uPointer, uMotion;
  uniform vec2 uPointerAt;
  varying vec4 vCol;
  void main() {
    // Coming apart: each grain lets go at its own moment, ragged edges first.
    float leave = clamp((1.0 - uForm) * 1.6 - (1.0 - aRnd.w) * 0.5 - aRnd.x * 0.25, 0.0, 1.0);
    // The edges keep shedding in slow cycles, like smoke.
    float cycle = fract(uTime * 0.018 * (0.55 + aRnd.y) + aRnd.z);
    float shed = max(leave, aEdge * (0.3 + 0.7 * cycle) * uMotion);
    float fade = aEdge > 0.03 && uMotion > 0.5
      ? smoothstep(0.0, 0.18, cycle) * (1.0 - smoothstep(0.7, 1.0, cycle))
      : 1.0;
    fade = mix(fade, 1.0, leave);

    vec3 p = position;
    vec2 outward = p.xy / max(length(p.xy), 1.0);
    float travel = shed * shed * uLift * (0.4 + aRnd.x);
    float swirl = sin(aRnd.w * 6.2832 + aRnd.x * 3.0 + uTime * 0.08) * travel * 0.2;
    p.x += outward.x * travel * 0.55 - outward.y * swirl;
    p.y += outward.y * travel * 0.35 + travel * 0.75;
    p.z += (aRnd.y - 0.5) * travel * 0.9;
    // Breathing: every grain moves a little, never in step.
    p.xy += vec2(sin(uTime * 0.5 + aRnd.x * 40.0), cos(uTime * 0.43 + aRnd.y * 40.0))
      * (0.15 + shed * 1.1) * uMotion;

    // The pointer parts the dust and lights it.
    vec2 away = p.xy - uPointerAt;
    float distance = length(away);
    float push = uPointer * smoothstep(90.0, 0.0, distance);
    p.xy += (away / max(distance, 1.0)) * push * 14.0 * (0.4 + aRnd.z);

    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    float alpha = aCol.a * (1.0 - 0.7 * shed) * fade * (1.0 - smoothstep(0.82, 1.0, leave));
    vCol = vec4(aCol.rgb * (1.0 + push * 0.8), alpha * (1.0 + push * 0.6));
    gl_PointSize = uStep * (0.4 + aCol.a * 0.5) * (1.0 - 0.35 * shed) * 2.0 * uPixelRatio
      * (uCameraZ / -view.z);
  }`;

const fragmentShader = /* glsl */ `
  varying vec4 vCol;
  void main() {
    float alpha = vCol.a * smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5));
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(vCol.rgb * alpha, alpha);
  }`;

/** Where the mark's centre sits, as a share of the viewport's height. */
const CENTRE = { desktop: 0.436, phone: 0.37 };
/** How long a mark takes to come apart and to gather, in ms. */
const LEAVE_MS = 1400;
const GATHER_MS = 2700;
const GATHER_DELAY_MS = 250;

export async function createLogoDust(
  canvas: HTMLCanvasElement,
  marks: readonly (Wordmark | null)[],
  reducedMotion: boolean,
): Promise<LogoDustScene | null> {
  const THREE = await import("three");
  let renderer: Three.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 6000);
  const clock = new THREE.Clock();

  type Mark = {
    group: Three.Group;
    points: Three.Points;
    material: Three.ShaderMaterial;
    form: number;
    from: number;
    to: number;
    startAt: number;
    duration: number;
  };
  let built: (Mark | null)[] = [];
  let shown = 0;
  let width = 1;
  let height = 1;
  const pointer = { x: 0, y: 0, inside: false, tiltX: 0, tiltY: 0, targetX: 0, targetY: 0, on: 0 };

  // A resize can ask for a new build while one is loading: only the latest one is kept.
  let buildToken = 0;
  const dispose = (marks: readonly (Mark | null)[]) => {
    for (const mark of marks) {
      if (!mark) continue;
      scene.remove(mark.group);
      mark.points.geometry.dispose();
      mark.material.dispose();
    }
  };
  const build = async () => {
    const token = ++buildToken;
    const next = await Promise.all(
      marks.map(async (mark, index) => {
        if (!mark) return null;
        const { geometry, step } = await sampleMark(THREE, mark, width, 3 + index * 2);
        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.CustomBlending,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
          blendSrcAlpha: THREE.OneFactor,
          blendDstAlpha: THREE.OneFactor,
          uniforms: {
            uTime: { value: 0 },
            uForm: { value: index === shown ? 1 : 0 },
            uLift: { value: width < 768 ? 66 : 108 },
            uStep: { value: step },
            uPixelRatio: { value: renderer.getPixelRatio() },
            uCameraZ: { value: 1 },
            uPointer: { value: 0 },
            uPointerAt: { value: new THREE.Vector2(9e4, 9e4) },
            uMotion: { value: reducedMotion ? 0 : 1 },
          },
        });
        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        const group = new THREE.Group();
        group.add(points);
        const form = index === shown ? 1 : 0;
        return { group, points, material, form, from: form, to: form, startAt: 0, duration: 1 };
      }),
    );
    if (token !== buildToken) {
      dispose(next);
      return;
    }
    // A rebuild keeps each mark where it was in its gathering or coming apart.
    next.forEach((mark, index) => {
      const previous = built[index];
      if (!mark) return;
      if (previous) {
        mark.form = previous.form;
        mark.from = previous.from;
        mark.to = previous.to;
        mark.startAt = previous.startAt;
        mark.duration = previous.duration;
      }
      scene.add(mark.group);
    });
    dispose(built);
    built = next;
    place();
  };

  const place = () => {
    const z = height / 2 / Math.tan((15 * Math.PI) / 180);
    camera.position.set(0, 0, z);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const centre = (width < 768 ? CENTRE.phone : CENTRE.desktop) * height;
    const scale = width < 768 ? 1 : Math.min(width / 1440, height / 900);
    for (const mark of built) {
      if (!mark) continue;
      mark.group.position.set(0, height / 2 - centre, 0);
      mark.group.scale.setScalar(scale);
      mark.material.uniforms.uCameraZ!.value = z;
      mark.material.uniforms.uPixelRatio!.value = renderer.getPixelRatio();
    }
  };

  const animate = (mark: Mark, to: number, delay: number, duration: number, now: number) => {
    mark.from = mark.form;
    mark.to = to;
    mark.startAt = now + delay;
    mark.duration = duration;
  };

  let running = true;
  let frame = 0;
  const tick = () => {
    frame = 0;
    const now = performance.now();
    const time = clock.getElapsedTime();
    pointer.tiltX += (pointer.targetX - pointer.tiltX) * 0.04;
    pointer.tiltY += (pointer.targetY - pointer.tiltY) * 0.04;
    pointer.on += ((pointer.inside ? 1 : 0) - pointer.on) * 0.06;
    let moving = false;
    for (const mark of built) {
      if (!mark) continue;
      if (now >= mark.startAt) {
        const t = clamp((now - mark.startAt) / mark.duration);
        mark.form = mark.from + (mark.to - mark.from) * ease(t);
        if (t < 1) moving = true;
      } else {
        moving = true;
      }
      mark.group.visible = mark.form > 0.001 || mark.to > 0;
      mark.group.rotation.y = reducedMotion ? 0 : pointer.tiltX * 0.07;
      mark.group.rotation.x = reducedMotion ? 0 : pointer.tiltY * 0.045;
      const uniforms = mark.material.uniforms;
      uniforms.uTime!.value = reducedMotion ? 0 : time;
      uniforms.uForm!.value = mark.form;
      uniforms.uPointer!.value = reducedMotion ? 0 : pointer.on;
      const scale = mark.group.scale.x;
      (uniforms.uPointerAt!.value as Three.Vector2).set(
        (pointer.x - width / 2) / scale,
        (height / 2 - pointer.y - mark.group.position.y) / scale,
      );
    }
    renderer.render(scene, camera);
    // Reduced motion draws only while a mark changes; otherwise it is a still.
    if (running && (!reducedMotion || moving)) frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (running && frame === 0) frame = requestAnimationFrame(tick);
  };

  let ready: Promise<void> = Promise.resolve();
  const resize = (nextWidth: number, nextHeight: number) => {
    const rebuild = nextWidth < 768 !== width < 768 || buildToken === 0;
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    if (rebuild) ready = build().then(wake);
    else place();
    wake();
  };

  return {
    show(index, instant = false) {
      if (index === shown && !instant) return;
      const now = performance.now();
      built.forEach((mark, i) => {
        if (!mark) return;
        if (instant || reducedMotion) {
          mark.form = i === index ? 1 : 0;
          mark.from = mark.to = mark.form;
          mark.startAt = 0;
        } else if (i === index) animate(mark, 1, GATHER_DELAY_MS, GATHER_MS, now);
        else if (mark.form > 0 || mark.to > 0) animate(mark, 0, 0, LEAVE_MS, now);
      });
      shown = index;
      wake();
    },
    async intro() {
      await ready;
      const mark = built[shown];
      if (!mark || reducedMotion) return;
      mark.form = 0;
      animate(mark, 1, 120, GATHER_MS + 600, performance.now());
      wake();
    },
    resize,
    pointer(x, y, inside) {
      pointer.x = x;
      pointer.y = y;
      pointer.inside = inside;
      pointer.targetX = (x / width - 0.5) * 2;
      pointer.targetY = (y / height - 0.5) * 2;
      wake();
    },
    setRunning(next) {
      running = next;
      if (next) wake();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    destroy() {
      running = false;
      buildToken += 1;
      if (frame) cancelAnimationFrame(frame);
      dispose(built);
      built = [];
      renderer.dispose();
    },
  };
}
