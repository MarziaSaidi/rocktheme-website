import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera, Scene, ShaderMaterial } from "three";

import { createWeather } from "../src/webgl/core/weather";
import { createDistanceFogUniforms } from "../src/webgl/modules/distanceFog";
import { createLowMist } from "../src/webgl/modules/lowMist";
import { createHorizonAtmosphere } from "../src/webgl/modules/horizonAtmosphere";
import { createReflectiveFloor } from "../src/webgl/modules/reflectiveFloor";
import { createStormSky } from "../src/webgl/modules/stormSky";
import {
  distanceFogConfig,
  floorConfig,
  horizonAtmosphereConfig,
  lightningConfig,
  lowMistConfig,
} from "../src/webgl/sceneConfig";

const camera = () => {
  const result = new PerspectiveCamera(34, 1.6, 0.1, 420);
  result.lookAt(0, 0, -1);
  result.updateMatrixWorld();
  return result;
};
const step = (
  weather: ReturnType<typeof createWeather>,
  seconds: number,
  view = camera(),
  allow = true,
) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) weather.update(1 / 60, view, allow);
};
const rng = () => {
  let seed = 42;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

test("first strike is 8–14 seconds, then irregular 20–40 active seconds, with four bounded flickers", () => {
  const weather = createWeather(false, rng());
  const view = camera();
  const starts: number[] = [];
  const peaks: number[][] = [];
  let before = 0;
  let rising = false;
  for (let frame = 0; frame < 60 * 360; frame++) {
    const strikes = weather.state.strikes;
    weather.update(1 / 60, view);
    const now = (frame + 1) / 60;
    if (weather.state.strikes !== strikes) {
      starts.push(now);
      peaks.push([]);
    }
    const value = weather.state.flash;
    assert.ok(value >= 0 && value <= lightningConfig.maxFlash);
    assert.equal(value, weather.uniforms.uWeatherFlash.value);
    if (rising && value < before && before > 0.02) peaks.at(-1)!.push(now);
    rising = value > before;
    before = value;
  }
  assert.ok(starts.length >= 6);
  assert.ok(starts[0]! >= 8 && starts[0]! <= 14.02);
  const gaps = starts.slice(1).map((time, index) => time - starts[index]!);
  assert.ok(gaps.every((gap) => gap >= 20 - 1 / 60 && gap <= 40 + 1 / 60));
  assert.ok(new Set(gaps.map((gap) => Math.round(gap))).size > 2);
  for (const pulse of peaks.slice(0, -1)) {
    assert.equal(pulse.length, 4);
    assert.ok(pulse[3]! - pulse[0]! < lightningConfig.duration);
    assert.ok(
      pulse.every((peak) => pulse.filter((other) => other >= peak && other < peak + 1).length <= 3),
    );
  }
  assert.strictEqual(weather.state.direction, weather.uniforms.uWeatherDirection.value);
});

test("reduced motion cancels a strike and never produces another", () => {
  const weather = createWeather(false, () => 0.5);
  step(weather, 11.033333333);
  assert.ok(weather.state.flash > 0);
  weather.setReducedMotion(true);
  assert.equal(weather.state.flash, 0);
  const count = weather.state.strikes;
  step(weather, 180);
  assert.equal(weather.state.strikes, count);
  weather.setReducedMotion(false);
  step(weather, 20);
  assert.equal(weather.state.strikes, count);
  step(weather, 23);
  assert.equal(weather.state.strikes, count + 1);
  const initiallyReduced = createWeather(true, () => 0.5);
  step(initiallyReduced, 200);
  assert.equal(initiallyReduced.state.strikes, 0);
});

test("camera travel defers new strikes but lets an existing envelope finish", () => {
  const weather = createWeather(false, () => 0.5);
  step(weather, 65, camera(), false);
  assert.equal(weather.state.strikes, 0);
  step(weather, 2 / 60);
  assert.equal(weather.state.strikes, 1);
  assert.ok(weather.state.flash > 0.1);
  step(weather, 3, camera(), false);
  assert.equal(weather.state.flash, 0);
});

test("suspension and destruction never replay an interrupted strike", () => {
  const weather = createWeather(false, () => 0.5);
  step(weather, 11.033333333);
  assert.ok(weather.state.flash > 0);
  weather.suspend();
  assert.equal(weather.uniforms.uWeatherFlash.value, 0);
  step(weather, 25);
  assert.equal(weather.state.strikes, 1);
  weather.destroy();
  step(weather, 180);
  assert.equal(weather.state.flash, 0);
  assert.equal(weather.state.strikes, 1);
});

test("mobile strikes are dimmer and direction stays fixed through camera movement", () => {
  const desktop = createWeather(false, () => 0.5);
  const mobile = createWeather(false, () => 0.5);
  const narrow = camera();
  narrow.aspect = 0.46;
  step(desktop, 11.033333333);
  step(mobile, 11.033333333, narrow);
  assert.ok(mobile.state.flash < desktop.state.flash);
  const direction = desktop.state.direction.clone();
  const turned = camera();
  turned.lookAt(1, 0, 0);
  turned.updateMatrixWorld();
  step(desktop, 0.5, turned, false);
  assert.ok(desktop.state.direction.distanceTo(direction) < 1e-10);
  assert.ok(Math.abs(direction.length() - 1) < 1e-10);
});

test("all atmospheric consumers share the controller's exact uniform references", () => {
  const weather = createWeather(false, () => 0.5);
  const scene = new Scene();
  const view = camera();
  const mist = createLowMist(scene, view, 1440, false, lowMistConfig, weather.uniforms);
  const atmosphere = createHorizonAtmosphere(
    scene,
    view,
    false,
    horizonAtmosphereConfig,
    weather.uniforms,
  );
  const sky = createStormSky(scene, false, "high", 1440, weather.uniforms);
  const floor = createReflectiveFloor({
    width: 160,
    depth: 140,
    reflectionSize: 0,
    maxRipples: 4,
    reducedMotion: false,
    config: floorConfig,
    weather: weather.uniforms,
  });
  const fog = createDistanceFogUniforms(distanceFogConfig, weather.uniforms);
  assert.strictEqual(fog.uWeatherFlash, weather.uniforms.uWeatherFlash);
  scene.add(floor.mesh);
  let count = 0;
  scene.traverse((object) => {
    const material = (object as { material?: ShaderMaterial }).material;
    if (!(material instanceof ShaderMaterial)) return;
    count++;
    assert.strictEqual(material.uniforms.uWeatherFlash, weather.uniforms.uWeatherFlash);
    assert.strictEqual(material.uniforms.uWeatherDirection, weather.uniforms.uWeatherDirection);
    assert.strictEqual(material.uniforms.uWeatherColor, weather.uniforms.uWeatherColor);
  });
  assert.ok(count >= 19);
  step(weather, 11.033333333);
  assert.ok(fog.uWeatherFlash.value > 0);
  weather.destroy();
  assert.equal(fog.uWeatherFlash.value, 0);
  mist.destroy();
  atmosphere.destroy();
  sky.destroy();
  floor.destroy();
});

test("an immediate strike has a sharp strongest leading flash and dark gaps", () => {
  const weather = createWeather(false, rng());
  assert.equal(weather.trigger(camera()), true);
  const peakTime = weather.peakTime();
  assert.ok(peakTime < 0.04);
  weather.sample(peakTime);
  const leading = weather.state.flash;
  assert.ok(leading > 0.4);
  weather.sample(peakTime + 0.14);
  assert.ok(weather.state.flash < leading * 0.1);
  let laterMaximum = 0;
  let darkFrames = 0;
  for (let i = 12; i < 99; i++) {
    weather.sample(i / 60);
    laterMaximum = Math.max(laterMaximum, weather.state.flash);
    if (weather.state.flash === 0) darkFrames++;
  }
  assert.ok(laterMaximum > 0.05 && laterMaximum < leading * 0.6);
  assert.ok(darkFrames > 15);
  weather.sample(lightningConfig.duration);
  assert.equal(weather.state.flash, 0);
  weather.setReducedMotion(true);
  assert.equal(weather.trigger(camera()), false);
  weather.destroy();
  assert.equal(weather.trigger(camera()), false);
});

test("the strongest flash reaches a rendered frame even at 30 fps", () => {
  const weather = createWeather(false, () => 0.5);
  weather.trigger(camera());
  const peak = weather.state.strength * lightningConfig.maxFlash;
  weather.update(1 / 30, camera());
  assert.equal(weather.state.flash, peak);
  weather.update(1 / 30, camera());
  assert.ok(weather.state.flash < peak);
});

test("entry arms the clock once; chapter and consent changes cannot restart it", () => {
  const weather = createWeather(false, () => 0.5, {}, true);
  step(weather, 90);
  assert.equal(weather.state.strikes, 0);
  weather.beginExperience(2);
  step(weather, 7);
  weather.setStormTarget(0.45);
  weather.beginExperience();
  step(weather, 2.04);
  assert.equal(weather.state.strikes, 1);
  weather.beginExperience();
  step(weather, 20);
  weather.setStormTarget(0.6);
  step(weather, 10.04);
  assert.equal(weather.state.strikes, 2);
});
