import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
  type Intersection,
  type Object3D,
} from "three";
import { WebGPURenderer } from "three/webgpu";

import { createCollider } from "./collision";
import { ARRIVAL, cabinFov, RIFT_ARRIVAL, WORLD_CAPTURE } from "./worldCapture";
import { createExplorer } from "./explorer";
import { isInHall, isInRoom, ROOM } from "./paths";
import { buildScenery, groundHeight, type MarziaTheme } from "./scenery";
import { getStation, HALL, MARZIA, STATIONS, type Station, type StationId } from "./stations";

/** Which named place the visitor is nearest, for the keyboard list and MARZIA's toggle. */
export type CabinState = Readonly<{ current: StationId; travelling: boolean }>;

export type CabinWorld = Readonly<{
  goTo: (id: Station["id"]) => void;
  setMarziaTheme: (theme: MarziaTheme) => void;
  /** The on-screen stick, each axis −1…1: x turns (right +), y walks (forward +). */
  stick: (x: number, y: number) => void;
  /** Where the visitor faces (degrees from north, clockwise) and how fast they walk. */
  pose: () => Readonly<{ heading: number; speed: number }>;
  dispose: () => void;
}>;

type MountOptions = Readonly<{
  canvas: HTMLCanvasElement;
  onState: (state: CabinState) => void;
  onExit: () => void;
  /** MARZIA's theme, at start and whenever the sign changes it. */
  onMarziaTheme: (theme: MarziaTheme) => void;
  /** The browser dropped the GPU context while the cabin was open. */
  onLost: () => void;
  /**
   * How the visitor got here, if not by the front door.
   *
   * "rift": through the homepage's rift. The view starts where
   * the capture was taken (behind and above the arrival point), at the zoom
   * the bridge picture has drifted to by the first frame, and settles from
   * there into the arrival.
   *
   * "capture": development only. Holds that starting pose still, at the
   * capture's wide lens, for `npm run capture:my-world` to photograph.
   */
  arrival?: Readonly<{ kind: "rift"; zoom: () => number }> | Readonly<{ kind: "capture" }>;
  /** The first frame has been drawn. */
  onFirstFrame?: () => void;
}>;

/** Drags shorter than this are taps, not looks. */
const DRAG_SLOP = 4;
/** How far a visitor may wander: the clearing, both buildings and room round them. */
const CLEARING = { x: -1, z: -5, radius: 32 } as const;
/** How short of a clicked thing the walk stops, by what it is (metres). */
const STOP_SHORT: Readonly<Record<string, number>> = {
  marzia: 3.4,
  cabin: 2,
  hall: 2,
  prop: 2,
  tree: 2.2,
  ground: 0,
};

const kindOf = (object: Object3D | null): string | undefined => {
  for (let node = object; node; node = node.parent) {
    if (node.userData.kind) return node.userData.kind as string;
  }
  return undefined;
};

const isGlass = (object: Object3D | null) => {
  for (let node = object; node; node = node.parent) if (node.userData.glass) return true;
  return false;
};

/** Where to stand for a named place, and what to face there. */
function standingFor(station: Station) {
  if (station.mode === "orbit") {
    const angle = (station.azimuth * Math.PI) / 180;
    const position = new Vector3(
      station.target[0] + Math.sin(angle) * station.radius,
      0,
      station.target[2] + Math.cos(angle) * station.radius,
    );
    return { position, face: new Vector3(...station.target) };
  }
  return { position: new Vector3(...station.position), face: new Vector3(...station.target) };
}

export async function mountCabinWorld({
  canvas,
  onState,
  onExit,
  onMarziaTheme,
  onLost,
  arrival: entry,
  onFirstFrame,
}: MountOptions): Promise<CabinWorld> {
  const capture = entry?.kind === "capture";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The WebGL2 backend: the MARZIA canvas is copied to the GPU every frame,
  // and WebGL does that copy on a fast path WebGPU lacks in browsers today.
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: true });
  await renderer.init();
  // A context the browser takes away mid-visit; tearing down sets this aside.
  renderer.onDeviceLost = (info) => {
    console.warn("Cabin: the GPU context was lost", info.message);
    renderer.setAnimationLoop(null);
    onLost();
  };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const mobile = window.matchMedia("(pointer: coarse), (max-width: 767px)").matches;
  const world = await buildScenery({ mobile, maxAnisotropy: renderer.getMaxAnisotropy() });
  onMarziaTheme(world.marzia.theme);
  const camera = new PerspectiveCamera(56, 1, 0.08, 400);

  const arrival = getStation("arrival");
  // Through the rift (or for its capture), the visitor lands by the fire pit
  // facing the mountain: the view the rift showed. Otherwise, the clearing's edge.
  const throughRift = entry !== undefined;
  const explorer = createExplorer(camera, {
    start: throughRift
      ? new Vector3(...RIFT_ARRIVAL.position)
      : new Vector3(...(arrival.mode === "look" ? arrival.position : arrival.target)),
    lookAt: throughRift ? new Vector3(...RIFT_ARRIVAL.lookAt) : new Vector3(...arrival.target),
    heightAt: groundHeight,
    collider: createCollider(world.trees),
    reducedMotion,
    bounds: CLEARING,
  });

  // The nearest named place, so keyboard users and MARZIA's toggle know where we are.
  const standing = STATIONS.map((station) => ({
    id: station.id as StationId,
    ...standingFor(station),
  }));
  let lastState: CabinState | null = null;
  const publish = () => {
    const here = explorer.position;
    let current: StationId = "arrival";
    if (Math.hypot(here.x - MARZIA.centre[0], here.z - MARZIA.centre[2]) < 7.5) {
      current = "marzia";
    } else {
      let best = Infinity;
      for (const place of standing) {
        if (isInRoom(place.position.x, place.position.z) !== isInRoom(here.x, here.z)) continue;
        const distance = Math.hypot(place.position.x - here.x, place.position.z - here.z);
        if (distance < best) [current, best] = [place.id, distance];
      }
    }
    const next = { current, travelling: explorer.moving };
    if (lastState && lastState.current === next.current && lastState.travelling === next.travelling)
      return;
    lastState = next;
    onState(next);
  };

  // ---------------------------------------------------------------- size
  let lens = 56;
  const resize = () => {
    const parent = canvas.parentElement ?? canvas;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = capture ? WORLD_CAPTURE.aspect : width / Math.max(height, 1);
    // Narrow screens see more of the world rather than a sliver of it.
    lens = capture ? WORLD_CAPTURE.fov : cabinFov(camera.aspect);
    camera.fov = lens;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement ?? canvas);
  resize();

  // ---------------------------------------------------------------- where a click leads
  const raycaster = new Raycaster();
  const ndc = new Vector2();

  /** Walk towards what was clicked, stopping a natural distance short of it. */
  const walkToward = (hit: Intersection) => {
    const point = hit.point;
    const kind = kindOf(hit.object) ?? "ground";
    const insideHit = isInRoom(point.x, point.z) && point.y < 3;
    const shortBy = insideHit ? 1.1 : (STOP_SHORT[kind] ?? 1.5);
    const heading = new Vector3(point.x - camera.position.x, 0, point.z - camera.position.z);
    const distance = heading.length();
    if (distance < 1e-3) return;
    heading.divideScalar(distance);
    const target = new Vector3(point.x, 0, point.z).addScaledVector(
      heading,
      -Math.min(shortBy, distance * 0.6),
    );
    const outsideCabin = kind === "cabin" && !isInRoom(camera.position.x, camera.position.z);
    const outsideHall = kind === "hall" && !isInHall(camera.position.x, camera.position.z);
    if (outsideCabin || outsideHall) {
      // A building's wall or roof from outside means "in there": walk in by
      // its door and stop inside, near the part that was clicked.
      const room = outsideCabin ? ROOM : HALL;
      const margin = outsideCabin ? 0.9 : 1.6;
      target.x = Math.min(room.maxX - margin, Math.max(room.minX + margin, point.x));
      target.z = Math.min(room.maxZ - margin, Math.max(room.minZ + margin, point.z));
      explorer.walkTo(target, null);
      return;
    }
    if (insideHit) {
      // Something seen through a window or the door: end up in the room with it.
      target.x = Math.min(ROOM.maxX - 0.5, Math.max(ROOM.minX + 0.5, target.x));
      target.z = Math.min(ROOM.maxZ - 0.5, Math.max(ROOM.minZ + 0.5, target.z));
    }
    const face =
      kind === "marzia"
        ? new Vector3(MARZIA.centre[0], MARZIA.centre[1] + 1.1, MARZIA.centre[2])
        : kind === "ground"
          ? null
          : point.clone();
    explorer.walkTo(target, face);
  };

  /** A window means "in there" from outside and "out there" from inside. */
  const walkThroughWindow = (point: Vector3) => {
    const heading = new Vector3(
      point.x - camera.position.x,
      0,
      point.z - camera.position.z,
    ).normalize();
    const inside = isInRoom(camera.position.x, camera.position.z);
    const target = new Vector3(point.x, 0, point.z).addScaledVector(heading, inside ? 2.6 : 1.4);
    if (!inside) {
      target.x = Math.min(ROOM.maxX - 0.6, Math.max(ROOM.minX + 0.6, target.x));
      target.z = Math.min(ROOM.maxZ - 0.6, Math.max(ROOM.minZ + 0.6, target.z));
    }
    explorer.walkTo(target, target.clone().addScaledVector(heading, 5).setY(1.4));
  };

  const pickAndWalk = (x: number, y: number) => {
    ndc.set(x, y);
    raycaster.setFromCamera(ndc, camera);
    raycaster.far = 120;
    // The hall's glass is seen through: a click lands on what is behind it.
    const hit = raycaster
      .intersectObject(world.scene, true)
      .find((candidate) => !candidate.object.userData.hallGlass);
    if (!hit) return;
    if (isGlass(hit.object)) {
      walkThroughWindow(hit.point);
      return;
    }
    walkToward(hit);
  };

  // ---------------------------------------------------------------- input
  let pointer: { id: number; x: number; y: number; moved: number } | null = null;

  const deviceX = (event: PointerEvent, bounds: DOMRect) =>
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  const deviceY = (event: PointerEvent, bounds: DOMRect) =>
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.dragging = "true";
  };

  const onPointerMove = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    const x = deviceX(event, bounds);
    const y = deviceY(event, bounds);
    world.marzia.pointer(x, y, camera);
    canvas.dataset.overToggle = world.marzia.pickTheme(x, y, camera) ? "true" : "false";
    // A mouse steers the view by where it is; touch looks by dragging only.
    if (event.pointerType === "mouse" && !pointer) explorer.pointer(x, y);
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.moved += Math.abs(dx) + Math.abs(dy);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointer.moved > DRAG_SLOP) {
      explorer.pointerLeave();
      explorer.drag(dx, dy);
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const tapped = pointer.moved <= DRAG_SLOP;
    pointer = null;
    delete canvas.dataset.dragging;
    if (!tapped) return;
    const bounds = canvas.getBoundingClientRect();
    const x = deviceX(event, bounds);
    const y = deviceY(event, bounds);
    // The theme toggle on MARZIA's sign first; otherwise walk to what was clicked.
    const theme = world.marzia.pickTheme(x, y, camera);
    if (theme) {
      setMarziaTheme(theme);
      return;
    }
    pickAndWalk(x, y);
  };

  const onPointerLeave = () => {
    explorer.pointerLeave();
    world.marzia.pointerLeave();
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    explorer.wheel(event.deltaY);
  };

  const isTyping = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("input, textarea, [contenteditable]"));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onExit();
      return;
    }
    // Arrow keys on a focused button (the keyboard place list) stay with the button.
    if (event.target instanceof HTMLButtonElement && event.code.startsWith("Arrow")) return;
    if (explorer.key(event.code, true)) event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    explorer.key(event.code, false);
  };
  // Keys held while the window loses focus would otherwise keep walking.
  const onBlur = () => {
    explorer.stick(0, 0);
    for (const code of [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ]) {
      explorer.key(code, false);
    }
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  let frames = 0;
  // The arrival out of the rift: -1 once settled (or never begun).
  let descentAge = (entry?.kind === "rift" && !reducedMotion) || capture ? 0 : -1;
  let startZoom = 1;
  const loop = () => {
    const now = performance.now();
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    explorer.update(delta);
    if (descentAge >= 0) {
      if (frames === 0 && entry?.kind === "rift") startZoom = entry.zoom();
      // From the bridge picture's pose and zoom, easing into the arrival.
      const t = capture ? 0 : Math.min(1, descentAge / ARRIVAL.seconds);
      const remaining = 1 - t * t * t * (t * (t * 6 - 15) + 10);
      const yaw = camera.rotation.y;
      camera.position.x += Math.sin(yaw) * ARRIVAL.back * remaining;
      camera.position.z += Math.cos(yaw) * ARRIVAL.back * remaining;
      camera.position.y += ARRIVAL.rise * remaining;
      camera.rotation.x -= ARRIVAL.pitch * remaining;
      const zoom = 1 + (startZoom - 1) * remaining;
      camera.fov = (360 / Math.PI) * Math.atan(Math.tan((lens * Math.PI) / 360) / zoom);
      camera.updateProjectionMatrix();
      if (!capture) descentAge = remaining > 0 ? descentAge + delta : -1;
    }
    world.update(camera, now);
    publish();
    renderer.render(world.scene, camera);
    frames += 1;
    if (frames === 1) onFirstFrame?.();
    // The capture script waits for the world to have drawn a while.
    if (capture && frames === 90) canvas.dataset.captureReady = "true";
  };

  const onVisibility = () => {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
    } else {
      last = performance.now();
      renderer.setAnimationLoop(loop);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  renderer.setAnimationLoop(document.hidden ? null : loop);
  publish();

  // ---------------------------------------------------------------- api
  function setMarziaTheme(theme: MarziaTheme) {
    world.marzia.setTheme(theme);
    onMarziaTheme(theme);
  }

  return {
    goTo: (id) => {
      if (id === "spot") return;
      const place = standingFor(getStation(id));
      explorer.walkTo(place.position, place.face);
    },
    setMarziaTheme,
    stick: explorer.stick,
    pose: () => ({ heading: explorer.heading, speed: explorer.speed }),
    dispose: () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      world.dispose();
      // Disposing releases the WebGL context on purpose, which fires the
      // renderer's device-lost handler; that is not an error here.
      renderer.onDeviceLost = () => {};
      renderer.dispose();
    },
  };
}
