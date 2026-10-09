import { Color, SRGBColorSpace, Vector3, type PerspectiveCamera } from "three";

import { lightningConfig } from "../sceneConfig";

/** Shared by reference, so every consumer sees the very same flash this frame. */
export type WeatherUniforms = {
  uWeatherFlash: { value: number };
  uWeatherDirection: { value: Vector3 };
  uWeatherColor: { value: Vector3 };
  uWeatherCloudTime: { value: number };
  uWeatherCloudOctaves: { value: number };
};

export type WeatherState = Readonly<{
  storm: number;
  flash: number;
  direction: Vector3;
  strength: number;
  strikes: number;
}>;

export function createWeatherUniforms(): WeatherUniforms {
  const rgb = { r: 0, g: 0, b: 0 };
  new Color(lightningConfig.color).getRGB(rgb, SRGBColorSpace);
  return {
    uWeatherFlash: { value: 0 },
    uWeatherCloudTime: { value: 0 },
    uWeatherCloudOctaves: { value: 3 },
    uWeatherDirection: { value: new Vector3(0, 0.45, -1).normalize() },
    uWeatherColor: { value: new Vector3(rgb.r, rgb.g, rgb.b) },
  };
}

/** Directional cells shared by clouds, air, terrain and reflected cloud light. */
export const WEATHER_GLSL = /* glsl */ `
  uniform float uWeatherFlash;
  uniform vec3 uWeatherDirection;
  uniform vec3 uWeatherColor;

  float weatherHorizonCell(vec3 direction) {
    vec2 ray = direction.xz / max(length(direction.xz), 0.001);
    // A broad cloud bank, not a radial emitter. All air shares its diffuse lift.
    return smoothstep(-0.65, 0.55, dot(ray, normalize(uWeatherDirection.xz)));
  }
`;

export function createWeather(
  reducedMotion: boolean,
  random: () => number = Math.random,
  events: { onStrike?: (state: WeatherState) => void; onCancel?: () => void } = {},
  waitingForEntry = false,
) {
  const uniforms = createWeatherUniforms();
  const state = {
    storm: lightningConfig.storm,
    flash: 0,
    direction: uniforms.uWeatherDirection.value,
    strength: 0,
    strikes: 0,
  };
  const amplitudes = new Float32Array(4);
  const starts = new Float32Array(4);
  const attacks = new Float32Array(4);
  const decays = new Float32Array(4);
  const look = new Vector3();
  const gap = () =>
    lightningConfig.interval[0] +
    random() * (lightningConfig.interval[1] - lightningConfig.interval[0]);
  const firstGap = () =>
    lightningConfig.firstInterval[0] +
    random() * (lightningConfig.firstInterval[1] - lightningConfig.firstInterval[0]);
  const nextGap = () => (state.strikes === 0 ? firstGap() : gap());
  let remaining = firstGap();
  let experienceStarted = !waitingForEntry;
  let age = -1;
  let announced = false;
  let stormTarget: number = lightningConfig.storm;
  let destroyed = false;
  let motionSuppressed = reducedMotion;

  const clearFlash = () => {
    age = -1;
    state.flash = 0;
    uniforms.uWeatherFlash.value = 0;
  };

  const sample = (seconds: number) => {
    if (destroyed || motionSuppressed || age < 0) return;
    age = seconds;
    if (age >= lightningConfig.duration) {
      clearFlash();
      return;
    }
    let envelope = 0;
    for (let i = 0; i < 4; i++) {
      const t = age - starts[i]!;
      if (t < 0 || t > attacks[i]! + decays[i]! * 5) continue;
      const pulse = t < attacks[i]! ? t / attacks[i]! : Math.exp(-(t - attacks[i]!) / decays[i]!);
      envelope = Math.max(envelope, amplitudes[i]! * pulse);
    }
    state.flash = envelope * state.strength * lightningConfig.maxFlash;
    uniforms.uWeatherFlash.value = state.flash;
    if (!announced && state.flash > 0) {
      announced = true;
      events.onStrike?.(state);
    }
  };
  const trigger = (camera: PerspectiveCamera) => {
    if (destroyed || motionSuppressed) return false;
    camera.getWorldDirection(look);
    const horizontalHalfFov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    const heading = Math.atan2(look.x, look.z) + (random() - 0.5) * horizontalHalfFov;
    state.direction.set(Math.sin(heading), 0.36 + random() * 0.19, Math.cos(heading)).normalize();
    state.strength = (0.65 + random() * 0.35) * (camera.aspect < 1 ? 0.85 : 1);
    starts.set([0.015, 0.34 + random() * 0.12, 0.73 + random() * 0.14, 1.15 + random() * 0.16]);
    for (let i = 0; i < 4; i++) {
      amplitudes[i] = i === 0 ? 1 : (0.65 - i * 0.13) * (0.8 + random() * 0.2);
      attacks[i] = 0.004 + random() * 0.004;
      decays[i] = 0.04 + random() * 0.012;
    }
    age = 0;
    announced = false;
    state.strikes++;
    remaining = gap();
    return true;
  };
  return {
    uniforms,
    /** Arm once from entry, independently of the sound choice or section changes. */
    beginExperience: (elapsedSinceEntry = 0) => {
      if (experienceStarted || destroyed) return;
      experienceStarted = true;
      remaining = Math.max(0, remaining - Math.max(0, elapsedSinceEntry));
    },
    setStormTarget: (value: number) => {
      stormTarget = Math.max(0, Math.min(1, value));
    },
    state: state as WeatherState,
    trigger,
    /** Analytical event sampling used by the development-only visual capture. */
    sample,
    peakTime: () => starts[0]! + attacks[0]!,
    flickerTimes: () => Array.from(starts, (start, i) => start + attacks[i]!),
    setReducedMotion: (reduce: boolean) => {
      if (reduce !== motionSuppressed) {
        motionSuppressed = reduce;
        if (reduce) events.onCancel?.();
        clearFlash();
        remaining = nextGap();
      }
    },
    update: (deltaSeconds: number, camera: PerspectiveCamera, allowNewStrike = true) => {
      if (destroyed || motionSuppressed || !experienceStarted) return;
      const delta = Math.max(0, Math.min(0.1, deltaSeconds));
      // Audio character eases between chapters; approved visual parameters stay fixed.
      state.storm += (stormTarget - state.storm) * (1 - Math.exp(-delta / 5));
      remaining -= delta;
      if (age < 0 && remaining <= 0 && allowNewStrike) trigger(camera);
      if (age >= 0) {
        const previousAge = age;
        sample(age + delta);
        // Preserve peaks crossed between display frames, including 30 fps.
        // The analytical sample API remains exact for still-frame comparisons.
        for (let i = 0; i < 4; i++) {
          const peak = starts[i]! + attacks[i]!;
          if (previousAge < peak && age >= peak) {
            state.flash = Math.max(
              state.flash,
              amplitudes[i]! * state.strength * lightningConfig.maxFlash,
            );
            uniforms.uWeatherFlash.value = state.flash;
          }
        }
      }
    },
    /** Hidden page/context suspension cancels a strike, never replays it on return. */
    suspend: () => {
      events.onCancel?.();
      clearFlash();
      remaining = nextGap();
    },
    destroy: () => {
      events.onCancel?.();
      destroyed = true;
      clearFlash();
    },
  };
}
