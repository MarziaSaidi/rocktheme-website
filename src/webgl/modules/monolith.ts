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

import {
  evaluateMonolith,
  getMonolithFaces,
  getMonolithTimeline,
  subscribeMonolith,
} from "../monolithChannel";
import type { MonolithConfig, MonolithFace } from "../sceneTypes";
import { applyDistanceFog, createDistanceFogUniforms } from "./distanceFog";
import { createDisplayDust, DISSOLVE_GLSL, type DisplayDust } from "./displayDust";
import { applyWaterlineContact, presenceAt } from "./rocks";
import { matchStone } from "./stoneMaterial";

/**
 * The Selected Work monolith.
 *
 * One stone with a screen set into each of its two wide faces, standing in
 * front of the mountain range. The transform tree is the whole contract:
 *
 *   root      world position, height and girth, resting yaw
 *   ├ aligned  the stone model, rotated so its faces meet the axes and
 *   │          offset so its pillar stands on the root's origin
 *   ├ front    screen, housing and glow on the front face
 *   └ back     the same, turned 180° onto the opposite face
 *
 * Nothing here ever turns. The stone is a fixed object in the landscape; the
 * viewer walks round it (see `orbit` and the camera rig in environment.ts).
 * The pillar's axis is exposed as `pivot`, the point that walk is centred on.
 *
 * The mountain range stands in front of the stone, and copies of the same
 * model stand at each quarter turn round the pivot, so every view along the
 * walk looks onto a landscape rather than an empty horizon.
 */

export type Monolith = Readonly<{
  update: (delta: number, now: number) => void;
  /** Progress round the stone from the latest update, 0 in front and 1 behind. */
  orbit: () => number;
  /** World position of the pillar's axis, the centre of the walk round it. */
  pivot: () => Vector3;
  /**
   * Where the viewer is standing this frame. Each screen fades out as it turns
   * edge-on: flat on uneven rock, a screen stands a little proud of it, and at
   * a grazing angle that lip would read as a plate fixed to the stone.
   */
  setViewer: (position: Vector3) => void;
  /** True while a walk or fade is still in progress. */
  animating: (now: number) => boolean;
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
 * boundary. The whole assembly, content, backing, edge and rim alike,
 * dissolves cell by cell with `uDisplay`: at 0 nothing of it is drawn and
 * the rock beneath shows through. Under reduced motion it crossfades instead.
 */
const SCREEN_FRAGMENT = /* glsl */ `
  ${DISSOLVE_GLSL}

  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uDisplay;
  uniform float uDissolve;
  uniform float uVisibility;
  uniform vec2 uHousing;
  uniform vec2 uScreen;
  uniform vec3 uOff;
  uniform vec3 uRim;

  void main() {
    float present = uDissolve > 0.5
      ? smoothstep(-0.012, 0.012, uDisplay - (1.0 - dissolveThreshold(vUv)))
      : uDisplay;
    if (present <= 0.001) discard;

    vec2 p = (vUv - 0.5) * uHousing;
    vec2 d2 = abs(p) - uScreen * 0.5;
    float dist = length(max(d2, 0.0)) + min(max(d2.x, d2.y), 0.0);
    float inside = 1.0 - smoothstep(-0.0006, 0.0006, dist);

    vec2 suv = p / uScreen + 0.5;
    vec3 image = uHasMap > 0.5 ? texture2D(uMap, suv).rgb : uOff;
    // A lit screen at dusk, not a white card: held a little below full white.
    vec3 colour = mix(uOff * 0.7, image * 0.9, inside);

    float line = exp(-pow(dist / 0.0011, 2.0));
    float spill = exp(-max(dist, 0.0) / 0.0025) * step(0.0, dist);
    colour += uRim * (line * 0.7 + spill * 0.06) * 0.6;

    gl_FragColor = vec4(colour, uVisibility * present);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type ScreenUniforms = {
  uMap: { value: Texture | null };
  uHasMap: { value: number };
  uDisplay: { value: number };
  uDissolve: { value: number };
  uVisibility: { value: number };
  uHousing: { value: [number, number] };
  uScreen: { value: [number, number] };
  uOff: { value: Color };
  uRim: { value: Color };
};

type Face = {
  plane: MonolithFace;
  /** 1 facing the viewer, 0 edge-on or turned away. */
  facing: number;
  /** How much of the display assembly is present, 0 to 1. */
  display: number;
  /** The face's frame on the stone: the display and its dust both live in it. */
  anchor: Group;
  /** Housing, screen and glow: everything that must vanish together. */
  group: Group;
  dust: DisplayDust;
  material: ShaderMaterial;
  uniforms: ScreenUniforms;
  housing: MeshStandardMaterial;
  light: PointLight;
  texture: Texture | null;
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
 * Distances from the stone's axis. The Selected Work view stands 15 units
 * out and the arrival 26; the hero is 55 out, deep in the scene fog. The
 * walk-round copies are only for the views round the back of the stone.
 */
const STONE_PRESENT = 30;
const STONE_GONE = 44;
const RING_PRESENT = 17;
const RING_GONE = 22;

/** Specks per display. Enough to read as dust, few enough to stay delicate. */
export const DUST_COUNT = 260;
/** Seconds a dissolving speck may outlive the dissolve itself. */
export const DUST_LIFE = 0.56;
/** Seconds before arrival that the first speck starts drifting in. */
export const DUST_LEAD = 0.6;

export function createMonolith(
  scene: Scene,
  config: MonolithConfig,
  handlers: Readonly<{ onFailure?: (asset: string) => void; onLoaded?: () => void }> = {},
): Monolith {
  const loader = new GLTFLoader();
  const textureLoader = new TextureLoader();
  let destroyed = false;
  let viewport: SceneViewport = "desktop";
  let visibility = 0;
  /** How much of the walk-round backdrop (the three copies) is present. */
  let ringPresence = 0;
  /** Where the viewer stood at the last `setViewer`; far away until told. */
  const viewer = new Vector3(0, 0, Number.POSITIVE_INFINITY);
  let stoneReady = false;
  let mountainsReady = false;

  const root = new Group();
  const aligned = new Group();
  root.visible = false;
  root.add(aligned);
  aligned.rotation.y = config.stone.alignYaw;
  aligned.position.set(-config.stone.axis[0], 0, -config.stone.axis[1]);

  /** The supplied range, then the same range at 90°, 180° and 270° round the pivot. */
  const RING = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const;
  const ranges = RING.map(() => {
    const range = new Group();
    range.visible = false;
    return range;
  });
  const [mountains] = ranges as [Group, ...Group[]];

  /*
   * Two fixed keys, one on each side of the stone, mirrored about it. From
   * either side the near one lights the face and the far one rims the edge,
   * so the back face is as readable as the front without any light moving.
   */
  const key = new DirectionalLight(config.key.color, 0);
  const keyBehind = new DirectionalLight(config.key.color, 0);
  key.target = root;
  keyBehind.target = root;

  const pivot = new Vector3();
  let orbit = 0;
  const faceCentre = new Vector3();
  const faceNormal = new Vector3();
  const toViewer = new Vector3();

  scene.add(root, ...ranges, key, keyBehind);

  const stoneMaterials: MeshStandardMaterial[] = [];
  const mountainMaterials: MeshStandardMaterial[] = [];
  const ringMaterials: MeshStandardMaterial[] = [];
  const mountainFog = createDistanceFogUniforms(config.mountains.fog);
  const waterline = { value: 0.05 };

  // ------------------------------------------------------------------ faces
  const { screen } = config;
  const geometries: (PlaneGeometry | BoxGeometry)[] = [];

  const createFace = (face: MonolithFace, turned: boolean): Face => {
    const holder = new Group();
    if (turned) holder.rotation.y = Math.PI;
    root.add(holder);

    const anchor = new Group();
    // Turn and tilt with the face so the screen lies flat on it.
    anchor.rotation.order = "YXZ";
    anchor.rotation.y = Math.atan(-face.across);
    anchor.rotation.x = Math.atan(face.slope);
    holder.add(anchor);

    const group = new Group();
    anchor.add(group);

    const plane = new PlaneGeometry(1, 1);
    const box = new BoxGeometry(1, 1, 1);
    geometries.push(plane, box);

    // Seen edge-on from the side of the walk, the housing's lip reads as a
    // ledge of the same stone rather than a plate fixed to it.
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
      uDisplay: { value: 0 },
      uDissolve: { value: 1 },
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
    group.add(screenMesh);

    /*
     * The glow is kept out of the display group and dimmed to zero rather
     * than hidden: toggling a light's visibility recompiles every lit
     * material in the scene.
     */
    const light = new PointLight(screen.glowColor, 0, 3, 2);
    light.position.set(0, 0, 0.05);
    anchor.add(light);

    const dust = createDisplayDust(DUST_COUNT, turned ? 0x51c3 : 0x2e9b);
    anchor.add(dust.points);

    return {
      plane: face,
      facing: turned ? 0 : 1,
      display: turned ? 0 : 1,
      anchor,
      group,
      dust,
      material,
      uniforms,
      housing,
      light,
      texture: null,
    };
  };

  const faces: [Face, Face] = [createFace(screen.front, false), createFace(screen.back, true)];

  /*
   * The stone is scaled by girth on x and z but not on y. The screen is sized
   * in local units so that, after that scale, it keeps the image's aspect.
   */
  const layoutFaces = (girth: number, screenHeight: number, centerY: number) => {
    const screenWidth = (screenHeight * screen.aspect) / girth;
    const housingWidth = screenWidth + (screen.bezel * 2) / girth;
    const housingHeight = screenHeight + screen.bezel * 2;
    faces.forEach((face) => {
      face.anchor.position.set(
        0,
        centerY,
        face.plane.offset + face.plane.slope * centerY + screen.clearance,
      );
      const [housingMesh, screenMesh] = face.group.children as [Mesh, Mesh];
      housingMesh.scale.set(housingWidth, housingHeight, screen.housingDepth);
      housingMesh.position.z = -screen.housingDepth / 2;
      screenMesh.scale.set(housingWidth, housingHeight, 1);
      screenMesh.position.z = 0.0008;
      // The shader measures in world-proportional units so the rim is even.
      face.uniforms.uHousing.value = [housingWidth * girth, housingHeight];
      face.uniforms.uScreen.value = [screenWidth * girth, screenHeight];
      face.dust.layout([housingWidth, housingHeight], girth);
    });
  };

  const loadFaceTextures = () => {
    const sources = getMonolithFaces();
    faces.forEach((face, index) => {
      const source = sources[index];
      const current = face.uniforms.uMap.value;
      if (!source || current?.userData.source === source) return;
      textureLoader.load(source, (texture) => {
        if (destroyed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.anisotropy = 4;
        texture.userData.source = source;
        face.texture?.dispose();
        face.texture = texture;
        face.uniforms.uMap.value = texture;
        face.uniforms.uHasMap.value = 1;
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
      model.traverse((item) => {
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
          applyWaterlineContact(material, waterline);
          matchStone(material);
          stoneMaterials.push(material);
        });
      });
      aligned.add(model);
      stoneReady = true;
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
          material.transparent = true;
          material.opacity = 0;
          // The range stands beyond the scene fog's far distance, which would
          // flatten it to the fog colour; it takes its own aerial perspective.
          applyDistanceFog(material, mountainFog);
          matchStone(material, config.mountains.shade);
          mountainMaterials.push(material);
        });
      });
      mountains.add(model);
      /*
       * The copies share geometry but carry their own materials: the range in
       * front is part of the landscape from every chapter, while the copies
       * only fill the views round the back of the stone and fade with it.
       */
      ranges.slice(1).forEach((range) => {
        const copy = model.clone();
        copy.traverse((item) => {
          if (!(item instanceof Mesh)) return;
          const source = Array.isArray(item.material) ? item.material : [item.material];
          const cloned = source.map((material) => {
            if (!(material instanceof MeshStandardMaterial)) return material;
            const next = material.clone();
            applyDistanceFog(next, mountainFog);
            matchStone(next, config.mountains.shade);
            ringMaterials.push(next);
            return next;
          });
          item.material = Array.isArray(item.material) ? cloned : cloned[0]!;
        });
        range.add(copy);
      });
      mountainsReady = true;
      applyPlacement();
      handlers.onLoaded?.();
    },
    undefined,
    () => handlers.onFailure?.("mountains"),
  );

  // -------------------------------------------------------------- placement
  function applyPlacement() {
    const stone = resolveResponsiveValue(config.stone.placement, viewport);
    const scaleXZ = stone.height * stone.girth;
    root.position.set(...stone.position);
    root.scale.set(scaleXZ, stone.height, scaleXZ);
    root.rotation.y = stone.yaw;
    waterline.value = stone.height * 0.05;
    layoutFaces(stone.girth, stone.screenHeight, stone.screenCenterY);

    faces.forEach((face) => {
      // Light reach is in world units; the face group is scaled with the stone.
      face.light.distance = stone.height * 0.5;
    });

    pivot.set(stone.position[0], 0, stone.position[2]);

    const range = resolveResponsiveValue(config.mountains.placement, viewport);
    const dx = range.position[0] - pivot.x;
    const dz = range.position[2] - pivot.z;
    ranges.forEach((copy, index) => {
      // Rotation about the pivot, matching three.js's yaw convention.
      const angle = RING[index] ?? 0;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      copy.position.set(
        pivot.x + dx * cos + dz * sin,
        range.position[1],
        pivot.z - dx * sin + dz * cos,
      );
      copy.scale.set(...range.scale);
      copy.rotation.y = range.yaw + angle;
    });

    key.position.set(...config.key.position);
    keyBehind.position.set(
      2 * pivot.x - config.key.position[0],
      config.key.position[1],
      2 * pivot.z - config.key.position[2],
    );
  }
  applyPlacement();

  // -------------------------------------------------------------- per frame
  const applyVisibility = () => {
    root.visible = stoneReady && visibility > 0.002;
    mountains.visible = mountainsReady;
    ranges.slice(1).forEach((range) => {
      range.visible = mountainsReady && ringPresence > 0.002;
    });
    const solid = visibility >= 0.999;
    stoneMaterials.forEach((material) => {
      material.opacity = visibility;
      // Fully present, the stone is drawn opaque so the screens sort cleanly.
      material.transparent = !solid;
      // While fading it must not hide what is behind it, or it reads as a
      // black silhouette rather than a stone going.
      material.depthWrite = solid;
    });
    // The range is landscape: always there, always solid.
    mountainMaterials.forEach((material) => {
      material.opacity = 1;
      material.transparent = false;
      material.depthWrite = true;
    });
    const ringSolid = ringPresence >= 0.999;
    ringMaterials.forEach((material) => {
      material.opacity = ringPresence;
      material.transparent = !ringSolid;
      material.depthWrite = ringSolid;
    });
    // The displays go well before the rock does, so no bright screen is left
    // hanging on a stone that is half gone.
    const displayPresence = visibility ** 3;
    faces.forEach((face) => {
      face.housing.depthWrite = solid;
      const presence = displayPresence * face.facing;
      // Hidden means not drawn: no backing, rim, edge or glow left behind.
      face.group.visible = presence > 0.002 && face.display > 0.001;
      face.housing.opacity = presence * face.display;
      face.uniforms.uVisibility.value = presence;
      face.uniforms.uDisplay.value = face.display;
      face.light.intensity = screen.glowIntensity * face.display * presence;
    });
    key.intensity = config.key.intensity * visibility;
    keyBehind.intensity = key.intensity;
  };

  return {
    update: (_delta, now) => {
      /*
       * The stone stands in the world; how much of it the viewer sees depends
       * only on how far away they are. It emerges from the fog on the way in
       * and its screens never glow through haze that hides the rock.
       */
      const distance = Math.hypot(viewer.x - pivot.x, viewer.z - pivot.z);
      visibility = presenceAt(distance, STONE_PRESENT, STONE_GONE);
      ringPresence = presenceAt(distance, RING_PRESENT, RING_GONE);

      const timeline = getMonolithTimeline();
      const pose = timeline
        ? evaluateMonolith(timeline, now)
        : { orbit: 0, front: 1, back: 0, sweep: -1, settled: true };
      orbit = pose.orbit;

      applyVisibility();
      if (!root.visible) return;

      faces[0].display = pose.front;
      faces[1].display = pose.back;
      const dissolve = timeline?.reduced ? 0 : 1;
      faces.forEach((face) => {
        face.uniforms.uDissolve.value = dissolve;
      });

      /*
       * Dust runs only for a walk between faces, on the face being left and
       * the face being reached, and only for as long as it takes: the
       * dissolve's specks are gone early in the walk, and the arrival's do
       * not start until the viewer is nearly round.
       */
      faces.forEach((face) => face.dust.set(-1, -10, 0, 0, 0));
      if (timeline && !timeline.reduced && timeline.fromView !== timeline.toView) {
        const { fadeOutMs, orbitMs, fadeInMs } = timeline.timing;
        const elapsed = (now - timeline.startedAt) / 1000;
        const outTime = elapsed < fadeOutMs / 1000 + DUST_LIFE ? elapsed : -1;
        const inTime = elapsed - (fadeOutMs + orbitMs) / 1000;
        const arriving = inTime > -DUST_LEAD && inTime < fadeInMs / 1000 ? inTime : -10;
        const leaving = faces[timeline.fromView === 0 ? 0 : 1];
        const reaching = faces[timeline.toView === 0 ? 0 : 1];
        leaving.dust.set(outTime, -10, fadeOutMs / 1000, fadeInMs / 1000, visibility ** 3);
        reaching.dust.set(-1, arriving, fadeOutMs / 1000, fadeInMs / 1000, visibility ** 3);
      }
      applyVisibility();
    },

    orbit: () => orbit,

    setViewer: (position) => {
      viewer.copy(position);
      if (!root.visible) return;
      root.updateMatrixWorld();
      faces.forEach((face) => {
        face.group.getWorldPosition(faceCentre);
        faceNormal.set(0, 0, 1).transformDirection(face.group.matrixWorld);
        const alignment = toViewer.copy(position).sub(faceCentre).normalize().dot(faceNormal);
        // Full within about 60° of the face, gone by about 78°.
        const t = Math.min(1, Math.max(0, (alignment - 0.2) / 0.3));
        face.facing = t * t * (3 - 2 * t);
      });
      applyVisibility();
    },

    pivot: () => pivot,

    animating: (now) => {
      const timeline = getMonolithTimeline();
      return Boolean(timeline && !evaluateMonolith(timeline, now).settled);
    },

    resize: (width) => {
      viewport = sceneViewportForWidth(width);
      applyPlacement();
    },

    destroy: () => {
      destroyed = true;
      unsubscribe();
      disposeModel(root);
      disposeModel(mountains);
      ringMaterials.forEach((material) => material.dispose());
      ranges.forEach((range) => range.clear());
      geometries.forEach((geometry) => geometry.dispose());
      faces.forEach((face) => {
        face.dust.dispose();
        face.material.dispose();
        face.housing.dispose();
        face.texture?.dispose();
        face.light.dispose();
      });
      key.dispose();
      keyBehind.dispose();
      scene.remove(root, ...ranges, key, keyBehind);
    },
  };
}
