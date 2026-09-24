import { FogExp2, PerspectiveCamera, Scene, WebGLRenderer } from "three";

import { sceneViewportForWidth } from "@/config/responsive";
import type { SectionId } from "@/config/sections";
import type { PointerSample } from "@/motion/pointerSource";

import { createHorizonLights, type HorizonLights } from "../modules/horizonLights";
import { createHorizonAtmosphere, type HorizonAtmosphere } from "../modules/horizonAtmosphere";
import {
  createParticleField,
  type ObstacleRect,
  type ParticleField,
} from "../modules/particleField";
import { createReflectiveFloor, type ReflectiveFloor } from "../modules/reflectiveFloor";
import { createRocks, type Rocks } from "../modules/rocks";
import { getSceneSection, resolveCamera } from "../sceneConfig";
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
  worldScene.fog = new FogExp2(activeScene.fog.color, activeScene.fog.density);
  const initialCamera = resolveCamera(activeSectionId, sceneViewportForWidth(width));
  const camera = new PerspectiveCamera(
    initialCamera.fov,
    width / height,
    initialCamera.near,
    initialCamera.far,
  );
  const applyCamera = () => {
    const config = resolveCamera(activeSectionId, sceneViewportForWidth(width));
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
    activeScene.horizonLights,
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
    atmosphere.update(elapsed);
    lights.update(deltaSeconds, elapsed);
    const beaconIntensity = lights.intensity();
    options.onBeaconIntensity?.(beaconIntensity);

    floor.setBeacons(lights.beacons());
    floor.update(deltaSeconds, elapsed);

    const normalisedX = pointer && width > 0 ? (pointer.x / width) * 2 - 1 : 0;
    const normalisedY = pointer && height > 0 ? (pointer.y / height) * 2 - 1 : 0;

    rocks.update(
      options.reducedMotion ? 0 : normalisedX,
      options.reducedMotion ? 0 : normalisedY,
      beaconIntensity,
      deltaSeconds,
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
    floor.renderReflection(renderer, worldScene, camera, [
      floor.mesh,
      lights.group,
      ...rocks.reflectionExclusions(),
    ]);

    renderer.clear();
    renderer.render(worldScene, camera);
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
      lights.resize(camera);
      atmosphere.resize(camera);

      particles.resize(width, height, cappedRatio());
      rocks.resize(width);
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

      if (sample.active && sample.inside && !options.reducedMotion) {
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
      worldScene.fog = new FogExp2(activeScene.fog.color, activeScene.fog.density);
      applyCamera();
      floor.setConfig(activeScene.water);
      lights.setConfig(activeScene.horizonLights, camera);
      atmosphere.setConfig(activeScene.fog, activeScene.horizonLights, camera);
      particles.setConfig(activeScene.particles);
      rocks.setLighting(activeScene.lighting);
      rocks.setSection(sectionId);
      lights.resize(camera);
      atmosphere.resize(camera);
      if (options.reducedMotion) renderOnce(0);
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
      options.canvas.removeEventListener("webglcontextlost", handleContextLost);
      options.canvas.removeEventListener("webglcontextrestored", handleContextRestored);

      particles.destroy();
      rocks.destroy();
      lights.destroy();
      atmosphere.destroy();
      floor.destroy();

      worldScene.clear();
      particles.scene.clear();

      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export type { ObstacleRect, QualitySettings };
