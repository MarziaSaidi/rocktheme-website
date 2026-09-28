"use client";

import { useEffect, useImperativeHandle, useRef, type Ref, type RefObject } from "react";
import type { Object3D, Vector3 } from "three";

import { TRANSITION_PEAK } from "@/sound/soundConfig";
import { emitSoundEvent } from "@/sound/soundEvents";
import { markDoorwayStanding } from "@/webgl/entryChannel";
import {
  environmentLightingConfig,
  introAtmosphereConfig,
  introDoorwayConfig as door,
  introLightConfig,
} from "@/webgl/sceneConfig";

import styles from "./SiteEntry.module.css";

export type IntroDoorwayHandle = Readonly<{
  /** Runs the entry: the cracks wake, the camera goes through the doorway. */
  enter: () => void;
}>;

type IntroDoorwayProps = Readonly<{
  ref?: Ref<IntroDoorwayHandle>;
  /** The gate: wheel, touch and arrow keys on it walk the camera around the doorway. */
  surface: RefObject<HTMLElement | null>;
  /** The camera has crossed the threshold; the hero may be revealed. */
  onCrossed: () => void;
}>;

/*
 * The entry sequence, in seconds from the click. The light runs through the
 * joints and the doorway breaks into its stones; the camera goes on through
 * them while they gather into a ring facing it; a spinning passage of light
 * opens inside the ring. The camera pushes in until the ring has passed out
 * of every edge of the screen, and only then does the light burst outward
 * and the page show through.
 */
const SEQUENCE = {
  /** The pieces let go, from the keystone down. */
  release: 0.15,
  /** The camera sets off through the breaking doorway. */
  depart: 0.2,
  /** The pieces begin to gather into the ring. */
  gather: 1.2,
  /** The camera stands beyond the doorway, the ring before it. */
  arrive: 2.7,
  /** The passage opens inside the ring. */
  vortex: 3.0,
  /** It has filled the ring. */
  vortexOpen: 3.8,
  /** The camera begins to push into the ring. */
  pushFrom: 3.4,
  /** The ring is past every edge of the screen: the light bursts. */
  boom: 6.0,
  /** How long the burst runs. */
  boomLength: 0.9,
  /** The gate may go: the page shows through the last of the burst. */
  crossed: 6.3,
} as const;

/** The share of the ring's radius inside its stones, where the passage may reach. */
const RING_INNER = 0.84;

/** The ring: how far before the camera it stands, and how much of the frame it spans. */
const RING = {
  distance: 10,
  fill: 0.7,
  spin: 0.35,
  /** Clearance between the ring's lowest stone and the water. */
  clearance: 0.9,
} as const;

/** Reduced motion: the cracks wake, a short dark, the hero. No flight. */
const STILL_SEQUENCE = { darkFrom: 0.4, darkFull: 0.6, crossed: 0.62 } as const;

/*
 * Exploring before entry: the camera walks a full circle around the doorway.
 * Scrolling down carries it one way round, scrolling up the other; there is
 * no end in either direction.
 */
const EXPLORE = {
  /** Where the walk starts, in degrees: square to the opening. */
  startAngle: 0,
  /** Wheel pixels for one full circle. */
  pixelsPerTurn: 3200,
  /** Touch travels further per pixel than the wheel: a swipe is short. */
  touchGain: 2.2,
  /** Wheel pixels per arrow-key press. */
  keyStep: 120,
  /** Extra distance side-on: closest square to the opening, from either face. */
  sideRecede: 0.1,
  /** Extra height side-on: lowest, so tallest, square to the opening. */
  sideRise: 0.4,
  /** How far past the doorway the camera aims, so it looks into the opening. */
  aimBeyond: 1.5,
  /** Rates, per second, at which the camera and its aim catch up with the scroll. */
  follow: 5.5,
  aimFollow: 8,
} as const;

/**
 * The ring's size against the frame's height. On a tall, narrow screen a ring
 * fitted to the width is too small to read as a circle, so it is allowed to
 * run a little past the sides.
 */
const ringSpan = (aspect: number) => Math.min(1, Math.max(aspect, 0.78));

/** Height of the supplied model in its own units. */
const MODEL_HEIGHT = 0.98187;
/** Width of the model at its base rocks, in its own units. */
const MODEL_WIDTH = 0.94763;

/**
 * The entry gate's scene: the stone doorway standing in the site's water.
 *
 * The water, beacons and horizon air are the site's own modules, mounted here
 * rather than reimplemented. The doorway never moves. Everything that moves
 * on entry is the camera, which is flown through the doorway's opening along
 * a curve composed once per layout; the frame loop only samples it.
 */
export function IntroDoorway({ ref, surface, onCrossed }: IntroDoorwayProps) {
  const host = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const crossed = useRef(onCrossed);
  // Until the scene exists, entering simply crosses.
  const enter = useRef<() => void>(() => crossed.current());

  useEffect(() => {
    crossed.current = onCrossed;
  }, [onCrossed]);

  useImperativeHandle(ref, () => ({ enter: () => enter.current() }), []);

  useEffect(() => {
    const element = host.current;
    const dark = veil.current;
    if (!element || !dark) return;
    const shade: HTMLDivElement = dark;
    const view: HTMLDivElement = element;

    let cancelled = false;
    let dispose = () => {};

    // The doorway is the first thing seen: its bytes start downloading now,
    // alongside the code that will draw it, not after it.
    const modelBytes = fetch(door.source).then((response) => {
      if (!response.ok) throw new Error(`doorway model: ${response.status}`);
      return response.arrayBuffer();
    });
    modelBytes.catch(() => markDoorwayStanding());

    void (async () => {
      const [
        THREE,
        { GLTFLoader },
        { MeshoptDecoder },
        { createReflectiveFloor },
        { createHorizonLights },
        { createHorizonAtmosphere },
        { applyWaterlineContact },
        { createCrackEnergy },
        { createDoorwayShatter },
        { createEntryVortex },
      ] = await Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/libs/meshopt_decoder.module.js"),
        import("@/webgl/modules/reflectiveFloor"),
        import("@/webgl/modules/horizonLights"),
        import("@/webgl/modules/horizonAtmosphere"),
        import("@/webgl/modules/rocks"),
        import("@/webgl/modules/crackEnergy"),
        import("@/webgl/modules/doorwayShatter"),
        import("@/webgl/modules/entryVortex"),
      ]);
      if (cancelled) return;

      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
      } catch {
        // No WebGL: the gate is the sky and the two choices, and entering crosses.
        markDoorwayStanding();
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      element.append(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(
        0x100b18,
        environmentLightingConfig.fogNear,
        environmentLightingConfig.fogFar,
      );

      const camera = new THREE.PerspectiveCamera(door.fov, 1, 0.05, 420);

      /*
       * Charcoal stone. Neutral light only: the violet belongs to the cracks,
       * and a coloured key would tint the whole doorway.
       */
      const sky = new THREE.HemisphereLight(0x3a3a3a, 0x0a0a0c, 1.2);
      scene.add(sky);
      const key = new THREE.DirectionalLight(0xd5dad4, 2.2);
      key.position.set(-6, 7, 8);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xa3a3a0, 0.5);
      fill.position.set(7, 3, 6);
      scene.add(fill);
      // The walk goes all the way round: a weak neutral key on the back faces.
      const back = new THREE.DirectionalLight(0xc4c8c2, 1.3);
      back.position.set(5, 7, -22);
      scene.add(back);
      const rim = new THREE.DirectionalLight(0x9b82bd, 0.3);
      rim.position.set(7, 1.2, -24);
      scene.add(rim);
      // The stone is drawn in a pass of its own while the window is open (layer 1).
      [sky, key, fill, back, rim].forEach((light) => light.layers.enableAll());

      const floor = createReflectiveFloor({
        width: 160,
        depth: 140,
        reflectionSize: 512,
        maxRipples: 2,
        reducedMotion: still,
      });
      scene.add(floor.mesh);

      const lights = createHorizonLights(scene, camera, still, introLightConfig);
      const atmosphere = createHorizonAtmosphere(scene, camera, still, introAtmosphereConfig);

      // ------------------------------------------------------------ doorway
      const scale = door.height / MODEL_HEIGHT;
      const doorway = new THREE.Group();
      // Square to the camera, its base rocks under the surface.
      doorway.position.set(0, -door.sink, door.z);
      scene.add(doorway);

      const energy = createCrackEnergy({ radius: 0.7 });
      const { uniforms } = energy;
      // In the model's own units: the keystone, and the middle of the opening.
      const shatter = createDoorwayShatter({
        crown: new THREE.Vector3(door.opening.x, door.opening.head + 0.1, 0),
        opening: new THREE.Vector2(door.opening.x, (door.opening.floor + door.opening.head) / 2),
      });

      const vortex = createEntryVortex();
      /*
       * While the ring forms, the water and the sky go dark behind it: a
       * veil drawn over everything but the stones.
       */
      const dimMaterial = new THREE.ShaderMaterial({
        uniforms: { uDim: { value: 0 } },
        vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader:
          "uniform float uDim; void main() { gl_FragColor = vec4(0.02, 0.012, 0.03, uDim); }",
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      const dimScene = new THREE.Scene();
      dimScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dimMaterial));
      const flatCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      /** The ring in the world, composed when the flight is. */
      const ring = {
        centre: new THREE.Vector3(),
        direction: new THREE.Vector3(),
        radius: 1,
      };
      let stoneMesh: InstanceType<typeof THREE.Mesh> | null = null;
      const local = new THREE.Vector3();
      const projected = new THREE.Vector3();

      const doorCentre = new THREE.Vector3(0, door.height * 0.45 - door.sink, door.z);
      uniforms.uPoint.value.copy(doorCentre).setY(-100);
      let loaded: Object3D | null = null;

      // --------------------------------------------------------- the camera
      const openingX = door.opening.x * scale;
      const openingFloor = door.opening.floor * scale - door.sink;
      // The passage height: well clear of the step, well under the arch.
      const passHeight = Math.max(openingFloor + 0.62, 1.12);
      const eyes = new THREE.CatmullRomCurve3(
        Array.from({ length: 5 }, () => new THREE.Vector3()),
        false,
        "centripetal",
      );
      const aims = new THREE.CatmullRomCurve3(
        Array.from({ length: 5 }, () => new THREE.Vector3()),
        false,
        "centripetal",
      );
      const eye = new THREE.Vector3();
      const aim = new THREE.Vector3();

      /*
       * The circle's radius for this viewport: far enough back to hold the
       * base rocks in frame on a narrow screen.
       */
      let distance: number = door.distance;
      const layout = (width: number, height: number) => {
        const halfTan = Math.tan(THREE.MathUtils.degToRad(door.fov / 2));
        const fit = (MODEL_WIDTH * scale) / door.narrowFill / (2 * halfTan * (width / height));
        distance = Math.max(door.distance, fit);
      };

      /*
       * One point on the circle around the opening; angle 0 is square to its
       * front, π square to its back. The radius and height grow side-on, so
       * facing either side of the opening is a slight push in.
       */
      const orbit = (angle: number, outEye: Vector3, outAim: Vector3) => {
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        const side = sin * sin;
        const radius = distance * (1 + EXPLORE.sideRecede * side);
        outEye.set(
          openingX + sin * radius,
          door.eyeHeight + EXPLORE.sideRise * side,
          door.z + cos * radius,
        );
        // Through the opening from wherever the camera stands.
        outAim.set(
          openingX - sin * EXPLORE.aimBeyond,
          door.aimHeight,
          door.z - cos * EXPLORE.aimBeyond,
        );
      };

      /*
       * The flight through, from wherever the camera is when a choice is
       * made: it curves round onto the doorway's axis on the side it is
       * already on, then runs straight through. From behind, it goes through
       * the back; it never cuts through the stone to reach the front.
       */
      const composeEntry = () => {
        const z = door.z;
        const face = camera.position.z >= z ? 1 : -1;
        const [e0, e1, e2, e3, e4] = eyes.points as [Vector3, Vector3, Vector3, Vector3, Vector3];
        e0.copy(camera.position);
        e1.set(e0.x * 0.25 + openingX * 0.75, door.eyeHeight - 0.1, z + face * distance * 0.45);
        // Lower as the stone closes in, so the doorway towers.
        e2.set(openingX, passHeight + 0.06, z + face * 2.1);
        e3.set(openingX, passHeight, z - face * 0.9);
        /*
         * Beyond the doorway the camera rises, so the whole ring stands clear
         * of the water; below it the rock is cut away at the surface.
         */
        const ringRadius =
          RING.fill *
          RING.distance *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
          ringSpan(camera.aspect);
        const endHeight = Math.max(passHeight + 0.1, ringRadius + RING.clearance);
        e4.set(openingX, endHeight, z - face * 4);
        const [t0, t1, t2, t3, t4] = aims.points as [Vector3, Vector3, Vector3, Vector3, Vector3];
        t0.copy(aim);
        t1.set(openingX, door.aimHeight + 0.05, z - face * 5);
        // Level through the opening: the horizon holds still as the stone parts.
        t2.set(openingX, passHeight + 0.55, z - face * 6);
        t3.set(openingX, passHeight + 0.45, z - face * 9);
        t4.set(openingX, endHeight, z - face * 14);
        eyes.updateArcLengths();
        aims.updateArcLengths();
      };

      // ---------------------------------------------------------- exploring
      /*
       * `targetAngle` is where the input has asked the camera to be; the
       * camera eases after it. Neither is ever wrapped or clamped, so the
       * walk goes on round in either direction. Reduced motion holds the
       * front view.
       */
      let targetAngle = still ? 0 : THREE.MathUtils.degToRad(EXPLORE.startAngle);
      let currentAngle = targetAngle;
      const wantedAim = new THREE.Vector3();
      const radiansPerPixel = (Math.PI * 2) / EXPLORE.pixelsPerTurn;
      const turn = (pixels: number) => {
        if (still || entering) return;
        targetAngle += pixels * radiansPerPixel;
      };

      const gate = surface.current;
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
        turn((event.deltaY + event.deltaX) * unit);
      };
      let touchY: number | null = null;
      const onTouchStart = (event: TouchEvent) => {
        touchY = event.touches[0]?.clientY ?? null;
      };
      const onTouchMove = (event: TouchEvent) => {
        const y = event.touches[0]?.clientY;
        if (y === undefined || touchY === null) return;
        event.preventDefault();
        turn((touchY - y) * EXPLORE.touchGain);
        touchY = y;
      };
      const keySteps: Readonly<Record<string, number>> = {
        ArrowDown: 1,
        ArrowRight: 1,
        PageDown: 4,
        ArrowUp: -1,
        ArrowLeft: -1,
        PageUp: -4,
      };
      const onKey = (event: KeyboardEvent) => {
        const steps = keySteps[event.key];
        if (!steps) return;
        event.preventDefault();
        turn(steps * EXPLORE.keyStep);
      };
      gate?.addEventListener("wheel", onWheel, { passive: false });
      gate?.addEventListener("touchstart", onTouchStart, { passive: true });
      gate?.addEventListener("touchmove", onTouchMove, { passive: false });
      gate?.addEventListener("keydown", onKey);

      /** Carries the camera toward the asked-for point on the circle, with a little inertia. */
      const explore = (deltaSeconds: number) => {
        const snap = deltaSeconds === 0;
        currentAngle = snap
          ? targetAngle
          : THREE.MathUtils.lerp(
              currentAngle,
              targetAngle,
              1 - Math.exp(-deltaSeconds * EXPLORE.follow),
            );
        orbit(currentAngle, eye, wantedAim);
        if (snap) aim.copy(wantedAim);
        else aim.lerp(wantedAim, 1 - Math.exp(-deltaSeconds * EXPLORE.aimFollow));
        camera.position.copy(eye);
        camera.lookAt(aim);
      };

      /** Places the camera `s` (0 to 1) of the way along the path by distance. */
      const place = (s: number) => {
        const t = eyes.getUtoTmapping(Math.min(1, Math.max(0, s)), 0);
        eyes.getPoint(t, eye);
        aims.getPoint(t, aim);
        camera.position.copy(eye);
        camera.lookAt(aim);
      };

      // ------------------------------------------------------- the pointer
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      /*
       * The pointer is carried onto a plane through the doorway's axis,
       * turned to face the camera, so it lands on the stone from any side.
       */
      const doorPlane = new THREE.Plane();
      const doorAxis = new THREE.Vector3(openingX, 0, door.z);
      const viewAxis = uniforms.uViewAxis.value;
      const hit = new THREE.Vector3();
      let pointerInside = false;
      let presence = 0;
      let pointerSeen = false;

      const onPointer = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect();
        ndc.set(
          ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
          -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
        );
        pointerInside = true;
        pointerSeen = true;
      };
      const onLeave = () => {
        pointerInside = false;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("pointerdown", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);

      // ---------------------------------------------------------- sequence
      let entering = false;
      let clock = 0;
      let hasCrossed = false;

      const cross = () => {
        if (hasCrossed) return;
        hasCrossed = true;
        crossed.current();
      };

      // ---------------------------------------------------------- the loop
      let frame = 0;
      let last = 0;
      let elapsed = 0;

      function draw(deltaSeconds: number) {
        lights.update(deltaSeconds, elapsed);
        atmosphere.update(elapsed);
        atmosphere.setIllumination(lights.illumination());
        floor.setBeacons(lights.beacons());
        floor.update(deltaSeconds, elapsed);
        // The water mirrors the doorway through the landscape's planar pass.
        floor.renderReflection(renderer, scene, camera, [floor.mesh, lights.group]);
        renderer.clear();
        const dim = dimMaterial.uniforms.uDim!.value as number;
        if (dim <= 0) {
          renderer.render(scene, camera);
        } else {
          // Water and sky, then the dark over them, then the stones on top.
          doorway.visible = false;
          renderer.render(scene, camera);
          doorway.visible = true;
          renderer.render(dimScene, flatCamera);
          camera.layers.set(1);
          renderer.render(scene, camera);
          camera.layers.enableAll();
        }
        vortex.render(renderer, view.clientHeight);
      }

      /** Places the ring in the mesh's own space, where the pieces are moved. */
      const placeRing = () => {
        if (!stoneMesh) return;
        stoneMesh.updateWorldMatrix(true, false);
        const scaleNow = stoneMesh.getWorldScale(local).x;
        shatter.uniforms.uRingCentre.value.copy(stoneMesh.worldToLocal(local.copy(ring.centre)));
        shatter.uniforms.uRingRadius.value = ring.radius / scaleNow;
        // A narrow screen makes a small ring: smaller pieces keep it a circle.
        shatter.uniforms.uRingPieceSize.value = THREE.MathUtils.lerp(
          0.3,
          0.55,
          THREE.MathUtils.clamp((camera.aspect - 0.45) / 0.9, 0, 1),
        );
      };

      const smooth = (edge0: number, edge1: number, value: number) =>
        THREE.MathUtils.smoothstep(value, edge0, edge1);

      function step(deltaSeconds: number) {
        const follow = 1 - Math.exp(-deltaSeconds * 9);

        // The pointer, carried onto the doorway's plane and followed smoothly.
        if (pointerSeen && !entering) {
          viewAxis.set(camera.position.x - doorAxis.x, 0, camera.position.z - doorAxis.z);
          if (viewAxis.lengthSq() > 1e-6) viewAxis.normalize();
          doorPlane.setFromNormalAndCoplanarPoint(viewAxis, doorAxis);
          raycaster.setFromCamera(ndc, camera);
          if (raycaster.ray.intersectPlane(doorPlane, hit)) {
            if (uniforms.uPoint.value.y < -50) uniforms.uPoint.value.copy(hit);
            uniforms.uPoint.value.lerp(hit, follow);
          }
        }
        const wanted = entering ? 1 : pointerInside && !still ? 1 : 0;
        presence += (wanted - presence) * (1 - Math.exp(-deltaSeconds * 4));
        uniforms.uPresence.value = presence;

        if (!entering) {
          explore(deltaSeconds);
          return;
        }

        clock += deltaSeconds;

        // The front: out from its origin through the whole arch.
        uniforms.uEnergy.value = smooth(0, 0.22, clock) * (still ? 1 - smooth(0.4, 0.6, clock) : 1);
        uniforms.uSpread.value = 14 * (1 - Math.pow(1 - Math.min(1, clock / 0.9), 2.4));

        if (still) {
          // A short step toward the doorway, not the flight.
          place(0.1 * smooth(0, 0.6, clock));
          shade.style.opacity = smooth(
            STILL_SEQUENCE.darkFrom,
            STILL_SEQUENCE.darkFull,
            clock,
          ).toFixed(3);
          if (clock >= STILL_SEQUENCE.crossed) cross();
          return;
        }

        // The transition is started so its bloom lands on the burst.
        const passageCue = SEQUENCE.boom - TRANSITION_PEAK;
        if (clock - deltaSeconds < passageCue && clock >= passageCue) {
          emitSoundEvent("entry:passage");
        }

        shatter.uniforms.uBreak.value = clock - SEQUENCE.release;
        shatter.uniforms.uGather.value = clock - SEQUENCE.gather;
        shatter.uniforms.uRingSpin.value =
          Math.max(0, clock - SEQUENCE.gather) * RING.spin +
          Math.pow(Math.max(0, clock - SEQUENCE.vortex), 2) * 0.12;
        shatter.uniforms.uRingGlow.value =
          smooth(SEQUENCE.gather + 0.8, SEQUENCE.vortex, clock) * 0.6 +
          smooth(SEQUENCE.vortex, SEQUENCE.vortexOpen + 0.4, clock) * 0.9;
        // The joints burn brighter once the passage is open.
        uniforms.uEnergy.value =
          smooth(0, 0.22, clock) *
          (1 + 0.9 * smooth(SEQUENCE.gather, SEQUENCE.vortex + 0.6, clock));
        uniforms.uSpread.value = Math.max(uniforms.uSpread.value, 14 * smooth(0, 0.9, clock));

        // Through the breaking doorway to the ring's stand, eased at both ends.
        const u = Math.min(
          1,
          Math.max(0, (clock - SEQUENCE.depart) / (SEQUENCE.arrive - SEQUENCE.depart)),
        );
        place(u * u * u * (u * (u * 6 - 15) + 10));

        /*
         * Then the push into the ring, as far as this screen needs for the
         * ring's inner edge to pass out past its corners: further on a wide
         * desktop than on a phone.
         */
        const width = view.clientWidth;
        const height = view.clientHeight;
        const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const pxPerUnitAt = (distance: number) => height / 2 / (distance * halfTan);
        const corner = Math.hypot(width, height) / 2;
        const clearAt = (ring.radius * RING_INNER * pxPerUnitAt(1)) / (corner * 1.12);
        const pushLength = Math.min(RING.distance * 0.9, Math.max(0, RING.distance - clearAt));
        const p = Math.min(
          1,
          Math.max(0, (clock - SEQUENCE.pushFrom) / (SEQUENCE.boom - SEQUENCE.pushFrom)),
        );
        const push = pushLength * (p * p * (3 - 2 * p));
        camera.position.addScaledVector(ring.direction, push);
        camera.updateMatrixWorld();

        dimMaterial.uniforms.uDim!.value = smooth(0.7, 2.6, clock) * 0.94;

        // The passage: on the ring's centre, and never past its inner edge.
        projected.copy(ring.centre).project(camera);
        const ringPx = ring.radius * pxPerUnitAt(RING.distance - push);
        const open = smooth(SEQUENCE.vortex, SEQUENCE.vortexOpen, clock);
        vortex.set({
          x: (projected.x * 0.5 + 0.5) * width,
          y: (-projected.y * 0.5 + 0.5) * height,
          radius: clock < SEQUENCE.vortex ? 0 : ringPx * RING_INNER * open,
          boom: Math.min(1, Math.max(0, (clock - SEQUENCE.boom) / SEQUENCE.boomLength)),
          time: clock,
        });
        if (clock >= SEQUENCE.crossed) cross();
      }

      const animate = (time: number) => {
        if (cancelled) return;
        const deltaSeconds = last === 0 ? 1 / 60 : Math.min(0.05, (time - last) / 1000);
        last = time;
        elapsed += deltaSeconds;
        step(deltaSeconds);
        draw(deltaSeconds);
        if (still && !entering) return;
        // Held until the page has shown through the end of the burst.
        if (hasCrossed && clock > SEQUENCE.crossed + 1.2) return;
        frame = window.requestAnimationFrame(animate);
      };

      enter.current = () => {
        if (entering) return;
        entering = true;
        clock = 0;
        // The flight starts exactly where the camera is, looking where it looks.
        composeEntry();
        // The ring stands before the flight's end, square to its gaze.
        const [, , , , endEye] = eyes.points as Vector3[];
        const [, , , , endAim] = aims.points as Vector3[];
        ring.direction.subVectors(endAim!, endEye!).normalize();
        ring.centre.copy(endEye!).addScaledVector(ring.direction, RING.distance);
        const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        ring.radius = RING.fill * RING.distance * halfTan * ringSpan(camera.aspect);
        placeRing();
        // The front sets off from wherever the light already is, kept on the stone.
        const origin = uniforms.uSpreadOrigin.value;
        if (presence > 0.2) {
          origin.copy(uniforms.uPoint.value);
          // Within the doorway's reach of its axis, and on its height.
          const reachX = origin.x - doorAxis.x;
          const reachZ = origin.z - doorAxis.z;
          const reach = Math.hypot(reachX, reachZ);
          if (reach > 2.6) {
            origin.x = doorAxis.x + (reachX / reach) * 2.6;
            origin.z = doorAxis.z + (reachZ / reach) * 2.6;
          }
          origin.y = Math.min(door.height - 1, Math.max(0.4, origin.y));
        } else {
          origin.copy(doorCentre);
        }
        // Without the stone there is nothing to fly through: a short dark.
        if (!loaded) {
          shade.style.opacity = "1";
          window.setTimeout(cross, 220);
          return;
        }
        if (still) frame = window.requestAnimationFrame(animate);
      };

      const resize = () => {
        const width = Math.max(element.clientWidth, 1);
        const height = Math.max(element.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        layout(width, height);
        lights.resize(camera);
        atmosphere.resize(camera);
        if (!entering) explore(0);
        draw(0);
      };

      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();

      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const onModel = ({ scene: model }: { scene: Object3D }) => {
        if (cancelled) return;
        const bounds = new THREE.Box3().setFromObject(model);
        const centre = bounds.getCenter(new THREE.Vector3());
        // Scaled uniformly and stood on its base; the group puts it in the water.
        model.scale.setScalar(scale);
        model.position.set(-centre.x * scale, -bounds.min.y * scale, -centre.z * scale);

        model.traverse((item) => {
          if (!(item instanceof THREE.Mesh)) return;
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.forEach((material) => {
            if (!(material instanceof THREE.MeshStandardMaterial)) return;
            material.metalness = 0.02;
            material.roughness = Math.max(0.9, material.roughness);
            // Wet and dark at the waterline, cut at the surface, as every rock is.
            applyWaterlineContact(material);
            energy.apply(material);
            shatter.apply(material);
          });
          // Moved stones leave the mesh's bounds; it is never culled.
          item.frustumCulled = false;
          stoneMesh = item;
          item.layers.enable(1);
        });

        doorway.add(model);
        loaded = model;
        element.dataset.doorwayReady = "";
        markDoorwayStanding();
        draw(0);
        if (!still) frame = window.requestAnimationFrame(animate);
      };
      void modelBytes
        .then((bytes) => loader.parseAsync(bytes, ""))
        .then(onModel)
        .catch(() => markDoorwayStanding());

      dispose = () => {
        observer.disconnect();
        window.cancelAnimationFrame(frame);
        gate?.removeEventListener("wheel", onWheel);
        gate?.removeEventListener("touchstart", onTouchStart);
        gate?.removeEventListener("touchmove", onTouchMove);
        gate?.removeEventListener("keydown", onKey);
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("pointerdown", onPointer);
        document.documentElement.removeEventListener("pointerleave", onLeave);
        loaded?.traverse((item) => {
          if (!(item instanceof THREE.Mesh)) return;
          item.geometry.dispose();
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.forEach((material) => {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.map?.dispose();
              material.normalMap?.dispose();
              material.roughnessMap?.dispose();
            }
            material.dispose();
          });
        });
        vortex.dispose();
        dimMaterial.dispose();
        atmosphere.destroy();
        lights.destroy();
        floor.destroy();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    })();

    return () => {
      cancelled = true;
      enter.current = () => crossed.current();
      dispose();
    };
    // The surface is a ref object: stable for the life of the gate.
  }, [surface]);

  return (
    <>
      <div className={styles.doorway} ref={host} aria-hidden="true" />
      <div className={styles.veil} ref={veil} aria-hidden="true" />
    </>
  );
}
