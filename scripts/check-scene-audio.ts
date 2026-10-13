import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createSceneAudio, shuffledCycle } from "../src/sound/sceneAudio";
import pack from "../src/sound/scene-audio.json";
import hashes from "../src/sound/scene-audio-hashes.json";

test("every interface and background recording matches its captured digest in both formats", () => {
  for (const paths of Object.values(pack))
    for (const path of paths)
      for (const extension of ["opus", "webm"]) {
        const name = `${path.split("/").at(-1)}.${extension}`;
        assert.equal(
          createHash("sha256")
            .update(readFileSync(`public${path}.${extension}`))
            .digest("hex"),
          hashes[name as keyof typeof hashes],
        );
      }
});
test("sample groups use every variation once and avoid repeating across cycle boundaries", () => {
  for (const size of [1, 3, 4, 5, 6]) {
    const select = shuffledCycle(size);
    let previous = -1;
    for (let cycle = 0; cycle < 100; cycle++) {
      const bag = Array.from({ length: size }, select);
      assert.equal(new Set(bag).size, size);
      if (size > 1) assert.notEqual(bag[0], previous);
      previous = bag.at(-1)!;
    }
  }
});

test("silent construction fetches nothing, and disposal cancels pending cue playback", async () => {
  const previous = {
    fetch: globalThis.fetch,
    document: globalThis.document,
    window: globalThis.window,
  };
  let requests = 0,
    starts = 0;
  const documentMock = Object.assign(new EventTarget(), {
    querySelector: () => null,
    documentElement: { dataset: {} },
  });
  const parameter = () => ({ value: 0, cancelAndHoldAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({
    gain: parameter(),
    frequency: parameter(),
    Q: parameter(),
    connect(target: unknown) {
      return target;
    },
    disconnect() {},
  });
  const context = {
    currentTime: 0,
    state: "running",
    createGain: node,
    createBiquadFilter: node,
    createBufferSource: () => ({
      buffer: null,
      playbackRate: parameter(),
      connect(target: unknown) {
        return target;
      },
      disconnect() {},
      start() {
        starts++;
      },
      stop() {},
    }),
    decodeAudioData: async () => ({ duration: 1 }),
  } as unknown as AudioContext;
  try {
    Object.assign(globalThis, {
      document: documentMock,
      window: { setTimeout, clearTimeout },
      fetch: async () => {
        requests++;
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
      },
    });
    const audio = createSceneAudio(context, node() as unknown as AudioNode);
    assert.equal(requests, 0);
    audio.start();
    audio.handle("project:active");
    assert.ok(requests > 0);
    audio.destroy();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(starts, 0);
    assert.equal(audio.voices.size, 0);
    assert.equal(audio.buffers.size, 0);
  } finally {
    Object.assign(globalThis, previous);
  }
});
