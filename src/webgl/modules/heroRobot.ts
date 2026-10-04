import {
  Bone,
  Box3,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const ROBOT_PARTS = [
  "head",
  "torso",
  "arm-left-upper",
  "arm-left-lower",
  "arm-right-upper",
  "arm-right-lower",
  "leg-right",
  "leg-left",
] as const;
export type RobotPart = (typeof ROBOT_PARTS)[number];
export type RobotInput = Readonly<{
  x: number;
  y: number;
  active: boolean;
  reducedMotion: boolean;
  paused: boolean;
  greeting: number;
}>;
export type HeroRobot = Readonly<{
  group: Group;
  update: (delta: number, input: RobotInput) => void;
  disposeSkeletons: () => void;
}>;

/** Dispose failed/late downloads too; the scene owns successful models. */
export function disposeRobotModel(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (material instanceof MeshStandardMaterial) {
        new Set([
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.metalnessMap,
        ]).forEach((texture) => texture?.dispose());
      }
      material.dispose();
    });
  });
}

/** All source parts are independent, upright exports, with their front at +Z. */
function fit(model: Object3D, height: number, origin: readonly [number, number, number]) {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error("Invalid robot part bounds");
  const scale = height / size.y;
  model.scale.setScalar(scale);
  model.position.set(
    -(bounds.min.x + size.x * origin[0]) * scale,
    -(bounds.min.y + size.y * origin[1]) * scale,
    -(bounds.min.z + size.z * origin[2]) * scale,
  );
}

/** Two bones bend each one-piece leg at its mechanical knee. */
function leg(model: Group, x: number, skeletons: Skeleton[]) {
  // Source coordinates are retained for skin binding, then the whole leg is scaled.
  const source = model.children[0];
  if (!(source instanceof Mesh)) throw new Error("Robot leg must contain one mesh");
  const geometry = source.geometry;
  const positions = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const height = bounds.max.y - bounds.min.y;
  const hipY = bounds.min.y + height * 0.96;
  const kneeY = bounds.min.y + height * 0.53;
  const indices: number[] = [],
    weights: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const blend = Math.max(0, Math.min(1, (positions.getY(i) - kneeY) / (height * 0.07) + 0.5));
    const weight = blend * blend * (3 - 2 * blend);
    indices.push(0, 1, 0, 0);
    weights.push(weight, 1 - weight, 0, 0);
  }
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  const hip = new Bone();
  hip.position.set(0, hipY, 0);
  const knee = new Bone();
  knee.position.y = kneeY - hipY;
  hip.add(knee);
  const mesh = new SkinnedMesh(geometry, source.material);
  mesh.add(hip);
  mesh.bind(new Skeleton([hip, knee]));
  // Animated bounds vary with the knee; this small mesh is gated by hero presence.
  mesh.frustumCulled = false;
  skeletons.push(mesh.skeleton);
  model.remove(source);
  model.add(mesh);
  const scale = 0.45 / height;
  model.scale.setScalar(scale);
  model.position.set(0, -hipY * scale, 0);
  const pivot = new Group();
  pivot.position.set(x, 0.075, 0.015);
  pivot.add(model);
  hip.rotation.x = -1.36;
  knee.rotation.x = 1.48;
  return { pivot, hip, knee };
}

export function assembleHeroRobot(parts: Record<RobotPart, Group>): HeroRobot {
  const group = new Group();
  group.name = "articulated-hero-robot";
  const torso = new Group();
  torso.name = "robot-torso";
  group.add(torso);
  fit(parts.torso, 0.34, [0.5, 0, 0.5]);
  torso.add(parts.torso);
  const head = new Group();
  head.name = "robot-head";
  head.position.set(0, 0.29, 0.018);
  torso.add(head);
  fit(parts.head, 0.49, [0.5, 0.035, 0.5]);
  head.add(parts.head);

  // The full-body reference keeps the shoulder hardware inside the torso socket.
  // These exports contain both sides of that hardware, so bounding-box edges
  // cannot be used as adjoining surfaces. Forearms also need an axial twist
  // before bending, placing the palms down over the thighs.
  const armRest = {
    shoulderPitch: 0.06,
    shoulderRoll: -0.36,
    elbowPitch: -1.1,
    elbowTwist: -1.15,
  };
  const makeArm = (side: "left" | "right", sign: number) => {
    const shoulder = new Group();
    shoulder.name = `robot-shoulder-${side}`;
    shoulder.position.set(sign * 0.115, 0.265, 0);
    torso.add(shoulder);
    const upper = parts[`arm-${side}-upper`];
    fit(upper, 0.205, [side === "left" ? 0.85 : 0.15, 0.81, 0.45]);
    shoulder.add(upper);
    const elbow = new Group();
    elbow.name = `robot-elbow-${side}`;
    elbow.position.set(sign * 0.106, -0.145, 0.033);
    shoulder.add(elbow);
    const lower = parts[`arm-${side}-lower`];
    fit(lower, 0.23, [side === "left" ? 0.74 : 0.26, 0.93, side === "left" ? 0.21 : 0.26]);
    elbow.add(lower);
    shoulder.rotation.set(armRest.shoulderPitch, 0, sign * armRest.shoulderRoll);
    elbow.rotation.set(armRest.elbowPitch, sign * armRest.elbowTwist, 0);
    return { shoulder, elbow };
  };
  // Anatomical left is on the viewer's right (+X).
  const left = makeArm("right", 1),
    right = makeArm("left", -1);
  const skeletons: Skeleton[] = [];
  const leftLeg = leg(parts["leg-left"], 0.096, skeletons);
  const rightLeg = leg(parts["leg-right"], -0.096, skeletons);
  group.add(leftLeg.pivot, rightLeg.pivot);
  // Match the old GLB's unit height and ground contact after posing the knees.
  group.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(group, true);
  const scale = 1 / (bounds.max.y - bounds.min.y);
  group.scale.setScalar(scale);
  group.position.y = -bounds.min.y * scale;
  group.rotation.y = -0.65;

  let time = 0,
    yaw = 0,
    pitch = 0,
    greeting = 0,
    waveTime = 4;
  const smooth = (from: number, to: number, dt: number) =>
    from + (to - from) * (1 - Math.exp(-dt * 5));
  return {
    group,
    disposeSkeletons: () => skeletons.forEach((skeleton) => skeleton.dispose()),
    update(delta, input) {
      // Reduced motion always gets the authored still pose; pause freezes in place.
      if (input.reducedMotion) {
        head.rotation.set(0, 0, 0);
        torso.rotation.set(0, 0, 0);
        left.shoulder.rotation.set(armRest.shoulderPitch, 0, armRest.shoulderRoll);
        right.shoulder.rotation.set(armRest.shoulderPitch, 0, -armRest.shoulderRoll);
        left.elbow.rotation.set(armRest.elbowPitch, armRest.elbowTwist, 0);
        leftLeg.knee.rotation.x = rightLeg.knee.rotation.x = 1.48;
        time = yaw = pitch = 0;
        waveTime = 4;
        greeting = input.greeting;
        return;
      }
      if (input.paused) {
        greeting = input.greeting;
        return;
      }
      const dt = Math.min(0.05, Math.max(0, delta));
      time += dt;
      if (input.greeting !== greeting) {
        greeting = input.greeting;
        if (waveTime >= 3.2) waveTime = 0;
      }
      waveTime += dt;
      const wave =
        waveTime < 3.2
          ? Math.sin((Math.PI * Math.min(1, waveTime / 0.65)) / 2) *
            Math.min(1, (3.2 - waveTime) / 0.65)
          : 0;
      yaw = smooth(
        yaw,
        input.active ? Math.max(-1, Math.min(1, input.x)) * 0.38 : Math.sin(time * 0.34) * 0.12,
        dt,
      );
      pitch = smooth(
        pitch,
        input.active ? Math.max(-1, Math.min(1, input.y)) * 0.16 : Math.sin(time * 0.53) * 0.035,
        dt,
      );
      head.rotation.set(pitch - wave * 0.045, yaw, Math.sin(time * 0.68) * 0.026 + wave * 0.06);
      torso.rotation.set(Math.sin(time * 1.35) * 0.009, yaw * 0.12, Math.sin(time * 0.68) * 0.009);
      left.shoulder.rotation.z = armRest.shoulderRoll + wave * 1.51;
      left.shoulder.rotation.x = armRest.shoulderPitch - wave * 0.38;
      left.elbow.rotation.x = armRest.elbowPitch + wave * 0.75;
      left.elbow.rotation.y = armRest.elbowTwist + wave * 1.15;
      left.elbow.rotation.z = wave * (0.8 + Math.sin(waveTime * 11) * 0.18);
      right.shoulder.rotation.x = armRest.shoulderPitch + Math.sin(time * 1.35 + 0.6) * 0.016;
      leftLeg.knee.rotation.x = 1.48 + Math.sin(time * 0.9) * 0.035;
      rightLeg.knee.rotation.x = 1.48 + Math.sin(time * 0.9 + 1.8) * 0.025;
    },
  };
}

export async function loadHeroRobot(): Promise<HeroRobot> {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(
    ROBOT_PARTS.map(
      async (part) =>
        [part, (await loader.loadAsync(`/assets/hero/robot-parts/${part}.glb`)).scene] as const,
    ),
  );
  if (results.some((result) => result.status === "rejected")) {
    results.forEach((result) => {
      if (result.status === "fulfilled") disposeRobotModel(result.value[1]);
    });
    throw new Error("Robot parts could not load");
  }
  const parts = Object.fromEntries(
    results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  ) as Record<RobotPart, Group>;
  try {
    return assembleHeroRobot(parts);
  } catch (error) {
    Object.values(parts).forEach(disposeRobotModel);
    throw error;
  }
}
