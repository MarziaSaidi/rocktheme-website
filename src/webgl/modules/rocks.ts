import {
  Box3,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Vector3,
  type Material,
  type Object3D,
  type Scene,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { sceneViewportForWidth, type SceneViewport } from "@/config/responsive";
import { toWorld } from "../core/chapterFrame";
import { loadRockAsset } from "../loaders/rockAssetLoader";
import {
  chapterFrames,
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
  /** Normalised model height, before the instance's vertical scale. */
  height: number;
  waterline: { value: number };
  opacity: number;
  ready: boolean;
  /** Resting world position; pointer parallax is added to this. */
  base: Vector3;
  /** The chapter frame's turn, for parallax along the viewer's right. */
  yaw: number;
};

export type Rocks = Readonly<{
  update: (
    pointerX: number,
    pointerY: number,
    beaconIntensity: number,
    delta: number,
    viewer: Vector3,
  ) => void;
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
 * The wet band never climbs past this share of a rock's own height. Broader,
 * the darkened stone reads as a black underside above the water rather than
 * as rock running into it.
 */
const WATERLINE_MAX_FRACTION = 0.06;

/**
 * Anchors a rock to the water it stands in.
 *
 * A rock whose material is uniform from base to peak ends at a clean edge
 * against the surface and reads as pasted on. Real stone at a waterline is
 * darker and far glossier than the dry rock above it, so the silhouette
 * dissolves into its own reflection instead of cutting against it.
 */
export function applyWaterlineContact(
  material: MeshStandardMaterial,
  waterline: { value: number } = { value: WATERLINE_HEIGHT },
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterline = waterline;

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
      /*
       * Only the rock above the surface exists, for the viewer and for the
       * water's mirror alike. The rocks stand well into the water, and their
       * widest boulders bulge out below the surface; the mirror camera, which
       * stands below the water, drew those as a pale flat lip reflected just
       * in front of the waterline, and the rock read as sitting on a plate.
       * The water is also drawn transparent, so a fading rock would otherwise
       * show its submerged base through it.
       */
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
         if (vRockHeight < 0.0) discard;`,
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
         gl_FragColor.rgb *= mix(1.0, 0.34, wetness);
         if (!gl_FrontFacing) gl_FragColor.rgb *= 0.34;`,
      );
  };
  /*
   * Cut at the surface, the rock is open underneath. A ripple displaces the
   * reflection lookup a few pixels, sometimes into that opening; its inside,
   * drawn as dark wet stone, keeps the mirror closed instead of showing sky
   * through the base.
   */
  material.side = DoubleSide;
}

/** Chapter crossfade speed, per second. About 0.35 s to settle. */
export const FADE_RATE = 6;

/*
 * A rock stands in the world wherever the viewer is. Past the scene fog's far
 * distance (58) it would still draw, as a fog-coloured silhouette cutting into
 * the horizon glow behind it, so it thins out over the last stretch before
 * the fog would have taken it anyway.
 */
const ROCK_PRESENT = 40;
const ROCK_GONE = 52;

/** 1 at `near` or closer, 0 at `far` or beyond, smooth between. */
export function presenceAt(distance: number, near: number, far: number): number {
  const t = Math.min(1, Math.max(0, (far - distance) / (far - near)));
  return t * t * (3 - 2 * t);
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
  let viewport: SceneViewport = "desktop";
  let destroyed = false;
  let activeLighting = lighting;

  /*
   * Broad, weak, local lights. The visible glow at the horizon and the light
   * that actually shades the rock are separate things: the atmosphere shader
   * draws what the eye reads, these only illuminate geometry.
   */
  const hemisphere = new HemisphereLight(
    lighting.hemisphereSky,
    lighting.hemisphereGround,
    lighting.hemisphereIntensity,
  );
  const points = lighting.points.map((source) => {
    const light = new PointLight(source.color, source.intensity, source.distance, source.decay);
    light.position.set(...source.position);
    return light;
  });
  group.add(hemisphere, ...points);
  scene.add(group);

  const applyTransform = (instanceId: RockInstanceId) => {
    const entry = entries[instanceId];
    const config = rockInstances[instanceId];
    const transform = resolveRockTransform(instanceId, viewport);
    const frame = chapterFrames[config.sectionId];
    entry.base.set(...toWorld(frame, transform.position));
    entry.yaw = frame.yaw;
    entry.root.position.copy(entry.base);
    entry.root.rotation.set(
      transform.rotation[0],
      transform.rotation[1] + frame.yaw,
      transform.rotation[2],
    );
    entry.root.scale.set(...transform.scale);
    entry.waterline.value = Math.min(
      WATERLINE_HEIGHT,
      entry.height * transform.scale[1] * WATERLINE_MAX_FRACTION,
    );
    entry.root.visible =
      entry.ready &&
      entry.opacity > 0.002 &&
      (config.visibility.viewports as readonly string[]).includes(viewport);
  };

  ROCK_INSTANCE_IDS.forEach((instanceId) => {
    const config = rockInstances[instanceId];
    const asset = rockAssets[config.assetId as RockAssetId];
    const root = new Group();
    root.visible = false;
    group.add(root);
    entries[instanceId] = {
      root,
      meshes: [],
      height: 0,
      waterline: { value: WATERLINE_HEIGHT },
      opacity: 0,
      ready: false,
      base: new Vector3(),
      yaw: 0,
    };

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
        entry.height = size.y * normalization;
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
              applyWaterlineContact(material, entry.waterline);
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
    setLighting: (config) => {
      activeLighting = config;
      hemisphere.color.setHex(config.hemisphereSky);
      hemisphere.groundColor.setHex(config.hemisphereGround);
      hemisphere.intensity = config.hemisphereIntensity;
      points.forEach((light, index) => {
        const source = config.points[index];
        if (!source) {
          light.intensity = 0;
          return;
        }
        light.color.setHex(source.color);
        light.distance = source.distance;
        light.decay = source.decay;
        light.position.set(...source.position);
      });
    },
    resize: (width) => {
      viewport = sceneViewportForWidth(width);
      ROCK_INSTANCE_IDS.forEach(applyTransform);
    },
    reflectionExclusions: () =>
      ROCK_INSTANCE_IDS.filter((instanceId) => !rockInstances[instanceId].reflection).map(
        (instanceId) => entries[instanceId].root,
      ),
    update: (pointerX, pointerY, beaconIntensity, delta, viewer) => {
      points.forEach((light, index) => {
        const source = activeLighting.points[index];
        if (!source) return;
        light.intensity = source.intensity * (1 + beaconIntensity * activeLighting.beaconGain);
      });
      ROCK_INSTANCE_IDS.forEach((instanceId) => {
        const entry = entries[instanceId];
        if (!entry.ready) return;
        const config = rockInstances[instanceId];
        const target = presenceAt(entry.base.distanceTo(viewer), ROCK_PRESENT, ROCK_GONE);
        entry.opacity +=
          (target - entry.opacity) * (delta === 0 ? 1 : Math.min(1, delta * FADE_RATE));
        if (Math.abs(target - entry.opacity) < 0.002) entry.opacity = target;

        // Parallax runs along the chapter's own sideways axis.
        const sideways = pointerX * rockParallax;
        entry.root.position.set(
          entry.base.x + sideways * Math.cos(entry.yaw),
          entry.base.y + pointerY * rockParallax * 0.2,
          entry.base.z - sideways * Math.sin(entry.yaw),
        );
        entry.root.visible =
          entry.opacity > 0.002 &&
          (config.visibility.viewports as readonly string[]).includes(viewport);
        entry.meshes.forEach((mesh) => {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => {
            if (!(material instanceof MeshStandardMaterial)) return;
            material.opacity = entry.opacity;
            /*
             * A fading rock must not write depth: it would hide the water,
             * horizon and particles behind it while barely drawing itself,
             * which reads as a black silhouette in its place.
             */
            material.depthWrite = entry.opacity >= 0.999;
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
