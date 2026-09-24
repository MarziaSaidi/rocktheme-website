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
import { sceneViewportForWidth } from "../src/config/responsive";
import { SECTION_IDS } from "../src/config/sections";
import { applyPointerInfluence } from "../src/webgl/modules/pointerInfluence";
import { createParticleField } from "../src/webgl/modules/particleField";
import { DUST_COUNT, DUST_LEAD, DUST_LIFE } from "../src/webgl/modules/monolith";
import { createReflectiveFloor } from "../src/webgl/modules/reflectiveFloor";
import { createHorizonLights } from "../src/webgl/modules/horizonLights";
import {
  createQualityManager,
  particleCountFor,
  pickInitialTier,
  settingsFor,
} from "../src/webgl/core/quality";
import {
  evaluateMonolith,
  monolithDuration,
  type MonolithTimeline,
} from "../src/webgl/monolithChannel";
import {
  floorConfig,
  monolithConfig,
  horizonLightConfig,
  particleConfig,
  pointerZones,
  ROCK_ASSET_IDS,
  ROCK_INSTANCE_IDS,
  resolveCamera,
  resolveRockTransform,
  rockAssets,
  rockInstances,
  sceneSections,
} from "../src/webgl/sceneConfig";

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
  const status = condition ? "pass" : "FAIL";
  if (!condition) {
    failures += 1;
  }
  console.log(`  [${status}] ${label}${detail ? ` — ${detail}` : ""}`);
}

// ------------------------------------------------ sections and scene registry
console.log("\nsection and scene registry");
check("section identities are unique", new Set(SECTION_IDS).size === SECTION_IDS.length);
for (const sectionId of SECTION_IDS) {
  const config = sceneSections[sectionId];
  check(`${sectionId} has a scene configuration`, Boolean(config));
  check(
    `${sectionId} configuration identifies its own section`,
    config?.sectionId === sectionId,
    `received ${String(config?.sectionId)}`,
  );
  check(
    `${sectionId} has at most four horizon sources`,
    config.horizonLights.sources.length > 0 && config.horizonLights.sources.length <= 4,
    `${config.horizonLights.sources.length} configured`,
  );
  check(
    `${sectionId} mist is built from overlapping sheets`,
    config.fog.layers.length >= 2 && config.fog.layers.length <= 4,
    `${config.fog.layers.length} layers`,
  );
  check(
    `${sectionId} mist sheets differ in depth, drift and noise`,
    new Set(config.fog.layers.map((layer) => layer.depth)).size === config.fog.layers.length &&
      new Set(config.fog.layers.map((layer) => layer.speed)).size === config.fog.layers.length &&
      new Set(config.fog.layers.map((layer) => layer.noiseScale)).size === config.fog.layers.length,
  );
  check(
    `${sectionId} no mist sheet is opaque enough to read as a wall`,
    config.fog.layers.every((layer) => layer.opacity > 0 && layer.opacity <= 1.5),
  );
  check(
    `${sectionId} horizon sources are wider than they are tall`,
    config.horizonLights.sources.every((source) => source.width > source.height * 1.6),
  );
  check(
    `${sectionId} rock lights stay local rather than global`,
    config.lighting.points.length > 0 &&
      config.lighting.points.every((light) => light.decay === 2 && light.distance <= 20),
  );
  check(
    `${sectionId} fog colour matches the DOM background`,
    config.fog.color === 0x100b18,
    `0x${config.fog.color.toString(16)}`,
  );
  check(
    `${sectionId} horizon sources sit at distinct depths`,
    new Set(config.horizonLights.sources.map((source) => source.depth)).size ===
      config.horizonLights.sources.length,
  );
}

// ------------------------------------------------------------- rock assets
console.log("\nrock assets and instances");
check("rock asset ids are unique", new Set(ROCK_ASSET_IDS).size === ROCK_ASSET_IDS.length);
check("rock instance ids are unique", new Set(ROCK_INSTANCE_IDS).size === ROCK_INSTANCE_IDS.length);
for (const assetId of ROCK_ASSET_IDS) {
  const asset = rockAssets[assetId];
  check(`${assetId} registry key matches its id`, asset.id === assetId);
  const path = join(process.cwd(), "public", asset.source.replace(/^\//, ""));
  check(`${assetId} GLB exists`, existsSync(path), asset.source);
  if (existsSync(path)) {
    check(`${assetId} GLB stays below 12 MiB`, statSync(path).size < 12 * 1024 * 1024);
  }
}

for (const instanceId of ROCK_INSTANCE_IDS) {
  const instance = rockInstances[instanceId];
  check(`${instanceId} registry key matches its id`, instance.id === instanceId);
  check(
    `${instanceId} references a known asset`,
    ROCK_ASSET_IDS.includes(instance.assetId as (typeof ROCK_ASSET_IDS)[number]),
    instance.assetId,
  );
  check(
    `${instanceId} references a known section`,
    SECTION_IDS.includes(instance.sectionId),
    instance.sectionId,
  );
  check(
    `${instanceId} asset allows ${instance.sectionId}`,
    (rockAssets[instance.assetId].allowedSections as readonly string[]).includes(
      instance.sectionId,
    ),
  );
  for (const viewport of ["desktop", "tablet", "mobile"] as const) {
    const transform = resolveRockTransform(instanceId, viewport);
    check(
      `${instanceId}.${viewport} position is finite`,
      transform.position.length === 3 && transform.position.every(Number.isFinite),
    );
    check(
      `${instanceId}.${viewport} rotation is finite`,
      transform.rotation.length === 3 && transform.rotation.every(Number.isFinite),
    );
    check(
      `${instanceId}.${viewport} scale is positive`,
      transform.scale.length === 3 &&
        transform.scale.every((value) => Number.isFinite(value) && value > 0),
      transform.scale.join(", "),
    );
  }
}

for (const sectionId of SECTION_IDS) {
  for (const instanceId of sceneSections[sectionId].rockInstanceIds) {
    const known = ROCK_INSTANCE_IDS.includes(instanceId as (typeof ROCK_INSTANCE_IDS)[number]);
    check(`${sectionId} references known rock instance ${instanceId}`, known);
    if (known) {
      check(
        `${sectionId} owns rock instance ${instanceId}`,
        rockInstances[instanceId as keyof typeof rockInstances].sectionId === sectionId,
      );
    }
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
    floor.update(floorConfig.rippleInterval + 0.01, 0);
    floor.requestRipple(0.4 + i * 0.05, 0.85, 400);
  }
  check(
    "ripple count is capped",
    floor.activeRipples() <= 3,
    `${floor.activeRipples()} alive, cap 3`,
  );

  // Ripples decay rather than persisting.
  floor.update(floorConfig.rippleSeconds + 0.1, 0);
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
  still.update(0, 100);
  check(
    "reduced-motion water time stays fixed",
    (still.mesh.material as ShaderMaterial).uniforms.uTime?.value === 0,
  );
  still.destroy();
}

// ------------------------------------------------------ horizon alignment
console.log("\nhorizon light/reflection alignment");
{
  const resolved = resolveCamera("hero", sceneViewportForWidth(1440));
  const camera = new PerspectiveCamera(resolved.fov, 16 / 9, resolved.near, resolved.far);
  camera.position.set(
    resolved.target[0] + resolved.offset[0],
    resolved.target[1] + resolved.offset[1],
    resolved.target[2] + resolved.offset[2],
  );
  camera.lookAt(...resolved.target);
  const lights = createHorizonLights(new Scene(), camera, true);
  lights.update(0, 30);
  const staticIntensities = lights.beacons().map((source) => source.intensity);
  lights.update(0, 90);
  check(
    "reduced-motion light intensity stays fixed",
    lights.beacons().every((source, index) => source.intensity === staticIntensities[index]),
  );
  check(
    "every configured light publishes one beacon",
    lights.beacons().length === horizonLightConfig.sources.length,
  );
  camera.aspect = 390 / 844;
  camera.updateProjectionMatrix();
  lights.resize(camera);
  // The water mirrors the beacon's world position, so source and reflection
  // cannot drift apart. What must hold is that the published position is the
  // mesh the viewer sees, at every aspect ratio.
  const anchored = lights.beacons().every((beacon, index) => {
    const mesh = lights.group.children[index]!;
    return new Vector3().copy(mesh.position).distanceTo(beacon.world) < 1e-6;
  });
  check("beacon world positions track their meshes", anchored);
  const onScreen = lights.beacons().every((beacon) => {
    const point = new Vector3().copy(beacon.world).project(camera);
    return Math.abs(point.x) <= 1.05;
  });
  check("mobile cropping keeps every beacon in frame", onScreen);
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

// ---------------------------------------------------------------- monolith
console.log("\nselected work monolith");
{
  for (const source of [monolithConfig.stone.source, monolithConfig.mountains.source]) {
    const path = join(process.cwd(), "public", source.replace(/^\//, ""));
    check(`${source} exists`, existsSync(path));
    if (existsSync(path)) {
      check(`${source} stays below 12 MiB`, statSync(path).size < 12 * 1024 * 1024);
    }
  }
  check(
    "monolith belongs to Selected Work, which has no other rock",
    monolithConfig.sectionId === "selected-work" &&
      sceneSections["selected-work"].rockInstanceIds.length === 0,
  );
  for (const viewport of ["desktop", "tablet", "mobile"] as const) {
    const placement = {
      ...monolithConfig.stone.placement.desktop,
      ...(viewport === "desktop" ? {} : monolithConfig.stone.placement[viewport]),
    };
    const top = placement.screenCenterY + placement.screenHeight / 2;
    const bottom = placement.screenCenterY - placement.screenHeight / 2;
    // The face planes were measured between these heights of the stone.
    check(`${viewport} screen stays on the measured face`, bottom >= 0.3 && top <= 0.83);
    const faceWidth = 0.36;
    const width = (placement.screenHeight * monolithConfig.screen.aspect) / placement.girth;
    check(
      `${viewport} screen leaves stone at its sides`,
      width < faceWidth * 0.8,
      width.toFixed(3),
    );
  }

  const timing = { fadeOutMs: 200, orbitMs: 1400, fadeInMs: 250 };
  const walk = (fromView: number, toView: number, reduced = false): MonolithTimeline => ({
    fromView,
    toView,
    startedAt: 0,
    timing,
    reduced,
  });

  const round = walk(0, 1);
  const total = monolithDuration(round);
  check("one walk lasts fade out + orbit + fade in", total === 1850, String(total));
  check(
    "the orbit takes between 1.2 and 1.6 seconds",
    monolithConfig.timing.orbitMs >= 1200 && monolithConfig.timing.orbitMs <= 1600,
  );

  const sweepOnce = (timeline: MonolithTimeline, rising: boolean) => {
    let previous = rising ? -Infinity : Infinity;
    let monotonic = true;
    let overshoot = false;
    for (let t = 0; t <= total + 100; t += 5) {
      const { orbit } = evaluateMonolith(timeline, t);
      if (rising ? orbit < previous - 1e-9 : orbit > previous + 1e-9) monotonic = false;
      if (orbit > 1 + 1e-9 || orbit < -1e-9) overshoot = true;
      previous = orbit;
    }
    return { monotonic, overshoot };
  };
  const out = sweepOnce(round, true);
  check("the camera walks one way only", out.monotonic);
  check("the camera never overshoots the back face", !out.overshoot);
  const back = sweepOnce(walk(1, 0), false);
  check("walking back retraces the same arc", back.monotonic && !back.overshoot);

  check("the camera waits while the screen fades out", evaluateMonolith(round, 150).orbit === 0);
  const dark = evaluateMonolith(round, 900);
  check("both screens are dark while walking", dark.front === 0 && dark.back === 0);
  const rest = evaluateMonolith(round, total);
  check("behind the stone, the back face is lit", rest.back === 1 && rest.front === 0);
  check("the walk settles behind the stone", rest.orbit === 1 && rest.settled);
  check("walking back relights the front face", evaluateMonolith(walk(1, 0), total).front === 1);

  {
    const { fadeOutMs, orbitMs } = monolithConfig.timing;
    const midpoint = (fadeOutMs + orbitMs / 2) / 1000;
    check(
      "the dissolving dust is gone before the camera is half way round",
      fadeOutMs / 1000 + DUST_LIFE < midpoint,
    );
    check(
      "the arriving dust does not start until after the half way point",
      (fadeOutMs + orbitMs) / 1000 - DUST_LEAD > midpoint,
    );
    check("the dust stays restrained", DUST_COUNT >= 150 && DUST_COUNT <= 300);
    const live = { ...round, timing: monolithConfig.timing };
    const half = evaluateMonolith(live, midpoint * 1000);
    check("no display is present half way round", half.front === 0 && half.back === 0);
  }

  const reduced = walk(0, 1, true);
  check("reduced motion drops the walk", monolithDuration(reduced) === 450);
  check(
    "reduced motion cuts to the other side while the screens are dark",
    evaluateMonolith(reduced, 199).orbit === 0 && evaluateMonolith(reduced, 201).orbit === 1,
  );
}

console.log(
  failures === 0 ? "\nAll scene checks passed.\n" : `\n${failures} scene check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
