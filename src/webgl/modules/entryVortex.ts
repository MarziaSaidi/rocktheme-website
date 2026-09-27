import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  type WebGLRenderer,
} from "three";

/**
 * The spinning passage inside the ring of stones, made of light.
 *
 * Particles in the violet the doorway's cracks glow with, laid along
 * logarithmic spiral arms around the ring's centre. The pattern turns as one,
 * so the arms keep their shape, and each particle flows inward along its arm
 * to the bright core, where it begins again at the rim. The passage is never
 * larger than `radius`, which the caller keeps inside the ring's stones.
 *
 * `boom`, 0 to 1, is the end: the particles burst outward past every edge in
 * a flash of the same violet, and fade.
 *
 * Screen space throughout: centre and sizes in CSS pixels. Nothing allocates
 * per frame.
 */

export type EntryVortex = Readonly<{
  /** In CSS pixels from the top left; radius 0 draws nothing. */
  set: (state: { x: number; y: number; radius: number; boom: number; time: number }) => void;
  render: (renderer: WebGLRenderer, height: number) => void;
  dispose: () => void;
}>;

/** How many particles make the passage. */
const COUNT = 120000;
/** Spiral arms. */
const ARMS = 4;
/** Share of the particles on the arms; the rest are the faint dust between them. */
const ON_ARMS = 0.86;

/*
 * The crack light: deep, core and hot violet (crackEnergy.ts), written in
 * display values here because this pass draws straight to the screen.
 */
const SHARED_GLSL = /* glsl */ `
  const vec3 CRACK_DEEP = vec3(0.545, 0.361, 0.965);
  const vec3 CRACK_CORE = vec3(0.663, 0.439, 1.0);
  const vec3 CRACK_HOT = vec3(0.718, 0.549, 1.0);
`;

const PARTICLE_VERTEX = /* glsl */ `
  uniform vec2 uCentre;
  uniform vec2 uResolution;
  uniform float uRadius;
  uniform float uTime;
  uniform float uBoom;
  uniform float uPixelRatio;
  // x: the arm's angle, y: offset from the arm (radians at the rim),
  // z: flow phase, w: brightness and size, negative for dust.
  attribute vec4 aSeed;
  varying float vHeat;
  varying float vAlpha;

  void main() {
    bool dust = aSeed.w < 0.0;
    float weight = abs(aSeed.w);

    // Along the arm toward the core, then out to the rim again.
    float flow = fract(aSeed.z - uTime * 0.06);
    float rn = mix(0.015, 1.0, pow(flow, 0.62));

    // A logarithmic spiral turning as one: the shape never smears.
    float angle = aSeed.x + 2.1 * log(rn + 0.02) + uTime * 1.05;
    // Arms are fine at the core and widen toward the rim.
    angle += aSeed.y * (0.35 + 0.65 * rn);

    float r = rn * uRadius;
    // The burst: out past every edge, the fast ones first.
    float blast = pow(uBoom, 1.25) * (5.0 + fract(aSeed.z * 17.3) * 9.0);
    r *= 1.0 + blast;

    vec2 position = uCentre + vec2(cos(angle), sin(angle)) * r;
    gl_Position = vec4(position / uResolution * 2.0 - 1.0, 0.0, 1.0);

    // Larger as the passage grows, so it stays as dense as it began.
    float grown = clamp(sqrt(uRadius / (300.0 * uPixelRatio)), 1.0, 2.8);
    gl_PointSize = (dust ? 1.0 : 1.1 + weight * 1.9) * uPixelRatio * grown
      * (0.75 + 0.5 * rn) * (1.0 + uBoom * 2.2);

    vHeat = clamp((1.0 - rn) * 0.9 + weight * 0.25, 0.0, 1.0);
    // Faint at the very rim, so nothing reads as touching the stones.
    float rim = 1.0 - smoothstep(0.86, 1.0, rn);
    float fade = 1.0 - smoothstep(0.35, 1.0, uBoom);
    vAlpha = (dust ? 0.22 : 0.5 + weight * 0.5) * mix(rim, 1.0, uBoom) * fade;
  }
`;

const PARTICLE_FRAGMENT = /* glsl */ `
  ${SHARED_GLSL}
  varying float vHeat;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, d);
    glow *= glow;
    vec3 colour = mix(CRACK_DEEP, CRACK_CORE, smoothstep(0.1, 0.55, vHeat));
    colour = mix(colour, CRACK_HOT, smoothstep(0.55, 1.0, vHeat));
    gl_FragColor = vec4(colour * glow * vAlpha, 1.0);
  }
`;

/*
 * Beneath the particles: the passage's body, a soft violet glow brightest at
 * the core, and the flash of the burst across the whole screen.
 */
const BASE_FRAGMENT = /* glsl */ `
  ${SHARED_GLSL}
  uniform vec2 uCentre;
  uniform float uRadius;
  uniform float uBoom;

  void main() {
    float d = distance(gl_FragCoord.xy, uCentre);
    float r = d / max(uRadius, 1.0);
    float body = (1.0 - smoothstep(0.0, 0.95, r)) * 0.16 * (1.0 - uBoom);
    float core = exp(-r * r * 60.0) * 0.55 * (1.0 - uBoom);
    float flash = sin(3.14159 * clamp(uBoom * 1.8, 0.0, 1.0)) * 0.32;
    vec3 colour = CRACK_DEEP * 0.3 * body + CRACK_HOT * core + CRACK_CORE * flash;
    gl_FragColor = vec4(colour, 1.0);
  }
`;

export function createEntryVortex(): EntryVortex {
  const seeds = new Float32Array(COUNT * 4);
  // A normal spread about the arm, from two uniforms.
  const gaussian = () =>
    Math.sqrt(-2 * Math.log(Math.max(1e-6, Math.random()))) * Math.cos(2 * Math.PI * Math.random());
  for (let i = 0; i < COUNT; i += 1) {
    const onArm = Math.random() < ON_ARMS;
    const arm = Math.floor(Math.random() * ARMS);
    seeds[i * 4] = (arm / ARMS) * Math.PI * 2;
    seeds[i * 4 + 1] = onArm ? gaussian() * 0.16 : (Math.random() - 0.5) * ((Math.PI * 2) / ARMS);
    seeds[i * 4 + 2] = Math.random();
    const weight = Math.max(Math.pow(Math.random(), 2.4), 0.001);
    seeds[i * 4 + 3] = onArm ? weight : -weight;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 4));

  const shared = {
    uCentre: { value: new Vector2() },
    uRadius: { value: 0 },
    uBoom: { value: 0 },
  };
  const particleMaterial = new ShaderMaterial({
    uniforms: {
      ...shared,
      uResolution: { value: new Vector2(1, 1) },
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: PARTICLE_VERTEX,
    fragmentShader: PARTICLE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: AdditiveBlending,
  });
  const baseMaterial = new ShaderMaterial({
    uniforms: shared,
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: BASE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: AdditiveBlending,
  });

  const scene = new Scene();
  const base = new Mesh(new PlaneGeometry(2, 2), baseMaterial);
  const particles = new Points(geometry, particleMaterial);
  particles.frustumCulled = false;
  base.renderOrder = 0;
  particles.renderOrder = 1;
  scene.add(base, particles);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const state = { x: 0, y: 0, radius: 0 };
  const size = new Vector2();

  return {
    set: (next) => {
      state.x = next.x;
      state.y = next.y;
      state.radius = next.radius;
      shared.uBoom.value = next.boom;
      particleMaterial.uniforms.uTime!.value = next.time;
    },
    render: (renderer, height) => {
      if (state.radius <= 0) return;
      const ratio = renderer.getPixelRatio();
      renderer.getDrawingBufferSize(size);
      shared.uCentre.value.set(state.x * ratio, (height - state.y) * ratio);
      shared.uRadius.value = state.radius * ratio;
      particleMaterial.uniforms.uResolution!.value.copy(size);
      particleMaterial.uniforms.uPixelRatio!.value = ratio;
      renderer.render(scene, camera);
    },
    dispose: () => {
      geometry.dispose();
      particleMaterial.dispose();
      baseMaterial.dispose();
      base.geometry.dispose();
    },
  };
}
