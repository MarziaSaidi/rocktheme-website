import {
  Color,
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
  Vector4,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";

import { emitSoundEvent } from "@/sound/soundEvents";

import { floorConfig, sceneColors } from "../sceneConfig";
import type { HorizonReflection } from "./horizonLights";

/**
 * Reflective computational floor.
 *
 * Not an ocean. There is no wave geometry, no whitecap, no constant motion.
 * The surface is near-black, drifts on a forty-six second noise cycle, and
 * carries a subdued planar reflection of rocks and analytical, source-aligned
 * glints from the distant lights. Ripples exist only in response to the pointer in the lower part of
 * the viewport, are capped in radius, and decay.
 *
 * The mirror is a planar reflection pass: the scene is re-rendered from a
 * camera reflected through the floor plane into a small render target. On the
 * low tier the pass is skipped entirely and the shader falls back to a gradient.
 */

const MAX_RIPPLES = 4;
const MAX_LIGHTS = 4;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vReflectUv;
  varying float vDepth;

  uniform mat4 uReflectMatrix;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vReflectUv = uReflectMatrix * world;
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uReflection;
  uniform float uHasReflection;
  uniform float uTime;
  uniform float uDistortion;
  uniform float uBeaconIntensity;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform vec3 uReflectionTint;
  uniform vec2 uResolution;
  uniform vec2 uViewport;
  uniform vec2 uRippleTravel;
  uniform float uRippleDisplacement;
  /** x, y, intensity, length in normalized screen coordinates. */
  uniform vec4 uLightScreen[${MAX_LIGHTS}];
  /** width in CSS px, shimmer, phase, unused. */
  uniform vec4 uLightStyle[${MAX_LIGHTS}];
  uniform vec3 uLightColor[${MAX_LIGHTS}];
  /** x, y in floor UV space, z = age in seconds, w = strength. */
  uniform vec4 uRipples[${MAX_RIPPLES}];
  uniform float uRippleRadius;
  uniform float uRippleSeconds;

  varying vec2 vUv;
  varying vec4 vReflectUv;
  varying float vDepth;

  // Cheap value noise. The surface only needs a slow, smooth wander.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // Extremely subtle horizontal drift. Two scales, both slow.
    vec2 drift = vec2(uTime * 0.016, uTime * 0.004);
    float surface = valueNoise(vUv * vec2(7.0, 26.0) + drift);
    surface += valueNoise(vUv * vec2(19.0, 61.0) - drift * 1.7) * 0.4;

    vec2 offset = vec2((surface - 0.7) * uDistortion, 0.0);

    // Pointer ripples: bounded radius, decaying, never the whole surface.
    float ripple = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 data = uRipples[i];
      if (data.w <= 0.0) continue;

      float age = data.z / uRippleSeconds;
      if (age >= 1.0) continue;

      float distance = length((vUv - data.xy) * vec2(1.0, 0.42));
      float radius = age * uRippleRadius;
      // A visible but soft band. Too narrow and the ring falls below a pixel
      // once perspective compresses the far field.
      float band = exp(-pow(abs(distance - radius) * 42.0, 2.0));
      float decay = (1.0 - age) * (1.0 - age);
      ripple += band * decay * data.w;
    }

    offset += vec2(0.0, ripple * 0.02);

    /*
     * Ramp on view depth, not on UV. Perspective compresses the whole visible
     * floor into the last few percent of the UV range, so a UV ramp lands
     * almost entirely in one band and a UV alpha fade erases the surface.
     * Depth is uniform in world units and behaves the way it reads.
     */
    float far = smoothstep(3.0, 34.0, vDepth);
    vec3 colour = mix(uNear, uFar, far);

    if (uHasReflection > 0.5) {
      vec2 reflectUv = vReflectUv.xy / max(vReflectUv.w, 0.0001);
      // Stretch vertically so the mirror reads as a wet floor, not a mirror.
      reflectUv.y = reflectUv.y * 0.82 + 0.09;
      vec3 mirrored = texture2D(uReflection, clamp(reflectUv + offset, 0.001, 0.999)).rgb;
      /*
   * The planar pass carries nearby geometry only. Distant lights are sampled
   * analytically below from their shared projected positions, avoiding a
   * second glow or a mirrored beam.
       */
      float strength = smoothstep(3.0, 24.0, vDepth) * 0.66;
      colour += mirrored * uReflectionTint * strength;
    }

    vec2 screen = gl_FragCoord.xy / uResolution;
    vec2 pixel = screen * uViewport;
    float waterDepth = clamp((uLightScreen[0].y - screen.y) / max(uLightScreen[0].y, 0.001), 0.0, 1.0);
    // Two long, low-amplitude ripple trains travel toward the viewer. The
    // slower distant train compresses into finer lines; the nearer one gently
    // bends the bands, without moving any geometry or the far waterline.
    float travel = uTime * mix(uRippleTravel.x, uRippleTravel.y, waterDepth);
    float transverse = sin(pixel.x * 0.009 - uTime * 0.28 + pixel.y * 0.014);
    transverse += sin(pixel.x * 0.022 + uTime * 0.19 - pixel.y * 0.009) * 0.42;
    float displacement = transverse * uRippleDisplacement * smoothstep(0.0, 0.22, waterDepth);
    float flowingY = pixel.y + travel + displacement;
    float grain = valueNoise(screen * vec2(92.0, 180.0) + vec2(uTime * 0.015, 0.0));
    float frequency = mix(1.3, 0.53, waterDepth);
    float band = pow(max(0.0, sin(flowingY * frequency + grain * 3.2)), 10.0);
    float broken = 0.4 + valueNoise(screen * vec2(150.0, 48.0)) * 0.6;
    float shallow = sin(flowingY * mix(0.33, 0.18, waterDepth) + transverse * 0.45);
    colour += vec3(0.028 + grain * 0.022 + shallow * 0.019 + band * broken * 0.052);
    colour += uReflectionTint * band * broken * 0.045;

    // Delicate horizontal fragments form each narrow vertical light path.
    // Positions come from the same world-space source as the visible points.
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec4 source = uLightScreen[i];
      vec4 style = uLightStyle[i];
      float below = source.y - screen.y;
      float along = clamp(below / max(source.w, 0.001), 0.0, 1.0);
      float extent = step(0.0, below) * (1.0 - smoothstep(0.72, 1.0, along));
      float wobble = (valueNoise(vec2(flowingY * 0.027, float(i) * 7.4 + uTime * 0.014)) - 0.5)
        * mix(0.5, 3.0, along) + displacement * along * 0.6;
      float dx = pixel.x - source.x * uViewport.x + wobble;
      float width = mix(2.8, style.x, along);
      float across = exp(-pow(dx / width, 2.0) * 2.5);
      float line = pow(max(0.0, sin(flowingY * mix(2.25, 0.85, along)
        + grain * 3.8 + style.z)), 13.0);
      float fragments = 0.48 + 0.52 * valueNoise(vec2(pixel.y * 0.17, float(i) * 13.0));
      float shimmer = 1.0 + sin(uTime * (0.37 + float(i) * 0.09) + style.z)
        * style.y;
      float falloff = pow(1.0 - along, 0.8);
      float glints = extent * across * line * fragments * falloff * shimmer * source.z;
      colour += uLightColor[i] * glints * 1.6;
      // A soft, dark-lavender underpath keeps the water legible between glints.
      colour += uLightColor[i] * extent * across * falloff * source.z * 0.055;
    }

    colour += uReflectionTint * ripple * 1.4;

    // Carry the low mist a little way onto the distant surface. The irregular
    // fade joins sky and water without moving the water plane or its ripples.
    float veilNoise = valueNoise(vec2(screen.x * 17.0, uTime * 0.005));
    float veilReach = 0.12 + veilNoise * 0.055;
    float waterlineVeil = 1.0 - smoothstep(0.0, veilReach, waterDepth);
    colour += uReflectionTint * waterlineVeil * (0.075 + veilNoise * 0.025);

    // Keep the distant surface present beneath the mist rather than allowing
    // its depth fade to leave a dark strip between atmosphere and water.
    float horizonFade = smoothstep(150.0, 64.0, vDepth);
    horizonFade = max(horizonFade, waterlineVeil * 0.82);
    gl_FragColor = vec4(colour, horizonFade);
  }
`;

type Ripple = { u: number; v: number; age: number; strength: number };

export type ReflectiveFloorOptions = Readonly<{
  width: number;
  depth: number;
  reflectionSize: number;
  maxRipples: number;
  reducedMotion: boolean;
}>;

export type ReflectiveFloor = Readonly<{
  mesh: Mesh;
  /** Renders the planar reflection. Call before the main pass. */
  renderReflection: (
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    hide: readonly Object3D[],
  ) => void;
  setHorizonLights: (sources: readonly HorizonReflection[]) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  update: (deltaSeconds: number, elapsedSeconds: number, beaconIntensity: number) => void;
  /**
   * Requests a ripple from a viewport-relative pointer position. Ignored unless
   * the pointer is inside the lower band of the viewport.
   */
  requestRipple: (viewportX: number, viewportY: number, speed: number) => boolean;
  setReflectionSize: (size: number) => void;
  /** Ripples currently alive, for reporting. */
  activeRipples: () => number;
  destroy: () => void;
}>;

export function createReflectiveFloor(options: ReflectiveFloorOptions): ReflectiveFloor {
  const geometry = new PlaneGeometry(options.width, options.depth, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const ripples: Ripple[] = [];
  const rippleData: number[] = new Array(MAX_RIPPLES * 4).fill(0);
  const lightScreen = Array.from({ length: MAX_LIGHTS }, () => new Vector4());
  const lightStyle = Array.from({ length: MAX_LIGHTS }, () => new Vector4());
  const lightColor = Array.from({ length: MAX_LIGHTS }, () => new Color());
  let rippleCooldown = 0;
  let target: WebGLRenderTarget | null = null;
  let reflectionSize = options.reflectionSize;

  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uReflection: { value: null },
      uHasReflection: { value: 0 },
      uReflectMatrix: { value: new Float32Array(16) },
      uTime: { value: 0 },
      uDistortion: { value: options.reducedMotion ? 0 : floorConfig.distortion },
      uBeaconIntensity: { value: 1 },
      uNear: { value: new Color(sceneColors.waterNear).multiplyScalar(1.4) },
      uFar: { value: new Color(sceneColors.midnight).multiplyScalar(2.2) },
      uReflectionTint: { value: new Color(sceneColors.reflection) },
      uResolution: { value: new Vector2(1, 1) },
      uViewport: { value: new Vector2(1, 1) },
      uRippleTravel: { value: new Vector2(...floorConfig.rippleTravelPxPerSecond) },
      uRippleDisplacement: { value: floorConfig.rippleDisplacementPx },
      uLightScreen: { value: lightScreen },
      uLightStyle: { value: lightStyle },
      uLightColor: { value: lightColor },
      uRipples: { value: rippleData },
      uRippleRadius: { value: 0.055 },
      uRippleSeconds: { value: floorConfig.rippleSeconds },
    },
  });

  const mesh = new Mesh(geometry, material);
  /*
   * The near edge sits behind the camera so the floor fills the frame from the
   * bottom of the viewport up to the horizon, with no visible near edge.
   */
  mesh.position.set(0, 0, -options.depth / 2 + 24);

  const ensureTarget = () => {
    if (reflectionSize <= 0) {
      target?.dispose();
      target = null;
      material.uniforms.uHasReflection!.value = 0;
      material.uniforms.uReflection!.value = null;
      return;
    }

    if (target && target.width === reflectionSize) {
      return;
    }

    target?.dispose();
    target = new WebGLRenderTarget(reflectionSize, Math.round(reflectionSize * 0.5), {
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
      generateMipmaps: false,
    });
    material.uniforms.uReflection!.value = target.texture;
    material.uniforms.uHasReflection!.value = 1;
  };

  ensureTarget();

  const reflectionCamera = new PerspectiveCamera();
  const lookTarget = new Vector3();

  return {
    mesh,

    resize: (width, height, pixelRatio) => {
      (material.uniforms.uResolution!.value as Vector2).set(
        width * pixelRatio,
        height * pixelRatio,
      );
      (material.uniforms.uViewport!.value as Vector2).set(width, height);
    },

    setHorizonLights: (sources) => {
      for (let index = 0; index < MAX_LIGHTS; index += 1) {
        const source = sources[index];
        lightScreen[index]!.set(
          source?.x ?? 0,
          source?.y ?? 0,
          source?.intensity ?? 0,
          source?.length ?? 0,
        );
        lightStyle[index]!.set(source?.width ?? 0, source?.shimmer ?? 0, source?.phase ?? 0, 0);
        lightColor[index]!.copy(source?.color ?? new Color(0));
      }
    },

    renderReflection: (renderer, scene, camera, hide) => {
      if (!target) {
        return;
      }

      // Mirror the camera through the y = 0 plane.
      reflectionCamera.fov = camera.fov;
      reflectionCamera.aspect = camera.aspect;
      reflectionCamera.near = camera.near;
      reflectionCamera.far = camera.far;
      reflectionCamera.position.set(camera.position.x, -camera.position.y, camera.position.z);

      camera.getWorldDirection(lookTarget);
      lookTarget.y *= -1;
      lookTarget.add(reflectionCamera.position);
      reflectionCamera.up.set(0, 1, 0);
      reflectionCamera.lookAt(lookTarget);
      reflectionCamera.updateProjectionMatrix();
      reflectionCamera.updateMatrixWorld();

      // Project world space into the reflection texture's UV space.
      const matrix = reflectionCamera.projectionMatrix
        .clone()
        .multiply(reflectionCamera.matrixWorldInverse);
      const bias = [0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1];
      const uniform = material.uniforms.uReflectMatrix!.value as Float32Array;
      const m = matrix.elements;

      // uReflectMatrix = bias * projection * view, in column-major order.
      for (let column = 0; column < 4; column += 1) {
        for (let row = 0; row < 4; row += 1) {
          let sum = 0;
          for (let k = 0; k < 4; k += 1) {
            sum += bias[k * 4 + row]! * m[column * 4 + k]!;
          }
          uniform[column * 4 + row] = sum;
        }
      }

      const previousTarget = renderer.getRenderTarget();
      const wasVisible = hide.map((item) => item.visible);
      hide.forEach((item) => {
        item.visible = false;
      });

      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, reflectionCamera);
      renderer.setRenderTarget(previousTarget);

      hide.forEach((item, index) => {
        item.visible = wasVisible[index]!;
      });
    },

    update: (deltaSeconds, elapsedSeconds, beaconIntensity) => {
      material.uniforms.uTime!.value = options.reducedMotion ? 0 : elapsedSeconds;
      material.uniforms.uBeaconIntensity!.value = beaconIntensity;

      rippleCooldown = Math.max(0, rippleCooldown - deltaSeconds);

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index]!;
        ripple.age += deltaSeconds;
        if (ripple.age >= floorConfig.rippleSeconds) {
          ripples.splice(index, 1);
        }
      }

      for (let slot = 0; slot < MAX_RIPPLES; slot += 1) {
        const ripple = ripples[slot];
        rippleData[slot * 4] = ripple?.u ?? 0;
        rippleData[slot * 4 + 1] = ripple?.v ?? 0;
        rippleData[slot * 4 + 2] = ripple?.age ?? 0;
        rippleData[slot * 4 + 3] = ripple?.strength ?? 0;
      }
    },

    requestRipple: (viewportX, viewportY, speed) => {
      if (options.reducedMotion || rippleCooldown > 0) {
        return false;
      }

      // Only the lower band of the viewport touches the water.
      if (viewportY < 1 - floorConfig.pointerZone) {
        return false;
      }

      if (ripples.length >= options.maxRipples) {
        ripples.shift();
      }

      const depthInBand = (viewportY - (1 - floorConfig.pointerZone)) / floorConfig.pointerZone;

      ripples.push({
        u: viewportX,
        /*
         * Lower on screen means nearer the camera, which is a smaller UV. The
         * visible floor spans roughly the last 0.16 of the range, so the
         * mapping stays inside that band.
         */
        v: 1 - depthInBand * 0.16,
        age: 0,
        strength: Math.min(1, 0.4 + speed / 1400),
      });

      rippleCooldown = floorConfig.rippleInterval;
      // One ripple, one event. The cue is gated by the same interval the
      // visible ripple is, so sound and image never disagree.
      emitSoundEvent("water:ripple", { intensity: Math.min(1, 0.3 + speed / 1600) });
      return true;
    },

    activeRipples: () => ripples.length,

    setReflectionSize: (size) => {
      reflectionSize = size;
      ensureTarget();
    },

    destroy: () => {
      geometry.dispose();
      material.dispose();
      target?.dispose();
      target = null;
    },
  };
}
