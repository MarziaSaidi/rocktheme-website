/**
 * The range beyond the range.
 *
 * The hero's mountains are compressed front-to-back: they hold up seen from
 * the water but not from the air. Behind and around them stand a baked
 * heightfield (low rock skirts and fjord water, scripts/aerial-terrain.mjs) and
 * the same mountain model at its own, uncompressed proportions, sunk so no
 * edge or base shows. None of it is drawn while the camera is below the haze
 * ceiling, so every view from the water is exactly as composed.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  type Scene,
} from "three";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import type { DistanceFogConfig } from "../sceneTypes";
import { applyDistanceFog, createDistanceFogUniforms } from "./distanceFog";
import { matchStone } from "./stoneMaterial";
import { Box3, Group, RepeatWrapping, type Object3D, type Texture } from "three";

export type AerialTerrain = Readonly<{
  /** Altitude of the viewer: below the haze ceiling the terrain is not drawn at all. */
  setViewer: (eye: Vector3) => void;
  mesh: () => Mesh | null;
  reflectionExclusions: () => readonly Object3D[];
  destroy: () => void;
}>;

/** Camera height at which the valley haze starts to thin, and where it is gone. */
const HAZE_FLOOR = 13;
const HAZE_TOP = 22;
/** The scene's own linear fog far distance: nothing past it is visible from below the ceiling. */
const LOW_FAR = 58;

export function createAerialTerrain(
  scene: Scene,
  fogColor: number,
  atmosphere: DistanceFogConfig,
  stride = 1,
): AerialTerrain {
  let mesh: Mesh | null = null;
  let destroyed = false;
  const hazeFar = { value: LOW_FAR };
  const hazeColor = { value: new Vector3() };
  const moonGlow = { value: 0 };
  const rgb = { r: 0, g: 0, b: 0 };
  new Color(fogColor).getRGB(rgb, SRGBColorSpace);
  hazeColor.value.set(rgb.r, rgb.g, rgb.b);

  const material = new MeshStandardMaterial({
    roughness: 1,
    metalness: 0,
  });
  applyDistanceFog(material, createDistanceFogUniforms(atmosphere));
  const fogPatch = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    fogPatch.call(material, shader, renderer);
    shader.uniforms.uHazeFar = hazeFar;
    shader.uniforms.uHazeColor = hazeColor;
    shader.uniforms.uMoonGlow = moonGlow;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTerrNormal;")
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nvTerrNormal = normal;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vTerrNormal;
         uniform float uHazeFar;
         uniform vec3 uHazeColor;
         uniform float uMoonGlow;
         #define TRI_SCALE 0.021
         float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
         float tNoise(vec2 p) {
           vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
           return mix(mix(tHash(i), tHash(i + vec2(1, 0)), f.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), f.x), f.y);
         }`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
         float tDist = distance(vAtmosWorld, cameraPosition);
         if (tDist > uHazeFar) discard;`,
      )
      .replace(
        "#include <map_fragment>",
        `
         vec3 tN = normalize(vTerrNormal);
         vec3 tW = pow(abs(tN), vec3(4.0)); tW /= (tW.x + tW.y + tW.z);
         vec2 tUvX = vAtmosWorld.zy * TRI_SCALE, tUvY = vAtmosWorld.xz * TRI_SCALE, tUvZ = vAtmosWorld.xy * TRI_SCALE;
         #ifdef USE_MAP
           vec4 tC = texture2D(map, tUvX) * tW.x + texture2D(map, tUvY) * tW.y + texture2D(map, tUvZ) * tW.z;
           // a second, larger scale breaks up the repetition
           vec4 tC2 = texture2D(map, tUvX * 0.23 + 0.31) * tW.x + texture2D(map, tUvY * 0.23 + 0.31) * tW.y + texture2D(map, tUvZ * 0.23 + 0.31) * tW.z;
           tC.rgb = mix(tC.rgb, tC2.rgb, 0.4);
           diffuseColor *= tC;
           diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.2);
         #endif`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `
         #ifdef USE_NORMALMAP
         {
           vec3 nX = texture2D(normalMap, tUvX).xyz * 2.0 - 1.0;
           vec3 nY = texture2D(normalMap, tUvY).xyz * 2.0 - 1.0;
           vec3 nZ = texture2D(normalMap, tUvZ).xyz * 2.0 - 1.0;
           nX.xy *= 0.8; nY.xy *= 0.8; nZ.xy *= 0.8;
           vec3 wX = vec3(nX.xy + tN.zy, abs(nX.z) * tN.x).zyx;
           vec3 wY = vec3(nY.xy + tN.xz, abs(nY.z) * tN.y).xzy;
           vec3 wZ = vec3(nZ.xy + tN.xy, abs(nZ.z) * tN.z);
           vec3 tWorld = normalize(wX * tW.x + wY * tW.y + wZ * tW.z);
           normal = normalize((viewMatrix * vec4(tWorld, 0.0)).xyz);
         }
         #endif`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
         // The valley haze: near the haze ceiling's far edge the rock sinks into the night air.
         gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, smoothstep(uHazeFar * 0.45, uHazeFar, tDist));
         // Air between the ridges glows toward the moon, so the layers separate against each other.
         vec3 tView = normalize(vAtmosWorld - cameraPosition);
         vec3 tMoon = normalize(vec3(0.31, 0.21, -0.93));
         float tGlow = pow(max(dot(tView, tMoon), 0.0), 24.0) * 0.12;
         gl_FragColor.rgb += vec3(0.42, 0.34, 0.58) * tGlow * smoothstep(60.0, 420.0, tDist) * uMoonGlow;`,
      );
  };
  material.customProgramCacheKey = () => "aerial-terrain";
  // The hero range's own rock: its colour and normal maps, sampled in world space.
  /*
   * The hero range's own rock: its colour and normal maps. The terrain samples
   * them in world space; the massifs (mesh-only files) wear them on their UVs.
   */
  const heroMaps = new GLTFLoader()
    .loadAsync("/assets/hero/mountains.glb")
    .then(({ scene: model }) => {
      let found: { map: Texture | null; normalMap: Texture | null } = {
        map: null,
        normalMap: null,
      };
      model.traverse((item) => {
        const source = (item as Mesh).material as MeshStandardMaterial | undefined;
        if (source?.map && !found.map) found = { map: source.map, normalMap: source.normalMap };
      });
      for (const texture of [found.map, found.normalMap]) {
        if (!texture) continue;
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.needsUpdate = true;
      }
      return found;
    });
  heroMaps
    .then(({ map, normalMap }) => {
      if (destroyed || !map) return;
      material.map = map;
      material.normalMap = normalMap;
      matchStone(material, 1);
      material.needsUpdate = true;
    })
    .catch((error) => console.error("aerial terrain maps", error));

  // The sculpted massifs: the hero range's own model at its native (uncompressed) proportions,
  // sunk into the base terrain so no tile edge or bottom shows. Same rock, same detail.
  const massifRoot = new Group();
  massifRoot.name = "aerial-massif";
  scene.add(massifRoot);
  const fogUniforms = createDistanceFogUniforms(atmosphere);
  Promise.all([
    fetch("/assets/aerial/massif.json").then(
      (r) =>
        r.json() as Promise<{ x: number; z: number; width: number; yaw: number; sink: number }[]>,
    ),
    new GLTFLoader().loadAsync("/assets/aerial/massif.glb"),
    new GLTFLoader().loadAsync("/assets/aerial/massif-lo.glb"),
    heroMaps,
  ])
    .then(([layout, gltfHi, gltfLo, maps]) => {
      if (destroyed) return;
      // Level of detail: the far rows (and every row on narrow layouts) use the lighter model.
      const narrow = stride > 1;
      const prepared = [gltfHi.scene, gltfLo.scene];
      const model = gltfHi.scene;
      const bounds = new Box3().setFromObject(model);
      const size = bounds.getSize(new Vector3());
      const center = bounds.getCenter(new Vector3());
      prepared.forEach((root) =>
        root.traverse((item) => {
          if (!(item instanceof Mesh)) return;
          const source = item.material as MeshStandardMaterial;
          source.map = maps.map;
          source.normalMap = maps.normalMap;
          source.metalness = 0;
          source.metalnessMap = null;
          source.roughness = 1;
          source.roughnessMap = null;
          source.normalScale.setScalar(0.6);
          applyDistanceFog(source, fogUniforms);
          const fog = source.onBeforeCompile;
          source.onBeforeCompile = (shader, renderer) => {
            fog.call(source, shader, renderer);
            shader.uniforms.uHazeFar = hazeFar;
            shader.uniforms.uHazeColor = hazeColor;
            shader.fragmentShader = shader.fragmentShader
              .replace(
                "#include <common>",
                "#include <common>\nuniform float uHazeFar;\nuniform vec3 uHazeColor;",
              )
              .replace(
                "#include <clipping_planes_fragment>",
                "#include <clipping_planes_fragment>\nfloat tDist = distance(vAtmosWorld, cameraPosition);\nif (tDist > uHazeFar) discard;",
              )
              .replace(
                "#include <dithering_fragment>",
                "#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, smoothstep(uHazeFar * 0.45, uHazeFar, tDist));",
              );
          };
          matchStone(source, 1);
          source.customProgramCacheKey = () => "aerial-massif";
        }),
      );
      for (const m of layout) {
        if (narrow && m.z < -700) continue;
        const instance = (narrow || m.z < -500 ? gltfLo.scene : model).clone();
        const W = m.width;
        const H = W * (size.y / size.x);
        const D = W * (size.z / size.x);
        instance.scale.set(W / size.x, H / size.y, D / size.z);
        instance.position.set(
          -center.x * instance.scale.x,
          -bounds.min.y * instance.scale.y,
          -center.z * instance.scale.z,
        );
        const holder = new Group();
        holder.add(instance);
        holder.position.set(m.x, -H * m.sink, m.z);
        holder.rotation.y = m.yaw;
        massifRoot.add(holder);
      }
    })
    .catch((error) => console.error("aerial massif", error));

  fetch("/assets/aerial/terrain.bin")
    .then((response) => response.arrayBuffer())
    .then((buffer) => {
      if (destroyed) return;
      const head = new DataView(buffer, 0, 20);
      const nx = head.getInt32(0, true);
      const nz = head.getInt32(4, true);
      const x0 = head.getFloat32(8, true);
      const z0 = head.getFloat32(12, true);
      const cell = head.getFloat32(16, true);
      const heights = new Float32Array(buffer, 20, nx * nz);
      const cx = Math.floor((nx - 1) / stride) + 1;
      const cz = Math.floor((nz - 1) / stride) + 1;
      const positions = new Float32Array(cx * cz * 3);
      for (let k = 0; k < cz; k++)
        for (let i = 0; i < cx; i++) {
          const o = (k * cx + i) * 3;
          positions[o] = x0 + i * stride * cell;
          positions[o + 1] = heights[k * stride * nx + i * stride]!;
          positions[o + 2] = z0 + k * stride * cell;
        }
      const index = new Uint32Array((cx - 1) * (cz - 1) * 6);
      let n = 0;
      for (let k = 0; k < cz - 1; k++)
        for (let i = 0; i < cx - 1; i++) {
          const a = k * cx + i;
          index[n++] = a;
          index[n++] = a + cx;
          index[n++] = a + 1;
          index[n++] = a + 1;
          index[n++] = a + cx;
          index[n++] = a + cx + 1;
        }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setIndex(new BufferAttribute(index, 1));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      mesh = new Mesh(geometry, material);
      mesh.name = "aerial-terrain";
      mesh.frustumCulled = false;
      scene.add(mesh);
    })
    .catch((error) => console.error("aerial terrain", error));

  return {
    setViewer: (eye) => {
      const t = Math.min(1, Math.max(0, (Math.abs(eye.y) - HAZE_FLOOR) / (HAZE_TOP - HAZE_FLOOR)));
      const eased = t * t * (3 - 2 * t);
      hazeFar.value = LOW_FAR + eased * eased * 2400;
      moonGlow.value = eased;
      // At or below the haze floor every fragment would be discarded: skip the geometry outright.
      const shown = Math.abs(eye.y) > HAZE_FLOOR;
      massifRoot.visible = shown;
      if (mesh) mesh.visible = shown;
    },
    mesh: () => mesh,
    reflectionExclusions: () => (mesh ? [mesh, massifRoot] : [massifRoot]),
    destroy: () => {
      destroyed = true;
      scene.remove(massifRoot);
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
      }
      material.dispose();
    },
  };
}
