import {
  GLSL3,
  LinearFilter,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  Scene,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import {
  BRIGHT_VERTEX,
  BRIGHT_FRAGMENT,
  BLUR_VERTEX,
  BLUR_FRAGMENT,
  BLOOM_VERTEX,
  BLOOM_FRAGMENT,
} from "./shaders";

/** Four Gaussian mip levels carry the cloud flash through the scene grade. */
export function createWeatherBloom(renderer: WebGLRenderer) {
  const makeTarget = () =>
    new WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });
  const bright = makeTarget(),
    horizontal = [makeTarget(), makeTarget(), makeTarget(), makeTarget()],
    vertical = horizontal.map(makeTarget);
  const makeMaterial = (
    vertexShader: string,
    fragmentShader: string,
    uniforms: Record<string, { value: unknown }>,
    defines: Record<string, number> = {},
  ) =>
    new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader,
      fragmentShader,
      uniforms,
      defines,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  const luminosity = makeMaterial(BRIGHT_VERTEX, BRIGHT_FRAGMENT, {
    tMap: { value: null },
    uThreshold: { value: 0.05 },
    uSmoothing: { value: 0.6 },
  });
  const blur = [3, 5, 7, 9].map((kernel) =>
    makeMaterial(
      BLUR_VERTEX,
      BLUR_FRAGMENT,
      {
        tMap: { value: null },
        uDirection: { value: new Vector2(1, 0) },
        uResolution: { value: new Vector2() },
      },
      { KERNEL_RADIUS: kernel, SIGMA: kernel },
    ),
  );
  const composite = makeMaterial(
    BLOOM_VERTEX,
    BLOOM_FRAGMENT,
    {
      tBlur1: { value: vertical[0]!.texture },
      tBlur2: { value: vertical[1]!.texture },
      tBlur3: { value: vertical[2]!.texture },
      tBlur4: { value: vertical[3]!.texture },
      tBlur5: { value: null },
      uBloomFactors: { value: [0.25, 0.5, 0.75, 1, 0.2] },
    },
    { NUM_MIPS: 5 },
  );
  const scene = new Scene(),
    camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    mesh = new Mesh(new PlaneGeometry(2, 2), luminosity);
  scene.add(mesh);
  let lastWidth = 0,
    lastHeight = 0;
  const pass = (material: RawShaderMaterial, target: WebGLRenderTarget) => {
    mesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  };
  return {
    render: (texture: Texture, width: number, height: number) => {
      if (width !== lastWidth || height !== lastHeight) {
        lastWidth = width;
        lastHeight = height;
        let w = Math.max(1, Math.pow(2, Math.floor(Math.log2(width))) / 4),
          h = Math.max(1, Math.pow(2, Math.floor(Math.log2(height))) / 4);
        bright.setSize(w, h);
        for (let i = 0; i < 4; i++) {
          horizontal[i]!.setSize(w, h);
          vertical[i]!.setSize(w, h);
          blur[i]!.uniforms.uResolution!.value.set(w, h);
          w = Math.max(1, w / 2);
          h = Math.max(1, h / 2);
        }
      }
      luminosity.uniforms.tMap!.value = texture;
      pass(luminosity, bright);
      let input = bright.texture;
      for (let i = 0; i < 4; i++) {
        const material = blur[i]!;
        material.uniforms.tMap!.value = input;
        material.uniforms.uDirection!.value.set(1, 0);
        pass(material, horizontal[i]!);
        material.uniforms.tMap!.value = horizontal[i]!.texture;
        material.uniforms.uDirection!.value.set(0, 1);
        pass(material, vertical[i]!);
        input = vertical[i]!.texture;
      }
      pass(composite, horizontal[0]!);
      return horizontal[0]!.texture;
    },
    destroy: () => {
      bright.dispose();
      for (const t of [...horizontal, ...vertical]) t.dispose();
      for (const m of [luminosity, composite, ...blur]) m.dispose();
      mesh.geometry.dispose();
    },
  };
}
