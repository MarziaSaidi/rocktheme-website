import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PerspectiveCamera } from "three";
import { createThunderSelector, THUNDER_SAMPLES } from "../src/sound/thunder";
import { createWeather } from "../src/webgl/core/weather";
import assets from "../src/webgl/weather/asset-hashes.json";
const random = () => {
  let seed = 42;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};
const camera = new PerspectiveCamera(34, 1.6, 0.1, 420);

test("weather textures and thunder recordings retain their asset digests", () => {
  for (const record of assets)
    assert.equal(
      createHash("sha256").update(readFileSync(record.path)).digest("hex"),
      record.sha256,
    );
  const hashes = THUNDER_SAMPLES.map((name) =>
    createHash("sha256")
      .update(readFileSync(`public/weather/thunder/${name}.opus`))
      .digest("hex"),
  );
  assert.equal(new Set(hashes).size, 8);
});
test("eight-voice shuffled cycles do not repeat at the cycle boundary", () => {
  const select = createThunderSelector(random());
  let previous = -1;
  for (let cycle = 0; cycle < 10; cycle++) {
    const used = new Set();
    for (let i = 0; i < 8; i++) {
      const plan = select(0, 0.9)!;
      assert.notEqual(plan.index, previous);
      used.add(plan.index);
      previous = plan.index;
    }
    assert.equal(used.size, 8);
  }
});
test("flash strength controls level and pitch without introducing an audio delay", () => {
  const select = createThunderSelector(random()),
    weak = select(0, 0.6)!,
    strong = select(1, 1.2)!;
  assert.equal(weak.delay, 0);
  assert.equal(strong.delay, 0);
  assert.equal(weak.gain, 0.75);
  assert.equal(strong.gain, 1);
  assert.equal(weak.rate, 0.9);
  assert.equal(strong.rate, 1);
  assert.equal(strong.lowpass, 20000);
  assert.equal(strong.highpass, 10);
});
test("four flash lobes publish only one thunder event", () => {
  let cues = 0,
    cancels = 0;
  const weather = createWeather(false, random(), {
    onStrike: () => cues++,
    onCancel: () => cancels++,
  });
  weather.trigger(camera);
  assert.equal(cues, 1);
  for (const t of weather.flickerTimes()) weather.sample(t);
  assert.equal(cues, 1);
  weather.trigger(camera);
  assert.equal(cues, 2);
  weather.suspend();
  assert.equal(cancels, 1);
  weather.setReducedMotion(true);
  assert.equal(weather.trigger(camera), false);
  assert.equal(cues, 2);
  weather.destroy();
  assert.equal(cancels, 3);
});
test("audio subscription does not alter the visual weather sequence", () => {
  const plain = createWeather(false, random()),
    wired = createWeather(false, random(), { onStrike: () => undefined });
  for (let i = 0; i < 60 * 70; i++) {
    plain.update(1 / 60, camera);
    wired.update(1 / 60, camera);
    assert.equal(wired.state.flash, plain.state.flash);
    assert.deepEqual(wired.state.direction.toArray(), plain.state.direction.toArray());
    assert.equal(wired.state.strikes, plain.state.strikes);
  }
});
test("partial decoding failures select only a successfully decoded recording", () => {
  const select = createThunderSelector(random());
  for (let i = 0; i < 30; i++) assert.equal(select(0, 0.9, 0.55, [1])?.index, 1);
  assert.equal(select(0, 1, 0.55, []), null);
  assert.equal(select(0, 1, 0.55, [0])?.index, 0);
});
