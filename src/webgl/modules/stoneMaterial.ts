import type { MeshStandardMaterial } from "three";

/**
 * One stone for the whole landscape.
 *
 * Every rock model came from a different generation run, and their baked
 * colour maps disagree. The footer rock, the approved stone, is a neutral
 * charcoal. The hero range is teal in its shadows and mid-tones but neutral in
 * its highlights; the perch is nearly black; the monolith a paler blue-grey.
 * Lit identically they still read as different geologies.
 *
 * A tint that lives in the shadows cannot be taken out with a colour multiply
 * (that leaves the shadows teal and turns the highlights brown), so each map
 * is desaturated as it is sampled, the way the footer map already is, and
 * then scaled to the footer map's mean brightness. Only colour cast and
 * overall level change: the cracks, streaks and contrast in each texture stay
 * as they were, and the cool undertone comes from the shared night lighting.
 */

/**
 * Mean linear albedo of the footer rock's colour map
 * (public/assets/rocks/footer-rock.glb). Re-measure if that asset changes.
 */
export const STONE_ALBEDO = [0.0375, 0.0361, 0.037] as const;

/** How much of a colour map's own saturation survives: 0 grey, 1 untouched. */
const STONE_SATURATION = 0.2;

const luminance = (rgb: readonly number[]) =>
  0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
const STONE_LUMINANCE = luminance(STONE_ALBEDO);

const SAMPLE = 32;

const toLinear = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Mean linear luminance of a texture image, or null where it cannot be read. */
function meanLuminance(image: unknown): number | null {
  if (typeof document === "undefined" || !image) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(image as CanvasImageSource, 0, 0, SAMPLE, SAMPLE);
    const { data } = context.getImageData(0, 0, SAMPLE, SAMPLE);
    let sum = 0;
    for (let index = 0; index < data.length; index += 4) {
      sum += luminance([
        toLinear(data[index]!),
        toLinear(data[index + 1]!),
        toLinear(data[index + 2]!),
      ]);
    }
    return sum / (SAMPLE * SAMPLE);
  } catch {
    return null;
  }
}

/**
 * Brings a rock material to the footer stone. Call it after any other shader
 * patch on the material: it wraps the existing `onBeforeCompile` rather than
 * replacing it. `shade` darkens the result for rock that should sit a little
 * deeper in the light than the reference.
 */
export function matchStone(material: MeshStandardMaterial, shade = 1) {
  const mean = meanLuminance(material.map?.image);
  const gain = mean ? Math.min(4, Math.max(0.25, STONE_LUMINANCE / Math.max(mean, 1e-4))) : 1;
  material.color.setScalar(gain * shade);

  const previous = material.onBeforeCompile;
  // Taken before the wrap: the default key is the hook's own source text.
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
       diffuseColor.rgb = mix(
         vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))),
         diffuseColor.rgb,
         ${STONE_SATURATION.toFixed(3)}
       );`,
    );
  };
  material.customProgramCacheKey = () => `${key}|stone`;
  material.needsUpdate = true;
}
