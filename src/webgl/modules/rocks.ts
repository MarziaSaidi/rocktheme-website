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

import { sceneViewportForWidth, type SceneViewport } from "@/config/responsive";
import type { SectionId } from "@/config/sections";

import { loadRockAsset } from "../loaders/rockAssetLoader";
import {
  ROCK_INSTANCE_IDS,
  rockAssets,
  rockInstances,
  rockParallax,
  resolveRockTransform,
  type RockAssetId,
  type RockInstanceId,
} from "../sceneConfig";
import type { EnvironmentLightingConfig } from "../sceneTypes";

type RockInstance = {
  root: Group;
  meshes: Mesh[];
  opacity: number;
  ready: boolean;
};

export type Rocks = Readonly<{
  update: (pointerX: number, pointerY: number, beaconIntensity: number, delta: number) => void;
  setSection: (sectionId: SectionId | null) => void;
  setLighting: (config: EnvironmentLightingConfig) => void;
  resize: (width: number) => void;
  reflectionExclusions: () => readonly Object3D[];
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

/** World height over which a rock reads as wet from standing in the water. */
const WATERLINE_HEIGHT = 1.4;

/**
 * Anchors a rock to the water it stands in.
 *
 * A rock whose material is uniform from base to peak ends at a clean edge
 * against the surface and reads as pasted on. Real stone at a waterline is
 * darker and far glossier than the dry rock above it, so the silhouette
 * dissolves into its own reflection instead of cutting against it.
 */
function applyWaterlineContact(material: MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterline = { value: WATERLINE_HEIGHT };

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vRockHeight;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvRockHeight = (modelMatrix * vec4(transformed, 1.0)).y;",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vRockHeight;\nuniform float uWaterline;",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
         float wetness = 1.0 - smoothstep(0.0, uWaterline, vRockHeight);
         roughnessFactor = mix(roughnessFactor, 0.16, wetness * 0.85);`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
         gl_FragColor.rgb *= mix(1.0, 0.34, wetness);`,
      );
  };
}

/** Renders typed rock instances; asset paths and transforms live in configuration. */
export function createRocks(
  scene: Scene,
  lighting: EnvironmentLightingConfig,
  onFailure?: (instanceId: RockInstanceId) => void,
  onLoaded?: () => void,
): Rocks {
  const group = new Group();
  const loader = new GLTFLoader();
  const entries = {} as Record<RockInstanceId, RockInstance>;
  let sectionId: SectionId | null = "hero";
  let viewport: SceneViewport = "desktop";
  let destroyed = false;
  let activeLighting = lighting;

  const ambient = new AmbientLight(lighting.ambientColor, lighting.ambientIntensity);
  const edge = new DirectionalLight(lighting.edgeColor, lighting.edgeIntensity);
  edge.position.set(...lighting.edgePosition);
  const fill = new DirectionalLight(lighting.fillColor, lighting.fillIntensity);
  fill.position.set(...lighting.fillPosition);
  group.add(ambient, edge, fill);
  scene.add(group);

  const applyTransform = (instanceId: RockInstanceId) => {
    const entry = entries[instanceId];
    const config = rockInstances[instanceId];
    const transform = resolveRockTransform(instanceId, viewport);
    entry.root.position.set(...transform.position);
    entry.root.rotation.set(...transform.rotation);
    entry.root.scale.set(...transform.scale);
    entry.root.visible =
      entry.ready && entry.opacity > 0.002 && config.visibility.viewports.includes(viewport);
  };

  ROCK_INSTANCE_IDS.forEach((instanceId) => {
    const config = rockInstances[instanceId];
    const asset = rockAssets[config.assetId as RockAssetId];
    const root = new Group();
    root.visible = false;
    group.add(root);
    entries[instanceId] = { root, meshes: [], opacity: 0, ready: false };

    loadRockAsset(
      loader,
      asset.id as RockAssetId,
      (model) => {
        if (destroyed) {
          disposeRock(model);
          return;
        }

        const bounds = new Box3().setFromObject(model);
        const size = bounds.getSize(new Vector3());
        const center = bounds.getCenter(new Vector3());
        const sourceWidth = Math.max(size.x, size.z);
        if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) {
          disposeRock(model);
          onFailure?.(instanceId);
          return;
        }

        const normalization = 1 / sourceWidth;
        model.scale.setScalar(normalization);
        model.position.set(
          -center.x * normalization,
          -bounds.min.y * normalization,
          -center.z * normalization,
        );
        root.add(model);

        const entry = entries[instanceId];
        model.traverse((item) => {
          if (!(item instanceof Mesh)) return;
          item.castShadow = false;
          item.receiveShadow = false;
          item.renderOrder = config.renderOrder;
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.forEach((material) => {
            if (material instanceof MeshStandardMaterial) {
              material.metalness = 0.05;
              material.roughness = Math.max(0.88, material.roughness);
              material.transparent = true;
              material.opacity = 0;
              material.depthWrite = true;
              applyWaterlineContact(material);
              material.needsUpdate = true;
            }
          });
          entry.meshes.push(item);
        });
        entry.ready = true;
        applyTransform(instanceId);
        onLoaded?.();
      },
      () => onFailure?.(instanceId),
    );
  });

  return {
    setSection: (next) => {
      sectionId = next;
    },
    setLighting: (config) => {
      activeLighting = config;
      ambient.color.setHex(config.ambientColor);
      ambient.intensity = config.ambientIntensity;
      edge.color.setHex(config.edgeColor);
      edge.position.set(...config.edgePosition);
      fill.color.setHex(config.fillColor);
      fill.intensity = config.fillIntensity;
      fill.position.set(...config.fillPosition);
    },
    resize: (width) => {
      viewport = sceneViewportForWidth(width);
      ROCK_INSTANCE_IDS.forEach(applyTransform);
    },
    reflectionExclusions: () =>
      ROCK_INSTANCE_IDS.filter((instanceId) => !rockInstances[instanceId].reflection).map(
        (instanceId) => entries[instanceId].root,
      ),
    update: (pointerX, pointerY, beaconIntensity, delta) => {
      edge.intensity = activeLighting.edgeIntensity + beaconIntensity * activeLighting.beaconGain;
      ROCK_INSTANCE_IDS.forEach((instanceId) => {
        const entry = entries[instanceId];
        if (!entry.ready) return;
        const config = rockInstances[instanceId];
        const target = config.sectionId === sectionId ? 1 : 0;
        entry.opacity += (target - entry.opacity) * (delta === 0 ? 1 : Math.min(1, delta * 2.4));
        if (Math.abs(target - entry.opacity) < 0.002) entry.opacity = target;

        const transform = resolveRockTransform(instanceId, viewport);
        entry.root.position.x = transform.position[0] + pointerX * rockParallax;
        entry.root.position.y = transform.position[1] + pointerY * rockParallax * 0.2;
        entry.root.position.z = transform.position[2];
        entry.root.visible =
          entry.opacity > 0.002 && config.visibility.viewports.includes(viewport);
        entry.meshes.forEach((mesh) => {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => {
            if (material instanceof MeshStandardMaterial) material.opacity = entry.opacity;
          });
        });
      });
    },
    destroy: () => {
      destroyed = true;
      Object.values(entries).forEach((entry) => disposeRock(entry.root));
      scene.remove(group);
      group.clear();
    },
  };
}
