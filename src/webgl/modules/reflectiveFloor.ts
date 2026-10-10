import { STORM_CLOUD_GLSL } from "./stormCloudField";
import {
  Color,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  Vector4,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";

import { createWeatherUniforms, WEATHER_GLSL, type WeatherUniforms } from "../core/weather";
import { lightningConfig } from "../sceneConfig";

import { floorConfig, waterTones } from "../sceneConfig";
import type { WaterConfig } from "../sceneTypes";
import type { BeaconSource } from "./horizonLights";

/**
 * Reflective computational floor.
 *
 * The surface is shaded, not painted. Every fragment reconstructs a world-space
 * normal from interfering swell fields, and that one normal drives all three
 * things the viewer reads as water: the planar reflection lookup, the Fresnel
 * balance between dark body and mirrored environment, and the specular lobe of
 * each beacon. Because the beacon paths are lobes off the same disturbed
 * normal, they widen, fragment and reconnect as ripples cross them instead of
 * sitting there as fixed-width columns.
 *
 * Nothing here works in screen space. A screen-space band is a horizontal line
 * by construction, which is what this replaces.
 */

const MAX_RIPPLES = 4;
const MAX_BEACONS = 4;
const MAX_LIGHT_IMPACTS = 16;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vReflectUv;
  varying vec3 vWorld;
  varying float vDepth;

  uniform mat4 uReflectMatrix;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
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
  uniform float uSwell;
  uniform float uRipple;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform vec3 uMist;
  uniform vec3 uSheen;
  uniform vec2 uReflectance;
  /** xyz world position, w intensity. */
  uniform vec4 uBeacon[${MAX_BEACONS}];
  uniform vec3 uBeaconColor[${MAX_BEACONS}];
  /** x, y in floor UV space, z = age in seconds, w = strength. */
  uniform vec4 uRipples[${MAX_RIPPLES}];
  uniform vec4 uLightImpacts[${MAX_LIGHT_IMPACTS}]; // world x,z, age, strength
  uniform vec3 uImpactColours[${MAX_LIGHT_IMPACTS}];
  uniform int uImpactCount;
  uniform float uRippleRadius;
  uniform float uRippleSeconds;

  varying vec2 vUv;
  varying vec4 vReflectUv;
  varying vec3 vWorld;
  varying float vDepth;

  ${WEATHER_GLSL}
  ${STORM_CLOUD_GLSL}

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

  /*
   * Analytic slope of one travelling wave. Returning the derivative rather
   * than the height means the normal costs no extra samples, and the surface
   * never needs geometry to carry it.
   */
  vec2 waveSlope(vec2 dir, float freq, float amp, float speed, float phase, vec2 p, float t) {
    float a = dot(dir, p) * freq + t * speed + phase;
    return dir * (freq * amp * cos(a));
  }

  void main() {
    vec2 p = vWorld.xz;
    float t = uTime;

    /*
     * Two depth ramps. Micro detail dies out well before the horizon because
     * beyond that a world-space ripple is narrower than a pixel and would
     * alias into crawling speckle; the broad swell relaxes more slowly, so the
     * surface smooths into the distance rather than stopping.
     */
    float detail = 1.0 - smoothstep(11.0, 62.0, vDepth);
    float broad = mix(0.4, 1.0, 1.0 - smoothstep(14.0, 104.0, vDepth));

    /*
     * Four swells on non-parallel headings. The wavelengths are mutually
     * non-harmonic, so crests interfere into an irregular field instead of
     * lining up into countable rows.
     */
    vec2 slope = vec2(0.0);
    slope += waveSlope(normalize(vec2(0.94, 0.34)), 0.83, 0.060, 0.37, 0.0, p, t);
    slope += waveSlope(normalize(vec2(-0.42, 0.91)), 1.27, 0.038, 0.29, 1.7, p, t);
    slope += waveSlope(normalize(vec2(0.71, -0.70)), 2.11, 0.019, 0.53, 3.4, p, t);
    slope += waveSlope(normalize(vec2(-0.87, -0.49)), 3.41, 0.011, 0.23, 5.2, p, t);
    slope *= broad * uSwell;

    /*
     * The micro layer rides a slowly warped domain. Without the warp three
     * high-frequency sines read as a woven grid; with it the crests wander and
     * break, which is what stops the eye from finding a repeat.
     */
    vec2 warp = vec2(
      valueNoise(p * 0.21 + vec2(t * 0.019, 0.0)),
      valueNoise(p * 0.18 - vec2(0.0, t * 0.015))
    ) - 0.5;
    vec2 q = p + warp * 3.2;
    vec2 micro = vec2(0.0);
    micro += waveSlope(normalize(vec2(0.31, 0.95)), 6.7, 0.0042, 0.71, 2.1, q, t);
    micro += waveSlope(normalize(vec2(-0.98, 0.19)), 9.3, 0.0027, 0.94, 4.6, q, t);
    micro += waveSlope(normalize(vec2(0.62, -0.78)), 14.1, 0.0015, 1.21, 0.8, q, t);
    slope += micro * detail * uRipple;

    vec3 receivedLight = vec3(0.0);
    for (int i = 0; i < ${MAX_LIGHT_IMPACTS}; i++) {
      if (i >= uImpactCount) break;
      vec4 hit = uLightImpacts[i];
      float age = hit.z;
      vec2 d = p - hit.xy;
      float distance_ = length(d);
      float radius = 0.035 + age * 0.65;
      float width_ = 0.025 + age * 0.014;
      float ring = exp(-pow((distance_ - radius) / width_, 2.0));
      float decay = pow(max(0.0, 1.0 - age / 1.8), 2.0);
      slope += d / max(distance_, 0.001) * ring * decay * hit.w * 0.045;
      float pool = exp(-distance_ * distance_ / (0.012 + age * 0.12)) * exp(-age * 3.8);
      float flash = exp(-distance_ * distance_ / 0.004) * exp(-age * 18.0);
      receivedLight += uImpactColours[i] * hit.w * (ring * decay * 0.16 + pool * 0.22 + flash * 0.7);
    }

    // Pointer ripples disturb the surface. They tilt the normal so the
    // reflections bend through the ring; they do not draw a ring.
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 data = uRipples[i];
      if (data.w <= 0.0) continue;

      float age = data.z / uRippleSeconds;
      if (age >= 1.0) continue;

      vec2 d = (vUv - data.xy) * vec2(1.0, 0.42);
      float dist = length(d);
      if (dist < 0.0001) continue;

      float x = (dist - age * uRippleRadius) * 46.0;
      float decay = (1.0 - age) * (1.0 - age);
      slope += (d / dist) * exp(-x * x) * cos(x * 2.2) * decay * data.w * 0.09;
    }

    vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 view = normalize(cameraPosition - vWorld);
    float ndv = clamp(dot(normal, view), 0.0, 1.0);
    // Schlick, water. Near the camera the surface is mostly dark body; at the
    // grazing angles toward the horizon it turns almost fully mirror.
    float fresnel = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

    float far = smoothstep(4.0, 46.0, vDepth);
    vec3 colour = mix(uNear, uFar, far);

    if (uHasReflection > 0.5) {
      /*
       * Looked up exactly where the mirror puts it. The lookup used to be
       * squeezed toward the middle of the texture, which slid every reflected
       * base away from the real one and left a strip of mirrored sky between
       * the rock and the water: the reflection must meet what it reflects.
       */
      vec2 reflectUv = vReflectUv.xy / max(vReflectUv.w, 0.0001);
      // The same slope that shades the surface displaces the lookup, so a
      // reflected edge breaks exactly where a ripple crosses it.
      vec2 offset = vec2(-slope.x, -slope.y) * uDistortion * mix(1.0, 0.22, far);
      vec3 mirrored = texture2D(uReflection, clamp(reflectUv + offset, 0.002, 0.998)).rgb;
      /*
       * Weighted by Fresnel rather than gated on depth. The old depth gate
       * erased the foreground, which is what left rocks sitting on top of the
       * water instead of standing in it.
       */
      colour += mirrored * uSheen * mix(uReflectance.x, uReflectance.y, fresnel);
    }

    /*
     * Ambient pickup on the micro facets. Without this the near field is a
     * black void: there is nothing bright enough nearby for Fresnel to catch,
     * and the viewer loses the fact that the material is water at all.
     */
    float facet = clamp((normal.y - 0.986) * 46.0, -1.0, 1.0);
    float tilt = slope.y;
    colour += uSheen * (facet * 0.05 + tilt * 0.09) * (1.0 - far * 0.55);

    /*
     * Beacon reflections. Each source is mirrored through the water plane and
     * tested against the reflected view vector, so the highlight is a genuine
     * specular lobe on a moving surface. The lobe broadens with distance: out
     * there the ripple detail has already faded, and a tight lobe with nothing
     * left to break it turns into single-pixel sparkle.
     */
    vec3 bounce = reflect(-view, normal);
    // Sample precisely the same outgoing radiance as the sky, through the
    // existing moving wave normal. Resolve transport after the calm haze mix.
    vec3 stormReflection = vec3(0.0);
    if (uWeatherFlash > 0.001 && bounce.y > 0.005) {
      vec3 direction = normalize(bounce);
      stormReflection = stormCloudRadiance(direction, stormCloudDensity(direction));
    }
    for (int i = 0; i < ${MAX_BEACONS}; i++) {
      vec4 beacon = uBeacon[i];
      if (beacon.w <= 0.0) continue;

      vec3 mirrored = vec3(beacon.x, -beacon.y, beacon.z);
      float lobe = max(dot(bounce, normalize(mirrored - vWorld)), 0.0);
      float sharp = mix(1500.0, 90.0, smoothstep(6.0, 58.0, vDepth));
      // A dim shoulder under the glint keeps the path continuous rather than
      // leaving disconnected specks between crests. It is kept narrow: a
      // broad one washed lavender over most of the water in front of a source.
      float path = pow(lobe, sharp) + pow(lobe, 26.0) * 0.08;
      colour += uBeaconColor[i] * path * beacon.w * (0.2 + fresnel * 0.8);
    }

    /*
     * The water dissolves into the same mist the atmosphere draws above it.
     * Matching the colour before the alpha falls away is what removes the hard
     * water-to-horizon boundary; a fade alone would just reveal a dark strip.
     * It starts late and stops short of full: the ranges stand 50 to 90 out,
     * and the water at their feet has to keep enough of their reflection to
     * join them to the surface, or they sit on a plain band of haze.
     */
    float haze = smoothstep(24.0, 110.0, vDepth) * 0.85;
    colour = mix(colour, uMist, haze);
    // Surface reflection and light scattered by the water's distant air each
    // receive one transmittance factor, rather than two independent gains.
    colour += stormReflection * mix(uReflectance.x, uReflectance.y, fresnel) * (1.0 - haze);
    colour += uWeatherColor * uWeatherFlash * ${lightningConfig.hazeGain}
      * (0.3 + 0.7 * weatherHorizonCell(vWorld - cameraPosition)) * haze;

    /*
     * Feather the far edge out before the geometry actually ends. The plane
     * stops a little below the horizon, and holding it opaque to that edge
     * cuts a hard line across the frame where the surface simply stops. Fading
     * it out first lets the mist carry the last stretch instead.
     */
    colour += receivedLight * (1.0 - haze);
    gl_FragColor = vec4(colour, 1.0 - smoothstep(62.0, 100.0, vDepth));
  }
`;

type Ripple = { u: number; v: number; age: number; strength: number };

export type ReflectiveFloorOptions = Readonly<{
  width: number;
  depth: number;
  reflectionSize: number;
  maxRipples: number;
  reducedMotion: boolean;
  config?: WaterConfig;
  weather?: WeatherUniforms;
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
  setBeacons: (sources: readonly BeaconSource[]) => void;
  update: (deltaSeconds: number, elapsedSeconds: number) => void;
  /**
   * Requests a ripple from a viewport-relative pointer position. Ignored unless
   * the pointer is inside the lower band of the viewport.
   */
  requestRipple: (viewportX: number, viewportY: number, speed: number) => boolean;
  requestLightImpact: (x: number, z: number, colour: number, strength: number) => boolean;
  setImpactBudget: (count: number) => void;
  activeLightImpacts: () => number;
  setReflectionSize: (size: number) => void;
  setConfig: (config: WaterConfig) => void;
  /** Ripples currently alive, for reporting. */
  activeRipples: () => number;
  destroy: () => void;
}>;

export function createReflectiveFloor(options: ReflectiveFloorOptions): ReflectiveFloor {
  let config = options.config ?? floorConfig;
  const geometry = new PlaneGeometry(options.width, options.depth, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const ripples: Ripple[] = [];
  const rippleData: number[] = new Array(MAX_RIPPLES * 4).fill(0);
  const beaconData = Array.from({ length: MAX_BEACONS }, () => new Vector4());
  const beaconColor = Array.from({ length: MAX_BEACONS }, () => new Color());
  const lightImpacts = Array.from({ length: MAX_LIGHT_IMPACTS }, () => new Vector4(0, 0, 2, 0));
  const impactColours = Array.from({ length: MAX_LIGHT_IMPACTS }, () => new Color());
  let impactBudget = MAX_LIGHT_IMPACTS;
  let impactCooldown = 0;
  let impactCount = 0;
  let rippleCooldown = 0;
  let target: WebGLRenderTarget | null = null;
  let reflectionSize = options.reflectionSize;

  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...(options.weather ?? createWeatherUniforms()),
      uReflection: { value: null },
      uHasReflection: { value: 0 },
      uReflectMatrix: { value: new Float32Array(16) },
      uTime: { value: 0 },
      uDistortion: { value: config.distortion },
      uSwell: { value: options.reducedMotion ? 0.55 : config.swell },
      uRipple: { value: options.reducedMotion ? 0.55 : config.ripple },
      // Display values: the shader writes them to the canvas unconverted.
      uNear: { value: new Color().setHex(waterTones.near, LinearSRGBColorSpace) },
      uFar: { value: new Color().setHex(waterTones.far, LinearSRGBColorSpace) },
      uMist: { value: new Color().setHex(waterTones.haze, LinearSRGBColorSpace) },
      uSheen: { value: new Color().setHex(waterTones.sheen, LinearSRGBColorSpace) },
      uReflectance: { value: [...waterTones.reflectance] },
      uBeacon: { value: beaconData },
      uBeaconColor: { value: beaconColor },
      uRipples: { value: rippleData },
      uLightImpacts: { value: lightImpacts },
      uImpactColours: { value: impactColours },
      uImpactCount: { value: 0 },
      uRippleRadius: { value: 0.055 },
      uRippleSeconds: { value: config.rippleSeconds },
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

    setBeacons: (sources) => {
      for (let index = 0; index < MAX_BEACONS; index += 1) {
        const source = sources[index];
        beaconData[index]!.set(
          source?.world.x ?? 0,
          source?.world.y ?? 0,
          source?.world.z ?? 0,
          source?.intensity ?? 0,
        );
        beaconColor[index]!.copy(source?.color ?? new Color(0));
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

    requestLightImpact: (x, z, colour, strength) => {
      if (options.reducedMotion || impactCooldown > 0) return false;
      let slot = -1;
      for (let i = 0; i < impactBudget; i++) {
        if (lightImpacts[i]!.w === 0) {
          slot = i;
          break;
        }
      }
      if (slot < 0) return false;
      lightImpacts[slot]!.set(x, z, 0, Math.min(1, strength * 1.6));
      impactColours[slot]!.setRGB(0.3 + colour * 0.45, 0.55 - colour * 0.15, 1);
      impactCooldown = 0.11;
      return true;
    },
    setImpactBudget: (count) => {
      impactBudget = Math.min(MAX_LIGHT_IMPACTS, count);
    },
    activeLightImpacts: () => impactCount,
    update: (deltaSeconds, elapsedSeconds) => {
      impactCooldown = Math.max(0, impactCooldown - deltaSeconds);
      impactCount = 0;
      let lastImpact = 0;
      for (let i = 0; i < MAX_LIGHT_IMPACTS; i++) {
        const hit = lightImpacts[i]!;
        if (hit.w === 0) continue;
        hit.z += deltaSeconds;
        if (hit.z >= 1.8) {
          hit.w = 0;
          continue;
        }
        impactCount++;
        lastImpact = i + 1;
      }
      material.uniforms.uImpactCount!.value = lastImpact;
      material.uniforms.uTime!.value = options.reducedMotion ? 0 : elapsedSeconds;

      rippleCooldown = Math.max(0, rippleCooldown - deltaSeconds);

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        const ripple = ripples[index]!;
        ripple.age += deltaSeconds;
        if (ripple.age >= config.rippleSeconds) {
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
      if (viewportY < 1 - config.pointerZone) {
        return false;
      }

      if (ripples.length >= options.maxRipples) {
        ripples.shift();
      }

      const depthInBand = (viewportY - (1 - config.pointerZone)) / config.pointerZone;

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

      rippleCooldown = config.rippleInterval;
      return true;
    },

    activeRipples: () => ripples.length,

    setReflectionSize: (size) => {
      reflectionSize = size;
      ensureTarget();
    },

    setConfig: (next) => {
      config = next;
      material.uniforms.uDistortion!.value = next.distortion;
      material.uniforms.uSwell!.value = options.reducedMotion ? 0.55 : next.swell;
      material.uniforms.uRipple!.value = options.reducedMotion ? 0.55 : next.ripple;
      material.uniforms.uRippleSeconds!.value = next.rippleSeconds;
    },

    destroy: () => {
      geometry.dispose();
      material.dispose();
      target?.dispose();
      target = null;
    },
  };
}
