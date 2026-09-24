"use client";

import { useEffect, useRef } from "react";
import type { Object3D } from "three";

import { rockAssets } from "@/webgl/sceneConfig";

import styles from "./SiteEntry.module.css";

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
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;
      element.append(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
      camera.position.set(0, 0.4, 6.7);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.AmbientLight(0xa99ebc, 2));
      const key = new THREE.DirectionalLight(0xd5b9ed, 4.5);
      key.position.set(-3, 5, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x7a658e, 3);
      rim.position.set(4, 2, -3);
      scene.add(rim);

      const rock = new THREE.Group();
      scene.add(rock);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let frame = 0;
      let loaded: Object3D | null = null;

      const resize = () => {
        const width = Math.max(element.clientWidth, 1);
        const height = Math.max(element.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();

      const animate = () => {
        if (cancelled) return;
        if (!reducedMotion.matches && loaded) {
          rock.rotation.y += 0.0011;
        }
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(animate);
      };

      const loader = new GLTFLoader();
      loader.load(rockAssets["intro-rock"].source, ({ scene: model }) => {
        if (cancelled) return;
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        if (!Number.isFinite(size.x) || Math.max(size.x, size.y, size.z) <= 0) return;
        model.position.sub(center);
        model.scale.setScalar(3.3 / Math.max(size.x, size.y, size.z));
        rock.rotation.y = -0.3;
        rock.add(model);
        loaded = model;
        element.dataset.rockReady = "";
        renderer.render(scene, camera);
        if (!reducedMotion.matches) frame = window.requestAnimationFrame(animate);
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
        renderer.dispose();
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
