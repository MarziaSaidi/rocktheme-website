import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  ShaderMaterial,
  TextureLoader,
  Vector3,
  type Material,
  type Object3D,
  type Scene,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  sceneViewportForWidth,
  resolveResponsiveValue,
  type SceneViewport,
} from "@/config/responsive";

import { getMonolithFaces, subscribeMonolith } from "../monolithChannel";
import type { MonolithConfig, MonolithPlacement } from "../sceneTypes";
import { applyDistanceFog, createDistanceFogUniforms } from "./distanceFog";
import { applyWaterlineContact, presenceAt } from "./rocks";
import { matchStone } from "./stoneMaterial";

/**
 * The Selected Work stones.
 *
 * One stone per featured project, each standing at its own place on the
 * water with the project's screen set into its wide face, and one mountain
 * range behind them all. Every stone has the same transform tree:
 *
 *   root      world position, height and girth, resting yaw
 *   ├ aligned  the stone model, rotated so its faces meet the axes and
 *   │          offset so its pillar stands on the root's origin
 *   └ anchor   screen, housing and glow, turned and tilted onto the face
 *
 * Nothing here ever moves. The camera travels from stone to stone (see the
 * camera journey); each stone only reports how much of it the viewer can see.
 */

export type Monolith = Readonly<{
  /**
   * Where the viewer is standing this frame. A stone emerges from the haze as
   * the viewer nears it, and its screen fades out as it turns edge-on: flat on
   * uneven rock, a screen stands a little proud of it, and at a grazing angle
   * that lip would read as a plate fixed to the stone.
   */
  setViewer: (position: Vector3) => void;
  /**
   * How many stones, in project order, may be drawn. The journey holds a
   * stone back until it sets off toward it, at a moment the stone is out of
   * frame, so it is never seen to appear.
   */
  setRevealed: (count: number) => void;
  resize: (width: number) => void;
  destroy: () => void;
}>;

const SCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/*
 * One quad covers the housing face. Inside the inner rectangle it is the
 * screen; outside it is the dark recessed edge, with a hairline rim on the
 * boundary.
 */
const SCREEN_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uVisibility;
  uniform vec2 uHousing;
  uniform vec2 uScreen;
  uniform vec3 uOff;
  uniform vec3 uRim;

  void main() {
    if (uVisibility <= 0.001) discard;

    vec2 p = (vUv - 0.5) * uHousing;
    vec2 d2 = abs(p) - uScreen * 0.5;
    float dist = length(max(d2, 0.0)) + min(max(d2.x, d2.y), 0.0);
    float inside = 1.0 - smoothstep(-0.0006, 0.0006, dist);

    vec2 suv = p / uScreen + 0.5;
    vec3 image = uHasMap > 0.5 ? texture2D(uMap, suv).rgb : uOff;
    // Set into the rock: the image falls a little into shadow at its edges,
    // as if the stone's lip overhangs it.
    float recess = mix(0.62, 1.0, smoothstep(0.0, 0.035 * uScreen.y, -dist));
    // A lit screen at night, not a white card: held well below full white.
    vec3 colour = mix(uOff * 0.7, image * 0.8 * recess, inside);

    float line = exp(-pow(dist / 0.0011, 2.0));
    float spill = exp(-max(dist, 0.0) / 0.0025) * step(0.0, dist);
    // A hairline of lit edge, not a coloured frame.
    colour += uRim * (line * 0.7 + spill * 0.06) * 0.28;

    /*
     * Seen by the water's mirror camera, which stands below the surface. Drawn
     * sharp, the screen came back as a second pale panel lying in the water.
     * The water should return its light, not a copy of it: the image is taken
     * from a small mip level so no interface survives, held far darker, and
     * feathered out from the middle, most of all top and bottom, so the
     * surface's own ripples break it into a smear of light.
     */
    if (cameraPosition.y < 0.0) {
      vec3 glow = uHasMap > 0.5 ? texture2D(uMap, clamp(suv, 0.0, 1.0), 6.0).rgb : uOff;
      vec2 q = abs(suv - 0.5) * 2.0;
      float feather = (1.0 - smoothstep(0.3, 1.05, q.x)) * (1.0 - smoothstep(0.2, 1.1, q.y));
      colour = mix(uOff * 0.7, glow * 0.95, feather);
    }

    gl_FragColor = vec4(colour, uVisibility);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type ScreenUniforms = {
  uMap: { value: Texture | null };
  uHasMap: { value: number };
  uVisibility: { value: number };
  uHousing: { value: [number, number] };
  uScreen: { value: [number, number] };
  uOff: { value: Color };
  uRim: { value: Color };
};

type Stone = {
  placement: MonolithConfig["stones"][number];
  root: Group;
  aligned: Group;
  /** The face's frame on the stone: housing, screen and glow live in it. */
  anchor: Group;
  /** Housing and screen: everything that must vanish together. */
  group: Group;
  housingMesh: Mesh;
  screenMesh: Mesh;
  material: ShaderMaterial;
  uniforms: ScreenUniforms;
  housing: MeshStandardMaterial;
  light: PointLight;
  texture: Texture | null;
  stoneMaterials: MeshStandardMaterial[];
  /** World height below which the rock darkens where it meets the water. */
  waterline: { value: number };
  pivot: Vector3;
  /** How much of the stone the viewer sees, from their distance to it. */
  visibility: number;
  /** 1 facing the viewer, 0 edge-on or turned away. */
  facing: number;
};

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

/*
 * Distances from a stone's axis at which it is fully there, and gone, per
 * stone in project order.
 *
 * Desktop: the first stone is never faded in. From the hero it stands about
 * 53 out, out of frame and behind the perch's crest, and it is revealed by
 * the camera moving past the rock, so it is solid the whole way. A stone only
 * partly there is drawn translucent and reads as a hologram. The second stone
 * is likewise solid whenever it is drawn: it is held back (setRevealed) until
 * the departure from the first stone begins, and it first comes into view
 * about 60 out, far past where the scene fog has taken its detail.
 *
 * Stacked: the hero stands about 50 out and the camera passes the far view
 * about 28 out, so both stones emerge from the haze on the way.
 */
const STONE_EMERGENCE: Record<"desktop" | "stacked", readonly (readonly [number, number])[]> = {
  desktop: [
    [58, 60],
    [90, 95],
  ],
  stacked: [[36, 48]],
};

export function createMonolith(
  scene: Scene,
  config: MonolithConfig,
  handlers: Readonly<{ onFailure?: (asset: string) => void; onLoaded?: () => void }> = {},
): Monolith {
  const loader = new GLTFLoader();
  const textureLoader = new TextureLoader();
  let destroyed = false;
  let viewport: SceneViewport = "desktop";
  let revealed = Number.POSITIVE_INFINITY;
  let stonesReady = false;
  let mountainsReady = false;

  const mountains = new Group();
  mountains.visible = false;

  /*
   * One key for every stone, from the camera's side: each stone's face is
   * turned toward its own settled view, so the same light shows both.
   */
  const key = new DirectionalLight(config.key.color, config.key.intensity);
  const keyTarget = new Group();
  key.target = keyTarget;

  scene.add(mountains, key, keyTarget);

  const mountainMaterials: MeshStandardMaterial[] = [];
  const mountainFog = createDistanceFogUniforms(config.mountains.fog);
  const { screen } = config;
  const plane = new PlaneGeometry(1, 1);
  const box = new BoxGeometry(1, 1, 1);

  const faceCentre = new Vector3();
  const faceNormal = new Vector3();
  const toViewer = new Vector3();

  const createStone = (placement: MonolithConfig["stones"][number], seed: number): Stone => {
    const root = new Group();
    root.visible = false;
    const aligned = new Group();
    aligned.rotation.y = config.stone.alignYaw;
    aligned.position.set(-config.stone.axis[0], 0, -config.stone.axis[1]);
    root.add(aligned);

    const anchor = new Group();
    // Turn and tilt with the face so the screen lies flat on it.
    anchor.rotation.order = "YXZ";
    anchor.rotation.y = Math.atan(-screen.face.across);
    anchor.rotation.x = Math.atan(screen.face.slope);
    root.add(anchor);

    const group = new Group();
    anchor.add(group);

    // Seen at an angle, the housing's lip reads as a ledge of the same stone
    // rather than a plate fixed to it.
    const housing = new MeshStandardMaterial({
      color: screen.housingColor,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0,
    });
    const housingMesh = new Mesh(box, housing);
    housingMesh.renderOrder = 1;
    group.add(housingMesh);

    const uniforms: ScreenUniforms = {
      uMap: { value: null },
      uHasMap: { value: 0 },
      uVisibility: { value: 0 },
      uHousing: { value: [1, 1] },
      uScreen: { value: [1, 1] },
      uOff: { value: new Color(screen.offColor) },
      uRim: { value: new Color(screen.rimColor) },
    };
    const material = new ShaderMaterial({
      vertexShader: SCREEN_VERTEX,
      fragmentShader: SCREEN_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms,
    });
    const screenMesh = new Mesh(plane, material);
    screenMesh.renderOrder = 2;
    screenMesh.name = `monolith-screen-${seed}`;
    group.add(screenMesh);

    /*
     * The glow is kept out of the display group and dimmed to zero rather
     * than hidden: toggling a light's visibility recompiles every lit
     * material in the scene.
     */
    const light = new PointLight(screen.glowColor, 0, 3, 2);
    light.position.set(0, 0, 0.05);
    anchor.add(light);

    scene.add(root);
    return {
      placement,
      root,
      aligned,
      anchor,
      group,
      housingMesh,
      screenMesh,
      material,
      uniforms,
      housing,
      light,
      texture: null,
      stoneMaterials: [],
      waterline: { value: 0.05 },
      pivot: new Vector3(),
      visibility: 0,
      facing: 1,
    };
  };

  const stones = config.stones.map(createStone);

  /*
   * The stone is scaled by girth on x and z but not on y. The screen is sized
   * in local units so that, after that scale, it keeps the image's aspect.
   */
  const layoutFace = (stone: Stone, placement: MonolithPlacement) => {
    const { girth, screenHeight, screenCenterY: centerY } = placement;
    const screenWidth = (screenHeight * screen.aspect) / girth;
    const housingWidth = screenWidth + (screen.bezel * 2) / girth;
    const housingHeight = screenHeight + screen.bezel * 2;
    stone.anchor.position.set(
      0,
      centerY,
      screen.face.offset + screen.face.slope * centerY + screen.clearance,
    );
    stone.housingMesh.scale.set(housingWidth, housingHeight, screen.housingDepth);
    stone.housingMesh.position.z = -screen.housingDepth / 2;
    stone.screenMesh.scale.set(housingWidth, housingHeight, 1);
    stone.screenMesh.position.z = 0.0008;
    // The shader measures in world-proportional units so the rim is even.
    stone.uniforms.uHousing.value = [housingWidth * girth, housingHeight];
    stone.uniforms.uScreen.value = [screenWidth * girth, screenHeight];
  };

  const loadFaceTextures = () => {
    const sources = getMonolithFaces();
    stones.forEach((stone, index) => {
      const source = sources[index];
      const current = stone.uniforms.uMap.value;
      if (!source || current?.userData.source === source) return;
      textureLoader.load(source, (texture) => {
        if (destroyed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.anisotropy = 8;
        texture.userData.source = source;
        stone.texture?.dispose();
        stone.texture = texture;
        stone.uniforms.uMap.value = texture;
        stone.uniforms.uHasMap.value = 1;
        handlers.onLoaded?.();
      });
    });
  };
  const unsubscribe = subscribeMonolith(loadFaceTextures);
  loadFaceTextures();

  // ----------------------------------------------------------------- models
  loader.load(
    config.stone.source,
    ({ scene: model }) => {
      if (destroyed) {
        disposeModel(model);
        return;
      }
      /*
       * Every stone shares the geometry but fades on its own materials, so the
       * copies are cloned from the untouched originals before any is adjusted.
       */
      const copies = stones.map((_, index) => {
        if (index === 0) return model;
        const copy = model.clone();
        copy.traverse((item) => {
          if (!(item instanceof Mesh)) return;
          item.material = Array.isArray(item.material)
            ? item.material.map((material) => material.clone())
            : item.material.clone();
        });
        return copy;
      });
      copies.forEach((copy, index) => {
        const stone = stones[index]!;
        copy.traverse((item) => {
          if (!(item instanceof Mesh)) return;
          item.renderOrder = 0;
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.forEach((material) => {
            if (!(material instanceof MeshStandardMaterial)) return;
            material.metalness = 0.05;
            material.roughness = Math.max(0.86, material.roughness);
            material.transparent = true;
            material.opacity = 0;
            material.depthWrite = true;
            applyWaterlineContact(material, stone.waterline);
            matchStone(material);
            stone.stoneMaterials.push(material);
          });
        });
        stone.aligned.add(copy);
      });
      stonesReady = true;
      handlers.onLoaded?.();
    },
    undefined,
    () => handlers.onFailure?.("monolith"),
  );

  loader.load(
    config.mountains.source,
    ({ scene: model }) => {
      if (destroyed) {
        disposeModel(model);
        return;
      }
      model.traverse((item) => {
        if (!(item instanceof Mesh)) return;
        const materials = Array.isArray(item.material) ? item.material : [item.material];
        materials.forEach((material) => {
          if (!(material instanceof MeshStandardMaterial)) return;
          /*
           * The same stone as the hero range, treated the same way: matte,
           * with the metal/roughness map dropped, since at this distance a
           * glossy texel reads as a pale scratch rather than as wet rock.
           */
          material.metalness = 0;
          material.metalnessMap = null;
          material.roughness = 1;
          material.roughnessMap = null;
          material.normalScale.setScalar(0.6);
          // The range stands beyond the scene fog's far distance, which would
          // flatten it to the fog colour; it takes its own aerial perspective.
          applyDistanceFog(material, mountainFog);
          matchStone(material, config.mountains.shade);
          mountainMaterials.push(material);
        });
      });
      mountains.add(model);
      mountainsReady = true;
      mountains.visible = true;
      applyPlacement();
      handlers.onLoaded?.();
    },
    undefined,
    () => handlers.onFailure?.("mountains"),
  );

  // -------------------------------------------------------------- placement
  function applyPlacement() {
    stones.forEach((stone) => {
      const placement = resolveResponsiveValue(stone.placement, viewport);
      const scaleXZ = placement.height * placement.girth;
      stone.root.position.set(...placement.position);
      stone.root.scale.set(scaleXZ, placement.height, scaleXZ);
      stone.root.rotation.y = placement.yaw;
      stone.pivot.set(placement.position[0], 0, placement.position[2]);
      stone.waterline.value = placement.height * 0.05;
      layoutFace(stone, placement);
      // Light reach is in world units; the face group is scaled with the stone.
      stone.light.distance = placement.height * 0.5;
      stone.root.updateMatrixWorld(true);
    });

    const range = resolveResponsiveValue(config.mountains.placement, viewport);
    mountains.position.set(...range.position);
    mountains.scale.set(...range.scale);
    mountains.rotation.y = range.yaw;

    key.position.set(...config.key.position);
    keyTarget.position.copy(stones[0]?.pivot ?? new Vector3());
  }
  applyPlacement();

  // -------------------------------------------------------------- per frame
  const applyVisibility = () => {
    stones.forEach((stone) => {
      const { visibility } = stone;
      stone.root.visible = stonesReady && visibility > 0.002;
      const solid = visibility >= 0.999;
      stone.stoneMaterials.forEach((material) => {
        material.opacity = visibility;
        // Fully present, the stone is drawn opaque so the screen sorts cleanly.
        material.transparent = !solid;
        // While fading it must not hide what is behind it, or it reads as a
        // black silhouette rather than a stone emerging from the haze.
        material.depthWrite = solid;
      });
      // The screen comes in after the rock does, so a stone still deep in
      // the haze carries only a dim light, never a bright plate.
      const presence = visibility ** 2 * stone.facing;
      stone.group.visible = presence > 0.002;
      stone.housing.depthWrite = solid;
      stone.housing.opacity = presence;
      stone.uniforms.uVisibility.value = presence;
      stone.light.intensity = screen.glowIntensity * presence;
    });
    mountains.visible = mountainsReady;
  };

  return {
    setViewer: (position) => {
      stones.forEach((stone, index) => {
        const distance = Math.hypot(position.x - stone.pivot.x, position.z - stone.pivot.z);
        const table = STONE_EMERGENCE[viewport === "desktop" ? "desktop" : "stacked"];
        const [present, gone] = table[Math.min(index, table.length - 1)]!;
        stone.visibility = index < revealed ? presenceAt(distance, present, gone) : 0;
        if (stone.visibility <= 0.002) return;
        stone.group.getWorldPosition(faceCentre);
        faceNormal.set(0, 0, 1).transformDirection(stone.group.matrixWorld);
        const alignment = toViewer.copy(position).sub(faceCentre).normalize().dot(faceNormal);
        // Full within about 60° of the face, gone by about 78°.
        const t = Math.min(1, Math.max(0, (alignment - 0.2) / 0.3));
        stone.facing = t * t * (3 - 2 * t);
      });
      applyVisibility();
    },

    setRevealed: (count) => {
      revealed = count;
    },

    resize: (width) => {
      viewport = sceneViewportForWidth(width);
      applyPlacement();
    },

    destroy: () => {
      destroyed = true;
      unsubscribe();
      stones.forEach((stone) => {
        disposeModel(stone.aligned);
        stone.material.dispose();
        stone.housing.dispose();
        stone.texture?.dispose();
        stone.light.dispose();
        scene.remove(stone.root);
      });
      disposeModel(mountains);
      plane.dispose();
      box.dispose();
      key.dispose();
      scene.remove(mountains, key, keyTarget);
    },
  };
}
