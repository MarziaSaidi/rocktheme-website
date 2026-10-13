import { Color, Vector3, type PerspectiveCamera, type Texture } from "three";
import preset from "../weather/preset.json";
import { lightningConfig } from "../sceneConfig";

export type WeatherUniforms = {
  uWeatherFlash: { value: number };
  uWeatherReflection: { value: number };
  uWeatherDirection: { value: Vector3 };
  uWeatherColor: { value: Color };
  uWeatherCloudTime: { value: number };
  uWeatherCloudOctaves: { value: number };
  uWeatherSkyTexture: { value: Texture | null };
};
export type WeatherState = Readonly<{
  storm: number;
  flash: number;
  direction: Vector3;
  strength: number;
  strikes: number;
}>;
export function createWeatherUniforms(): WeatherUniforms {
  return {
    uWeatherFlash: { value: 0 },
    uWeatherReflection: { value: 0 },
    uWeatherDirection: { value: new Vector3(0, 0.4, -1).normalize() },
    uWeatherColor: { value: new Color(lightningConfig.color) },
    uWeatherCloudTime: { value: 0 },
    uWeatherCloudOctaves: { value: 6 },
    uWeatherSkyTexture: { value: null },
  };
}
export const WEATHER_GLSL = /* glsl */ `
  uniform float uWeatherFlash;
  uniform float uWeatherReflection;
  uniform vec3 uWeatherDirection;
  uniform vec3 uWeatherColor;
  float weatherHorizonCell(vec3 direction) {
    float ang = acos(clamp(dot(normalize(direction), uWeatherDirection), -1.0, 1.0));
    float cell = 1.0 - smoothstep(0.0, 0.55, ang);
    return cell * cell;
  }
`;

/** One active-time clock owns the four-pulse flash and its audio event. */
export function createWeather(
  reducedMotion: boolean,
  random: () => number = Math.random,
  events: { onStrike?: (state: WeatherState) => void; onCancel?: () => void } = {},
  waitingForEntry = false,
) {
  const uniforms = createWeatherUniforms();
  const settings = preset.sky.lightning;
  const state = {
    storm: settings.intensity,
    flash: 0,
    direction: uniforms.uWeatherDirection.value,
    strength: 1,
    strikes: 0,
  };
  let remaining = -1,
    age = -1;
  let started = !waitingForEntry,
    suppressed = reducedMotion,
    destroyed = false;
  const rand = (a: number, b: number) => a + random() * Math.max(0, b - a);
  const next = () => rand(settings.minInterval, settings.maxInterval);
  const clear = () => {
    age = -1;
    state.flash = 0;
    uniforms.uWeatherFlash.value = 0;
    uniforms.uWeatherReflection.value = 0;
  };
  const envelope = (t: number) => {
    const pulse = (centre: number, width: number) => Math.exp(-(((t - centre) / width) ** 2));
    return (
      pulse(0.09, 0.06) +
      pulse(0.21, 0.06) * 0.5 +
      pulse(0.42, 0.11) * 0.6 +
      pulse(0.71, 0.17) * 0.4
    );
  };
  const sample = (seconds: number) => {
    if (destroyed || suppressed || age < 0) return;
    age = seconds;
    if (age >= settings.duration) {
      clear();
      return;
    }
    state.flash = envelope(age / settings.duration) * state.strength * settings.intensity;
    uniforms.uWeatherFlash.value = state.flash;
    uniforms.uWeatherReflection.value = state.flash * settings.reflection;
  };
  const trigger = (camera: PerspectiveCamera) => {
    void camera; // Cells are world-aligned, independent of the journey camera.
    if (destroyed || suppressed) return false;
    const heading = rand(-0.4, 0.4) * Math.PI;
    const elevation = rand(0.15, 0.8),
      horizontal = Math.cos(elevation);
    state.direction
      .set(horizontal * Math.sin(heading), Math.sin(elevation), -horizontal * Math.cos(heading))
      .normalize();
    state.strength = rand(0.6, 1.2);
    state.strikes++;
    age = 0;
    remaining = settings.duration + next();
    sample(0);
    events.onStrike?.(state);
    return true;
  };
  return {
    uniforms,
    state: state as WeatherState,
    trigger,
    sample,
    peakTime: () => 0.09 * settings.duration,
    flickerTimes: () => [0.09, 0.21, 0.42, 0.71].map((t) => t * settings.duration),
    beginExperience: (elapsed = 0) => {
      void elapsed; // The active scene clock starts when entry is armed.
      if (!started && !destroyed) {
        started = true;
        remaining = next();
      }
    },

    setReducedMotion: (reduce: boolean) => {
      if (reduce !== suppressed) {
        suppressed = reduce;
        clear();
        remaining = next();
        if (reduce) events.onCancel?.();
      }
    },
    update: (delta: number, camera: PerspectiveCamera, allowNewStrike = true) => {
      if (destroyed || suppressed || !started) return;
      if (delta > 1) {
        clear();
        remaining = next();
        return;
      }
      if (remaining < 0) remaining = next();
      const dt = Math.max(0, delta);
      remaining -= dt;
      if (age < 0 && remaining <= 0 && allowNewStrike) {
        const overshoot = -remaining;
        trigger(camera);
        remaining -= overshoot;
        sample(overshoot);
      } else if (age >= 0) sample(age + dt);
    },
    suspend: () => {
      events.onCancel?.();
      clear();
      remaining = next();
    },
    destroy: () => {
      events.onCancel?.();
      destroyed = true;
      clear();
    },
  };
}
