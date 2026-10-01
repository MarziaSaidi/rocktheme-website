import {
  Color,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Camera,
  type Object3D,
} from "three";

/**
 * Brings the hero robot (one merged, unrigged mesh) to life with a rig that
 * runs in its shader.
 *
 * Regions are found from where each vertex sits in the model: the head above
 * the neck, the leaf sprout above the helmet, the chest. Each is moved about
 * its own pivot with a soft blend at the joint, the way skin weights work, so
 * the model needs no bones. The eyes are the pale shapes on the visor; they
 * glow softly and blink with lids that close from above and below.
 *
 * All positions are in the model's own space, as exported: 0.98 tall, seated,
 * facing −x, backpack towards +x, leaf sprout at the back of the helmet.
 */
export type RobotLifeInput = Readonly<{
  /** Pointer in normalised device coordinates (−1…1, y up), or null. */
  pointer: { x: number; y: number } | null;
  camera: Camera;
  reducedMotion: boolean;
  /** Bump to make the robot greet: a happy tilt, a nod and a leaf bounce. */
  greeting: number;
}>;

export type RobotLife = Readonly<{
  update: (delta: number, input: RobotLifeInput) => void;
  /** Development aid: paints the visor and eye masks so they can be checked. */
  setDebug: (on: boolean) => void;
}>;

const NECK = new Vector3(0.05, 0.44, 0);
const LEAF_BASE = new Vector3(0.2, 0.81, 0);
const CHEST = new Vector3(0.05, 0.3, 0);
const EYE_Y = 0.59;
const EYE_HALF = 0.075;

/** How far the head may turn and nod (radians). */
const MAX_YAW = 0.62;
const MAX_PITCH = 0.3;

const VERTEX_RIG = /* glsl */ `
uniform mat3 uHeadRotation;
uniform vec3 uHeadPivot;
uniform mat3 uLeafRotation;
uniform vec3 uLeafPivot;
uniform vec3 uChest;
uniform float uBreath;
varying vec3 vRobotLocal;

float robotHeadWeight(vec3 p) {
  float above = smoothstep(0.425, 0.465, p.y);
  // The top of the backpack sits at neck height behind it; it stays put.
  float pack = (1.0 - smoothstep(0.47, 0.5, p.y)) * smoothstep(0.15, 0.2, p.x);
  return above * (1.0 - pack);
}

float robotLeafWeight(vec3 p) {
  return smoothstep(0.81, 0.86, p.y) * smoothstep(0.12, 0.18, p.x);
}

float robotChestWeight(vec3 p) {
  return smoothstep(0.14, 0.22, p.y) * (1.0 - smoothstep(0.38, 0.44, p.y));
}
`;

const FRAGMENT_EYES = /* glsl */ `
uniform float uBlink;
uniform float uEyeGlow;
uniform vec3 uEyeColor;
uniform float uDebug;
varying vec3 vRobotLocal;
`;

export function bringRobotToLife(root: Object3D): RobotLife {
  const uniforms = {
    uHeadRotation: { value: new Matrix3() },
    uHeadPivot: { value: NECK.clone() },
    uLeafRotation: { value: new Matrix3() },
    uLeafPivot: { value: LEAF_BASE.clone() },
    uChest: { value: CHEST.clone() },
    uBreath: { value: 0 },
    uBlink: { value: 0 },
    uEyeGlow: { value: 0.55 },
    uEyeColor: { value: new Color("#fff1d2") },
    uDebug: { value: 0 },
  };

  let mesh: Mesh | null = null;
  root.traverse((child) => {
    if (!(child instanceof Mesh) || !(child.material instanceof MeshStandardMaterial)) return;
    mesh = child;
    const material = child.material;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERTEX_RIG}`)
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          objectNormal = normalize(mix(objectNormal, uHeadRotation * objectNormal, robotHeadWeight(position)));`,
        )
        .replace(
          "#include <begin_vertex>",
          `vec3 transformed = position;
          vRobotLocal = position;
          float chest = robotChestWeight(position);
          vec3 breathed = uChest + (transformed - uChest) * vec3(1.0 + uBreath * 0.012, 1.0 + uBreath * 0.005, 1.0 + uBreath * 0.012);
          transformed = mix(transformed, breathed, chest);
          float leaf = robotLeafWeight(position);
          transformed = mix(transformed, uLeafPivot + uLeafRotation * (transformed - uLeafPivot), leaf);
          float head = robotHeadWeight(position);
          vec3 headPivot = uHeadPivot + vec3(0.0, uBreath * 0.004, 0.0);
          transformed = mix(transformed, headPivot + uHeadRotation * (transformed - uHeadPivot), head);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAGMENT_EYES}`)
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          float robotLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float robotVisor = step(vRobotLocal.x, -0.05) * step(abs(vRobotLocal.z), 0.15)
            * step(0.5, vRobotLocal.y) * step(vRobotLocal.y, 0.69);
          // Each eye is an oval either side of the middle; reflections elsewhere don't count.
          vec2 robotEyeOffset = vec2((abs(vRobotLocal.z) - 0.07) / 0.06, (vRobotLocal.y - ${EYE_Y.toFixed(3)}) / 0.085);
          float robotEye = robotVisor * step(length(robotEyeOffset), 1.0) * smoothstep(0.32, 0.5, robotLum);
          float robotLid = step(${EYE_HALF.toFixed(3)} * (1.0 - uBlink), abs(vRobotLocal.y - ${EYE_Y.toFixed(3)}));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.025, 0.035), robotEye * robotLid);
          float robotEyeOpen = robotEye * (1.0 - robotLid);
          if (uDebug > 0.5) {
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0, 0.3, 1.0), robotVisor * 0.5);
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), robotLid), robotEye);
          }`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += uEyeColor * robotEyeOpen * uEyeGlow;`,
        );
    };
    material.customProgramCacheKey = () => "robot-life";
    material.needsUpdate = true;
  });

  // ---------------------------------------------------------------- motion
  let time = 0;
  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let blinkIn = 2.5;
  let blinkTime = -1;
  let greeting = 0;
  let greetTime = 99;

  const inverse = new Matrix4();
  const target = new Vector3();
  const local = new Vector3();
  const rotation = new Matrix4();
  const leafRotation = new Matrix4();
  const smooth = (from: number, to: number, rate: number, delta: number) =>
    from + (to - from) * (1 - Math.exp(-rate * delta));

  const update = (delta: number, input: RobotLifeInput) => {
    const dt = Math.min(0.05, Math.max(0, delta));
    if (input.reducedMotion) {
      uniforms.uHeadRotation.value.identity();
      uniforms.uLeafRotation.value.identity();
      uniforms.uBreath.value = 0;
      uniforms.uBlink.value = 0;
      return;
    }
    time += dt;

    // Where to look: the cursor's point in the world at the robot's distance,
    // or a slow idle glance about when there is no cursor.
    let wantYaw = Math.sin(time * 0.31) * 0.22;
    let wantPitch = Math.sin(time * 0.47) * 0.05;
    const current: Mesh | null = mesh;
    if (input.pointer && current) {
      const camera = input.camera;
      current.updateWorldMatrix(true, false);
      const neckWorld = NECK.clone().applyMatrix4(current.matrixWorld);
      // The cursor's point stands between the camera and the robot, never at it.
      const distance = Math.max(0.6, neckWorld.distanceTo(camera.position) - 1.4);
      target
        .set(input.pointer.x, input.pointer.y, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      target.multiplyScalar(distance).add(camera.position);
      inverse.copy(current.matrixWorld).invert();
      local.copy(target).applyMatrix4(inverse).sub(NECK);
      // Facing −x: turning about y swings the face across, about z nods it.
      wantYaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, Math.atan2(local.z, -local.x)));
      wantPitch = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, Math.atan2(local.y, Math.hypot(local.x, local.z))),
      );
    }

    if (input.greeting !== greeting) {
      greeting = input.greeting;
      greetTime = 0;
    }
    greetTime += dt;
    const greet = greetTime < 1.8 ? Math.sin(Math.PI * Math.min(1, greetTime / 1.8)) : 0;

    yaw = smooth(yaw, wantYaw, 4, dt);
    pitch = smooth(pitch, wantPitch + greet * Math.sin(greetTime * 9) * 0.06, 5, dt);
    roll = smooth(roll, greet * 0.22 + Math.sin(time * 0.6) * 0.02, 4, dt);

    // Nodding about z points the face (−x) up for a negative angle.
    rotation
      .makeRotationY(yaw)
      .multiply(new Matrix4().makeRotationZ(-pitch))
      .multiply(new Matrix4().makeRotationX(roll));
    uniforms.uHeadRotation.value.setFromMatrix4(rotation);

    const sway =
      Math.sin(time * 1.3) * 0.06 +
      Math.sin(time * 2.9) * 0.025 +
      greet * Math.sin(greetTime * 14) * 0.18;
    leafRotation
      .makeRotationZ(sway)
      .multiply(new Matrix4().makeRotationX(Math.sin(time * 1.1 + 1) * 0.05));
    uniforms.uLeafRotation.value.setFromMatrix4(leafRotation);

    uniforms.uBreath.value = Math.sin(time * 1.6);

    // Blink every few seconds, now and then twice; a greeting is a happy squint.
    blinkIn -= dt;
    if (blinkIn <= 0 && blinkTime < 0) {
      blinkTime = 0;
      blinkIn = 2.4 + Math.random() * 3.2;
      if (Math.random() < 0.2) blinkIn = 0.35;
    }
    if (blinkTime >= 0) {
      blinkTime += dt;
      const t = blinkTime / 0.16;
      uniforms.uBlink.value = t < 1 ? Math.sin(Math.PI * t) : 0;
      if (t >= 1) blinkTime = -1;
    } else {
      uniforms.uBlink.value = greet * 0.55;
    }
  };

  return {
    update,
    setDebug: (on) => {
      uniforms.uDebug.value = on ? 1 : 0;
    },
  };
}
