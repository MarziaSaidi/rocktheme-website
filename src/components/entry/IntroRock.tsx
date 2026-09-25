"use client";

import { useEffect, useRef } from "react";
import type { Object3D } from "three";

import {
  cameraConfig,
  environmentLightingConfig,
  introAtmosphereConfig,
  introLightConfig,
  rockAssets,
} from "@/webgl/sceneConfig";

import styles from "./SiteEntry.module.css";

/**
 * The intro landscape.
 *
 * It mounts the approved water, beacon and mist modules rather than standing up
 * a second implementation, and drives them from the same camera the rest of the
 * site uses, so the intro water is the site's water rather than a lookalike.
 *
 * The rock does not move. Any sense of life comes from the water surface and a
 * very slow forward creep of the camera, which settles rather than loops.
 */
export function IntroRock() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    let cancelled = false;
    let dispose = () => {};

    void (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const { createReflectiveFloor } = await import("@/webgl/modules/reflectiveFloor");
      const { createHorizonLights } = await import("@/webgl/modules/horizonLights");
      const { createHorizonAtmosphere } = await import("@/webgl/modules/horizonAtmosphere");
      const { applyWaterlineContact } = await import("@/webgl/modules/rocks");
      if (cancelled) return;

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const still = reducedMotion.matches;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // The old 1.35 lifted the stone into a lavender haze. Neutral exposure.
      renderer.toneMappingExposure = 1;
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      element.append(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(
        0x100b18,
        environmentLightingConfig.fogNear,
        environmentLightingConfig.fogFar,
      );

      const camera = new THREE.PerspectiveCamera(
        cameraConfig.fov,
        1,
        cameraConfig.near,
        cameraConfig.far,
      );
      const home = new THREE.Vector3(
        cameraConfig.target[0] + cameraConfig.offset[0],
        cameraConfig.target[1] + cameraConfig.offset[1],
        cameraConfig.target[2] + cameraConfig.offset[2],
      );
      const target = new THREE.Vector3(...cameraConfig.target);
      camera.position.copy(home);
      camera.lookAt(target);

      /*
       * Neutral stone lighting. The rock reads charcoal because nothing here is
       * lavender except a single low rim: the previous lavender ambient and key
       * were what tinted the whole surface purple.
       */
      scene.add(new THREE.HemisphereLight(0x3a3a3a, 0x0a0a0c, 1.55));
      const key = new THREE.DirectionalLight(0xd5dad4, 3.4);
      key.position.set(-6, 7, 8);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xa3a3a0, 0.85);
      fill.position.set(7, 3, 6);
      scene.add(fill);
      /*
       * The only coloured light. Kept well behind the rock so it grazes the
       * silhouette rather than washing the upper faces, which is what was
       * leaving a magenta cast on the peak.
       */
      const rim = new THREE.DirectionalLight(0x9b82bd, 0.34);
      rim.position.set(7, 1.2, -24);
      scene.add(rim);

      const floor = createReflectiveFloor({
        width: 160,
        depth: 140,
        reflectionSize: 512,
        maxRipples: 2,
        reducedMotion: still,
      });
      scene.add(floor.mesh);

      const lights = createHorizonLights(scene, camera, still, introLightConfig);
      const atmosphere = createHorizonAtmosphere(scene, camera, still, introAtmosphereConfig);

      const rock = new THREE.Group();
      scene.add(rock);
      let loaded: Object3D | null = null;
      let frame = 0;
      let last = 0;
      let elapsed = 0;

      const resize = () => {
        const width = Math.max(element.clientWidth, 1);
        const height = Math.max(element.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        lights.resize(camera);
        atmosphere.resize(camera);
        draw(0);
      };

      function draw(deltaSeconds: number) {
        lights.update(deltaSeconds, elapsed);
        atmosphere.update(elapsed);
        atmosphere.setIllumination(lights.illumination());
        floor.setBeacons(lights.beacons());
        floor.update(deltaSeconds, elapsed);

        // The water mirrors the rock through the same planar pass the landscape
        // uses. The floor must not sample itself, and the beacons are handled
        // analytically inside the water shader.
        floor.renderReflection(renderer, scene, camera, [floor.mesh, lights.group]);

        renderer.clear();
        renderer.render(scene, camera);
      }

      const animate = (time: number) => {
        if (cancelled) return;
        const deltaSeconds = last === 0 ? 1 / 60 : Math.min(0.1, (time - last) / 1000);
        last = time;
        elapsed += deltaSeconds;

        /*
         * A slow forward settle rather than a loop: the camera eases toward a
         * point a little ahead and stops there. The rock never turns.
         */
        const creep = 1 - Math.exp(-elapsed / 16);
        camera.position.set(home.x, home.y, home.z - creep * 0.55);
        camera.lookAt(target);

        draw(deltaSeconds);
        frame = window.requestAnimationFrame(animate);
      };

      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();

      const loader = new GLTFLoader();
      loader.load(rockAssets["intro-rock"].source, ({ scene: model }) => {
        if (cancelled) return;
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const centre = bounds.getCenter(new THREE.Vector3());
        const tallest = Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(tallest) || tallest <= 0) return;

        /*
         * Normalised so the model's base sits on y = 0, the water plane; the
         * rock is then stood a little into the water (see its position below).
         */
        const unit = 1 / Math.max(size.y, 0.0001);
        model.scale.setScalar(unit * 8.1);
        model.position.set(
          -centre.x * unit * 8.1,
          -bounds.min.y * unit * 8.1,
          -centre.z * unit * 8.1,
        );

        model.traverse((item) => {
          if (!(item instanceof THREE.Mesh)) return;
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.forEach((material) => {
            if (!(material instanceof THREE.MeshStandardMaterial)) return;
            // Geometry, maps and surface variation are preserved; only the
            // response is made stony rather than glossy and tinted.
            material.metalness = 0.02;
            material.roughness = Math.max(0.9, material.roughness);
            // The same waterline darkening the landscape rocks use, so the base
            // turns wet and dissolves into the surface instead of ending on it.
            applyWaterlineContact(material);
            material.needsUpdate = true;
          });
        });

        rock.add(model);
        /*
         * Slightly right of centre, standing in the shallows. The model is
         * widest at its flat base, so on the surface its whole lower edge read
         * as a line drawn on the water; 0.2 under (2.5% of its height), the
         * water cuts across the stone instead.
         */
        rock.position.set(2.2, -0.2, -12.6);
        rock.rotation.y = -0.42;
        loaded = model;
        element.dataset.rockReady = "";
        draw(0);
        if (!still) frame = window.requestAnimationFrame(animate);
      });

      dispose = () => {
        observer.disconnect();
        window.cancelAnimationFrame(frame);
        loaded?.traverse((item) => {
          if (!(item instanceof THREE.Mesh)) return;
          item.geometry.dispose();
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.forEach((material) => material.dispose());
        });
        atmosphere.destroy();
        lights.destroy();
        floor.destroy();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    })();

    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return <div className={styles.rock} ref={host} aria-hidden="true" />;
}
