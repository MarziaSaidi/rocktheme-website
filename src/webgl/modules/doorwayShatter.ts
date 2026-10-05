import { Vector2, Vector3, type MeshStandardMaterial } from "three";

/**
 * The doorway coming apart, and its stones becoming a ring.
 *
 * scripts/fracture-doorway.mjs gives every vertex a `_CHUNK` attribute: the
 * centre of the piece it belongs to (model space) and a per-piece random
 * number in w; what sits at the waterline carries w = -1 and never moves.
 * Each piece is moved as a rigid body in the vertex shader, so the doorway
 * stays one draw call and the other patches on the material (the crack
 * light, the waterline) see every piece where it has gone.
 *
 * Two movements, each staggered per piece:
 *   burst  the release runs from the keystone down; each piece is thrown out
 *          of the opening and on ahead, turning as it goes.
 *   ring   each piece is drawn onto its own place on a circle facing the
 *          camera, a little smaller than it was, and the circle turns.
 */

export type DoorwayShatter = Readonly<{
  uniforms: {
    /** Seconds since the release began; below zero the doorway is whole. */
    uBreak: { value: number };
    uStonePointer: { value: Vector3 };
    uStoneHover: { value: number };
    /** Seconds since the pieces began gathering into the ring; below zero, not yet. */
    uGather: { value: number };
    /** The ring's centre, in the mesh's own space. */
    uRingCentre: { value: Vector3 };
    /** The ring's radius, in the mesh's own units. */
    uRingRadius: { value: number };
    /** How far round the ring has turned, in radians. */
    uRingSpin: { value: number };
    /** How large a piece is once on the ring, relative to its own size. */
    uRingPieceSize: { value: number };
    /** Lavender light along the pieces' edges once they are on the ring, 0 to 1+. */
    uRingGlow: { value: number };
  };
  /** Chains onto the material's existing `onBeforeCompile`. Apply it last. */
  apply: (material: MeshStandardMaterial) => void;
}>;

export type DoorwayShatterOptions = Readonly<{
  /** Model-space point the release spreads from: the keystone. */
  crown: Vector3;
  /** Model-space centre of the opening, in the doorway's plane. */
  opening: Vector2;
}>;

const SHATTER_GLSL = /* glsl */ `
  attribute vec4 _chunk;
  uniform float uBreak;
  uniform vec3 uStonePointer;
  uniform float uStoneHover;
  uniform float uGather;
  uniform vec3 uBreakCrown;
  uniform vec2 uBreakOpening;
  uniform vec3 uRingCentre;
  uniform float uRingRadius;
  uniform float uRingSpin;
  uniform float uRingPieceSize;
  varying float vShatterGlow;

  mat3 shatterTurn(vec3 axis, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    float k = 1.0 - c;
    return mat3(
      c + axis.x * axis.x * k, axis.y * axis.x * k + axis.z * s, axis.z * axis.x * k - axis.y * s,
      axis.x * axis.y * k - axis.z * s, c + axis.y * axis.y * k, axis.z * axis.y * k + axis.x * s,
      axis.x * axis.z * k + axis.y * s, axis.y * axis.z * k - axis.x * s, c + axis.z * axis.z * k
    );
  }

  float shatterEase(float t) {
    t = clamp(t, 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  /*
   * w is the piece's place round the ring (0 to 1, ordered by where it sat
   * around the opening). Anything meant to look random is hashed from it.
   */
  float shatterRandom(float k) {
    return fract(sin(_chunk.w * 91.7 + k * 17.3) * 43758.5453);
  }

  float stoneHover() {
    if (_chunk.w < 0.0) return 0.0;
    float proximity = 1.0 - smoothstep(0.035, 0.16, distance(_chunk.xyz, uStonePointer));
    return proximity * uStoneHover * (1.0 - smoothstep(0.0, 0.25, max(uBreak, 0.0)));
  }

  mat3 stoneTilt() {
    return shatterTurn(normalize(vec3(0.4, 1.0, 0.2)), stoneHover() * 0.045);
  }

  // How far the piece is through its burst, 0 to 1.
  float shatterBurst() {
    if (_chunk.w < 0.0 || uBreak <= 0.0) return 0.0;
    float delay = distance(_chunk.xyz, uBreakCrown) * 0.45 + shatterRandom(1.0) * 0.1;
    float t = clamp((uBreak - delay) / (1.1 + shatterRandom(2.0) * 0.4), 0.0, 1.0);
    // Quick to let go, slow to finish: an ease-out.
    return 1.0 - pow(1.0 - t, 3.0);
  }

  // How far the piece is onto the ring, 0 to 1.
  float shatterGather() {
    if (_chunk.w < 0.0 || uGather <= 0.0) return 0.0;
    return shatterEase((uGather - shatterRandom(3.0) * 0.4) / 1.3);
  }

  mat3 shatterRotation(float burst, float gather) {
    vec3 axis = normalize(vec3(shatterRandom(4.0), shatterRandom(5.0), shatterRandom(6.0)) - 0.5 + 1e-3);
    float spin = shatterRandom(7.0) - 0.5;
    // Tumbling on the burst, then settling as the piece takes its place.
    float angle = spin * 3.2 * burst * (1.0 - 0.5 * gather)
      + spin * 0.6 * max(uGather, 0.0) * (1.0 - gather);
    return shatterTurn(axis, angle);
  }

  vec3 shatterCentre(float burst, float gather) {
    vec2 out2 = _chunk.xy - uBreakOpening;
    vec2 dir = out2 / max(length(out2), 1e-3);
    float reach = 0.35 + shatterRandom(8.0) * 0.45;
    // Out of the opening and on ahead, the way the camera goes, so the cloud
    // stays in front of it as it passes through.
    vec3 thrown = _chunk.xyz + vec3(dir * reach * burst, -(0.15 + shatterRandom(9.0) * 0.55) * burst);
    thrown.y += 0.06 * burst;

    // Its own slot on the ring, evenly spaced, in the order the pieces stood.
    float angle = _chunk.w * 6.2831853 - 3.1415927 + uRingSpin;
    float radius = uRingRadius * (0.97 + shatterRandom(10.0) * 0.06);
    vec3 onRing = uRingCentre + vec3(cos(angle) * radius, sin(angle) * radius,
      (shatterRandom(11.0) - 0.5) * uRingRadius * 0.04);
    return mix(thrown, onRing, gather);
  }
`;

export function createDoorwayShatter({ crown, opening }: DoorwayShatterOptions): DoorwayShatter {
  const uniforms = {
    uBreak: { value: -1 },
    uStonePointer: { value: new Vector3(0, -100, 0) },
    uStoneHover: { value: 0 },
    uGather: { value: -1 },
    uBreakCrown: { value: crown.clone() },
    uBreakOpening: { value: opening.clone() },
    uRingCentre: { value: new Vector3() },
    uRingRadius: { value: 1 },
    uRingSpin: { value: 0 },
    uRingGlow: { value: 0 },
    uRingPieceSize: { value: 0.55 },
    uRingGlowColour: { value: new Vector3(0.74, 0.58, 0.95) },
  };

  const apply = (material: MeshStandardMaterial) => {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      /*
       * Applied last, so its code lands straight after each include, ahead of
       * the earlier patches: they all see the moved piece.
       */
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${SHATTER_GLSL}`)
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
           {
             float burst = shatterBurst();
             objectNormal = stoneTilt() * objectNormal;
             if (burst > 0.0) objectNormal = shatterRotation(burst, shatterGather()) * objectNormal;
           }`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           {
             float burst = shatterBurst();
             if (burst > 0.0) {
               float gather = shatterGather();
               // Smaller on the ring, so the circle reads as a circle.
               float size = mix(1.0, uRingPieceSize, gather);
               transformed = shatterRotation(burst, gather) * (transformed - _chunk.xyz) * size
                 + shatterCentre(burst, gather);
             }
             transformed = stoneTilt() * (transformed - _chunk.xyz) + _chunk.xyz;
             transformed += vec3(0.0, 0.004, 0.014) * stoneHover();
             vShatterGlow = shatterGather();
           }`,
        );
      // On the ring the pieces are lit along their edges, like embers.
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           varying float vShatterGlow;
           uniform float uRingGlow;
           uniform vec3 uRingGlowColour;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
           {
             float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
             float edge = pow(1.0 - facing, 2.0);
             totalEmissiveRadiance += uRingGlowColour * vShatterGlow * uRingGlow * (0.18 + edge * 1.4);
           }`,
        );
    };
    material.needsUpdate = true;
  };

  return { uniforms, apply };
}
