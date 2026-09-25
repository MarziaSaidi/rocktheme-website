import {
  AdditiveBlending,
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Raycaster,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Material,
  type Object3D,
  type Scene,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  resolveResponsiveValue,
  sceneViewportForWidth,
  type SceneViewport,
} from "@/config/responsive";

import { toWorld, type ChapterFrame } from "../core/chapterFrame";
import type { HeroLandscapeConfig, LandscapeModelPlacement } from "../sceneTypes";
import { applyDistanceFog, createDistanceFogUniforms } from "./distanceFog";
import { applyWaterlineContact } from "./rocks";
import { matchStone } from "./stoneMaterial";

/**
 * The hero landscape.
 *
 * Three supplied models, each at its own depth in the hero frame:
 *
 *   mountains  the range across the back of the view, past the scene fog and
 *              shaded by its own aerial perspective instead
 *   perch      the rock in the right foreground, standing in the water
 *   robot      seated on the perch; its height is found on the rock's surface
 *              when both have loaded, so it rests on the stone rather than
 *              floating at a configured height
 *
 * Nothing here moves by itself. The viewer's journey moves the camera, and the
 * whole landscape stays put in the world; it only fades as the journey leaves
 * the hero, so the Selected Work view beyond it is unchanged.
 */

export type HeroLandscape = Readonly<{
  /**
   * How present the landscape is, 0 to 1, set by the journey each frame:
   * `far` for the range and the moon, `near` for the perch and the robot.
   */
  setPresence: (far: number, near: number) => void;
  resize: (width: number) => void;
  /** Objects that should not be drawn into the water's reflection. */
  reflectionExclusions: () => readonly Object3D[];
  destroy: () => void;
}>;

type Part = "mountains" | "perch" | "robot";

function disposeModel(root: Object3D) {
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

/** Centres a model on x/z, stands it on y 0 and scales it into a unit box. */
function normalise(model: Object3D, uniform: boolean): Vector3 | null {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  if (![size.x, size.y, size.z].every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }
  const scale = uniform
    ? new Vector3().setScalar(1 / size.y)
    : new Vector3(1 / size.x, 1 / size.y, 1 / size.z);
  model.scale.copy(scale);
  model.position.set(-center.x * scale.x, -bounds.min.y * scale.y, -center.z * scale.z);
  // Proportions of the unit model, relative to its height.
  return new Vector3(size.x / size.y, 1, size.z / size.y);
}

/**
 * The moon: a hard-edged bright disc in a halo that falls off slowly, so the
 * sky round it reads as lit air rather than as a bulb.
 */
function moonTexture(core: Color, halo: Color): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const c = size / 2;
  const rgb = (color: Color, alpha: number) =>
    `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${alpha})`;
  const glow = context.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, rgb(halo, 0.55));
  glow.addColorStop(0.07, rgb(halo, 0.34));
  glow.addColorStop(0.2, rgb(halo, 0.12));
  glow.addColorStop(0.5, rgb(halo, 0.035));
  glow.addColorStop(1, rgb(halo, 0));
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
  const disc = context.createRadialGradient(c, c, 0, c, c, size * 0.028);
  disc.addColorStop(0, rgb(core, 1));
  disc.addColorStop(0.8, rgb(core, 0.95));
  disc.addColorStop(1, rgb(core, 0));
  context.fillStyle = disc;
  context.beginPath();
  context.arc(c, c, size * 0.028, 0, Math.PI * 2);
  context.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createHeroLandscape(
  scene: Scene,
  config: HeroLandscapeConfig,
  frame: ChapterFrame,
  handlers: Readonly<{ onFailure?: (part: Part) => void; onLoaded?: () => void }> = {},
): HeroLandscape {
  const loader = new GLTFLoader();
  const root = new Group();
  root.name = "hero-landscape";
  root.position.set(...toWorld(frame, [0, 0, 0]));
  root.rotation.y = frame.yaw;
  scene.add(root);

  const mountains = new Group();
  const flank = new Group();
  const perch = new Group();
  const robot = new Group();
  mountains.visible = flank.visible = perch.visible = robot.visible = false;
  root.add(mountains, flank, perch, robot);

  const ready: Record<Part, boolean> = { mountains: false, perch: false, robot: false };
  const materials: Record<Part, MeshStandardMaterial[]> = {
    mountains: [],
    perch: [],
    robot: [],
  };
  const perchMeshes: Mesh[] = [];
  const waterline = { value: 0.2 };
  const mountainFog = createDistanceFogUniforms(config.mountainFog);

  let viewport: SceneViewport = "desktop";
  let presence = 1;
  let nearPresence = 1;
  let destroyed = false;

  /*
   * Moonlight. Directional, so every surface is lit from the same side the
   * glow in the sky is on: ridges and crowns catch it, faces toward the viewer
   * stay dark. The target is the root, so the direction turns with the frame.
   */
  const moon = new DirectionalLight(config.moonlight.color, 0);
  moon.position.set(...config.moonlight.position);
  moon.target = root;
  root.add(moon);

  const moonMap = moonTexture(new Color(config.moon.color), new Color(config.moon.haloColor));
  const moonMaterial = new SpriteMaterial({
    map: moonMap,
    color: new Color(1, 1, 1).multiplyScalar(config.moon.intensity),
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const moonDisc = new Sprite(moonMaterial);
  moonDisc.scale.setScalar(config.moon.size);
  // Drawn before the mist and horizon glow, so the air in front veils it.
  moonDisc.renderOrder = 0;
  root.add(moonDisc);

  const robotLight = new PointLight(config.robotLight.color, 0, 1, 2);
  robotLight.position.set(...config.robotLight.offset);
  robot.add(robotLight);

  // ------------------------------------------------------------------ placement
  const place = (group: Group, placement: LandscapeModelPlacement) => {
    group.position.set(...placement.position);
    group.rotation.y = placement.yaw;
    group.scale.set(
      placement.mirror ? -placement.width : placement.width,
      placement.height,
      placement.depth,
    );
  };

  const raycaster = new Raycaster();
  const down = new Vector3(0, -1, 0);
  const probe = new Vector3();

  /*
   * Seats the robot on the rock. Rays are cast straight down through the
   * footprint of its seat; it rests on the highest point they find, pressed a
   * fraction into the stone so the contact reads as weight, not a hover.
   */
  const seatRobot = () => {
    const seat = resolveResponsiveValue(config.placement, viewport).robot;
    robot.scale.setScalar(seat.height);
    robot.rotation.y = seat.yaw;
    let y = 0;
    if (ready.perch) {
      root.updateMatrixWorld(true);
      const reach = seat.height * 0.12;
      const samples: [number, number][] = [
        [0, 0],
        [reach, 0],
        [-reach, 0],
        [0, reach],
        [0, -reach],
      ];
      const hits: number[] = [];
      samples.forEach(([dx, dz]) => {
        probe.set(seat.x + dx, 100, seat.z + dz);
        root.localToWorld(probe);
        raycaster.set(probe, down);
        const hit = raycaster.intersectObjects(perchMeshes, false)[0];
        if (hit) hits.push(root.worldToLocal(hit.point.clone()).y);
      });
      if (hits.length > 0) {
        hits.sort((a, b) => a - b);
        // The median, so one ray down a crack does not drop the figure into it.
        y = hits[Math.floor(hits.length / 2)]! - seat.height * 0.02;
      }
    }
    robot.position.set(seat.x, y, seat.z);
    robotLight.distance = seat.height * 6;
  };

  const applyPlacement = () => {
    const placement = resolveResponsiveValue(config.placement, viewport);
    place(mountains, placement.mountains);
    place(flank, placement.flank);
    moonDisc.position.set(...placement.moon);
    place(perch, placement.perch);
    waterline.value = placement.perch.height * 0.18;
    seatRobot();
  };

  const fadeMaterials = (list: readonly MeshStandardMaterial[], value: number) => {
    const solid = value >= 0.999;
    list.forEach((material) => {
      material.opacity = value;
      material.transparent = !solid;
      // A fading model must not hide the water behind it.
      material.depthWrite = solid;
    });
  };

  const applyPresence = () => {
    fadeMaterials(materials.mountains, presence);
    fadeMaterials(materials.perch, nearPresence);
    fadeMaterials(materials.robot, nearPresence);
    mountains.visible = flank.visible = ready.mountains && presence > 0.002;
    perch.visible = ready.perch && nearPresence > 0.002;
    robot.visible = ready.robot && ready.perch && nearPresence > 0.002;
    robotLight.intensity = config.robotLight.intensity * nearPresence;
    moon.intensity = config.moonlight.intensity * presence;
    moonMaterial.opacity = presence;
    moonDisc.visible = presence > 0.002;
  };

  // --------------------------------------------------------------------- loading
  const load = (
    part: Part,
    source: string,
    target: Group,
    prepare: (material: MeshStandardMaterial, mesh: Mesh) => void,
  ) => {
    loader.load(
      source,
      ({ scene: model }) => {
        if (destroyed) {
          disposeModel(model);
          return;
        }
        if (!normalise(model, part === "robot")) {
          disposeModel(model);
          handlers.onFailure?.(part);
          return;
        }
        model.traverse((item) => {
          if (!(item instanceof Mesh)) return;
          item.castShadow = false;
          item.receiveShadow = false;
          const list = Array.isArray(item.material) ? item.material : [item.material];
          list.forEach((material) => {
            if (!(material instanceof MeshStandardMaterial)) return;
            prepare(material, item);
            material.needsUpdate = true;
            materials[part].push(material);
          });
        });
        target.add(model);
        // The flank is the same range again: shared geometry and materials.
        if (part === "mountains") flank.add(model.clone());
        ready[part] = true;
        if (part === "perch" || part === "robot") seatRobot();
        applyPresence();
        handlers.onLoaded?.();
      },
      undefined,
      () => handlers.onFailure?.(part),
    );
  };

  load("mountains", config.sources.mountains, mountains, (material) => {
    /*
     * Fully matte, with the metal/roughness map dropped: at this distance a
     * glossy texel under the moon is a white scratch across the ridge.
     */
    material.metalness = 0;
    material.metalnessMap = null;
    material.roughness = 1;
    material.roughnessMap = null;
    material.normalScale.setScalar(0.6);
    applyDistanceFog(material, mountainFog);
    matchStone(material, config.mountainShade);
  });
  load("perch", config.sources.perch, perch, (material, mesh) => {
    material.metalness = 0.05;
    material.roughness = Math.max(0.8, material.roughness);
    applyWaterlineContact(material, waterline);
    matchStone(material, config.perchShade);
    perchMeshes.push(mesh);
  });
  load("robot", config.sources.robot, robot, (material) => {
    // No environment map: metal would render black. Painted plastic and enamel.
    material.metalness = Math.min(material.metalness, 0.15);
  });

  applyPlacement();
  applyPresence();

  return {
    setPresence: (far, near) => {
      const nextFar = Math.min(1, Math.max(0, far));
      const nextNear = Math.min(1, Math.max(0, near));
      if (Math.abs(nextFar - presence) < 0.0005 && Math.abs(nextNear - nearPresence) < 0.0005) {
        return;
      }
      presence = nextFar;
      nearPresence = nextNear;
      applyPresence();
    },
    resize: (width) => {
      viewport = sceneViewportForWidth(width);
      applyPlacement();
    },
    /*
     * The range stands in the water, so the water mirrors it: that dark
     * reflection is what joins its feet to the surface. Left out, the water
     * under the peaks mirrored the lit sky instead and the range floated on a
     * pale band. The moon stays out; its disc is sky, not landscape.
     */
    reflectionExclusions: () => [moonDisc],
    destroy: () => {
      destroyed = true;
      flank.clear();
      disposeModel(root);
      moonMap?.dispose();
      moonMaterial.dispose();
      scene.remove(root);
      root.clear();
    },
  };
}
