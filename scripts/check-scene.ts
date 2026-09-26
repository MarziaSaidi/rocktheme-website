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
import { resolveResponsiveValue, sceneViewportForWidth } from "../src/config/responsive";
import { SECTION_IDS } from "../src/config/sections";
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
  WORK_STRETCHES,
  detailsPoint,
  holdStart,
  workMoment,
  workScreens,
} from "../src/webgl/workJourney";
import {
  arrivalEnd,
  evaluateJourney,
  nearestRest,
  type CameraPose,
  type JourneyStops,
} from "../src/webgl/core/cameraJourney";
import { toWorld } from "../src/webgl/core/chapterFrame";
import {
  arrivalKeyframes,
  chapterFrames,
  departureKeyframes,
  chapterRest,
  journeyWaypoints,
  floorConfig,
  heroLandscapeConfig,
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
  workStations,
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
  check("one stone per featured project", monolithConfig.stones.length === 2);
  for (const viewport of ["desktop", "tablet", "mobile"] as const) {
    const placements = monolithConfig.stones.map((stone) =>
      resolveResponsiveValue(stone, viewport),
    );
    placements.forEach((placement, index) => {
      const top = placement.screenCenterY + placement.screenHeight / 2;
      const bottom = placement.screenCenterY - placement.screenHeight / 2;
      const label = `${viewport} stone ${index + 1}`;
      // The face plane was measured between these heights of the stone.
      check(`${label}: screen stays on the measured face`, bottom >= 0.3 && top <= 0.83);
      const faceWidth = 0.36;
      const width = (placement.screenHeight * monolithConfig.screen.aspect) / placement.girth;
      check(
        `${label}: screen leaves stone at its sides`,
        width < faceWidth * 0.8,
        width.toFixed(3),
      );
    });
    const [first, second] = placements;
    if (first && second) {
      const apart = Math.hypot(
        first.position[0] - second.position[0],
        first.position[2] - second.position[2],
      );
      check(`${viewport}: the projects stand in different places`, apart > 20, apart.toFixed(1));
    }
    check(
      `${viewport}: one camera station per stone`,
      workStations(viewport).length === monolithConfig.stones.length,
    );
  }
}

// --------------------------------------------------------- work journey
console.log("\nselected work journey");
{
  const count = 2;
  const total = workScreens(count);
  check(
    "the stage runs approach + two holds + one travel",
    Math.abs(total - (WORK_STRETCHES.approach + 2 * WORK_STRETCHES.hold + WORK_STRETCHES.travel)) <
      1e-9,
  );
  check("the far view shows no details", !workMoment(0, count).details);
  check(
    "no details during the approach",
    !workMoment(WORK_STRETCHES.approach * 0.95, count).details,
  );
  check("details once settled at the first stone", workMoment(detailsPoint(0), count).details);
  check("details once settled at the second stone", workMoment(detailsPoint(1), count).details);

  let detailsWhileMoving = false;
  let projectChangedWhileShown = false;
  let lastProject = 0;
  const firstDetails = [-1, -1];
  for (let screens = 0; screens <= total; screens += 0.001) {
    const moment = workMoment(screens, count);
    if (moment.details && moment.leg.kind !== "hold") detailsWhileMoving = true;
    if (moment.project !== lastProject && moment.details) projectChangedWhileShown = true;
    if (moment.details && firstDetails[moment.project] === -1)
      firstDetails[moment.project] = screens;
    lastProject = moment.project;
  }
  check("details only ever show while the camera holds still", !detailsWhileMoving);
  check("the card only changes project while it is hidden", !projectChangedWhileShown);
  check(
    "details wait for the camera to settle",
    firstDetails.every((at, index) => at > holdStart(index)),
    firstDetails.map((at) => at.toFixed(2)).join(", "),
  );
  const leaveAt = holdStart(0) + WORK_STRETCHES.hold;
  check(
    "the card is gone well before the camera moves on",
    !workMoment(leaveAt - 0.2, count).details,
  );
  check(
    "the camera travels to the second stone",
    workMoment(leaveAt + 0.1, count).leg.kind === "move",
  );
  check("the stage ends settled at the last stone", workMoment(total, count).leg.kind === "hold");
}

// ------------------------------------------------------------ camera journey
console.log("\ncamera journey");
{
  // Scroll offsets as the page measures them; the work stage pins for its journey.
  const layouts = {
    desktop: { workStart: 2070, workEnd: 8550, about: 9420, contact: 10110 },
    mobile: { workStart: 844, workEnd: 6921, about: 7846, contact: 8546 },
  } as const satisfies Record<string, JourneyStops>;

  for (const [viewport, stops] of Object.entries(layouts) as [
    keyof typeof layouts,
    JourneyStops,
  ][]) {
    const rests = {
      about: chapterRest("about", viewport),
      contact: chapterRest("footer", viewport),
    };
    const waypoints = { departure: journeyWaypoints.departure };
    const arrival = arrivalKeyframes(viewport);
    const departures = departureKeyframes(viewport);
    const stations = workStations(viewport);
    const pivots = monolithConfig.stones.map((stone) => {
      const { position } = resolveResponsiveValue(stone, viewport);
      return new Vector3(position[0], 0, position[2]);
    });
    const rocks = ROCK_INSTANCE_IDS.map((instanceId) => {
      const transform = resolveRockTransform(instanceId, viewport);
      const world = toWorld(chapterFrames[rockInstances[instanceId].sectionId], transform.position);
      return { world: new Vector3(...world), half: transform.scale[0] / 2 };
    });
    // The hero's perch is a rock the journey passes too, while it is drawn:
    // it is gone once the camera has arrived at the first stone.
    const perch = resolveResponsiveValue(heroLandscapeConfig.placement, viewport).perch;
    const perchRock = {
      world: new Vector3(...toWorld(chapterFrames.hero, perch.position)),
      half: Math.max(perch.width, perch.depth) / 2,
    };

    const at = (scroll: number) => {
      const pose: CameraPose = { eye: new Vector3(), target: new Vector3(), fov: 0 };
      evaluateJourney({ scroll, stops, arrival, rests, waypoints, stations, departures }, pose);
      return pose;
    };
    const same = (a: CameraPose, eye: readonly number[]) =>
      a.eye.distanceTo(new Vector3(eye[0], eye[1], eye[2])) < 1e-6;
    const total = workScreens(stations.length);
    const workScroll = (screens: number) =>
      stops.workStart + (screens / total) * (stops.workEnd - stops.workStart);

    const arrived = arrivalEnd(stops, stations.length);
    check(`${viewport}: the journey starts at the hero composition`, same(at(0), arrival[0]!.eye));
    arrival.forEach((key, index) => {
      check(
        `${viewport}: the arrival passes keyframe ${index + 1}`,
        same(at(key.at * arrived), key.eye),
      );
    });
    check(
      `${viewport}: the arrival ends settled at the first stone`,
      same(at(arrived), stations[0]!.settle.eye) &&
        at(arrived - 1).eye.distanceTo(new Vector3(...stations[0]!.settle.eye)) < 1e-3,
    );
    // Only the authored stops are still: the camera never halts mid-arrival.
    let stalls = 0;
    // From the first move on; leaving the hero it gathers pace from rest.
    for (let scroll = Math.ceil(arrival[1]!.at * arrived); scroll < arrived - 2; scroll += 1) {
      if (at(scroll).eye.distanceTo(at(scroll - 1).eye) < 1e-7) stalls += 1;
    }
    check(`${viewport}: the camera does not stop during the arrival`, stalls === 0, `${stalls}`);
    stations.forEach((station, index) => {
      check(
        `${viewport}: the camera settles at stone ${index + 1} while its details show`,
        same(at(workScroll(detailsPoint(index))), station.settle.eye),
      );
    });
    check(
      `${viewport}: the stage ends settled at the last stone`,
      same(at(stops.workEnd), stations[stations.length - 1]!.settle.eye),
    );
    check(
      `${viewport}: How I Work rests at its composition`,
      same(at(stops.about), rests.about.eye),
    );
    check(
      `${viewport}: Contact rests at its composition`,
      same(at(stops.contact), rests.contact.eye),
    );

    let previous = at(0);
    let largestStep = 0;
    let largestTurn = 0;
    let nearestStone = Number.POSITIVE_INFINITY;
    let nearestRock = Number.POSITIVE_INFINITY;
    for (let scroll = 1; scroll <= stops.contact; scroll += 1) {
      const pose = at(scroll);
      const direction = pose.target.clone().sub(pose.eye).normalize();
      const before = previous.target.clone().sub(previous.eye).normalize();
      largestStep = Math.max(largestStep, pose.eye.distanceTo(previous.eye));
      largestTurn = Math.max(largestTurn, Math.acos(Math.min(1, direction.dot(before))));
      pivots.forEach((pivot) => {
        nearestStone = Math.min(
          nearestStone,
          Math.hypot(pose.eye.x - pivot.x, pose.eye.z - pivot.z),
        );
      });
      [...rocks, ...(scroll < arrivalEnd(stops, stations.length) ? [perchRock] : [])].forEach(
        (rock) => {
          const gap = Math.hypot(pose.eye.x - rock.world.x, pose.eye.z - rock.world.z) - rock.half;
          nearestRock = Math.min(nearestRock, gap);
        },
      );
      previous = pose;
    }
    check(`${viewport}: no jump between scroll pixels`, largestStep < 0.6, largestStep.toFixed(3));
    check(
      `${viewport}: no sudden turn between scroll pixels`,
      (largestTurn * 180) / Math.PI < 2,
      `${((largestTurn * 180) / Math.PI).toFixed(2)}°`,
    );
    check(
      `${viewport}: the camera keeps clear of both stones`,
      nearestStone > 8,
      nearestStone.toFixed(2),
    );
    check(
      `${viewport}: the camera keeps clear of every rock`,
      nearestRock > 3,
      nearestRock.toFixed(2),
    );

    const reversed = at(4200);
    at(stops.contact);
    check(
      `${viewport}: scrolling back returns the same pose`,
      reversed.eye.distanceTo(at(4200).eye) < 1e-9,
    );
    check(
      `${viewport}: reduced motion near the top cuts to the hero`,
      nearestRest(arrived * 0.2, stops, stations.length) === 0,
    );
    check(
      `${viewport}: reduced motion on the way in cuts to the first stone`,
      same(at(nearestRest(arrived * 0.8, stops, stations.length)), stations[0]!.settle.eye),
    );
    check(
      `${viewport}: reduced motion inside the stage cuts to a settled project`,
      same(at(nearestRest(workScroll(5.2), stops, stations.length)), stations[1]!.settle.eye),
    );
  }
}

console.log(
  failures === 0 ? "\nAll scene checks passed.\n" : `\n${failures} scene check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
