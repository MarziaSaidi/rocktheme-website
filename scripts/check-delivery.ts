import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  getAllProjects,
  getProjectBySlug,
  getProjectStaticParams,
} from "../src/content/projects/projectLoader";
import { createQualityManager } from "../src/webgl/core/quality";
import { createCurlField } from "../src/webgl/core/noise";

const bytes = (path: string) => gzipSync(readFileSync(`public/assets/${path}`)).length;
const hero = ["mountains", "perch-rock", "robot"];

test("public routes and next-study links expose authored studies only", () => {
  const projects = getAllProjects();
  assert.deepEqual(
    getProjectStaticParams()
      .map((p) => p.slug)
      .sort(),
    ["quill-and-pigeon", "survue"],
  );
  for (const project of projects) {
    assert.notEqual(project.contentStatus, "placeholder");
    assert.ok(getProjectBySlug(project.nextProjectSlug));
  }
  assert.equal(getProjectBySlug("qalin"), undefined);
  assert.ok(getProjectBySlug("qalin", { includeDisabled: true }));
});

test("homepage model transfers fit the desktop, mobile and journey budgets", () => {
  const work = bytes("selected-work/mountains.glb");
  const desktop = hero.reduce((sum, name) => sum + bytes(`hero/${name}.glb`), 0);
  const mobileWork = bytes("selected-work/mountains.mobile.glb");
  const mobile = hero.reduce((sum, name) => sum + bytes(`hero/${name}.mobile.glb`), 0);
  assert.ok(desktop + work <= 2_500_000, `${desktop + work} desktop bytes`);
  assert.ok(mobile + mobileWork <= 1_500_000, `${mobile + mobileWork} mobile bytes`);
  const journey =
    desktop +
    work +
    bytes("rocks/footer-rock.glb") +
    bytes("rift/mountain.glb") +
    bytes("rift/stones.glb") +
    bytes("cabin/sky/my-world-capture.webp") +
    bytes("rift/opening.json");
  assert.ok(journey <= 6_000_000, `${journey} full-journey bytes`);
});

test("GPU-bound delivery downgrades after warmup; isolated stalls do not", () => {
  const slow = createQualityManager("high");
  let changed: string | undefined;
  for (let i = 0; i < 200 && !changed; i++) changed = slow.sample(34)?.tier;
  assert.equal(changed, "medium");
  const healthy = createQualityManager("high");
  for (let i = 0; i < 400; i++) {
    assert.equal(healthy.sample(i === 250 ? 2000 : 16.7), null);
  }
  for (const value of [NaN, Infinity, -1, 0]) assert.equal(healthy.sample(value), null);
  assert.equal(healthy.current().tier, "high");
});

test("periodic dropped frames downgrade even when average delivery is under 20 ms", () => {
  const manager = createQualityManager("high");
  for (let i = 0; i < 500 && manager.current().tier === "high"; i++) {
    manager.sample(i % 10 === 0 ? 34 : 16.7);
  }
  assert.equal(manager.current().tier, "medium");
});

test("a p99 violation after warmup steps down before waiting another window", () => {
  const manager = createQualityManager("high");
  for (let i = 0; i < 200; i++) manager.sample(16.7);
  assert.equal(manager.current().tier, "high");
  assert.equal(manager.sample(34)?.tier, "medium");
  assert.equal(manager.sample(34)?.tier, "low");
});

test("curl flow stays bit-exact with the original seeded field", () => {
  const hash = createHash("sha256");
  const bytes = Buffer.alloc(24);
  for (const seed of [0, 1337, 0x7a31d4, 0xffffffff]) {
    const field = createCurlField(seed);
    const out: [number, number, number] = [0, 0, 0];
    const sample = (x: number, y: number, z: number) => {
      field.sample(x, y, z, out);
      for (let axis = 0; axis < 3; axis++) bytes.writeDoubleLE(out[axis]!, axis * 8);
      hash.update(bytes);
    };
    for (const point of [
      [0, 0, 0],
      [1, 1, 1],
      [-1, -1, -1],
      [256, -256, 0],
      [0.0001, -0.0001, 255.9999],
      [-0, 0, -0],
    ]) {
      sample(point[0]!, point[1]!, point[2]!);
    }
    for (let i = 0; i < 4096; i++)
      sample(i * 0.173 - 50, (i % 29) * 0.0723 - 3, (i % 97) * 0.0137 - 0.4);
  }
  assert.equal(
    hash.digest("hex"),
    "0b550e7b23f1e37b9490d66690104a2acb5d453a9eacd6e8218dca5ffcdb571b",
  );
});

test("curl sampling preserves components when an output setter samples again", () => {
  const field = createCurlField();
  const expected: [number, number, number] = [0, 0, 0];
  const out: [number, number, number] = [0, 0, 0];
  const nested: [number, number, number] = [0, 0, 0];
  field.sample(0.31, -0.42, 99.01, expected);
  let first = 0;
  Object.defineProperty(out, "0", {
    get: () => first,
    set: (value: number) => {
      first = value;
      field.sample(3, 4, 5, nested);
    },
  });
  field.sample(0.31, -0.42, 99.01, out);
  assert.deepEqual([...out], expected);
});
