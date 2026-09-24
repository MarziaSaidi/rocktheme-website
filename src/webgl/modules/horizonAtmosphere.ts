import {
  AdditiveBlending,
  Color,
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

import { horizonAtmosphereConfig, horizonLightConfig, sceneColors } from "../sceneConfig";
import type { FogConfig, HorizonLightConfig } from "../sceneTypes";

const MAX_LIGHTS = 4;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NOISE = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), u.x), u.y);
  }
  float fbm(vec2 p) {
    return 0.57 * noise(p) + 0.29 * noise(p * 2.13 + 8.4)
         + 0.14 * noise(p * 4.17 + 19.7);
  }
`;

const HAZE_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    float side = smoothstep(0.0, 0.07, vUv.x) * smoothstep(0.0, 0.07, 1.0 - vUv.x);
    float bottom = smoothstep(0.0, 0.12, vUv.y);
    float rise = pow(1.0 - smoothstep(0.08, 0.98, vUv.y), 2.0);
    float texture = fbm(vec2(vUv.x * 8.0 + uTime * 0.006, vUv.y * 2.6 - uTime * 0.003));
    float veils = 0.58 + texture * 0.55;
    gl_FragColor = vec4(uColor, side * bottom * rise * veils * uOpacity);
  }
`;

/*
 * One continuous mist volume, not a row of objects.
 *
 * Coverage, lift and internal structure are three independent noise fields at
 * different scales, so the layer thins to nothing in some stretches and gathers
 * in others without ever repeating a silhouette. Density is pinned to the
 * water by an exponential vertical falloff: the mist hangs on the surface and
 * only occasionally reaches higher.
 */
const MIST_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uCoverageScale;
  uniform float uCling;
  uniform float uDrift;
  uniform vec3 uColor;
  uniform vec3 uLitColor;
  uniform vec4 uLights[4];
  varying vec2 vUv;
  ${NOISE}
  void main() {
    float t = uTime * uDrift;

    // Where the mist is at all. Broad and slow: whole stretches of horizon go
    // nearly clear while others stay banked up.
    float coverage = fbm(vec2(vUv.x * uCoverageScale + t * 0.7, t));
    coverage = smoothstep(0.24, 0.78, coverage + 0.16);

    // How high it reaches there. A separate, even broader field, so the rises
    // do not line up with the dense patches.
    float lift = 0.55 + fbm(vec2(vUv.x * 1.6 - 4.2, t * 0.8)) * 0.95;

    // Most of the volume clings to the water.
    float vertical = exp(-pow(vUv.y / max(uCling * lift, 0.04), 1.3));

    // Domain-warped interior. The warp is what keeps this from reading as a
    // tiled noise texture stretched along the horizon.
    vec2 q = vec2(vUv.x * 3.6, vUv.y * 1.5);
    q += vec2(fbm(q * 1.3 + t * 1.1), fbm(q * 1.1 - t * 0.9)) * 0.6;
    float body = fbm(q * 2.0 + vec2(t * 0.6, -t * 0.4));

    // The beacons light the mist they sit in. Same sources, same falloff as
    // the glow layer, so one light reads as one physical thing.
    float lit = 0.0;
    for (int i = 0; i < 4; i++) {
      float dx = (vUv.x - uLights[i].x) / max(uLights[i].z, 0.001);
      lit += exp(-dx * dx * 1.7) * uLights[i].y;
    }

    vec3 colour = mix(uColor, uLitColor, clamp(lit * 0.8, 0.0, 1.0));
    float side = smoothstep(0.0, 0.06, vUv.x) * smoothstep(0.0, 0.06, 1.0 - vUv.x);
    float alpha = vertical * coverage * side * (0.32 + body * 0.85) * uOpacity;
    gl_FragColor = vec4(colour, alpha);
  }
`;

const GLOW_SHADER = /* glsl */ `
  precision highp float;
  uniform vec4 uLights[4];
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float glow = 0.0;
    for (int i = 0; i < 4; i++) {
      float dx = (vUv.x - uLights[i].x) / uLights[i].z;
      float dy = (vUv.y - 0.12) / 0.32;
      glow += exp(-(dx * dx + dy * dy) * 2.5) * uLights[i].y;
    }
    float bottom = smoothstep(0.0, 0.13, vUv.y);
    float top = 1.0 - smoothstep(0.38, 0.96, vUv.y);
    gl_FragColor = vec4(uColor, glow * bottom * top * uOpacity);
  }
`;

export type HorizonAtmosphere = Readonly<{
  resize: (camera: PerspectiveCamera) => void;
  update: (elapsedSeconds: number) => void;
  setConfig: (fog: FogConfig, lights: HorizonLightConfig, camera: PerspectiveCamera) => void;
  destroy: () => void;
}>;

/** Three independent, very low-contrast layers behind the near scene. */
export function createHorizonAtmosphere(
  scene: Scene,
  camera: PerspectiveCamera,
  reducedMotion: boolean,
  initialFog: FogConfig = horizonAtmosphereConfig,
  initialLights: HorizonLightConfig = horizonLightConfig,
): HorizonAtmosphere {
  let fogConfig = initialFog;
  let lightConfig = initialLights;
  const group = new Group();
  const geometry = new PlaneGeometry(1, 1);
  const materials: ShaderMaterial[] = [];
  const timeUniform = { value: 0 };
  const color = new Color(sceneColors.lavender);
  // The mist body sits far darker than the light that picks it out, so a lit
  // pocket reads as illumination rather than as a brighter cloud.
  const mistColor = new Color(sceneColors.lavender).multiplyScalar(0.34);
  const mistLitColor = new Color(sceneColors.lavender).multiplyScalar(1.05);
  const glowLights = Array.from({ length: MAX_LIGHTS }, (_, index) => {
    const source = lightConfig.sources[index];
    return new Vector4(source?.position ?? 0, source?.intensity ?? 0, source?.spread ?? 0.075, 0);
  });

  const makePlane = (fragmentShader: string, opacity: number, additive = false) => {
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader,
      uniforms: {
        uTime: timeUniform,
        uColor: { value: color },
        uOpacity: { value: opacity },
        uLights: { value: glowLights },
        uLitColor: { value: mistLitColor },
        uCoverageScale: { value: fogConfig.mist.coverageScale },
        uCling: { value: fogConfig.mist.cling },
        uDrift: { value: fogConfig.mist.drift },
      },
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = additive ? 1 : 0;
    materials.push(material);
    group.add(mesh);
    return mesh;
  };

  const haze = makePlane(HAZE_SHADER, fogConfig.hazeOpacity);
  const glow = makePlane(GLOW_SHADER, fogConfig.glowOpacity, true);
  const mist = makePlane(MIST_SHADER, fogConfig.mist.opacity);
  mist.material.uniforms.uColor!.value = mistColor;
  mist.renderOrder = 2;

  scene.add(group);

  const place = (mesh: Mesh, height: number, below: number, viewWidth: number, offset: number) => {
    mesh.position.set(0, fogConfig.baseY + (height - below) * 0.5, fogConfig.depth + offset);
    mesh.scale.set(viewWidth * 1.13, height + below, 1);
  };

  const resize = (viewCamera: PerspectiveCamera) => {
    const distance = viewCamera.position.z - fogConfig.depth;
    const viewHeight = 2 * Math.tan((viewCamera.fov * Math.PI) / 360) * distance;
    const viewWidth = viewHeight * viewCamera.aspect;
    viewCamera.updateMatrixWorld();

    place(haze, fogConfig.hazeHeight, fogConfig.hazeBelow, viewWidth, 0);
    place(glow, fogConfig.glowHeight, fogConfig.glowBelow, viewWidth, 0.03);
    /*
     * The mist is pinned to the waterline rather than to the fog base. Its
     * whole job is to bridge water and sky, and any gap under it puts the seam
     * straight back. It dips slightly below zero so the overlap is certain.
     */
    mist.position.set(0, fogConfig.mist.height * 0.5 - 0.14, fogConfig.depth + 0.06);
    mist.scale.set(viewWidth * 1.13, fogConfig.mist.height, 1);
    group.children.forEach((child) => child.quaternion.copy(viewCamera.quaternion));
  };
  resize(camera);

  return {
    resize,
    update: (elapsedSeconds) => {
      timeUniform.value = reducedMotion ? 0 : elapsedSeconds;
    },
    setConfig: (nextFog, nextLights, viewCamera) => {
      fogConfig = nextFog;
      lightConfig = nextLights;
      haze.material.uniforms.uOpacity!.value = nextFog.hazeOpacity;
      glow.material.uniforms.uOpacity!.value = nextFog.glowOpacity;
      const mistUniforms = mist.material.uniforms;
      mistUniforms.uOpacity!.value = nextFog.mist.opacity;
      mistUniforms.uCoverageScale!.value = nextFog.mist.coverageScale;
      mistUniforms.uCling!.value = nextFog.mist.cling;
      mistUniforms.uDrift!.value = nextFog.mist.drift;
      glowLights.forEach((light, index) => {
        const source = lightConfig.sources[index];
        light.set(source?.position ?? 0, source?.intensity ?? 0, source?.spread ?? 0.075, 0);
      });
      resize(viewCamera);
    },
    destroy: () => {
      scene.remove(group);
      materials.forEach((material) => material.dispose());
      geometry.dispose();
    },
  };
}
