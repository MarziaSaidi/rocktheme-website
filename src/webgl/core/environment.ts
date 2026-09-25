import {
  Color,
  Fog,
  Group,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";

import { sceneViewportForWidth, type SceneViewport } from "@/config/responsive";
import { SECTION_IDS, type SectionId } from "@/config/sections";
import type { PointerSample } from "@/motion/pointerSource";

import { createHorizonLights, type HorizonLights } from "../modules/horizonLights";
import { createHorizonAtmosphere, type HorizonAtmosphere } from "../modules/horizonAtmosphere";
import { createLowMist, type LowMist } from "../modules/lowMist";
import {
  createParticleField,
  type ObstacleRect,
  type ParticleField,
} from "../modules/particleField";
import { createReflectiveFloor, type ReflectiveFloor } from "../modules/reflectiveFloor";
import { createHeroLandscape, type HeroLandscape } from "../modules/heroLandscape";
import { createMonolith, type Monolith } from "../modules/monolith";
import { createRocks, type Rocks } from "../modules/rocks";
import { subscribeMonolith } from "../monolithChannel";
import {
  chapterFrames,
  chapterRest,
  getSceneSection,
  heroLandscapeConfig,
  introPose,
  journeyWaypoints,
  monolithConfig,
  resolveCamera,
} from "../sceneConfig";
import type { EnvironmentLightingConfig, Vector3Tuple } from "../sceneTypes";
import {
  evaluateJourney,
  nearestRest,
  smootherstep,
  type CameraPose,
  type JourneyRests,
  type JourneyStops,
} from "./cameraJourney";
import { poseInFrame, toWorld } from "./chapterFrame";
import { detectCapability } from "./capability";
import {
  createQualityManager,
  particleCountFor,
  pickInitialTier,
  type QualitySettings,
} from "./quality";

/**
 * Scene lifecycle.
 *
 * Owns the renderer, the two render passes, the frame loop and disposal. Every
 * module is constructed here and torn down here, so there is exactly one place
 * to look for a leak.
 *
 * Two passes share one renderer:
 *   1. perspective  floor, beacons, rocks
 *   2. orthographic particles, simulated in screen-space pixels
 *
 * The environment receives obstacle rectangles and a pointer sample. It is
 * given no project data, no labels and no DOM nodes.
 */

export type EnvironmentStats = Readonly<{
  tier: QualitySettings["tier"];
  particleCount: number;
  pixelRatio: number;
  averageFrameMs: number;
  disturbedParticles: number;
  reflectionSize: number;
  drawCalls: number;
  activeRipples: number;
}>;

export type EnvironmentOptions = Readonly<{
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
  /** Called whenever the quality tier changes, for reporting and DOM state. */
  onQualityChange?: (settings: QualitySettings) => void;
  /** Called with the beacon intensity so the DOM can rim-light its own edges. */
  onBeaconIntensity?: (intensity: number) => void;
  /** Called if the Selected Work stone or its mountains cannot be loaded. */
  onMonolithFailure?: () => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}>;

export type Environment = Readonly<{
  start: () => void;
  stop: () => void;
  resize: (width: number, height: number) => void;
  setObstacles: (obstacles: readonly ObstacleRect[]) => void;
  /**
   * The rectangle the environment should respond to: particles gather around
   * it and the nearest horizon beacon brightens. Pass null to release.
   */
  setFocus: (rect: ObstacleRect | null) => void;
  setPointer: (sample: PointerSample) => void;
  setSection: (sectionId: SectionId | null) => void;
  /** The page's scroll offset; the camera journey follows it. */
  setScroll: (scrollY: number) => void;
  /** Where each chapter's scroll range begins and ends, measured from the DOM. */
  setJourneyStops: (stops: JourneyStops) => void;
  stats: () => EnvironmentStats;
  destroy: () => void;
}>;

export function createEnvironment(options: EnvironmentOptions): Environment | null {
  const capability = detectCapability();

  if (!capability) {
    return null;
  }

  let width = Math.max(1, options.canvas.clientWidth);
  let height = Math.max(1, options.canvas.clientHeight);
  let activeSectionId: SectionId = "hero";
  let activeScene = getSceneSection(activeSectionId);

  const quality = createQualityManager(pickInitialTier(capability, width * height));
  let settings = quality.current();

  let renderer: WebGLRenderer;

  try {
    renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
  } catch {
    // A context can still fail to materialise after a successful probe.
    return null;
  }

  const cappedRatio = () => Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap);

  renderer.setPixelRatio(cappedRatio());
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  // ---------------------------------------------------------- perspective pass
  const worldScene = new Scene();
  /*
   * Linear fog only sinks far geometry into the same atmosphere the mist
   * sheets draw. Its colour is the DOM background the canvas composites over;
   * the renderer stays alpha so the CSS fallback layer is never covered.
   */
  worldScene.fog = new Fog(
    activeScene.fog.color,
    activeScene.lighting.fogNear,
    activeScene.lighting.fogFar,
  );
  /*
   * `camera` is the layout reference only: the hero composition at the origin
   * of its frame. Horizon sources, atmosphere and mist lay themselves out from
   * it once; the horizon rig then carries them to wherever `view` stands.
   */
  const initialCamera = resolveCamera("hero", sceneViewportForWidth(width));
  const camera = new PerspectiveCamera(
    initialCamera.fov,
    width / height,
    initialCamera.near,
    initialCamera.far,
  );
  const applyCamera = () => {
    const config = resolveCamera("hero", sceneViewportForWidth(width));
    camera.fov = config.fov;
    camera.near = config.near;
    camera.far = config.far;
    camera.position.set(
      config.target[0] + config.offset[0],
      config.target[1] + config.offset[1],
      config.target[2] + config.offset[2],
    );
    camera.lookAt(...config.target);
    camera.updateProjectionMatrix();
  };
  applyCamera();

  const floor: ReflectiveFloor = createReflectiveFloor({
    width: 160,
    depth: 140,
    reflectionSize: settings.reflectionSize,
    maxRipples: settings.maxRipples,
    reducedMotion: options.reducedMotion,
    config: activeScene.water,
  });
  worldScene.add(floor.mesh);
  /*
   * The water beyond the far side of the Selected Work stone. The floor is one
   * quad running from just behind the camera to the horizon; walking round
   * the stone turns the view toward where that quad ends. This tile is the
   * same mesh, geometry and material, laid edge to edge behind it, so the
   * surface is one continuous world-space field. It is behind the camera in
   * every other view.
   */
  const floorBeyond = new Mesh(floor.mesh.geometry, floor.mesh.material);
  floorBeyond.rotation.copy(floor.mesh.rotation);
  floorBeyond.position.copy(floor.mesh.position);
  floorBeyond.position.z += 140;
  floorBeyond.renderOrder = floor.mesh.renderOrder;
  worldScene.add(floorBeyond);

  const lights: HorizonLights = createHorizonLights(
    worldScene,
    camera,
    options.reducedMotion,
    activeScene.horizonLights,
  );
  const atmosphere: HorizonAtmosphere = createHorizonAtmosphere(
    worldScene,
    camera,
    options.reducedMotion,
    activeScene.fog,
  );
  /*
   * Low mist lies on the water in world space, so unlike the horizon sheets it
   * stays where it is while the viewer walks round the stone.
   */
  const mist: LowMist = createLowMist(
    worldScene,
    camera,
    width,
    options.reducedMotion,
    activeScene.mist,
  );
  const rocks: Rocks = createRocks(
    worldScene,
    activeScene.lighting,
    (instanceId) => {
      console.error(`Landscape rock failed to load: ${instanceId}`);
      options.canvas.dataset.rockFailed = instanceId;
    },
    () => {
      if (options.reducedMotion) renderOnce(0);
    },
  );
  rocks.resize(width);

  const heroLandscape: HeroLandscape = createHeroLandscape(
    worldScene,
    heroLandscapeConfig,
    chapterFrames.hero,
    {
      onFailure: (part) => {
        console.error(`Hero ${part} failed to load`);
        options.canvas.dataset.heroFailed = part;
      },
      onLoaded: () => {
        if (options.reducedMotion) renderOnce(0);
      },
    },
  );
  heroLandscape.resize(width);

  const monolith: Monolith = createMonolith(worldScene, monolithConfig, {
    onFailure: (asset) => {
      console.error(`Selected Work ${asset} failed to load`);
      options.canvas.dataset.monolithFailed = asset;
      options.onMonolithFailure?.();
    },
    onLoaded: () => {
      if (options.reducedMotion) renderOnce(0);
    },
  });
  monolith.resize(width);

  /*
   * The rendered camera.
   *
   * `view` is placed by the camera journey and nothing else: the scroll offset
   * picks a pose, the gallery's timeline adds the walk round the stone, and
   * that pose is applied here once per frame. The world does not move to
   * imitate travel; the viewer does.
   *
   * The horizon glow and atmosphere are sky, not ground: they ride on
   * `horizonRig`, which carries them from the layout camera to the viewer by
   * the same turn and the same distance across the water, so every view keeps
   * its horizon light and none of it is ever walked into. The water surface is
   * shaded in world space, so its mesh simply stays under the viewer.
   */
  const view = new PerspectiveCamera(initialCamera.fov, width / height, 0.1, initialCamera.far);
  const horizonRig = new Group();
  horizonRig.add(lights.group, atmosphere.group);
  worldScene.add(horizonRig);
  const up = new Vector3(0, 1, 0);
  const rigTurn = new Quaternion();
  const rigOffset = new Vector3();
  const floorHome = floor.mesh.position.clone();
  const worldBeacons = lights.beacons().map((source) => ({ ...source, world: new Vector3() }));
  let viewYaw = 0;

  const pose: CameraPose = { eye: new Vector3(), target: new Vector3(), fov: initialCamera.fov };
  const direction = new Vector3();
  let viewport: SceneViewport = sceneViewportForWidth(width);
  let stops: JourneyStops = { introEnd: 0, workStart: 0, workEnd: 0, about: 0, contact: 0 };
  let stopsKnown = false;
  let targetScroll = 0;
  let shownScroll = 0;
  /** How quickly the camera catches up with the page, per second. */
  const SCROLL_RATE = 14;
  /** World units the resting hero camera drifts by, at most. */
  const IDLE_DRIFT = 0.035;

  /*
   * The hero is pinned long enough for a second composition only on desktop;
   * below that its layout is unchanged, so the journey goes straight on.
   */
  const buildRests = (): JourneyRests => ({
    hero: chapterRest("hero", viewport),
    intro: viewport === "desktop" ? poseInFrame(chapterFrames.hero, introPose) : null,
    work: chapterRest("selected-work", viewport),
    about: chapterRest("about", viewport),
    contact: chapterRest("footer", viewport),
  });
  let rests = buildRests();
  const waypoints = {
    ...journeyWaypoints,
    approach: poseInFrame(chapterFrames.hero, journeyWaypoints.approach),
  };

  // ------------------------------------------------ lighting that travels
  /*
   * Each chapter's rock lighting, placed in the world with its chapter. The
   * journey blends from one to the next, so a rock never changes its light
   * the moment a different section becomes the most visible.
   */
  const chapterLighting = Object.fromEntries(
    SECTION_IDS.map((id) => {
      const lighting = getSceneSection(id).lighting;
      return [
        id,
        {
          ...lighting,
          points: lighting.points.map((point) => ({
            ...point,
            position: toWorld(chapterFrames[id], point.position),
          })),
        },
      ];
    }),
  ) as unknown as Record<SectionId, EnvironmentLightingConfig>;
  const mixA = new Color();
  const mixB = new Color();
  const mixHex = (a: number, b: number, t: number) =>
    mixA.setHex(a).lerp(mixB.setHex(b), t).getHex();
  const blendLighting = (from: SectionId, to: SectionId, t: number): EnvironmentLightingConfig => {
    const a = chapterLighting[from];
    const b = chapterLighting[to];
    if (t <= 0 || from === to) return a;
    if (t >= 1) return b;
    return {
      ...a,
      hemisphereSky: mixHex(a.hemisphereSky, b.hemisphereSky, t),
      hemisphereGround: mixHex(a.hemisphereGround, b.hemisphereGround, t),
      hemisphereIntensity:
        a.hemisphereIntensity + (b.hemisphereIntensity - a.hemisphereIntensity) * t,
      beaconGain: a.beaconGain + (b.beaconGain - a.beaconGain) * t,
      points: a.points.map((point, index) => {
        const other = b.points[index] ?? point;
        const position = point.position.map(
          (value, axis) => value + ((other.position[axis] ?? value) - value) * t,
        ) as unknown as Vector3Tuple;
        return {
          ...point,
          position,
          color: mixHex(point.color, other.color, t),
          intensity: point.intensity + (other.intensity - point.intensity) * t,
          distance: point.distance + (other.distance - point.distance) * t,
        };
      }),
    };
  };

  const yawOf = (from: Vector3, to: Vector3) => {
    direction.copy(to).sub(from);
    return Math.atan2(-direction.x, -direction.z);
  };
  const homeTarget = new Vector3();

  /** Places `view` for this frame. The only code that moves the camera. */
  const applyJourney = (deltaSeconds: number) => {
    if (options.reducedMotion) {
      // Cut between compositions: no flight, no scroll-linked motion.
      shownScroll = stopsKnown ? nearestRest(targetScroll, stops, rests.intro !== null) : 0;
    } else if (deltaSeconds === 0) {
      shownScroll = targetScroll;
    } else {
      shownScroll += (targetScroll - shownScroll) * (1 - Math.exp(-deltaSeconds * SCROLL_RATE));
      if (Math.abs(targetScroll - shownScroll) < 0.25) shownScroll = targetScroll;
    }

    const state = evaluateJourney(
      {
        scroll: stopsKnown ? shownScroll : 0,
        stops,
        rests,
        waypoints,
        orbit: monolith.orbit(),
        pivot: monolith.pivot(),
      },
      pose,
    );

    /*
     * Idle drift at the hero viewpoint: a few centimetres of eye and aim on
     * periods of a minute or so, like a held camera breathing. It is gone by
     * the first 160 px of scroll, so it never touches the journey itself.
     */
    if (!options.reducedMotion && state.from === "hero" && state.to === "hero") {
      const idle = Math.max(0, 1 - shownScroll / 160) * IDLE_DRIFT;
      pose.eye.x += Math.sin(elapsed * 0.11) * idle;
      pose.eye.y += Math.sin(elapsed * 0.083 + 1.3) * idle * 0.6;
      pose.target.x += Math.sin(elapsed * 0.07 + 2.1) * idle;
      pose.target.y += Math.sin(elapsed * 0.095 + 0.4) * idle * 0.5;
    }

    view.fov = pose.fov;
    view.aspect = width / height;
    view.near = initialCamera.near;
    view.far = initialCamera.far;
    view.position.copy(pose.eye);
    view.lookAt(pose.target);
    view.updateProjectionMatrix();
    view.updateMatrixWorld();
    monolith.setViewer(view.position);

    // Sky: the same turn and the same distance across the water as the viewer.
    homeTarget.set(...initialCamera.target);
    viewYaw = yawOf(pose.eye, pose.target) - yawOf(camera.position, homeTarget);
    rigTurn.setFromAxisAngle(up, viewYaw);
    rigOffset.copy(camera.position).applyQuaternion(rigTurn);
    horizonRig.quaternion.copy(rigTurn);
    horizonRig.position.set(pose.eye.x - rigOffset.x, 0, pose.eye.z - rigOffset.z);
    horizonRig.updateMatrixWorld(true);

    // Ground: the water tiles stay under the viewer; their shading is world-space.
    floor.mesh.position.set(
      floorHome.x + pose.eye.x - camera.position.x,
      floorHome.y,
      floorHome.z + pose.eye.z - camera.position.z,
    );
    floorBeyond.position.copy(floor.mesh.position);
    floorBeyond.position.z += 140;

    rocks.setLighting(blendLighting(state.from, state.to, state.blend));

    /*
     * The hero landscape is there for the hero only. The perch and the robot
     * leave the frame as the camera moves on past them, and only once they
     * are behind it do they go, so the later chapters facing back across the
     * water never see them. The range and the moon sink into the haze over
     * the first stretch of the flight, before the Selected Work range would
     * show behind them.
     */
    const leaving = (start: number, span: number) =>
      state.from === "hero"
        ? state.to === "hero"
          ? 1
          : 1 - smootherstep(Math.min(1, Math.max(0, (state.blend - start) / span)))
        : 0;
    heroLandscape.setPresence(leaving(0.1, 0.45), leaving(0.3, 0.3));
  };

  // -------------------------------------------------------- orthographic pass
  options.onQualityChange?.(settings);

  const particles: ParticleField = createParticleField({
    count: particleCountFor(settings, width * height),
    width,
    height,
    pixelRatio: cappedRatio(),
    reducedMotion: options.reducedMotion,
    config: activeScene.particles,
  });

  // ------------------------------------------------------------- frame state
  let frame = 0;
  let running = false;
  let lastTime = 0;
  let elapsed = 0;
  let contextLost = false;

  let pointer: PointerSample | null = null;
  let pointerDirX = 0;
  let pointerDirY = 0;

  const applySettings = (next: QualitySettings) => {
    settings = next;
    renderer.setPixelRatio(cappedRatio());
    renderer.setSize(width, height, false);
    particles.setCount(particleCountFor(next, width * height));
    particles.resize(width, height, cappedRatio());
    floor.setReflectionSize(next.reflectionSize);
    options.onQualityChange?.(next);
  };

  const renderOnce = (deltaSeconds: number) => {
    monolith.update(deltaSeconds, performance.now());
    applyJourney(deltaSeconds);

    atmosphere.update(elapsed);
    lights.update(deltaSeconds, elapsed);
    const beaconIntensity = lights.intensity();
    options.onBeaconIntensity?.(beaconIntensity);

    // The water reflects the beacons where they are in the world, which is
    // wherever the horizon rig has carried them.
    const beacons = lights.beacons();
    beacons.forEach((source, index) => {
      const target = worldBeacons[index];
      if (!target) return;
      target.world.copy(source.world).applyMatrix4(horizonRig.matrixWorld);
      worldBeacons[index] = { ...source, world: target.world };
    });
    floor.setBeacons(worldBeacons.slice(0, beacons.length));
    atmosphere.setIllumination(lights.illumination());
    mist.update(deltaSeconds, elapsed);
    floor.update(deltaSeconds, elapsed);

    const normalisedX = pointer && width > 0 ? (pointer.x / width) * 2 - 1 : 0;
    const normalisedY = pointer && height > 0 ? (pointer.y / height) * 2 - 1 : 0;

    rocks.update(
      options.reducedMotion ? 0 : normalisedX,
      options.reducedMotion ? 0 : normalisedY,
      beaconIntensity,
      deltaSeconds,
      view.position,
    );

    particles.update(deltaSeconds, elapsed, {
      x: pointer?.x ?? 0,
      y: pointer?.y ?? 0,
      dirX: pointerDirX,
      dirY: pointerDirY,
      speed: pointer?.speed ?? 0,
      active: Boolean(pointer?.active && pointer.inside) && !options.reducedMotion,
    });

    // The floor must not sample itself, and the reflection is only for the
    // objects standing on the floor.
    floor.renderReflection(renderer, worldScene, view, [
      floor.mesh,
      floorBeyond,
      lights.group,
      mist.group,
      ...rocks.reflectionExclusions(),
      ...heroLandscape.reflectionExclusions(),
    ]);

    renderer.clear();
    renderer.render(worldScene, view);
    renderer.clearDepth();
    renderer.render(particles.scene, particles.camera);
  };

  const loop = (time: number) => {
    if (!running || contextLost) {
      return;
    }

    const deltaSeconds = lastTime === 0 ? 1 / 60 : Math.min(0.1, (time - lastTime) / 1000);
    lastTime = time;
    elapsed += deltaSeconds;

    const frameStart = performance.now();
    renderOnce(deltaSeconds);
    const changed = quality.sample(performance.now() - frameStart);

    if (changed) {
      applySettings(changed);
    }

    frame = requestAnimationFrame(loop);
  };

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    options.onContextLost?.();
    running = false;
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  const handleContextRestored = () => {
    contextLost = false;
    applySettings(settings);
    options.onContextRestored?.();
    if (running) {
      return;
    }
    start();
  };

  /*
   * Reduced motion renders single frames only. A gallery change still has to
   * be drawn, so it gets frames for exactly as long as its fade lasts.
   */
  let transitionFrame = 0;
  const drawTransition = () => {
    transitionFrame = 0;
    if (contextLost) return;
    renderOnce(0);
    if (monolith.animating(performance.now())) {
      transitionFrame = requestAnimationFrame(drawTransition);
    }
  };
  const unsubscribeMonolith = subscribeMonolith(() => {
    if (options.reducedMotion && transitionFrame === 0) {
      transitionFrame = requestAnimationFrame(drawTransition);
    }
  });

  options.canvas.addEventListener("webglcontextlost", handleContextLost);
  options.canvas.addEventListener("webglcontextrestored", handleContextRestored);

  function start() {
    if (running || contextLost) {
      return;
    }

    running = true;
    lastTime = 0;

    if (options.reducedMotion) {
      // A single static frame. No loop, no pointer response, no drift.
      renderOnce(0);
      running = false;
      return;
    }

    frame = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  return {
    start,
    stop,

    resize: (nextWidth, nextHeight) => {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);

      renderer.setPixelRatio(cappedRatio());
      renderer.setSize(width, height, false);

      camera.aspect = width / height;
      applyCamera();
      viewport = sceneViewportForWidth(width);
      rests = buildRests();
      lights.resize(camera);
      atmosphere.resize(camera);
      mist.resize(width, camera);

      particles.resize(width, height, cappedRatio());
      rocks.resize(width);
      heroLandscape.resize(width);
      monolith.resize(width);
      // Density is per megapixel, so a resize changes the count too.
      particles.setCount(particleCountFor(settings, width * height));

      if (options.reducedMotion) {
        renderOnce(0);
      }
    },

    setObstacles: (obstacles) => {
      particles.setObstacles(obstacles);
    },

    setFocus: (rect) => {
      particles.setFocus(rect);
      lights.setFocus(rect && width > 0 ? (rect.x + rect.width / 2) / width : null);
    },

    setPointer: (sample) => {
      pointer = sample;

      const length = Math.hypot(sample.dx, sample.dy);
      if (length > 0.001) {
        pointerDirX = sample.dx / length;
        pointerDirY = sample.dy / length;
      }

      // Ripples map the lower screen onto the water ahead of a viewer facing
      // down it, as the hero does; turned any other way they would land in
      // the wrong place, so they wait until the viewer faces that way again.
      if (sample.active && sample.inside && !options.reducedMotion && Math.abs(viewYaw) < 0.01) {
        floor.requestRipple(
          Math.min(1, Math.max(0, sample.x / Math.max(1, width))),
          Math.min(1, Math.max(0, sample.y / Math.max(1, height))),
          sample.speed,
        );
      }
    },

    setSection: (sectionId) => {
      if (!sectionId || sectionId === activeSectionId) return;
      activeSectionId = sectionId;
      activeScene = getSceneSection(sectionId);
      worldScene.fog = new Fog(
        activeScene.fog.color,
        activeScene.lighting.fogNear,
        activeScene.lighting.fogFar,
      );
      floor.setConfig(activeScene.water);
      lights.setConfig(activeScene.horizonLights, camera);
      atmosphere.setConfig(activeScene.fog, camera);
      mist.setConfig(activeScene.mist, camera);
      particles.setConfig(activeScene.particles);
      lights.resize(camera);
      atmosphere.resize(camera);
      if (options.reducedMotion) renderOnce(0);
    },

    setScroll: (scrollY) => {
      targetScroll = scrollY;
      // Reduced motion draws single frames, so a new composition needs one.
      if (options.reducedMotion && !contextLost) renderOnce(0);
    },

    setJourneyStops: (next) => {
      stops = next;
      if (!stopsKnown) shownScroll = targetScroll;
      stopsKnown = true;
      if (options.reducedMotion && !contextLost) renderOnce(0);
    },

    stats: () => ({
      tier: settings.tier,
      particleCount: particleCountFor(settings, width * height),
      pixelRatio: renderer.getPixelRatio(),
      averageFrameMs: quality.averageFrameMs(),
      disturbedParticles: particles.disturbedCount(),
      reflectionSize: settings.reflectionSize,
      drawCalls: renderer.info.render.calls,
      activeRipples: floor.activeRipples(),
    }),

    destroy: () => {
      stop();
      unsubscribeMonolith();
      if (transitionFrame !== 0) cancelAnimationFrame(transitionFrame);
      options.canvas.removeEventListener("webglcontextlost", handleContextLost);
      options.canvas.removeEventListener("webglcontextrestored", handleContextRestored);

      particles.destroy();
      rocks.destroy();
      heroLandscape.destroy();
      monolith.destroy();
      lights.destroy();
      atmosphere.destroy();
      mist.destroy();
      floor.destroy();

      horizonRig.clear();
      worldScene.clear();
      particles.scene.clear();

      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export type { ObstacleRect, QualitySettings };
