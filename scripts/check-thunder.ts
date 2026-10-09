import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PerspectiveCamera } from "three";
import { createThunderSelector, thunderDistance, THUNDER_SAMPLES } from "../src/sound/thunder";
import { createWeather } from "../src/webgl/core/weather";
const random = () => {
  let seed = 42;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};
const camera = new PerspectiveCamera(34, 1.6, 0.1, 420);
test("six intact source files and five enabled, shuffled thunder characters", () => {
  const hashes = THUNDER_SAMPLES.map((name) =>
    createHash("sha256")
      .update(readFileSync(`public/audio/effects/thunder/${name}.mp3`))
      .digest("hex"),
  );
  assert.equal(new Set(hashes).size, 6);
  for (const distance of [0, 0.5]) {
    const select = createThunderSelector(random());
    let previous = -1;
    for (let cycle = 0; cycle < 10; cycle++) {
      const used = new Set();
      for (let i = 0; i < (distance === 0 ? 3 : 2); i++) {
        const next = select(distance, 0.8)!;
        assert.notEqual(next.index, previous);
        used.add(next.index);
        previous = next.index;
      }
      assert.equal(used.size, distance === 0 ? 3 : 2);
    }
  }
});
test("distance jointly controls delay, filtering, level and character", () => {
  const select = createThunderSelector(random()),
    near = select(0, 1)!,
    far = select(1, 1)!,
    weak = select(0, 0.2)!;
  assert.equal(near.delay, 0);
  assert.equal(far.delay, 2.5);
  assert.ok(near.gain > far.gain && near.gain > weak.gain && near.gain < 1);
  assert.ok(near.lowpass > far.lowpass && far.lowpass >= 850);
  assert.equal(near.rate, 1);
  assert.equal(far.rate, 1);
  assert.ok(far.distanceMetres > near.distanceMetres);
  const gaps = new Set(Array.from({ length: 20 }, (_, i) => select(i / 19, 0.8)!.delay));
  assert.equal(gaps.size, 20);
});
test("one semantic thunder cue per visible strike, never per flicker", () => {
  let cues = 0,
    cancels = 0;
  const weather = createWeather(false, random(), {
    onStrike: () => cues++,
    onCancel: () => cancels++,
  });
  weather.trigger(camera);
  assert.equal(cues, 0);
  for (let i = 0; i < 120; i++) weather.update(1 / 60, camera);
  assert.equal(cues, 1);
  weather.trigger(camera);
  weather.sample(weather.peakTime());
  weather.sample(0);
  weather.sample(weather.flickerTimes()[1]!);
  assert.equal(cues, 2);
  weather.suspend();
  assert.equal(cancels, 1);
  weather.setReducedMotion(true);
  assert.equal(weather.trigger(camera), false);
  assert.equal(cues, 2);
  weather.destroy();
  assert.equal(cancels, 3);
});
test("audio hooks and eased chapter character preserve the approved visual envelope", () => {
  const plain = createWeather(false, random()),
    wired = createWeather(false, random(), { onStrike: () => undefined });
  wired.setStormTarget(0.45);
  for (let i = 0; i < 60 * 70; i++) {
    plain.update(1 / 60, camera);
    wired.update(1 / 60, camera);
    assert.equal(wired.state.flash, plain.state.flash);
    assert.deepEqual(wired.state.direction.toArray(), plain.state.direction.toArray());
    assert.equal(wired.state.strikes, plain.state.strikes);
  }
  assert.ok(Math.abs(wired.state.storm - 0.45) < 0.001);
});

test("close onset and distant delay derive from the same strike strength", () => {
  const select = createThunderSelector(random());
  for (const intensity of [0.88, 0.93, 1]) {
    const plan = select(thunderDistance(intensity), intensity)!;
    assert.ok(plan.delay >= 0 && plan.delay <= 0.15);
    assert.ok(Math.abs(plan.delay - plan.distanceMetres / 343) < 1e-9);
  }
  const weak = select(thunderDistance(0.65), 0.65)!;
  assert.ok(weak.delay > 2.4);
});

test("partial asset failures always select a decoded recording", () => {
  const select = createThunderSelector(random());
  for (let i = 0; i < 30; i++) {
    const plan = select(i % 2 ? 0 : 1, 0.9, 0.55, [1]);
    assert.equal(plan?.index, 1);
  }
  assert.equal(select(0, 1, 0.55, []), null);
  assert.equal(select(1, 1, 0.55, [0]), null);
});

test("shipped recordings match the audited CC0 provenance", () => {
  const records = JSON.parse(
    readFileSync("public/audio/effects/thunder/PROVENANCE.json", "utf8"),
  ) as { name: string; id: number; license: string; outputSha256: string }[];
  assert.equal(new Set(records.map((record) => record.id)).size, 6);
  for (const record of records) {
    assert.equal(record.license, "CC0 1.0");
    assert.equal(
      createHash("sha256")
        .update(readFileSync(`public/audio/effects/thunder/${record.name}.mp3`))
        .digest("hex"),
      record.outputSha256,
    );
  }
});
