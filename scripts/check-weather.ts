import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { PerspectiveCamera, Scene } from "three";
import { createWeather } from "../src/webgl/core/weather";
import { createStormSky } from "../src/webgl/modules/stormSky";
import { createThunderSelector, THUNDER_SAMPLES } from "../src/sound/thunder";
import preset from "../src/webgl/weather/preset.json";
import hashes from "../src/webgl/weather/shader-hashes.json";
import * as shaders from "../src/webgl/weather/shaders";
const camera = new PerspectiveCamera(34, 1.6, 0.1, 420);
const step = (weather: ReturnType<typeof createWeather>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) weather.update(1 / 60, camera);
};

test("shader content matches the approved weather asset digests", () => {
  for (const [name, expected] of Object.entries(hashes)) {
    assert.equal(
      createHash("sha256")
        .update(shaders[name as keyof typeof shaders])
        .digest("hex"),
      expected,
    );
  }
});
test("entry arms the weather clock, and one flash emits one audio event", () => {
  let strikes = 0;
  const weather = createWeather(false, () => 0.5, { onStrike: () => strikes++ }, true);
  step(weather, 20);
  assert.equal(strikes, 0);
  weather.beginExperience();
  step(weather, preset.sky.lightning.minInterval - 0.05);
  assert.equal(strikes, 0);
  step(weather, preset.sky.lightning.maxInterval);
  assert.equal(strikes, 1);
  assert.equal(weather.state.flash, weather.uniforms.uWeatherFlash.value);
});
test("flash sampling matches the four-pulse playback fixture", () => {
  const weather = createWeather(false, () => 0.5);
  weather.trigger(camera);
  const fixture = JSON.parse(readFileSync("src/webgl/weather/flash-fixture.json", "utf8"));
  for (const [seconds, expected] of fixture) {
    weather.sample(seconds);
    assert.ok(Math.abs(weather.state.flash - expected) < 1e-12);
    assert.ok(
      Math.abs(
        weather.uniforms.uWeatherReflection.value - expected * preset.sky.lightning.reflection,
      ) < 1e-12,
    );
  }
});
test("hidden/reduced-motion lifecycle discards a flash and pending audio", () => {
  let cancelled = 0;
  const weather = createWeather(false, () => 0.5, { onCancel: () => cancelled++ });
  weather.trigger(camera);
  weather.sample(weather.peakTime());
  assert.ok(weather.state.flash > 0);
  weather.suspend();
  assert.equal(weather.state.flash, 0);
  assert.equal(cancelled, 1);
  weather.setReducedMotion(true);
  const strikes = weather.state.strikes;
  step(weather, 60);
  assert.equal(weather.state.strikes, strikes);
  weather.destroy();
  assert.equal(weather.trigger(camera), false);
});
test("all eight thunder recordings are local, non-repeating, and play at flash time", () => {
  for (const name of THUNDER_SAMPLES)
    for (const ext of ["opus", "webm"])
      assert.ok(existsSync(`public/weather/thunder/${name}.${ext}`));
  const select = createThunderSelector(() => 0.5);
  const cycle = Array.from({ length: 8 }, () => select(0, 0.9)!);
  assert.equal(new Set(cycle.map((p) => p.index)).size, 8);
  assert.notEqual(select(0, 0.9)!.index, cycle.at(-1)!.index);
  assert.ok(
    cycle.every(
      (p) => p.delay === 0 && Math.abs(p.gain - 0.875) < 1e-12 && Math.abs(p.rate - 0.95) < 1e-12,
    ),
  );
  assert.equal(select(0, 1, 0.5, []), null);
});
test("sky and reflected water share one cloud texture, which is released on teardown", () => {
  const weather = createWeather(false),
    scene = new Scene();
  const sky = createStormSky(scene, false, "high", 1440, weather.uniforms);
  assert.ok(weather.uniforms.uWeatherSkyTexture.value);
  assert.strictEqual(
    sky.mesh.material.uniforms.tSky!.value,
    weather.uniforms.uWeatherSkyTexture.value,
  );
  sky.destroy();
  assert.equal(weather.uniforms.uWeatherSkyTexture.value, null);
  assert.equal(scene.children.length, 0);
});
