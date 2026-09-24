import {
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector4,
} from "three";

import { horizonAtmosphereConfig } from "../sceneConfig";
import type { FogConfig } from "../sceneTypes";

const MAX_LIGHTS = 4;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/*
 * A low, uneven mist sheet.
 *
 * Three of these run at different depths with different noise, drift, size and
 * opacity. Individually each is a plane; together they read as one irregular
 * atmospheric field, which is the point — no single layer should be findable.
 *
 * The base colour is nearly the environment colour. Mist is not purple smoke;
 * it only takes on colour where a beacon is actually lighting it.
 */
const MIST_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uOpacity;
  uniform float uSeed;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uHeightBias;
  /** x = centre in plane UV, y = gaussian width, z = weight. */
  uniform vec4 uLights[${MAX_LIGHTS}];

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Rotating the coordinates between octaves reduces obvious repetition.
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      value += noise2D(p) * amplitude;
      p = rotation * p * 2.02;
      p += vec2(17.1, 9.2);
      amplitude *= 0.5;
    }
    return value;
  }

  float gaussian(float x, float centre, float width) {
    float d = (x - centre) / width;
    return exp(-d * d);
  }

  void main() {
    float time = uTime * uSpeed;

    // Stretched horizontally: mist forms long irregular banks, not round puffs.
    vec2 p = vec2(vUv.x * uScale, vUv.y * 2.1);

    // Domain warp, so this cannot read as plain procedural noise.
    vec2 warp;
    warp.x = fbm(p * 0.72 + vec2(time * 0.055, uSeed));
    warp.y = fbm(p * 0.61 + vec2(uSeed * 2.7, -time * 0.031));
    warp -= 0.5;
    vec2 warpedP = p + warp * vec2(0.72, 0.26);

    // Banks, then irregular boundaries, then fine breakup.
    float broad = fbm(warpedP * 0.48 + vec2(time * 0.022, uSeed));
    float medium = fbm(warpedP * 1.15 + vec2(-time * 0.036, uSeed * 3.1));
    float fine = fbm(warpedP * 2.65 + vec2(time * 0.051, -uSeed));

    float density = broad * 0.62 + medium * 0.28 + fine * 0.10;
    // Real mist does not cover the horizon uniformly.
    density = smoothstep(0.39, 0.70, density);

    float height = clamp(1.0 - vUv.y + uHeightBias, 0.0, 1.0);
    float groundMist = pow(height, 2.35);
    // Some banks rise a little above the main layer.
    float risingMist = pow(height, 1.25) * smoothstep(0.57, 0.78, broad) * 0.30;

    float alpha = density * (groundMist + risingMist);

    float coverage = fbm(vec2(vUv.x * 3.0 + uSeed * 4.0 + time * 0.013, 0.73));
    coverage = smoothstep(0.24, 0.70, coverage);
    alpha *= coverage;

    float left = smoothstep(0.0, 0.12, vUv.x);
    float right = smoothstep(0.0, 0.12, 1.0 - vUv.x);
    float top = smoothstep(0.0, 0.16, 1.0 - vUv.y);
    alpha *= left * right * top;

    // The beacons illuminate the mist they sit in.
    float lightAmount = 0.0;
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      lightAmount += gaussian(vUv.x, uLights[i].x, max(uLights[i].y, 0.001)) * uLights[i].z;
    }
    // Light mainly reaches the mist close to the water.
    lightAmount *= pow(1.0 - vUv.y, 1.5);

    vec3 baseMist = vec3(0.050, 0.043, 0.062);
    vec3 illuminatedMist = vec3(0.19, 0.145, 0.25);
    vec3 color = mix(baseMist, illuminatedMist, clamp(lightAmount, 0.0, 1.0));
    color += vec3(0.025, 0.021, 0.031) * broad;

    alpha *= uOpacity;
    // Never an opaque purple wall.
    alpha = clamp(alpha, 0.0, 0.27);

    gl_FragColor = vec4(color, alpha);
  }
`;

export type HorizonAtmosphere = Readonly<{
  /** The mist sheets, so the camera rig can carry them with the view. */
  group: Group;
  resize: (camera: PerspectiveCamera) => void;
  update: (elapsedSeconds: number) => void;
  setConfig: (fog: FogConfig, camera: PerspectiveCamera) => void;
  /** Accepts each beacon's viewport centre and spread. */
  setIllumination: (sources: readonly (readonly [number, number, number?])[]) => void;
  destroy: () => void;
}>;

export function createHorizonAtmosphere(
  scene: Scene,
  camera: PerspectiveCamera,
  reducedMotion: boolean,
  initialFog: FogConfig = horizonAtmosphereConfig,
): HorizonAtmosphere {
  let fogConfig = initialFog;
  const group = new Group();
  const geometry = new PlaneGeometry(1, 1);
  const timeUniform = { value: 0 };
  const lightUniform = Array.from({ length: MAX_LIGHTS }, () => new Vector4());

  /*
   * Each sheet is a touch wider than the viewport, so a beacon's viewport
   * fraction has to be remapped into plane UV or the mist would light the
   * wrong stretch of horizon.
   */
  const applyIllumination = (
    sources: readonly (readonly [number, number, number?])[],
    widthFactor: number,
  ) => {
    for (let index = 0; index < MAX_LIGHTS; index += 1) {
      const source = sources[index];
      if (!source) {
        lightUniform[index]!.set(0, 1, 0, 0);
        continue;
      }
      const [centre, spread, strength = 1] = source;
      lightUniform[index]!.set(
        0.5 + (centre - 0.5) / widthFactor,
        Math.max(spread / widthFactor, 0.02),
        0.6 * strength,
        0,
      );
    }
  };

  const layers = fogConfig.layers.map((layer) => {
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: MIST_SHADER,
      uniforms: {
        uTime: timeUniform,
        uOpacity: { value: layer.opacity },
        uSeed: { value: layer.seed },
        uSpeed: { value: layer.speed },
        uScale: { value: layer.noiseScale },
        uHeightBias: { value: layer.heightBias },
        uLights: { value: lightUniform },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
    });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 2;
    group.add(mesh);
    return mesh;
  });

  scene.add(group);

  const resize = (viewCamera: PerspectiveCamera) => {
    viewCamera.updateMatrixWorld();
    layers.forEach((mesh, index) => {
      const layer = fogConfig.layers[index]!;
      const distance = viewCamera.position.z - layer.depth;
      const viewHeight = 2 * Math.tan((viewCamera.fov * Math.PI) / 360) * distance;
      const viewWidth = viewHeight * viewCamera.aspect;
      /*
       * The dense edge of the sheet is its base, so the base is pinned just
       * under the waterline. Anything higher leaves a gap; anything lower
       * spends the density budget where the water hides it.
       */
      mesh.scale.set(viewWidth * layer.widthFactor, layer.height, 1);
      mesh.position.set(layer.offsetX, layer.height * 0.5 - 0.2, layer.depth);
      mesh.quaternion.copy(viewCamera.quaternion);
    });
  };
  resize(camera);

  return {
    group,
    resize,
    update: (elapsedSeconds) => {
      timeUniform.value = reducedMotion ? 0 : elapsedSeconds;
    },
    setIllumination: (sources) => {
      applyIllumination(sources, fogConfig.layers[0]?.widthFactor ?? 1.2);
    },
    setConfig: (nextFog, viewCamera) => {
      fogConfig = nextFog;
      layers.forEach((mesh, index) => {
        const layer = nextFog.layers[index];
        mesh.visible = Boolean(layer);
        if (!layer) return;
        const uniforms = (mesh.material as ShaderMaterial).uniforms;
        uniforms.uOpacity!.value = layer.opacity;
        uniforms.uSeed!.value = layer.seed;
        uniforms.uSpeed!.value = layer.speed;
        uniforms.uScale!.value = layer.noiseScale;
        uniforms.uHeightBias!.value = layer.heightBias;
      });
      resize(viewCamera);
    },
    destroy: () => {
      scene.remove(group);
      layers.forEach((mesh) => (mesh.material as ShaderMaterial).dispose());
      geometry.dispose();
    },
  };
}
