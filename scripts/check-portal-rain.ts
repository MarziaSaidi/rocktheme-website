import assert from "node:assert/strict";
import { test } from "node:test";
import { PerspectiveCamera, Scene, Vector3 } from "three";
import { createPortalRain, type RainEmitter } from "../src/webgl/modules/portalRain";
import { createBioDust } from "../src/webgl/modules/bioDust";

const camera = new PerspectiveCamera(50, 1.6, 0.1, 100);

test("restored mountain stream uses scene depth testing and hides its empty draw", () => {
  const scene = new Scene();
  const view = new PerspectiveCamera(50, 1440 / 900, 0.1, 100);
  view.updateMatrixWorld();
  const dust = createBioDust(scene);
  dust.update(
    view,
    {
      grains: new Float32Array([1100, 360, 1.2, 0.5, 0.8, -120, 30, 0]),
      count: 1,
      exposure: 1 / 120,
    },
    24,
    1440,
    900,
  );
  const position = dust.mesh.geometry.getAttribute("iPosition");
  const point = new Vector3(position.getX(0), position.getY(0), position.getZ(0)).project(view);
  assert.ok(Math.abs((point.x * 0.5 + 0.5) * 1440 - 1100) < 0.01);
  assert.ok(Math.abs((-point.y * 0.5 + 0.5) * 900 - 360) < 0.01);
  assert.equal((dust.mesh.material as import("three").ShaderMaterial).depthTest, true);
  assert.equal(dust.count(), 1);
  dust.update(view, null, 24, 1440, 900);
  assert.equal(dust.count(), 0);
  assert.equal(dust.mesh.visible, false);
  dust.destroy();
});
const emitter: RainEmitter = (_seed, position, outward) => {
  position.set(2, 8, -8);
  outward.set(0, 0, 1);
  return true;
};
function positions(scene: Scene) {
  const mesh = scene.getObjectByName("portal-falling-stars") as import("three").Mesh<
    import("three").InstancedBufferGeometry
  >;
  return { count: mesh.geometry.instanceCount, p: mesh.geometry.getAttribute("iPosition") };
}
test("world-space drops continue downward at rest and drain after emission stops", () => {
  const scene = new Scene();
  let hits = 0;
  const rain = createPortalRain(scene, false, (x, z) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(z));
    hits++;
    return true;
  });
  rain.setQuality("low");
  const step = (intensity: number, moving: boolean) =>
    rain.update(1 / 60, intensity, moving, false, emitter, camera, 1280, 800);
  for (let i = 0; i < 120; i++) step(1, true);
  assert.ok(rain.stats().alive > 40);
  const y = positions(scene).p.getY(0);
  camera.position.set(10, 2, 6);
  camera.updateMatrixWorld();
  step(0, false);
  assert.ok(
    positions(scene).p.getY(0) < y,
    "gravity continues after scrolling stops and camera moves",
  );
  for (let i = 0; i < 1100; i++) step(0, false);
  assert.equal(rain.stats().alive, 0);
  assert.equal(positions(scene).count, 0);
  assert.ok(hits > 0);
  rain.destroy();
  assert.equal(scene.children.length, 0);
});
test("fast intensity changes respect the pool ceiling and keep finite coordinates", () => {
  const scene = new Scene();
  const rain = createPortalRain(scene, false, () => false);
  rain.setQuality("low");
  for (let i = 0; i < 500; i++) {
    rain.update(i % 2 ? 0.1 : 1 / 60, i % 3 ? 1 : 0, true, true, emitter, camera, 390, 844);
    assert.ok(rain.stats().alive <= 450);
  }
  const { count, p } = positions(scene);
  for (let i = 0; i < count; i++) {
    assert.ok(Number.isFinite(p.getX(i)) && p.getY(i) >= 0 && Number.isFinite(p.getZ(i)));
  }
  rain.destroy();
});
test("reduced motion creates no dynamic rain or impacts", () => {
  const scene = new Scene();
  const rain = createPortalRain(scene, true, () => {
    throw new Error("unexpected impact");
  });
  for (let i = 0; i < 100; i++) rain.update(1 / 60, 1, true, false, emitter, camera, 1280, 800);
  assert.equal(rain.stats().alive, 0);
  assert.equal(positions(scene).count, 0);
  rain.destroy();
});

test("water impacts use exact world coordinates and dissolve without changing pointer ripples", async () => {
  const { createReflectiveFloor } = await import("../src/webgl/modules/reflectiveFloor");
  const floor = createReflectiveFloor({
    width: 100,
    depth: 140,
    reflectionSize: 0,
    maxRipples: 3,
    reducedMotion: false,
  });
  const material = floor.mesh.material as import("three").ShaderMaterial;
  floor.setImpactBudget(4);
  assert.equal(floor.requestLightImpact(-18, 32, 0.4, 0.5), true);
  assert.equal(
    floor.requestLightImpact(-18, 32, 0.4, 0.5),
    false,
    "selected impacts are throttled",
  );
  floor.update(0.12, 0.12);
  const hits = material.uniforms.uLightImpacts!.value as import("three").Vector4[];
  assert.equal(hits[0]!.x, -18);
  assert.equal(hits[0]!.y, 32);
  assert.ok(hits[0]!.z > 0);
  assert.equal(floor.activeLightImpacts(), 1);
  assert.equal(floor.activeRipples(), 0);
  for (let i = 0; i < 3; i++) {
    assert.equal(floor.requestLightImpact(-17 + i, 33, 0.6, 0.5), true);
    floor.update(0.12, 0.24 + i * 0.12);
  }
  assert.equal(
    floor.requestLightImpact(-16, 34, 0.5, 0.5),
    false,
    "pool never overwrites live rings",
  );
  floor.update(2, 3);
  assert.equal(floor.activeLightImpacts(), 0);
  assert.equal(material.uniforms.uImpactCount!.value, 0);
  floor.destroy();
});

test("bio glyph births align with the text and stay in world space as the camera moves", () => {
  const scene = new Scene();
  const view = new PerspectiveCamera(50, 1440 / 900, 0.1, 100);
  view.position.set(0, 1.55, 0);
  view.lookAt(0, 1.55, -20);
  view.updateMatrixWorld();
  const rain = createPortalRain(scene, false, () => false);
  rain.releaseFromBio(300, 250, 0.6, view, 24, 1440, 900);
  rain.update(0, 0, false, false, emitter, view, 1440, 900);
  const position = positions(scene).p;
  const world = new Vector3(position.getX(0), position.getY(0), position.getZ(0));
  const projected = world.clone().project(view);
  assert.ok(Math.abs((projected.x * 0.5 + 0.5) * 1440 - 300) < 0.01);
  assert.ok(Math.abs((-projected.y * 0.5 + 0.5) * 900 - 250) < 0.01);
  view.position.x += 4;
  view.updateMatrixWorld();
  rain.update(0, 0, false, false, emitter, view, 1440, 900);
  assert.equal(positions(scene).p.getX(0), world.x);
  assert.equal(positions(scene).p.getY(0), world.y);
  rain.destroy();
});

test("cursor air current stays local and preserves downward gravity", () => {
  const view = new PerspectiveCamera(50, 1440 / 900, 0.1, 100);
  view.position.set(0, 1.55, 0);
  view.lookAt(0, 1.55, -20);
  view.updateMatrixWorld();
  const baselineScene = new Scene();
  const responsiveScene = new Scene();
  const baseline = createPortalRain(baselineScene, false, () => false);
  const responsive = createPortalRain(responsiveScene, false, () => false);
  const random = Math.random;
  try {
    // Identical births isolate the cursor force from the existing random wind.
    Math.random = () => 0.5;
    baseline.releaseFromBio(300, 250, 0.6, view, 24, 1440, 900);
    responsive.releaseFromBio(300, 250, 0.6, view, 24, 1440, 900);
  } finally {
    Math.random = random;
  }
  responsive.setPointer({ x: 310, y: 250 }, view, 1440, 900);
  baseline.update(1 / 60, 0, false, false, emitter, view, 1440, 900);
  responsive.update(1 / 60, 0, false, false, emitter, view, 1440, 900);
  const a = positions(baselineScene).p;
  const b = positions(responsiveScene).p;
  assert.equal(a.getY(0), b.getY(0), "the cursor cannot lift or delay falling matter");
  assert.notEqual(a.getX(0), b.getX(0));
  assert.ok(Math.abs(a.getX(0) - b.getX(0)) < 0.002, "reaction is restrained");
  responsive.setPointer(null, view, 1440, 900);
  baseline.destroy();
  responsive.destroy();
});
