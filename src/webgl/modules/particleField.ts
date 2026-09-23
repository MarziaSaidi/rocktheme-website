import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
} from "three";

import { emitSoundEvent, soundEventsIdle } from "@/sound/soundEvents";

import { createCurlField } from "../core/noise";
import { particleConfig, sceneColors } from "../sceneConfig";
import {
  applyPointerInfluence,
  goldFlashChance,
  type PointerInfluenceResult,
} from "./pointerInfluence";

/**
 * Particle field.
 *
 * Simulated in screen space, in CSS pixels, and drawn with an orthographic
 * camera. Screen space is deliberate: every distance in the creative direction
 * is a pixel distance, and obstacle avoidance works against DOM rectangles
 * measured in the same units, so nothing has to be unprojected.
 *
 * Obstacles arrive as plain rectangles. This module has no idea that they are
 * typography or project planes, which is what keeps portfolio content out of
 * the scene code.
 */

/** A screen-space rectangle the field should flow around. */
export type ObstacleRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type ParticleFieldOptions = Readonly<{
  count: number;
  width: number;
  height: number;
  /** Renderer pixel ratio. Point sizes are specified in device pixels. */
  pixelRatio: number;
  reducedMotion: boolean;
}>;

export type ParticlePointerState = Readonly<{
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  active: boolean;
}>;

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aGold;

  varying float vAlpha;
  varying float vGold;

  void main() {
    vAlpha = aAlpha;
    vGold = aGold;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = aSize;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform vec3 uBotanical;
  uniform vec3 uGold;

  varying float vAlpha;
  varying float vGold;

  void main() {
    // Round, soft-edged point. No texture upload for a shape this simple.
    vec2 offset = gl_PointCoord - vec2(0.5);
    float radius = length(offset);
    if (radius > 0.5) discard;

    float falloff = smoothstep(0.5, 0.06, radius);
    vec3 tint = mix(uBotanical, uGold, vGold);
    gl_FragColor = vec4(tint * 2.2, falloff * vAlpha);
  }
`;

export type ParticleField = Readonly<{
  scene: Scene;
  camera: OrthographicCamera;
  update: (deltaSeconds: number, elapsedSeconds: number, pointer: ParticlePointerState) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  setObstacles: (obstacles: readonly ObstacleRect[]) => void;
  /**
   * Rectangle the field should gather around, or null to release. The field is
   * given geometry only; it never learns what the rectangle contains.
   */
  setFocus: (rect: ObstacleRect | null) => void;
  setCount: (count: number) => void;
  /** Number of particles currently recovering from a disturbance. */
  disturbedCount: () => number;
  destroy: () => void;
}>;

export function createParticleField(options: ParticleFieldOptions): ParticleField {
  const curl = createCurlField();
  const scene = new Scene();

  let width = options.width;
  let height = options.height;
  let capacity = options.count;
  let active = options.reducedMotion
    ? Math.round(options.count * particleConfig.density.reducedMotionFactor)
    : options.count;
  let obstacles: readonly ObstacleRect[] = [];
  let focus: ObstacleRect | null = null;
  /** Eased 0 to 1 so the gathering builds and releases rather than snapping. */
  let focusAmount = 0;
  /** Point sizes are written in device pixels, so the field needs the DPR. */
  let pixelRatio = options.pixelRatio;

  const camera = new OrthographicCamera(0, width, 0, height, -1000, 1000);

  // Simulation state lives in plain typed arrays, never in React.
  let posX = new Float32Array(capacity);
  let posY = new Float32Array(capacity);
  let posZ = new Float32Array(capacity);
  let velX = new Float32Array(capacity);
  let velY = new Float32Array(capacity);
  let laneOffset = new Float32Array(capacity);
  let branchIndex = new Uint8Array(capacity);
  let pointAlpha = new Float32Array(capacity);
  let generation = new Uint32Array(capacity);
  let recovery = new Float32Array(capacity);
  let goldTimer = new Float32Array(capacity);

  let positions = new Float32Array(capacity * 3);
  let sizes = new Float32Array(capacity);
  let alphas = new Float32Array(capacity);
  let golds = new Float32Array(capacity);

  const geometry = new BufferGeometry();
  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uBotanical: { value: new Color(sceneColors.botanical) },
      uGold: { value: new Color(sceneColors.gold) },
    },
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const randomFor = (index: number, channel: number): number => {
    let value =
      (particleConfig.seed ^
        Math.imul(index + 1, 0x9e3779b1) ^
        Math.imul(generation[index]! + 1, 0x85ebca6b) ^
        Math.imul(channel + 1, 0xc2b2ae35)) >>>
      0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  };

  const smooth = (value: number): number => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };

  /** Smooth, non-repeating centreline through the configured landscape points. */
  const centreAt = (u: number, lane: number): number => {
    const knots = particleConfig.path;
    let segment = 0;
    while (segment < knots.length - 2 && u > knots[segment + 1]![0]) segment += 1;
    const left = knots[segment]!;
    const right = knots[segment + 1]!;
    const span = right[0] - left[0];
    const t = Math.max(0, Math.min(1, (u - left[0]) / span));
    const before = knots[Math.max(0, segment - 1)]!;
    const after = knots[Math.min(knots.length - 1, segment + 2)]!;
    const m0 = ((right[1] - before[1]) / (right[0] - before[0])) * span;
    const m1 = ((after[1] - left[1]) / (after[0] - left[0])) * span;
    const t2 = t * t;
    const t3 = t2 * t;
    let y =
      (2 * t3 - 3 * t2 + 1) * left[1] +
      (t3 - 2 * t2 + t) * m0 +
      (-2 * t3 + 3 * t2) * right[1] +
      (t3 - t2) * m1;

    if (lane > 0) {
      const branch = particleConfig.branches[lane - 1]!;
      const split = smooth((u - branch.split) / 0.15);
      const merge = smooth((branch.merge - u) / 0.17);
      y += branch.offset * split * merge;
    }
    return y;
  };

  const desiredY = (index: number, x: number): number =>
    (centreAt(x / Math.max(1, width), branchIndex[index]!) + laneOffset[index]!) * height;

  const spawn = (index: number, acrossFullWidth: boolean) => {
    const branchPick = randomFor(index, 0);
    let boundary = 1;
    branchIndex[index] = 0;
    for (let lane = 0; lane < particleConfig.branches.length; lane += 1) {
      boundary -= particleConfig.branches[lane]!.fraction;
      if (branchPick >= boundary) {
        branchIndex[index] = lane + 1;
        break;
      }
    }
    const wisp = randomFor(index, 1) < particleConfig.wispFraction;
    const bell = randomFor(index, 2) + randomFor(index, 3) + randomFor(index, 4) - 1.5;
    laneOffset[index] =
      bell * (wisp ? particleConfig.wispSpread : particleConfig.corridorHeight / 3);
    posX[index] = acrossFullWidth
      ? randomFor(index, 5) * width
      : -randomFor(index, 5) * width * 0.18;
    posY[index] = desiredY(index, posX[index]!);
    posZ[index] = randomFor(index, 6);
    const sparkle = randomFor(index, 7) > 0.985;
    pointAlpha[index] = sparkle
      ? 0.9 + randomFor(index, 8) * 0.1
      : (wisp ? 0.12 : 0.37) + Math.pow(randomFor(index, 8), 2) * (wisp ? 0.19 : 0.47);
    velX[index] = 0;
    velY[index] = 0;
    recovery[index] = 0;
    goldTimer[index] = 0;
    generation[index] = generation[index]! + 1;
  };

  const allocate = (nextCapacity: number) => {
    capacity = nextCapacity;
    posX = new Float32Array(capacity);
    posY = new Float32Array(capacity);
    posZ = new Float32Array(capacity);
    velX = new Float32Array(capacity);
    velY = new Float32Array(capacity);
    laneOffset = new Float32Array(capacity);
    branchIndex = new Uint8Array(capacity);
    pointAlpha = new Float32Array(capacity);
    generation = new Uint32Array(capacity);
    recovery = new Float32Array(capacity);
    goldTimer = new Float32Array(capacity);
    positions = new Float32Array(capacity * 3);
    sizes = new Float32Array(capacity);
    alphas = new Float32Array(capacity);
    golds = new Float32Array(capacity);

    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(alphas, 1));
    geometry.setAttribute("aGold", new BufferAttribute(golds, 1));

    for (let index = 0; index < capacity; index += 1) {
      spawn(index, true);
    }
  };

  allocate(capacity);

  const flow: [number, number, number] = [0, 0, 0];
  const influence: PointerInfluenceResult = { ax: 0, ay: 0, disturbance: 0, contact: false };
  let disturbed = 0;

  /**
   * Bend the flow around an obstacle.
   *
   * The force is a smooth falloff from the rectangle's nearest point rather
   * than a hard test against its interior, so particles start curving before
   * they arrive. A tangential component pointing the way the particle is
   * already travelling makes them slide past instead of queueing along the
   * edge in a visible line.
   */
  const avoidObstacles = (index: number, deltaSeconds: number) => {
    const x = posX[index]!;
    const y = posY[index]!;
    const padding = particleConfig.obstaclePadding;
    const band = particleConfig.obstacleInfluence;

    for (let rect = 0; rect < obstacles.length; rect += 1) {
      const box = obstacles[rect]!;
      const left = box.x - padding;
      const right = box.x + box.width + padding;
      const top = box.y - padding;
      const bottom = box.y + box.height + padding;

      if (x < left - band || x > right + band || y < top - band || y > bottom + band) {
        continue;
      }

      const nearestX = Math.min(right, Math.max(left, x));
      const nearestY = Math.min(bottom, Math.max(top, y));
      let normalX = x - nearestX;
      let normalY = y - nearestY;
      let distance = Math.hypot(normalX, normalY);

      if (distance < 0.001) {
        // Inside the rectangle: leave through the closest face.
        const toTop = y - top;
        const toBottom = bottom - y;
        const toLeft = x - left;
        const toRight = right - x;
        const minimum = Math.min(toTop, toBottom, toLeft, toRight);

        if (minimum === toTop) {
          normalX = 0;
          normalY = -1;
        } else if (minimum === toBottom) {
          normalX = 0;
          normalY = 1;
        } else if (minimum === toLeft) {
          normalX = -1;
          normalY = 0;
        } else {
          normalX = 1;
          normalY = 0;
        }

        distance = 0;
      } else {
        normalX /= distance;
        normalY /= distance;

        if (distance > band) {
          continue;
        }
      }

      const falloff = 1 - distance / band;
      const force = particleConfig.obstacleStrength * falloff * falloff * deltaSeconds;

      velX[index]! += normalX * force;
      velY[index]! += normalY * force;

      // Slide along the surface, in whichever direction the particle is headed.
      const tangentX = -normalY;
      const tangentY = normalX;
      const side = tangentX * velX[index]! + tangentY * velY[index]! >= 0 ? 1 : -1;
      velX[index]! += tangentX * side * force * 0.6;
      velY[index]! += tangentY * side * force * 0.6;
    }
  };

  /**
   * Draw a particle towards the focus rectangle's nearest edge and set it
   * circling there, so the field visibly collects around the active plane
   * instead of flowing straight past it.
   */
  const gatherAroundFocus = (index: number, deltaSeconds: number) => {
    const rect = focus;

    if (!rect) {
      return;
    }

    const x = posX[index]!;
    const y = posY[index]!;
    const nearestX = Math.min(rect.x + rect.width, Math.max(rect.x, x));
    const nearestY = Math.min(rect.y + rect.height, Math.max(rect.y, y));
    const toEdgeX = nearestX - x;
    const toEdgeY = nearestY - y;
    const distance = Math.hypot(toEdgeX, toEdgeY);

    if (distance > particleConfig.focusRadius || distance < 0.001) {
      return;
    }

    const falloff = 1 - distance / particleConfig.focusRadius;
    const pull = particleConfig.focusStrength * falloff * focusAmount * deltaSeconds;
    const normalX = toEdgeX / distance;
    const normalY = toEdgeY / distance;

    // Inward pull plus a tangential drift, so particles orbit the edge rather
    // than piling into it. Obstacle avoidance still keeps them outside.
    velX[index]! += normalX * pull;
    velY[index]! += normalY * pull;
    velX[index]! += -normalY * pull * 0.8;
    velY[index]! += normalX * pull * 0.8;
  };

  const update: ParticleField["update"] = (deltaSeconds, elapsedSeconds, pointer) => {
    // Reduced motion holds the field still: it becomes a slow ambient texture
    // that is drawn once rather than an animated system.
    if (options.reducedMotion) {
      writeBuffers();
      return;
    }

    const step = Math.min(deltaSeconds, 1 / 30);
    const flowTime = elapsedSeconds * particleConfig.flowTimeScale;
    disturbed = 0;

    const wantedFocus = focus ? 1 : 0;
    focusAmount += (wantedFocus - focusAmount) * Math.min(1, step / particleConfig.focusEase);

    for (let index = 0; index < active; index += 1) {
      const depth = posZ[index]!;

      curl.sample(
        posX[index]! * particleConfig.flowScale,
        posY[index]! * particleConfig.flowScale,
        depth * 2 + flowTime,
        flow,
      );

      // Target velocity: steady rightward drift plus curl turbulence, both
      // scaled by depth so nearer particles travel faster.
      const depthScale = 0.4 + depth * 0.8;
      const targetX =
        particleConfig.driftSpeed * depthScale + flow[0] * particleConfig.flowStrength;
      const pathSlope = (desiredY(index, posX[index]! + 3) - desiredY(index, posX[index]! - 3)) / 6;
      const targetY =
        pathSlope * targetX +
        flow[1] * particleConfig.flowStrength +
        (desiredY(index, posX[index]!) - posY[index]!) * particleConfig.pathReturn;

      // A recovering particle steers back to the field gradually. The timer is
      // what makes a carved path close over roughly 1.4 seconds.
      const recovering = recovery[index]!;
      const follow = particleConfig.followStrength * (recovering > 0 ? 1 - recovering * 0.75 : 1);

      velX[index]! += (targetX - velX[index]!) * follow * step;
      velY[index]! += (targetY - velY[index]!) * follow * step;

      if (pointer.active) {
        applyPointerInfluence(
          {
            px: posX[index]!,
            py: posY[index]!,
            vx: velX[index]!,
            vy: velY[index]!,
            cx: pointer.x,
            cy: pointer.y,
            dirX: pointer.dirX,
            dirY: pointer.dirY,
            speed: pointer.speed,
          },
          influence,
        );

        if (influence.disturbance > 0) {
          velX[index]! += influence.ax * step;
          velY[index]! += influence.ay * step;
          recovery[index] = Math.max(recovering, influence.disturbance);

          if (influence.contact && goldTimer[index]! <= 0 && Math.random() < goldFlashChance) {
            goldTimer[index] = particleConfig.goldSeconds;

            /*
             * Report the contact. This is an event, not a sound: the field
             * never learns whether anything is listening. The engine's own
             * cooldown decides how much of this becomes audible.
             */
            if (!soundEventsIdle()) {
              emitSoundEvent("particles:contact", {
                intensity: Math.min(1, pointer.speed / 1200),
              });
            }
          }
        }
      }

      if (recovery[index]! > 0) {
        recovery[index] = Math.max(0, recovery[index]! - step / particleConfig.recoverySeconds);
        disturbed += 1;
      }

      if (goldTimer[index]! > 0) {
        goldTimer[index] = Math.max(0, goldTimer[index]! - step);
      }

      velX[index]! -= velX[index]! * particleConfig.damping * step * 0.12;
      velY[index]! -= velY[index]! * particleConfig.damping * step * 0.12;

      avoidObstacles(index, step);

      if (focusAmount > 0.01 && focus) {
        gatherAroundFocus(index, step);
      }

      posX[index]! += velX[index]! * step;
      posY[index]! += velY[index]! * step;

      // Recycle at the right edge and wrap vertically.
      if (posX[index]! > width + particleConfig.edgeFade) {
        spawn(index, false);
      } else if (
        posY[index]! < -particleConfig.edgeFade ||
        posY[index]! > height + particleConfig.edgeFade
      ) {
        // Re-enter from the left rather than wrapping, so the stream keeps its
        // shape instead of degrading into an even spread.
        spawn(index, false);
      }
    }

    writeBuffers();
  };

  function writeBuffers() {
    const [minSize, maxSize] = particleConfig.sizeRange;
    const fade = particleConfig.edgeFade;

    for (let index = 0; index < active; index += 1) {
      const x = posX[index]!;
      const y = posY[index]!;
      const depth = posZ[index]!;

      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = depth * 10;

      sizes[index] = (minSize + (maxSize - minSize) * depth) * pixelRatio;

      // Gradual fade at every boundary so nothing pops in or out.
      const fadeLeft = Math.min(1, Math.max(0, (x + fade) / fade));
      const fadeRight = Math.min(1, Math.max(0, (width + fade - x) / fade));
      const fadeTop = Math.min(1, Math.max(0, (y + fade) / fade));
      const fadeBottom = Math.min(1, Math.max(0, (height + fade - y) / fade));
      const depthAlpha = 0.62 + depth * 0.38;

      alphas[index] = fadeLeft * fadeRight * fadeTop * fadeBottom * depthAlpha * pointAlpha[index]!;
      golds[index] = goldTimer[index]! > 0 ? 1 : 0;
    }

    geometry.setDrawRange(0, active);
    (geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("aSize") as BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("aAlpha") as BufferAttribute).needsUpdate = true;
    (geometry.getAttribute("aGold") as BufferAttribute).needsUpdate = true;
  }

  return {
    scene,
    camera,
    update,
    resize: (nextWidth, nextHeight, nextPixelRatio) => {
      const previousWidth = width;
      const previousHeight = height;
      width = nextWidth;
      height = nextHeight;
      pixelRatio = nextPixelRatio;
      for (let index = 0; index < active; index += 1) {
        posX[index] = (posX[index]! / Math.max(1, previousWidth)) * width;
        posY[index] = (posY[index]! / Math.max(1, previousHeight)) * height;
      }
      camera.left = 0;
      camera.right = width;
      camera.top = 0;
      camera.bottom = height;
      camera.updateProjectionMatrix();
    },
    setObstacles: (next) => {
      obstacles = next;
    },

    setFocus: (rect) => {
      focus = rect;
    },
    setCount: (count) => {
      count = options.reducedMotion
        ? Math.round(count * particleConfig.density.reducedMotionFactor)
        : count;
      if (count <= capacity) {
        active = count;
        return;
      }

      allocate(count);
      active = count;
    },
    disturbedCount: () => disturbed,
    destroy: () => {
      geometry.dispose();
      material.dispose();
      scene.remove(points);
    },
  };
}
