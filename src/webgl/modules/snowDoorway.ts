import {
  Box3,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Raycaster,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Camera,
  type Object3D,
  type Scene,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

import { toWorld } from "../core/chapterFrame";
import type { DoorwayAnchor, DoorwayRect } from "../doorwayChannel";
import { chapterFrames, introDoorwayConfig } from "../sceneConfig";
import { applyWaterlineContact } from "./rocks";

/**
 * A second doorway, standing in the water beside the bio.
 *
 * The site opens through a stone arch; this is its twin, with its own moss
 * and ivy, lit by the same moon and mirrored in the same water. At rest its
 * opening is dark. When the visitor hovers or holds it, daylight fades in
 * through it: a winter sky over a snowy hill, the cabin's world. It is only
 * there while the camera is at the bio, so neither the hero nor the contact
 * chapter ever sees it.
 */
export type SnowDoorway = Readonly<{
  /** 0 to 1: how present the doorway is, set by the journey. */
  setPresence: (presence: number) => void;
  update: (delta: number, elapsed: number, input: { hover: boolean; hold: number }) => void;
  /** Where the opening is on screen, in CSS pixels, or null if it can't be used. */
  screenRect: (camera: Camera, width: number, height: number) => DoorwayRect | null;
  /** The opening on screen whenever the doorway shows at all, with its presence. */
  screenAnchor: (camera: Camera, width: number, height: number) => DoorwayAnchor | null;
  destroy: () => void;
}>;

/** Composed in the bio's frame: right of the text, out on the water. */
const PLACEMENT = {
  position: [5.4, 0, -12.5] as const,
  /** Turned towards the bio camera's eye at (0, 1.55, 8.5). */
  yaw: Math.atan2(0 - 5.4, 8.5 + 12.5),
  height: 6.2,
  sink: 0.36,
};

const PORTAL_SKY = "/assets/cabin/sky/portal.webp";

const PORTAL_VERTEX = /* glsl */ `
varying vec3 vToFragment;
varying vec2 vUv;
void main() {
  vUv = uv;
  // The view ray in the doorway's own space, for the window's parallax.
  vec3 cameraLocal = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vToFragment = position - cameraLocal;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

const PORTAL_FRAGMENT = /* glsl */ `
uniform sampler2D uSky;
uniform float uPresence;
uniform float uReveal;
uniform float uGlow;
varying vec3 vToFragment;
varying vec2 vUv;

void main() {
  // The other world: a snowy forest hill under a blue sky, framed so the
  // horizon sits a third of the way up. Looking in at an angle shifts the
  // view the other way, as a window onto somewhere far away does.
  vec3 ray = normalize(vToFragment);
  vec2 slope = ray.xy / max(0.2, -ray.z);
  vec2 skyUv = vec2(0.27 + (vUv.x - 0.5) * 0.17 + slope.x * 0.08, mix(0.33, 0.8, vUv.y) + slope.y * 0.06);
  vec3 day = texture2D(uSky, skyUv).rgb * 0.88 * (1.0 + uGlow * 0.5);

  // Daylight blooms towards the stone, the way bright air does in a doorway.
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  day += vec3(0.85, 0.92, 1.0) * (1.0 - smoothstep(0.0, 0.16, edge)) * (0.2 + uGlow * 0.6);
  day += vec3(1.0) * uGlow * 0.22;

  // At rest the opening is the night's own dark; the day fades in over it,
  // from the middle of the doorway outwards.
  vec3 night = vec3(0.0);
  float spread = smoothstep(0.0, 1.0, uReveal * 1.6 - length(vUv - vec2(0.5, 0.45)) * 0.9);
  vec3 colour = mix(night, day, clamp(spread, 0.0, 1.0));

  gl_FragColor = vec4(colour, uPresence);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createSnowDoorway(scene: Scene): SnowDoorway {
  const frame = chapterFrames.about;
  const group = new Group();
  group.name = "snow-doorway";
  const [x, , z] = toWorld(frame, [PLACEMENT.position[0], 0, PLACEMENT.position[2]]);
  group.position.set(x, -PLACEMENT.sink, z);
  group.rotation.y = frame.yaw + PLACEMENT.yaw;
  group.visible = false;
  scene.add(group);

  let presence = 0;
  let destroyed = false;
  const stoneMaterials: MeshStandardMaterial[] = [];

  // ---------------------------------------------------------------- the window
  const portalUniforms = {
    uSky: { value: null as Texture | null },
    uPresence: { value: 0 },
    uReveal: { value: 0 },
    uGlow: { value: 0 },
  };
  const portalMaterial = new ShaderMaterial({
    uniforms: portalUniforms,
    vertexShader: PORTAL_VERTEX,
    fragmentShader: PORTAL_FRAGMENT,
    transparent: true,
    side: DoubleSide,
  });
  let portal: Mesh | null = null;
  // The opening, in the group's space; set once the arch is measured.
  const opening = { centre: new Vector3(), width: 1, height: 1, floor: 0 };

  new TextureLoader().load(PORTAL_SKY, (texture) => {
    if (destroyed) {
      texture.dispose();
      return;
    }
    texture.colorSpace = SRGBColorSpace;
    portalUniforms.uSky.value = texture;
  });

  // Cool daylight spilling out of the opening onto the stone and the water,
  // only while the day is showing through it.
  const daylight = new PointLight(new Color("#dfe9ff"), 0, 16, 1.6);
  group.add(daylight);

  // ---------------------------------------------------------------- the arch
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.load(introDoorwayConfig.source, ({ scene: model }) => {
    if (destroyed) {
      disposeModel(model);
      return;
    }
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const centre = bounds.getCenter(new Vector3());
    const scale = PLACEMENT.height / size.y;
    model.scale.setScalar(scale);
    model.position.set(-centre.x * scale, -bounds.min.y * scale, -centre.z * scale);
    model.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        material.metalness = 0.02;
        material.roughness = Math.max(0.9, material.roughness);
        // Its own textures, moss and ivy as at the entry gate; only wet at the waterline.
        applyWaterlineContact(material);
        stoneMaterials.push(material);
      }
    });
    group.add(model);
    model.updateMatrixWorld(true);

    // Measure the opening: rays straight through the arch find the gap.
    const { opening: share } = introDoorwayConfig;
    const floor = share.floor * PLACEMENT.height;
    const head = share.head * PLACEMENT.height;
    const middle = (floor + head) / 2;
    const raycaster = new Raycaster();
    raycaster.far = 10;
    const through = new Vector3(0, 0, -1).transformDirection(group.matrixWorld);
    const open = (lx: number) => {
      raycaster.set(new Vector3(lx, middle, 5).applyMatrix4(group.matrixWorld), through);
      return raycaster.intersectObject(model, true).length === 0;
    };
    // From the middle of the opening outward, until stone on each side.
    const step = PLACEMENT.height * 0.006;
    const start = share.x * PLACEMENT.height;
    let left = start;
    let right = start;
    if (open(start)) {
      while (left > start - PLACEMENT.height && open(left - step)) left -= step;
      while (right < start + PLACEMENT.height && open(right + step)) right += step;
    }
    if (right - left < 0.3) {
      left = -PLACEMENT.height * 0.17;
      right = PLACEMENT.height * 0.17;
    }
    const width = right - left;
    opening.centre.set((left + right) / 2, middle, 0);
    opening.width = width;
    opening.height = head - floor;
    opening.floor = floor;

    // The window: a round-headed shape filling the opening, set in the stone.
    const radius = width / 2;
    const shape = new Shape();
    shape.moveTo(left, floor);
    shape.lineTo(right, floor);
    shape.lineTo(right, head - radius);
    shape.absarc(opening.centre.x, head - radius, radius, 0, Math.PI, false);
    shape.lineTo(left, floor);
    const geometry = new ShapeGeometry(shape, 24);
    // Normalised UVs across the opening, for the window's framing and glow.
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, (position.getX(i) - left) / width, (position.getY(i) - floor) / (head - floor));
    }
    portal = new Mesh(geometry, portalMaterial);
    portal.position.z = 0.02;
    group.add(portal);

    daylight.position.set(opening.centre.x, middle, 1.4);
  });

  // ---------------------------------------------------------------- frame
  const corner = new Vector3();

  /** The opening's bounds on screen, in CSS pixels, or null when off screen. */
  const project = (camera: Camera, width: number, height: number): DoorwayRect | null => {
    if (!portal) return null;
    group.updateMatrixWorld();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const half = opening.width / 2;
    for (const [cx, cy] of [
      [opening.centre.x - half, opening.floor],
      [opening.centre.x + half, opening.floor],
      [opening.centre.x - half, opening.floor + opening.height],
      [opening.centre.x + half, opening.floor + opening.height],
    ] as const) {
      corner.set(cx, cy, 0).applyMatrix4(group.matrixWorld).project(camera);
      if (corner.z > 1) return null;
      const sx = (corner.x * 0.5 + 0.5) * width;
      const sy = (-corner.y * 0.5 + 0.5) * height;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }
    if (maxX < 0 || minX > width || maxY < 0 || minY > height) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  return {
    setPresence: (next) => {
      presence = MathUtils.clamp(next, 0, 1);
      group.visible = presence > 0.002;
      const solid = presence >= 0.999;
      for (const material of stoneMaterials) {
        material.opacity = presence;
        material.transparent = !solid;
        material.depthWrite = solid;
      }
    },
    update: (delta, _elapsed, input) => {
      if (!group.visible) return;
      // The day fades in on hover and stays while held; holding brightens it.
      const reveal = Math.max(input.hover ? 1 : 0, input.hold > 0 ? 1 : 0);
      portalUniforms.uReveal.value = MathUtils.damp(
        portalUniforms.uReveal.value,
        reveal,
        reveal ? 2.6 : 3.5,
        delta,
      );
      portalUniforms.uGlow.value = MathUtils.damp(portalUniforms.uGlow.value, input.hold, 6, delta);
      portalUniforms.uPresence.value = presence;
      daylight.intensity =
        presence * portalUniforms.uReveal.value * (5 + portalUniforms.uGlow.value * 14);
    },
    screenRect: (camera, width, height) => {
      if (presence < 0.7) return null;
      return project(camera, width, height);
    },
    screenAnchor: (camera, width, height) => {
      if (!group.visible) return null;
      const rect = project(camera, width, height);
      if (!rect) return null;
      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        width: rect.width,
        height: rect.height,
        presence,
      };
    },
    destroy: () => {
      destroyed = true;
      scene.remove(group);
      group.traverse((item) => {
        if (item instanceof Mesh && item !== portal) disposeModel(item);
      });
      portal?.geometry.dispose();
      portalMaterial.dispose();
      portalUniforms.uSky.value?.dispose();
    },
  };
}

function disposeModel(root: Object3D) {
  root.traverse((item) => {
    if (!(item instanceof Mesh)) return;
    item.geometry.dispose();
    const materials = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && typeof value === "object" && "isTexture" in value)
          (value as Texture).dispose();
      }
      material.dispose();
    }
  });
}
