import {
  Bone,
  Float32BufferAttribute,
  Mesh,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from "three";

const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Articulates the existing seated geometry; the bind pose keeps its original shape. */
export function rigRobotGait(original: Mesh) {
  const geometry = original.geometry.clone();
  const mesh = new SkinnedMesh(geometry, original.material);
  mesh.name = original.name;
  mesh.position.copy(original.position);
  mesh.rotation.copy(original.rotation);
  mesh.scale.copy(original.scale);
  mesh.castShadow = original.castShadow;
  mesh.receiveShadow = original.receiveShadow;
  const root = new Bone();
  root.name = "robot-body";
  const bones: Bone[] = [root];
  const joint = (name: string, parent: Bone, x: number, y: number, z: number) => {
    const bone = new Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    parent.add(bone);
    bones.push(bone);
    return bone;
  };
  const legs = [1, -1].map((side) => {
    const hip = joint(`hip-${side}`, root, -0.04, 0.16, side * 0.13);
    const knee = joint(`knee-${side}`, hip, -0.14, 0.045, 0);
    const ankle = joint(`ankle-${side}`, knee, -0.12, -0.12, 0);
    return {
      hip,
      knee,
      ankle,
      indices: [bones.indexOf(hip), bones.indexOf(knee), bones.indexOf(ankle)],
    };
  });
  const arms = [1, -1].map((side) => {
    const shoulder = joint(`shoulder-${side}`, root, -0.01, 0.355, side * 0.22);
    const elbow = joint(`elbow-${side}`, shoulder, -0.12, -0.08, 0);
    return { shoulder, elbow, indices: [bones.indexOf(shoulder), bones.indexOf(elbow)] };
  });
  const positions = geometry.getAttribute("position");
  const indices = new Uint16Array(positions.count * 4),
    weights = new Float32Array(positions.count * 4);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i),
      az = Math.abs(z),
      side = z >= 0 ? 0 : 1;
    const arm =
      smoothstep(0.16, 0.22, az) *
      smoothstep(0.17, 0.23, y) *
      (1 - smoothstep(0.38, 0.42, y)) *
      (1 - smoothstep(-0.03, 0.04, x));
    const leg =
      smoothstep(0.04, 0.09, az) *
      (1 - smoothstep(0.245, 0.3, y)) *
      (1 - smoothstep(-0.12, -0.045, x)) *
      (1 - arm);
    const at = i * 4;
    if (arm > leg) {
      const lower = 1 - smoothstep(-0.2, -0.08, x);
      indices.set([0, arms[side]!.indices[0]!, arms[side]!.indices[1]!, 0], at);
      weights.set([1 - arm, arm * (1 - lower), arm * lower, 0], at);
    } else {
      const lower = 1 - smoothstep(-0.22, -0.12, x),
        foot = (1 - smoothstep(0.12, 0.18, y)) * lower;
      indices.set([0, ...legs[side]!.indices], at);
      weights.set([1 - leg, leg * (1 - lower), leg * (lower - foot), leg * foot], at);
    }
  }
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  mesh.add(root);
  mesh.bind(new Skeleton(bones));
  original.geometry.dispose();
  const parent = original.parent;
  if (parent) {
    parent.remove(original);
    parent.add(mesh);
  }
  let stand = 0,
    distance = 0,
    walking = 0;
  const ground = [0, 0];
  let supportLift = 0;
  return {
    mesh,
    feet: legs.map(({ ankle }) => ankle),
    setGround: (heights: number[]) =>
      heights.forEach((height, i) => {
        ground[i] = Math.max(-0.12, Math.min(0.12, height));
      }),
    update: (delta: number, standing: number, walk: number, traveled?: number) => {
      const dt = Math.min(0.05, Math.max(0, delta));
      const follow = 1 - Math.exp(-dt * 9);
      stand += (standing - stand) * follow;
      walking += (walk - walking) * follow;
      if (standing === 0 && stand < 0.00001) stand = 0;
      if (walk === 0 && walking < 0.00001) walking = 0;
      // The stance foot retreats by exactly the distance the body advances.
      // A full cycle travels .24 model units, with 60% spent on the ground.
      distance = traveled ?? distance + dt * 0.22 * walking;
      if (stand === 0) distance = 0;
      const phase = distance / 0.24;
      supportLift += (Math.max(...ground) * walking - supportLift) * follow;
      root.position.y = stand * 0.24 + supportLift;
      root.rotation.x = walking * Math.sin(phase * Math.PI * 2) * 0.012;
      root.rotation.z = -walking * 0.035;
      legs.forEach(({ hip, knee, ankle }, i) => {
        const cycle = (((phase + i * 0.5) % 1) + 1) % 1;
        const stance = cycle < 0.6;
        const swing = (cycle - 0.6) / 0.4;
        const footX = stance ? -0.072 + cycle * 0.24 : 0.072 * Math.cos(Math.PI * swing);
        const lift = stance ? 0 : Math.sin(Math.PI * swing) ** 2 * 0.045;
        const dx = footX * walking;
        const dy = -0.315 + lift * walking + ground[i]! * walking - supportLift;
        const upper = Math.hypot(0.14, 0.045);
        const lower = Math.hypot(0.12, 0.12);
        const reach = Math.min(upper + lower - 0.0001, Math.hypot(dx, dy));
        const alpha = Math.acos(
          Math.max(
            -1,
            Math.min(1, (upper * upper + reach * reach - lower * lower) / (2 * upper * reach)),
          ),
        );
        const bend = Math.acos(
          Math.max(
            -1,
            Math.min(1, (reach * reach - upper * upper - lower * lower) / (2 * upper * lower)),
          ),
        );
        const angle = Math.atan2(dy, dx) - alpha - Math.atan2(0.045, -0.14);
        hip.rotation.z = stand * (angle + Math.PI * 2);
        knee.rotation.z = stand * (bend - 1.0969449903);
        // Counter-rotate the boot so its sole stays level during support.
        ankle.rotation.z = -hip.rotation.z - knee.rotation.z;
      });
      arms.forEach(({ shoulder, elbow }, i) => {
        shoulder.rotation.z =
          stand * 0.85 - walking * Math.sin((phase + i * 0.5) * Math.PI * 2) * 0.12;
        elbow.rotation.z = stand * -0.2;
      });
      mesh.updateMatrixWorld(true);
      return stand;
    },
    destroy: () => {
      mesh.skeleton.dispose();
      geometry.dispose();
    },
  };
}
