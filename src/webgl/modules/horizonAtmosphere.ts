import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  Vector4,
  type WebGLRenderer,
} from "three";

import { horizonAtmosphereConfig, horizonLightConfig, sceneColors } from "../sceneConfig";

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

const PLUME_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  uniform float uSpeed;
  uniform vec3 uColor;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    float t = uTime * uSpeed;
    float bend = (fbm(vec2(vUv.y * 2.0 + uSeed, t * 0.26)) - 0.5) * 0.24;
    float sideways = sin(vUv.y * 4.1 + t * 0.17 + uSeed) * 0.025;
    float x = abs(vUv.x - 0.5 - bend * vUv.y - sideways);
    float width = mix(0.14, 0.33, vUv.y);
    float edgeNoise = fbm(vec2(vUv.x * 5.0 + uSeed, vUv.y * 5.8 - t * 0.17));
    float edge = 1.0 - smoothstep(width - 0.13, width + 0.06, x + (edgeNoise - 0.5) * 0.13);
    float inner = fbm(vec2(vUv.x * 3.8 + uSeed * 2.0, vUv.y * 5.2 - t * 0.24));
    float base = smoothstep(0.0, 0.13, vUv.y);
    float top = pow(1.0 - smoothstep(0.36, 1.0, vUv.y), 1.55);
    float alpha = edge * base * top * (0.34 + 0.66 * inner) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
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

const WATERLINE_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uHorizon;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    float wander = (fbm(vec2(vUv.x * 11.0, uTime * 0.004)) - 0.5) * 0.009;
    float distance = vUv.y - uHorizon - wander;
    float width = distance > 0.0 ? 0.055 : 0.062;
    float fade = exp(-pow(distance / width, 2.0) * 1.7);
    float texture = 0.7 + fbm(vec2(vUv.x * 14.0, vUv.y * 8.0 - uTime * 0.003)) * 0.3;
    float side = smoothstep(0.0, 0.035, vUv.x) * smoothstep(0.0, 0.035, 1.0 - vUv.x);
    gl_FragColor = vec4(uColor, fade * texture * side * uOpacity);
  }
`;

export type HorizonAtmosphere = Readonly<{
  resize: (camera: PerspectiveCamera) => void;
  update: (elapsedSeconds: number) => void;
  renderWaterline: (renderer: WebGLRenderer) => void;
  destroy: () => void;
}>;

/** Three independent, very low-contrast layers behind the near scene. */
export function createHorizonAtmosphere(
  scene: Scene,
  camera: PerspectiveCamera,
  reducedMotion: boolean,
): HorizonAtmosphere {
  const group = new Group();
  const geometry = new PlaneGeometry(1, 1);
  const materials: ShaderMaterial[] = [];
  const timeUniform = { value: 0 };
  const horizonUniform = { value: 0.28 };
  const color = new Color(sceneColors.lavender);
  const glowLights = horizonLightConfig.sources.map(
    (source) => new Vector4(source.position, source.intensity, 0.075, 0),
  );

  const makePlane = (fragmentShader: string, opacity: number, additive = false) => {
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader,
      uniforms: {
        uTime: timeUniform,
        uColor: { value: color },
        uOpacity: { value: opacity },
        uLights: { value: glowLights },
        uSeed: { value: 0 },
        uSpeed: { value: 1 },
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

  const haze = makePlane(HAZE_SHADER, horizonAtmosphereConfig.hazeOpacity);
  const glow = makePlane(GLOW_SHADER, horizonAtmosphereConfig.glowOpacity, true);
  const plumes = horizonAtmosphereConfig.plumes.map((plume, index) => {
    const mesh = makePlane(PLUME_SHADER, plume.opacity);
    const material = mesh.material as ShaderMaterial;
    material.uniforms.uSeed!.value = index * 7.17 + 2.4;
    material.uniforms.uSpeed!.value = plume.speed;
    return mesh;
  });

  // A screen-space veil spans a few pixels on both sides of the actual water
  // contact line. It is a separate pass so the floor cannot depth-occlude it.
  const waterlineScene = new Scene();
  const waterlineCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 2);
  waterlineCamera.position.z = 1;
  const waterlineGeometry = new PlaneGeometry(2, 2);
  const waterlineMaterial = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: WATERLINE_SHADER,
    uniforms: {
      uTime: timeUniform,
      uHorizon: horizonUniform,
      uColor: { value: color },
      uOpacity: { value: horizonAtmosphereConfig.waterlineOpacity },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  waterlineScene.add(new Mesh(waterlineGeometry, waterlineMaterial));

  scene.add(group);

  const resize = (viewCamera: PerspectiveCamera) => {
    const distance = viewCamera.position.z - horizonAtmosphereConfig.depth;
    const viewHeight = 2 * Math.tan((viewCamera.fov * Math.PI) / 360) * distance;
    const viewWidth = viewHeight * viewCamera.aspect;
    const y = horizonAtmosphereConfig.baseY;
    viewCamera.updateMatrixWorld();
    const contact = new Vector3(0, y, horizonAtmosphereConfig.depth).project(viewCamera);
    horizonUniform.value = (contact.y + 1) * 0.5;

    haze.position.set(
      0,
      y + (horizonAtmosphereConfig.hazeHeight - horizonAtmosphereConfig.hazeBelow) * 0.5,
      horizonAtmosphereConfig.depth,
    );
    haze.scale.set(
      viewWidth * 1.13,
      horizonAtmosphereConfig.hazeHeight + horizonAtmosphereConfig.hazeBelow,
      1,
    );
    haze.quaternion.copy(viewCamera.quaternion);

    glow.position.set(
      0,
      y + (horizonAtmosphereConfig.glowHeight - horizonAtmosphereConfig.glowBelow) * 0.5,
      horizonAtmosphereConfig.depth + 0.03,
    );
    glow.scale.set(
      viewWidth * 1.13,
      horizonAtmosphereConfig.glowHeight + horizonAtmosphereConfig.glowBelow,
      1,
    );
    glow.quaternion.copy(viewCamera.quaternion);

    plumes.forEach((mesh, index) => {
      const plume = horizonAtmosphereConfig.plumes[index]!;
      mesh.position.set(
        (plume.x - 0.5) * viewWidth,
        y + plume.height * 0.5,
        horizonAtmosphereConfig.depth + 0.06,
      );
      mesh.scale.set(viewWidth * plume.width, plume.height, 1);
      mesh.quaternion.copy(viewCamera.quaternion);
    });
  };
  resize(camera);

  return {
    resize,
    update: (elapsedSeconds) => {
      timeUniform.value = reducedMotion ? 0 : elapsedSeconds;
    },
    renderWaterline: (renderer) => {
      renderer.clearDepth();
      renderer.render(waterlineScene, waterlineCamera);
    },
    destroy: () => {
      scene.remove(group);
      materials.forEach((material) => material.dispose());
      geometry.dispose();
      waterlineMaterial.dispose();
      waterlineGeometry.dispose();
      waterlineScene.clear();
    },
  };
}
