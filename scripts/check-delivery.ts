import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";

const bytes = (path: string) => gzipSync(readFileSync(`public/assets/${path}`)).length;
const hero = ["mountains", "perch-rock", "robot"];

test("homepage model transfers fit the desktop, mobile and journey budgets", () => {
  const work = bytes("selected-work/mountains.glb");
  const desktop = hero.reduce((sum, name) => sum + bytes(`hero/${name}.glb`), 0);
  const mobileWork = bytes("selected-work/mountains.mobile.glb");
  const mobile = hero.reduce((sum, name) => sum + bytes(`hero/${name}.mobile.glb`), 0);
  assert.ok(desktop + work <= 2_500_000, `${desktop + work} desktop bytes`);
  assert.ok(mobile + mobileWork <= 1_500_000, `${mobile + mobileWork} mobile bytes`);
  // The rift mountain keeps its full geometry: the bio's render passes draw its
  // edges and count its triangles. It loads once the visitor leaves the hero.
  const journey =
    desktop +
    work +
    bytes("rocks/footer-rock.glb") +
    bytes("rift/mountain.glb") +
    bytes("rift/stones.glb") +
    bytes("cabin/sky/my-world-capture.webp") +
    bytes("rift/opening.json");
  assert.ok(journey <= 8_500_000, `${journey} full-journey bytes`);
});
