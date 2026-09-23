/**
 * Headless checks for the scene modules.
 *
 * These exercise the parts of the environment that are pure logic: the pointer
 * zones, the water's pointer gating, and the quality manager's downgrade path.
 * None of them need a GPU, so they run in CI and give a deterministic answer
 * where a screenshot can only suggest one.
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { PerspectiveCamera, Points, Scene, ShaderMaterial, Vector3 } from "three";
import { applyPointerInfluence } from "../src/webgl/modules/pointerInfluence";
import { createParticleField } from "../src/webgl/modules/particleField";
import { createReflectiveFloor } from "../src/webgl/modules/reflectiveFloor";
import { createHorizonLights } from "../src/webgl/modules/horizonLights";
import {
  createQualityManager,
  particleCountFor,
  pickInitialTier,
  settingsFor,
} from "../src/webgl/core/quality";
import {
  cameraConfig,
  floorConfig,
  horizonLightConfig,
  particleConfig,
  pointerZones,
  rockConfig,
} from "../src/webgl/sceneConfig";

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
  const status = condition ? "pass" : "FAIL";
  if (!condition) {
    failures += 1;
  }
  console.log(`  [${status}] ${label}${detail ? ` — ${detail}` : ""}`);
}

// ------------------------------------------------------------- rock assets
console.log("\nrock assets");
for (const [chapter, config] of Object.entries(rockConfig.chapters)) {
  const path = join(process.cwd(), "public", config.url.replace(/^\//, ""));
  check(`${chapter} GLB exists`, existsSync(path));
  if (existsSync(path)) {
    check(`${chapter} GLB stays below 12 MiB`, statSync(path).size < 12 * 1024 * 1024);
  }
}

// ------------------------------------------------------------ pointer zones
console.log("\npointer influence zones");
{
  const base = { px: 0, py: 0, vx: 30, vy: 0, cx: 0, cy: 0, dirX: 1, dirY: 0, speed: 400 };
  const out = { ax: 0, ay: 0, disturbance: 0, contact: false };

  const at = (distance: number) => {
    applyPointerInfluence({ ...base, px: distance }, out);
    return { ...out, magnitude: Math.hypot(out.ax, out.ay) };
  };

  const outside = at(pointerZones.awareness + 40);
  check("beyond the awareness radius there is no force", outside.magnitude === 0);

  const aware = at(pointerZones.awareness - 20);
  check(
    `inside ~${pointerZones.awareness}px particles react`,
    aware.magnitude > 0 && !aware.contact,
    `force ${aware.magnitude.toFixed(1)}`,
  );

  const orbit = at(pointerZones.orbit - 20);
  check(
    `inside ~${pointerZones.orbit}px the force grows into an orbit`,
    orbit.magnitude > aware.magnitude && !orbit.contact,
    `force ${orbit.magnitude.toFixed(1)}`,
  );

  const contact = at(pointerZones.contact - 10);
  check(
    `inside ~${pointerZones.contact}px particles divide around the pointer`,
    contact.contact && contact.magnitude > orbit.magnitude && contact.disturbance === 1,
    `force ${contact.magnitude.toFixed(1)}`,
  );

  // The split must be tangential, not a radial shove.
  applyPointerInfluence({ ...base, px: 10, py: 0, vx: 0, vy: 40 }, out);
  check("the split is mostly tangential", Math.abs(out.ay) > Math.abs(out.ax));
}

// -------------------------------------------------------- particle composition
console.log("\nparticle composition");
{
  const options = { count: 900, width: 1586, height: 992, pixelRatio: 1, reducedMotion: false };
  const first = createParticleField(options);
  const second = createParticleField(options);
  const positions = (field: typeof first) =>
    Array.from(
      (
        (field.scene.children[0] as Points).geometry.getAttribute("position").array as Float32Array
      ).slice(0, 120),
    );
  const idlePointer = { x: 0, y: 0, dirX: 0, dirY: 0, speed: 0, active: false };
  first.update(0, 0, idlePointer);
  second.update(0, 0, idlePointer);
  check(
    "spawning is identical across reloads",
    JSON.stringify(positions(first)) === JSON.stringify(positions(second)),
  );
  first.destroy();
  second.destroy();

  const still = createParticleField({ ...options, reducedMotion: true });
  still.update(0, 0, idlePointer);
  const initial = positions(still);
  const drawCount = (still.scene.children[0] as Points).geometry.drawRange.count;
  still.update(5, 5, { ...idlePointer, active: true });
  check(
    "reduced-motion particles remain still",
    JSON.stringify(initial) === JSON.stringify(positions(still)),
  );
  check(
    "reduced-motion composition is sparse",
    drawCount === Math.round(options.count * particleConfig.density.reducedMotionFactor),
  );
  still.destroy();

  check(
    "mobile density is further reduced",
    particleCountFor(settingsFor("high"), 390 * 844) <
      particleCountFor(settingsFor("high"), 1586 * 992) * 0.2,
  );
}

// ------------------------------------------------------------- water gating
console.log("\nreflective floor pointer gating");
{
  const floor = createReflectiveFloor({
    width: 160,
    depth: 140,
    reflectionSize: 256,
    maxRipples: 3,
    reducedMotion: false,
  });

  check(
    "the upper viewport never touches the water",
    floor.requestRipple(0.5, 0.2, 400) === false && floor.activeRipples() === 0,
  );

  const threshold = 1 - floorConfig.pointerZone;
  check(
    `just above the ${(floorConfig.pointerZone * 100).toFixed(0)}% band is still ignored`,
    floor.requestRipple(0.5, threshold - 0.02, 400) === false,
  );

  check(
    "inside the lower band a ripple forms",
    floor.requestRipple(0.5, threshold + 0.05, 400) === true,
  );
  check(
    "a second ripple is throttled by the interval",
    floor.requestRipple(0.5, 0.9, 400) === false,
  );

  // Let the cooldown lapse and fill past the cap.
  for (let i = 0; i < 6; i += 1) {
    floor.update(floorConfig.rippleInterval + 0.01, 0, 1);
    floor.requestRipple(0.4 + i * 0.05, 0.85, 400);
  }
  check(
    "ripple count is capped",
    floor.activeRipples() <= 3,
    `${floor.activeRipples()} alive, cap 3`,
  );

  // Ripples decay rather than persisting.
  floor.update(floorConfig.rippleSeconds + 0.1, 0, 1);
  check("ripples decay away", floor.activeRipples() === 0);

  floor.destroy();

  const still = createReflectiveFloor({
    width: 160,
    depth: 140,
    reflectionSize: 0,
    maxRipples: 3,
    reducedMotion: true,
  });
  check("reduced motion never ripples", still.requestRipple(0.5, 0.95, 400) === false);
  still.update(0, 100, 1);
  check(
    "reduced-motion water time stays fixed",
    (still.mesh.material as ShaderMaterial).uniforms.uTime?.value === 0,
  );
  still.destroy();
}

// ------------------------------------------------------ horizon alignment
console.log("\nhorizon light/reflection alignment");
{
  const camera = new PerspectiveCamera(
    cameraConfig.fov,
    16 / 9,
    cameraConfig.near,
    cameraConfig.far,
  );
  camera.position.set(0, cameraConfig.height, cameraConfig.distance);
  camera.rotation.set(
    Math.atan((2 * floorConfig.horizon - 1) * Math.tan((cameraConfig.fov * Math.PI) / 360)),
    0,
    0,
  );
  const lights = createHorizonLights(new Scene(), camera, true);
  lights.update(0, 30);
  const staticIntensities = lights.reflections().map((source) => source.intensity);
  lights.update(0, 90);
  check(
    "reduced-motion light intensity stays fixed",
    lights.reflections().every((source, index) => source.intensity === staticIntensities[index]),
  );
  check(
    "every configured light has one reflection",
    lights.reflections().length === horizonLightConfig.sources.length,
  );
  camera.aspect = 390 / 844;
  camera.updateProjectionMatrix();
  lights.resize(camera);
  const aligned = lights.group.children.every((mesh, index) => {
    const point = new Vector3().copy(mesh.position).project(camera);
    const reflected = lights.reflections()[index]!;
    return Math.abs((point.x + 1) * 0.5 - reflected.x) < 0.002;
  });
  check("mobile light and reflection x remain aligned", aligned);
  lights.destroy();
}

// ----------------------------------------------------------- quality tiers
console.log("\nquality manager");
{
  check(
    "a weak device starts low",
    pickInitialTier(
      { webgl2: false, maxTextureSize: 2048, cores: 2, memory: 2, devicePixelRatio: 1 },
      2_000_000,
    ) === "low",
  );
  check(
    "a mid device starts medium",
    pickInitialTier(
      { webgl2: true, maxTextureSize: 8192, cores: 4, memory: 4, devicePixelRatio: 2 },
      1_000_000,
    ) === "medium",
  );
  check(
    "a strong device starts high",
    pickInitialTier(
      { webgl2: true, maxTextureSize: 16384, cores: 12, memory: 8, devicePixelRatio: 2 },
      1_300_000,
    ) === "high",
  );

  const high = settingsFor("high");
  const low = settingsFor("low");
  check("pixel ratio is capped on every tier", high.pixelRatioCap <= 2 && low.pixelRatioCap <= 1);
  check("the low tier drops the reflection pass", low.reflectionSize === 0);
  check(
    "particle density falls with the tier",
    high.particlesPerMegapixel > low.particlesPerMegapixel,
  );

  const desktop = particleCountFor(high, 1440 * 900);
  const phone = particleCountFor(high, 390 * 844);
  check(
    "particle count scales with viewport area, not just tier",
    phone < desktop / 2.5,
    `1440x900 → ${desktop}, 390x844 → ${phone}`,
  );
  check(
    "a huge viewport stays under the ceiling",
    particleCountFor(high, 3840 * 2160) <= high.maxParticles,
  );

  const manager = createQualityManager("high");
  let downgraded: string | null = null;
  for (let frame = 0; frame < 200 && !downgraded; frame += 1) {
    const next = manager.sample(34);
    if (next) downgraded = next.tier;
  }
  check("sustained slow frames downgrade the tier", downgraded === "medium", `now ${downgraded}`);

  const steady = createQualityManager("high");
  let changed = false;
  for (let frame = 0; frame < 400; frame += 1) {
    if (steady.sample(12)) changed = true;
  }
  check("healthy frames never downgrade", !changed);

  const spike = createQualityManager("high");
  let spiked = false;
  for (let frame = 0; frame < 50; frame += 1) {
    if (spike.sample(2000)) spiked = true;
  }
  check("a tab-switch stall is not mistaken for slowness", !spiked);
}

console.log(
  failures === 0 ? "\nAll scene checks passed.\n" : `\n${failures} scene check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
