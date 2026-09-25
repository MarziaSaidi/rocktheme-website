import { Color, SRGBColorSpace, Vector3, Vector4, type MeshStandardMaterial } from "three";

import type { DistanceFogConfig } from "../sceneTypes";

/**
 * Aerial perspective for far geometry.
 *
 * The scene's linear fog is tuned for the rocks standing 15 to 25 units out;
 * anything past its far distance comes out solid fog colour. The mountain
 * range stands well beyond that, so it opts out of scene fog and takes this
 * instead: exponential-squared on distance, which barely touches the front
 * ridges and sinks the back ones, plus a thin extra haze near the waterline
 * so the range's feet dissolve rather than cut against the water.
 *
 * It is blended after the colour-space conversion, as three.js does with its
 * own fog, so the colour is uploaded in the output (sRGB) space and matches
 * the DOM background the canvas composites over.
 */

export type DistanceFogUniforms = {
  uAtmosColor: { value: Vector3 };
  uAtmosLow: { value: Vector3 };
  /** x distance, y density, z height, w heightDensity */
  uAtmosShape: { value: Vector4 };
  uAtmosMax: { value: number };
};

const scratch = new Color();

export function createDistanceFogUniforms(config: DistanceFogConfig): DistanceFogUniforms {
  const uniforms: DistanceFogUniforms = {
    uAtmosColor: { value: new Vector3() },
    uAtmosLow: { value: new Vector3() },
    uAtmosShape: { value: new Vector4() },
    uAtmosMax: { value: 0 },
  };
  setDistanceFog(uniforms, config);
  return uniforms;
}

export function setDistanceFog(uniforms: DistanceFogUniforms, config: DistanceFogConfig) {
  scratch.setHex(config.color);
  const rgb = { r: 0, g: 0, b: 0 };
  scratch.getRGB(rgb, SRGBColorSpace);
  uniforms.uAtmosColor.value.set(rgb.r, rgb.g, rgb.b);
  scratch.setHex(config.lowColor ?? config.color);
  scratch.getRGB(rgb, SRGBColorSpace);
  uniforms.uAtmosLow.value.set(rgb.r, rgb.g, rgb.b);
  uniforms.uAtmosShape.value.set(
    config.distance,
    config.density,
    Math.max(config.height, 0.001),
    config.heightDensity,
  );
  uniforms.uAtmosMax.value = config.maxAmount;
}

export function applyDistanceFog(material: MeshStandardMaterial, uniforms: DistanceFogUniforms) {
  // Scene fog would flatten the range to its colour; this replaces it.
  material.fog = false;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vAtmosWorld;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvAtmosWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vAtmosWorld;
         uniform vec3 uAtmosColor;
         uniform vec3 uAtmosLow;
         uniform vec4 uAtmosShape;
         uniform float uAtmosMax;`,
      )
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
         {
           float atmosDepth = max(distance(vAtmosWorld, cameraPosition) - uAtmosShape.x, 0.0);
           float atmosDistance = 1.0 - exp(-pow(uAtmosShape.y * atmosDepth, 2.0));
           // Haze at the base, only where the distance term has begun.
           float atmosLow = exp(-max(vAtmosWorld.y, 0.0) / uAtmosShape.z);
           float atmosBase = uAtmosShape.w * atmosLow * clamp(atmosDepth / uAtmosShape.x, 0.0, 1.0);
           float atmos = 1.0 - (1.0 - atmosDistance) * (1.0 - atmosBase);
           // The base haze takes the low colour; distance alone sinks to the background.
           vec3 atmosTint = mix(uAtmosColor, uAtmosLow, atmosBase / max(atmos, 1e-4));
           gl_FragColor.rgb = mix(gl_FragColor.rgb, atmosTint, min(atmos, uAtmosMax));
         }`,
      );
  };
  material.needsUpdate = true;
}
