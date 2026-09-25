"use client";

import { useEffect, useImperativeHandle, useRef, type Ref, type RefObject } from "react";
import type { Object3D, Vector3 } from "three";

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
 * The entry sequence, in seconds from the click. The camera holds while the
 * cracks wake, sets off gently, gathers pace, drops a little and looks up as
 * the stone closes around it, goes through, and is gone into a brief dark.
 */
const SEQUENCE = {
  /** The camera leaves rest here; before it, only the stone changes. */
  depart: 0.25,
  /** The spreading front has reached most of the arch. */
  activated: 0.35,
  /** The camera reaches the end of its path, beyond the doorway. */
  arrive: 1.75,
  /** The dark of the threshold: in, then fully dark, then the hero. */
  darkFrom: 1.6,
  darkFull: 1.69,
  crossed: 1.75,
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

    let cancelled = false;
    let dispose = () => {};

    void (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const { createReflectiveFloor } = await import("@/webgl/modules/reflectiveFloor");
      const { createHorizonLights } = await import("@/webgl/modules/horizonLights");
      const { createHorizonAtmosphere } = await import("@/webgl/modules/horizonAtmosphere");
      const { applyWaterlineContact } = await import("@/webgl/modules/rocks");
      const { createCrackEnergy } = await import("@/webgl/modules/crackEnergy");
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
      scene.add(new THREE.HemisphereLight(0x3a3a3a, 0x0a0a0c, 1.2));
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
        e4.set(openingX, passHeight + 0.1, z - face * 4);
        const [t0, t1, t2, t3, t4] = aims.points as [Vector3, Vector3, Vector3, Vector3, Vector3];
        t0.copy(aim);
        t1.set(openingX, door.aimHeight + 0.05, z - face * 5);
        // Looking up into the arch at the closest approach, then levelling.
        t2.set(openingX, passHeight + 1.45, z - face * 6);
        t3.set(openingX, passHeight + 1.2, z - face * 9);
        t4.set(openingX, passHeight + 1.05, z - face * 14);
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
        renderer.render(scene, camera);
      }

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

        // Still, then a slow pull that keeps gathering pace to the threshold.
        const u = Math.min(
          1,
          Math.max(0, (clock - SEQUENCE.depart) / (SEQUENCE.arrive - SEQUENCE.depart)),
        );
        place(Math.pow(u, 1.6));
        shade.style.opacity = smooth(SEQUENCE.darkFrom, SEQUENCE.darkFull, clock).toFixed(3);
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
        if (hasCrossed && clock > SEQUENCE.crossed + 0.6) return;
        frame = window.requestAnimationFrame(animate);
      };

      enter.current = () => {
        if (entering) return;
        entering = true;
        clock = 0;
        // The flight starts exactly where the camera is, looking where it looks.
        composeEntry();
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

      new GLTFLoader().load(door.source, ({ scene: model }) => {
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
          });
        });

        doorway.add(model);
        loaded = model;
        element.dataset.doorwayReady = "";
        draw(0);
        if (!still) frame = window.requestAnimationFrame(animate);
      });

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
