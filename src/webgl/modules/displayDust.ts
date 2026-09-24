import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  type WebGLRenderer,
} from "three";

import { particleConfig, sceneColors } from "../sceneConfig";
import { POINT_FRAGMENT_SHADER } from "./particleField";

/**
 * Digital dust for the Selected Work displays.
 *
 * A display does not fade; it dissolves cell by cell. Each cell has a
 * threshold, and `DISSOLVE_GLSL` computes it identically in the screen's
 * fragment shader and in this module's vertex shader. So a speck of dust
 * leaves the display exactly where, and exactly when, its cell disappears,
 * and on the way back lands exactly where a cell appears.
 *
 * Nothing here runs per particle on the CPU. The monolith hands the shader
 * two clocks, seconds into the dissolve and seconds relative to the
 * materialise, and every speck works out its own position and alpha. Outside
 * a transition both clocks are off and the points are not drawn at all.
 *
 * The specks are the site's existing particles: the same round soft point,
 * the same botanical green, the same size range and additive blending.
 */

/** Cells across and down the display. About the size of a speck of dust. */
const CELLS = "vec2(48.0, 68.0)";

export const DISSOLVE_GLSL = /* glsl */ `
  float dissolveHash(vec2 cell) {
    return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  }

  /*
   * When, from 0 to 1 of a fade, this part of the display goes. Mostly
   * random, with a gentle diagonal lean so the dissolve drifts across the
   * display rather than appearing as noise.
   */
  float dissolveThreshold(vec2 uv) {
    vec2 cell = floor(clamp(uv, 0.0, 0.9999) * ${CELLS});
    vec2 centre = (cell + 0.5) / ${CELLS};
    float diagonal = clamp((centre.x * 0.35 + (1.0 - centre.y)) / 1.35, 0.0, 1.0);
    return 0.08 + 0.84 * mix(dissolveHash(cell), diagonal, 0.35);
  }
`;

const VERTEX_SHADER = /* glsl */ `
  ${DISSOLVE_GLSL}

  attribute vec2 aCell;
  attribute vec4 aSeed;
  attribute float aSize;

  uniform float uOutTime;
  uniform float uInTime;
  uniform float uFadeOut;
  uniform float uFadeIn;
  uniform vec2 uHousing;
  uniform float uGirth;
  uniform float uPixelRatio;
  uniform float uAlpha;

  varying float vAlpha;
  varying float vGold;

  void main() {
    float threshold = dissolveThreshold(aCell);
    vec3 origin = vec3((aCell - 0.5) * uHousing, 0.004);

    // Out of the face and slightly upward, a little different for each speck.
    vec3 heading = normalize(vec3(aSeed.x * 2.0 - 1.0, aSeed.y * 2.0 - 0.65, 0.7 + aSeed.z));
    vec3 drift = heading * (0.03 + 0.045 * aSeed.w);
    // The display's frame is stretched by the stone's girth on x and z.
    drift.xz /= uGirth;

    vec3 position = origin;
    float alpha = 0.0;

    // Dissolve: the speck leaves as its cell goes, and drifts off.
    float life = 0.36 + 0.18 * aSeed.z;
    float age = uOutTime - threshold * uFadeOut;
    float s = age / life;
    if (uOutTime >= 0.0 && s > 0.0 && s < 1.0) {
      float eased = 1.0 - (1.0 - s) * (1.0 - s);
      vec3 wobble = vec3(sin(age * 7.0 + aSeed.x * 40.0), cos(age * 6.0 + aSeed.y * 40.0), 0.0);
      wobble.x /= uGirth;
      position = origin + drift * eased + wobble * 0.004 * s;
      alpha = smoothstep(0.0, 0.06, s) * pow(1.0 - s, 1.3);
    }

    // Materialise: the speck drifts in and lands as its cell appears.
    float lead = 0.42 + 0.14 * aSeed.z;
    float land = (1.0 - threshold) * uFadeIn;
    float t = (uInTime - (land - lead)) / lead;
    if (uInTime > -9.0 && t > 0.0 && t < 1.0) {
      float eased = 1.0 - (1.0 - t) * (1.0 - t);
      position = origin + drift * (1.0 - eased);
      alpha = smoothstep(0.0, 0.3, t) * (1.0 - smoothstep(0.82, 1.0, t));
    }

    vAlpha = alpha * uAlpha;
    vGold = 0.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // A touch larger than the landscape stream: these are seen against lit rock.
    gl_PointSize = alpha > 0.0 ? aSize * 1.3 * uPixelRatio : 0.0;
  }
`;

export type DisplayDust = Readonly<{
  points: Points;
  /**
   * The two clocks, in seconds. `outTime` counts from the start of the
   * dissolve (negative: none). `inTime` counts from the start of the
   * materialise and runs negative during the approach (below -9: none).
   */
  set: (outTime: number, inTime: number, fadeOut: number, fadeIn: number, alpha: number) => void;
  /** Display size in the face's local units, and the stone's girth. */
  layout: (housing: readonly [number, number], girth: number) => void;
  dispose: () => void;
}>;

export function createDisplayDust(count: number, seed: number): DisplayDust {
  let state = seed;
  // Deterministic per face, so the pattern never flickers between renders.
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  const cells = new Float32Array(count * 2);
  const seeds = new Float32Array(count * 4);
  const sizes = new Float32Array(count);
  const [minSize, maxSize] = particleConfig.sizeRange;
  for (let index = 0; index < count; index += 1) {
    cells[index * 2] = random();
    cells[index * 2 + 1] = random();
    for (let k = 0; k < 4; k += 1) seeds[index * 4 + k] = random();
    sizes[index] = minSize + (maxSize - minSize) * random();
  }

  const geometry = new BufferGeometry();
  // Positions come from the shader; this only gives the points a count.
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aCell", new BufferAttribute(cells, 2));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 4));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));

  const uniforms = {
    uOutTime: { value: -1 },
    uInTime: { value: -10 },
    uFadeOut: { value: 0.22 },
    uFadeIn: { value: 0.28 },
    uHousing: { value: [1, 1] as [number, number] },
    uGirth: { value: 1 },
    uPixelRatio: { value: 1 },
    uAlpha: { value: 0 },
    uBotanical: { value: new Color(sceneColors.botanical) },
    uGold: { value: new Color(sceneColors.gold) },
  };

  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: POINT_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  points.renderOrder = 3;
  points.onBeforeRender = (renderer: WebGLRenderer) => {
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
  };

  return {
    points,
    set: (outTime, inTime, fadeOut, fadeIn, alpha) => {
      uniforms.uOutTime.value = outTime;
      uniforms.uInTime.value = inTime;
      uniforms.uFadeOut.value = fadeOut;
      uniforms.uFadeIn.value = fadeIn;
      uniforms.uAlpha.value = alpha;
      points.visible = alpha > 0.001 && (outTime >= 0 || inTime > -9);
    },
    layout: (housing, girth) => {
      uniforms.uHousing.value = [housing[0], housing[1]];
      uniforms.uGirth.value = girth;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
