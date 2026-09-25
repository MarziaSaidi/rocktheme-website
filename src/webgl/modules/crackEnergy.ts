import { Color, Vector3, type MeshStandardMaterial } from "three";

/**
 * Violet energy in the gaps between the doorway's stones.
 *
 * The doorway's texture has no glow baked in, but its seams are there: the
 * gaps between stones are the darkest, least green texels of the albedo. The
 * light is emitted only from those texels, so it sits inside the gaps and
 * follows their real shapes. A mip-blurred sample of the same mask lets a
 * little of it bounce onto the stone edges on either side of a gap.
 *
 * Where it shows is spatial: strong close to a point on the doorway (the
 * pointer, projected onto the doorway's plane), softer further out, dark
 * beyond. On entry a second front spreads outward from that point through
 * the whole arch.
 *
 * Every value lives in `uniforms`, updated in place; nothing here allocates
 * per frame.
 */

export type CrackEnergy = Readonly<{
  uniforms: {
    /** World-space point the local glow is centred on. */
    uPoint: { value: Vector3 };
    /** 0 when the pointer is away from the page, 1 when it is on it. */
    uPresence: { value: number };
    /** Radius of the spreading front, in world units. */
    uSpread: { value: number };
    /** Horizontal direction from the doorway to the camera. */
    uViewAxis: { value: Vector3 };
    /** Where the front spreads from. */
    uSpreadOrigin: { value: Vector3 };
    /** Strength of everything the front has reached. */
    uEnergy: { value: number };
  };
  /** Chains onto the material's existing `onBeforeCompile`. */
  apply: (material: MeshStandardMaterial) => void;
}>;

export type CrackEnergyOptions = Readonly<{
  /** Radius of the strong glow around the pointer, in world units. */
  radius: number;
}>;

export function createCrackEnergy({ radius }: CrackEnergyOptions): CrackEnergy {
  const uniforms = {
    uPoint: { value: new Vector3(0, -100, 0) },
    uPresence: { value: 0 },
    uSpread: { value: 0 },
    uViewAxis: { value: new Vector3(0, 0, 1) },
    uSpreadOrigin: { value: new Vector3() },
    uEnergy: { value: 0 },
    uRadius: { value: radius },
    // Deep, core and hot violet, in the renderer's linear working space.
    uDeep: { value: new Color(0x8b5cf6) },
    uCore: { value: new Color(0xa970ff) },
    uHot: { value: new Color(0xb78cff) },
  };

  const apply = (material: MeshStandardMaterial) => {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      Object.assign(shader.uniforms, uniforms);

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vCrackWorld;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvCrackWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           varying vec3 vCrackWorld;
           uniform vec3 uPoint;
           uniform float uPresence;
           uniform float uSpread;
           uniform vec3 uViewAxis;
           uniform vec3 uSpreadOrigin;
           uniform float uEnergy;
           uniform float uRadius;
           uniform vec3 uDeep;
           uniform vec3 uCore;
           uniform vec3 uHot;

           // Dark and not foliage: the gaps between stones.
           float crackMask(vec3 albedo, float low, float high) {
             float lum = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
             float green = albedo.g - max(albedo.r, albedo.b);
             return (1.0 - smoothstep(low, high, lum)) * (1.0 - smoothstep(0.004, 0.02, green));
           }`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
           #ifdef USE_MAP
           {
             // The gap itself, and a wider, softer copy for the bounce.
             float gap = crackMask(sampledDiffuseColor.rgb, 0.0025, 0.011);
             float halo = crackMask(texture2D(map, vMapUv, 2.5).rgb, 0.006, 0.03);

             // Near the pointer strong, further out softer, far away dark.
             // Measured mostly across the view, so both faces of a stone answer.
             vec3 offset = vCrackWorld - uPoint;
             offset -= uViewAxis * dot(offset, uViewAxis) * 0.65;
             float d = length(offset);
             float nearGlow = exp(-pow(d / uRadius, 2.0));
             float wideGlow = exp(-pow(d / (uRadius * 2.0), 2.0));
             float local = (nearGlow + wideGlow * 0.22) * uPresence;

             // Idle: a faint presence deep in a few gaps, nowhere else.
             float few = smoothstep(0.55, 0.95,
               0.5 + 0.5 * sin(vCrackWorld.x * 1.9 + 1.3) * sin(vCrackWorld.y * 1.1 + 0.4));
             float idle = 0.035 * few * smoothstep(0.8, 1.0, gap);

             // The entry front, travelling out from where it was set off.
             float reach = distance(vCrackWorld, uSpreadOrigin);
             float front = (1.0 - smoothstep(uSpread - 1.6, uSpread, reach)) * uEnergy;

             float energy = max(idle, local) + front * 0.8;
             vec3 violet = mix(uDeep, uCore, smoothstep(0.0, 0.45, energy));
             violet = mix(violet, uHot, smoothstep(0.7, 1.2, energy));
             // A soft ceiling: however much piles up, a gap stays violet, never white.
             float light = 1.15 * (1.0 - exp(-1.6 * energy));

             totalEmissiveRadiance += violet * gap * light;
             // A little light thrown onto the stone around the gap.
             totalEmissiveRadiance += violet * diffuseColor.rgb * halo * light * 0.8;
           }
           #endif`,
        );
    };
    material.needsUpdate = true;
  };

  return { uniforms, apply };
}
