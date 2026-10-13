import {
  ClampToEdgeWrapping,
  Color,
  Data3DTexture,
  GLSL3,
  LinearFilter,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
  type Texture,
} from "three";
import { GRADE_VERTEX, GRADE_FRAGMENT } from "./shaders";
import preset from "./preset.json";
import { createWeatherBloom } from "./bloom";

/** Scene-only grading; HTML text and controls retain their own colors. */
export function createWeatherGrade(renderer: WebGLRenderer) {
  const g = preset.grade;
  const bloom = createWeatherBloom(renderer);
  const target = new WebGLRenderTarget(1, 1, { minFilter: LinearFilter, magFilter: LinearFilter });
  const size = new Vector2();
  const noise = new TextureLoader().load("/weather/textures/blue-noise.png");
  noise.wrapS = noise.wrapT = RepeatWrapping;
  noise.colorSpace = SRGBColorSpace;
  const data = new Uint8Array(32 * 32 * 32 * 4);
  for (let b = 0; b < 32; b++)
    for (let y = 0; y < 32; y++)
      for (let r = 0; r < 32; r++) {
        const i = ((b * 32 + y) * 32 + r) * 4;
        data.set([(r / 31) * 255, (y / 31) * 255, (b / 31) * 255, 255], i);
      }
  let lut = new Data3DTexture(data, 32, 32, 32);
  lut.minFilter = lut.magFilter = LinearFilter;
  lut.needsUpdate = true;
  const uniforms = {
    tScene: { value: target.texture },
    tDistortion: { value: noise },
    tBloom: { value: noise as Texture },
    tFluid: { value: noise },
    tBlur: { value: noise },
    tNoise: { value: noise },
    tBanner: { value: noise },
    tPanel: { value: noise },
    tLut: { value: lut },
    uLutIntensity: { value: 0 },
    boolBloom: { value: true },
    boolFluid: { value: false },
    boolLuminosity: { value: false },
    boolFxaa: { value: false },
    uRgbShiftAmount: { value: g.rgbShiftAmount },
    uVignIn: { value: g.vignette.inner },
    uVignOut: { value: g.vignette.outer },
    uVignFade: { value: g.vignette.fade },
    uContrast: { value: 1 },
    uRatio: { value: 1 },
    uHue: { value: 0 },
    uExposure: { value: 1 },
    uSaturation: { value: g.saturation },
    uRevealFactor: { value: 1 },
    uRevealColor: { value: new Color() },
    uTime: { value: 0 },
    uGrainIntensity: { value: g.grain.intensity },
    uDistortionAmount: { value: 0 },
    uDistortionMix: { value: 0 },
    uDistortionScale: { value: 1 },
    uExposureOffset: { value: 0 },
    uBannerMix: { value: 1 },
    uPanelMix: { value: 1 },
    uBannerActive: { value: false },
    uPanelActive: { value: false },
  };
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: GRADE_VERTEX,
    fragmentShader: GRADE_FRAGMENT,
    uniforms,
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const scene = new Scene();
  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const controller = new AbortController();
  let destroyed = false;
  void fetch("/weather/textures/color-correction.bin", { signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Color map HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (destroyed) return;
      const side = new DataView(buffer).getUint32(0, true);
      if (side !== 32 || buffer.byteLength !== 4 + side ** 3 * 4)
        throw new Error("Invalid color map");
      const next = new Data3DTexture(new Uint8Array(buffer, 4), side, side, side);
      next.minFilter = next.magFilter = LinearFilter;
      next.wrapS = next.wrapT = next.wrapR = ClampToEdgeWrapping;
      next.generateMipmaps = false;
      next.needsUpdate = true;
      lut.dispose();
      lut = next;
      uniforms.tLut.value = next;
      // Keep the portfolio palette; the weather color map stays neutral.
      uniforms.uLutIntensity.value = 0;
    })
    .catch((error) => {
      if (!controller.signal.aborted) console.error(error);
    });
  return {
    begin: (time: number) => {
      renderer.getDrawingBufferSize(size);
      if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
      uniforms.uRatio.value = size.x / size.y;
      uniforms.uTime.value = time;
      renderer.setRenderTarget(target);
    },
    finish: () => {
      uniforms.tBloom.value = bloom.render(target.texture, size.x, size.y);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    },
    destroy: () => {
      destroyed = true;
      controller.abort();
      target.dispose();
      bloom.destroy();
      material.dispose();
      mesh.geometry.dispose();
      noise.dispose();
      lut.dispose();
    },
  };
}
