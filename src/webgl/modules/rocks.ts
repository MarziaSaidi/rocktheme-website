import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Object3D,
  type Scene,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { rockConfig, sceneColors, type RockChapter } from "../sceneConfig";

type RockInstance = { root: Group; meshes: Mesh[]; opacity: number; ready: boolean };

export type Rocks = Readonly<{
  update: (pointerX: number, pointerY: number, beaconIntensity: number, delta: number) => void;
  setChapter: (chapter: RockChapter | null) => void;
  resize: (width: number) => void;
  destroy: () => void;
}>;

function disposeRock(root: Object3D) {
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    item.geometry.dispose();
    const materials = Array.isArray(item.material) ? item.material : [item.material];
    materials.forEach((material: Material) => {
      if (material instanceof MeshStandardMaterial) {
        material.map?.dispose();
        material.normalMap?.dispose();
        material.metalnessMap?.dispose();
        material.roughnessMap?.dispose();
      }
      material.dispose();
    });
  });
}

/** Three independent Tripo models. A failed file never becomes a fake rock. */
export function createRocks(
  scene: Scene,
  onFailure?: (chapter: RockChapter) => void,
  onLoaded?: () => void,
): Rocks {
  const group = new Group();
  const loader = new GLTFLoader();
  const entries = {} as Record<RockChapter, RockInstance>;
  let chapter: RockChapter | null = "hero";
  let narrow = false;
  let destroyed = false;

  const ambient = new AmbientLight(0xd7cde2, 1.2);
  const edge = new DirectionalLight(sceneColors.lavender, 2.5);
  edge.position.set(-8, 7, -14);
  const fill = new DirectionalLight(0xc7c1d0, 0.9);
  fill.position.set(5, 9, 6);
  group.add(ambient, edge, fill);
  scene.add(group);

  (Object.keys(rockConfig.chapters) as RockChapter[]).forEach((key) => {
    const config = rockConfig.chapters[key];
    const root = new Group();
    root.visible = false;
    group.add(root);
    entries[key] = { root, meshes: [], opacity: 0, ready: false };

    loader.load(
      config.url,
      (gltf) => {
        if (destroyed) {
          disposeRock(gltf.scene);
          return;
        }
        const bounds = new Box3().setFromObject(gltf.scene);
        const size = bounds.getSize(new Vector3());
        const center = bounds.getCenter(new Vector3());
        if (!Number.isFinite(size.x) || Math.max(size.x, size.y, size.z) <= 0) {
          disposeRock(gltf.scene);
          onFailure?.(key);
          return;
        }

        const scale = config.width / Math.max(size.x, size.z);
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        root.position.set(...(narrow ? config.mobile.position : config.position));
        root.rotation.y = config.rotation;
        root.scale.setScalar(narrow ? config.mobile.width / config.width : 1);
        root.scale.y *= narrow ? config.mobile.heightRatio : config.heightRatio;
        root.add(gltf.scene);

        const entry = entries[key];
        gltf.scene.traverse((item) => {
          if (!(item instanceof Mesh)) return;
          item.castShadow = false;
          item.receiveShadow = false;
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.forEach((material) => {
            if (material instanceof MeshStandardMaterial) {
              material.metalness = 0.05;
              material.roughness = Math.max(0.88, material.roughness);
              material.transparent = true;
              material.opacity = 0;
              material.depthWrite = true;
              material.needsUpdate = true;
            }
          });
          entry.meshes.push(item);
        });
        entry.ready = true;
        onLoaded?.();
      },
      undefined,
      () => onFailure?.(key),
    );
  });

  return {
    setChapter: (next) => {
      chapter = next;
    },
    resize: (width) => {
      narrow = width < 768;
    },
    update: (pointerX, pointerY, beaconIntensity, delta) => {
      edge.intensity = 2.1 + beaconIntensity * 0.35;
      for (const key of Object.keys(entries) as RockChapter[]) {
        const entry = entries[key];
        if (!entry.ready) continue;
        const target = key === chapter ? 1 : 0;
        entry.opacity += (target - entry.opacity) * (delta === 0 ? 1 : Math.min(1, delta * 2.4));
        if (Math.abs(target - entry.opacity) < 0.002) entry.opacity = target;
        entry.root.visible = entry.opacity > 0.002;
        const placement = rockConfig.chapters[key];
        const active = narrow ? placement.mobile : placement;
        entry.root.position.x = active.position[0] + pointerX * rockConfig.parallax;
        entry.root.position.y = active.position[1] + pointerY * rockConfig.parallax * 0.2;
        entry.root.position.z = active.position[2];
        entry.root.scale.setScalar(narrow ? placement.mobile.width / placement.width : 1);
        entry.root.scale.y *= active.heightRatio;
        entry.meshes.forEach((mesh) => {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => {
            if (material instanceof MeshStandardMaterial) material.opacity = entry.opacity;
          });
        });
      }
    },
    destroy: () => {
      destroyed = true;
      for (const entry of Object.values(entries)) disposeRock(entry.root);
      scene.remove(group);
      group.clear();
    },
  };
}
