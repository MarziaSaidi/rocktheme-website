import {
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
  type Object3D,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";

import type { PassView, RenderPass } from "../renderPassChannel";

/**
 * The rift as it was made: two extra views of the real scene.
 *
 *   sketch  the rock's feature edges as moonlit lines over a dark fill, the
 *           water as a drafting grid
 *   engine  the rock's surface normals in the site palette, the water as
 *           depth contours
 *
 * Neither copies any geometry: each view is a mesh or line set sharing the
 * scene's own buffers, placed on the original's world matrix every frame.
 * Edges are built one mesh per frame, only once the bio is near.
 */

const MOON = new Color("#c4aaf0");
const LAVENDER = new Color("#b793d2");
const BOTANICAL = new Color("#a8c947");

/** Crease angle for feature lines; dense scans get a higher one. */
const EDGE_ANGLE = 34;
const EDGE_ANGLE_DENSE = 55;
const MAX_EDGE_VERTICES = 160_000;

const sketchFill = new MeshBasicMaterial({
  color: 0x0c0912,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const sketchLine = (opacity: number) =>
  new LineBasicMaterial({ color: MOON, transparent: true, opacity, depthWrite: false });

const normalsMaterial = new ShaderMaterial({
  uniforms: {
    uMoon: { value: MOON },
    uLavender: { value: LAVENDER },
    uBotanical: { value: BOTANICAL },
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vDepth;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uMoon, uLavender, uBotanical;
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vDepth;
    void main() {
      vec3 n = normalize(vNormal);
      // A normals pass in the site palette: each direction owns a colour.
      vec3 indigo = vec3(0.16, 0.12, 0.34);
      vec3 c = uLavender * max(n.x, 0.0) * 0.85
             + uBotanical * max(-n.x, 0.0) * 0.55
             + uMoon * max(n.y, 0.0) * 0.95
             + indigo * max(n.z, 0.0) * 1.1
             + vec3(0.05, 0.035, 0.09);
      c += uMoon * pow(1.0 - max(0.0, dot(n, vView)), 3.0) * 0.35;
      c += uMoon * smoothstep(0.92, 1.0, fract(vDepth * 0.5)) * 0.12;
      gl_FragColor = vec4(c * (0.18 + 0.82 * exp(-vDepth * 0.022)) * 0.85, 1.0);
    }`,
});

const waterMaterial = (mode: 0 | 1) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uMoon: { value: MOON }, uLavender: { value: LAVENDER }, uMode: { value: mode } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying float vDepth;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mv = viewMatrix * world;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uMoon, uLavender;
      uniform float uMode;
      varying vec3 vWorld;
      varying float vDepth;
      float line(float v, float w) {
        float d = abs(fract(v - 0.5) - 0.5) / fwidth(v);
        return 1.0 - min(d / w, 1.0);
      }
      void main() {
        float fade = exp(-vDepth * 0.03);
        if (uMode < 0.5) {
          // Drafting grid: a line every metre, a stronger one every five.
          float minor = max(line(vWorld.x, 0.6), line(vWorld.z, 0.6)) * 0.22;
          float major = max(line(vWorld.x / 5.0, 0.9), line(vWorld.z / 5.0, 0.9)) * 0.55;
          gl_FragColor = vec4(mix(uLavender, uMoon, major), max(minor, major) * fade * 0.8);
        } else {
          // Depth from the camera as contour bands, the way a depth pass reads.
          float bands = line(vDepth / 2.0, 0.8);
          vec3 c = mix(uMoon, uLavender, smoothstep(0.0, 60.0, vDepth));
          gl_FragColor = vec4(c * (0.06 + 0.5 * bands) * fade, 0.92);
        }
      }`,
  });

type Pair = { source: Object3D; views: Object3D[] };

export type RenderPasses = Readonly<{
  /** Builds one more mesh's views; cheap once everything is built. */
  prepare: () => void;
  ready: () => boolean;
  /**
   * Draws the frame through the passes: `light` draws the real scene and
   * whatever goes over it, and is called inside its own part of the screen.
   */
  draw: (
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    view: PassView,
    light: () => void,
  ) => void;
  /** The rift's main rock and the portal, for the annotations. */
  rock: () => Mesh | null;
  portal: () => Object3D | null;
  points: () => number;
  triangles: () => number;
  dispose: () => void;
}>;

const isVisible = (object: Object3D) => {
  for (let node: Object3D | null = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
};

const triangleCount = (geometry: BufferGeometry) =>
  (geometry.index ? geometry.index.count : geometry.attributes.position!.count) / 3;

export function createRenderPasses(
  world: Scene,
  options: Readonly<{ rift: Object3D; water: readonly Mesh[] }>,
): RenderPasses {
  const scenes: Record<Exclude<RenderPass, "light">, Scene> = {
    sketch: new Scene(),
    engine: new Scene(),
  };
  const pairs: Pair[] = [];
  const owned: { dispose: () => void }[] = [];
  let queue: Mesh[] | null = null;
  let built = false;
  let rock: Mesh | null = null;
  let points = 0;
  let triangles = 0;

  const place = <T extends Object3D>(view: T): T => {
    view.matrixAutoUpdate = false;
    // The pass scene must not recompute these from its own (identity) root.
    view.matrixWorldAutoUpdate = false;
    view.frustumCulled = false;
    return view;
  };

  const collect = () => {
    const found: Mesh[] = [];
    options.rift.traverse((object) => {
      const mesh = object as Mesh;
      // The floating stones are placed by their own vertex shader (frustumCulled
      // off); a plain copy would stand in the wrong place, so they sit this out.
      if (mesh.isMesh && mesh.material instanceof MeshStandardMaterial && mesh.frustumCulled)
        found.push(mesh);
    });
    // The mountain loads on its own; wait for it rather than build a pass without it.
    if (found.length === 0) return;
    queue = found;
    for (const water of options.water) {
      const grid = place(new Mesh(water.geometry, waterMaterial(0)));
      const depth = place(new Mesh(water.geometry, waterMaterial(1)));
      grid.renderOrder = depth.renderOrder = -1;
      owned.push(grid.material as ShaderMaterial, depth.material as ShaderMaterial);
      scenes.sketch.add(grid);
      scenes.engine.add(depth);
      pairs.push({ source: water, views: [grid, depth] });
    }
  };

  const buildOne = (source: Mesh) => {
    const geometry = source.geometry;
    const count = geometry.attributes.position!.count;
    points += count;
    triangles += triangleCount(geometry);
    if (!rock || count > rock.geometry.attributes.position!.count) rock = source;
    let edges = new EdgesGeometry(geometry, EDGE_ANGLE);
    if (edges.attributes.position!.count > MAX_EDGE_VERTICES) {
      edges.dispose();
      edges = new EdgesGeometry(geometry, EDGE_ANGLE_DENSE);
      edges.setDrawRange(0, MAX_EDGE_VERTICES);
    }
    const lines = sketchLine(0.62);
    owned.push(edges, lines);
    const fill = place(new Mesh(geometry, sketchFill));
    const outline = place(new LineSegments(edges, lines));
    const solid = place(new Mesh(geometry, normalsMaterial));
    scenes.sketch.add(fill, outline);
    scenes.engine.add(solid);
    pairs.push({ source, views: [fill, outline, solid] });
  };

  const prepare = () => {
    if (built) return;
    if (!queue) return collect();
    const next = queue.shift();
    if (next) buildOne(next);
    if (queue.length === 0) built = true;
  };

  const sync = () => {
    world.updateMatrixWorld();
    for (const { source, views } of pairs) {
      const visible = isVisible(source);
      for (const view of views) {
        view.visible = visible;
        view.matrixWorld.copy(source.matrixWorld);
      }
    }
  };

  const draw: RenderPasses["draw"] = (renderer, camera, view, light) => {
    if (!built) {
      // Asked for before it was prepared (a jump straight into the bio): finish now if
      // the mountain is in, otherwise keep showing the lit world.
      for (let guard = 0; !built && guard < 64; guard++) prepare();
      if (!built) return light();
    }
    const element = renderer.domElement;
    const width = element.clientWidth || window.innerWidth;
    const height = element.clientHeight || window.innerHeight;
    const span = view.vertical ? height : width;
    const at = Math.round(span * Math.min(1, Math.max(0, view.split)));
    let synced = false;
    const side = (pass: RenderPass, from: number, to: number) => {
      if (to - from <= 0) return;
      renderer.setScissorTest(true);
      if (view.vertical) renderer.setScissor(0, height - to, width, to - from);
      else renderer.setScissor(from, 0, to - from, height);
      if (pass === "light") light();
      else {
        if (!synced) sync();
        synced = true;
        renderer.render(scenes[pass], camera);
      }
      renderer.setScissorTest(false);
    };
    side(view.first, 0, at);
    side(view.second, at, span);
  };

  const portalObject = () => world.getObjectByName("rift-window") ?? null;

  return {
    prepare,
    ready: () => built,
    draw,
    rock: () => rock,
    portal: portalObject,
    points: () => points,
    triangles: () => triangles,
    dispose: () => {
      owned.forEach((item) => item.dispose());
      scenes.sketch.clear();
      scenes.engine.clear();
    },
  };
}

const projected = new Vector3();

/** A point on an object's bounds, offset in world units, in CSS pixels; null behind the camera. */
export function screenPoint(
  object: Object3D | null,
  camera: PerspectiveCamera,
  width: number,
  height: number,
  offset: readonly [number, number, number] = [0, 0, 0],
) {
  const geometry = (object as Mesh | null)?.geometry;
  if (!object || !geometry) return null;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  geometry.boundingBox!.getCenter(projected).applyMatrix4(object.matrixWorld);
  projected.x += offset[0];
  projected.y += offset[1];
  projected.z += offset[2];
  projected.project(camera);
  if (projected.z > 1) return null;
  return { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height };
}
