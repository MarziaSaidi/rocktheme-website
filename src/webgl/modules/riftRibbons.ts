import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";

/**
 * The aurora band: silk-fine strands of light flowing along the crack.
 *
 * As in the reference, the vapour is one broad band hugging the right inner
 * edge of the crack and following its slope, from the bottom of the opening
 * up to the peak, made of many thin translucent strands that run almost
 * parallel, braid and curl round each other in soft S-curves, each with a
 * glowing edge. A few finer blue strands climb the left edge low down.
 *
 * Colour is set by a strand's place across the band, not at random: icy
 * blue and cyan in the strands nearest the opening, violet and lavender
 * through the middle, pink at the outer edge over the rock, warming to a
 * peach hint at the bottom; it drifts slowly along each strand.
 *
 * Each strand is a camera-facing strip whose path is computed in the vertex
 * shader from the measured edge (a uniform array), so it is one draw call
 * and nothing is rebuilt per frame.
 */
export type RiftRibbons = Readonly<{
  mesh: Mesh;
  update: (time: number, energy: number, go: number) => void;
  dispose: () => void;
}>;

type Rows = readonly (readonly [number, number, number])[];

const EDGE_POINTS = 40;
const ALONG = 150;
const BAND = { wide: 28, compact: 12 } as const;
const LEFT = { wide: 6, compact: 3 } as const;

const VERTEX = /* glsl */ `
uniform vec3 uRightEdge[${EDGE_POINTS}];
uniform vec3 uLeftEdge[${EDGE_POINTS}];
uniform float uTime;
uniform float uEnergy;
uniform float uGo;

attribute float aU;
attribute float aSide;
/** edge (0 right band, 1 left), place across the band -1 (opening) … 1 (rock), width, seed */
attribute vec4 aStrand;

varying float vU;
varying float vSide;
varying float vAcross;
varying float vSeed;

vec3 edgeAt(float which, float u) {
  float f = clamp(u, 0.0, 1.0) * ${EDGE_POINTS - 1}.0;
  int i = int(floor(f));
  int j = min(i + 1, ${EDGE_POINTS - 1});
  float t = f - float(i);
  return which < 0.5 ? mix(uRightEdge[i], uRightEdge[j], t) : mix(uLeftEdge[i], uLeftEdge[j], t);
}

vec3 strandAt(float u) {
  float which = aStrand.x;
  float across = aStrand.y;
  float seed = aStrand.w;
  vec3 p = edgeAt(which, u);
  float t = uTime * (0.32 + seed * 0.18) * (1.0 + uEnergy * 0.4 + uGo * 1.5);
  // Broad at the bottom of the band, narrowing towards the peak.
  float band = which < 0.5 ? mix(0.12, 0.045, u) : mix(0.03, 0.012, u);
  band *= 1.0 + uEnergy * 0.12;
  // Its place across the band braids slowly with its neighbours...
  float place = across + 0.5 * sin(u * 6.0 - t * 1.3 + seed * 6.2831);
  // ...and the whole band snakes in soft S-curves.
  float snake = 0.8 * sin(u * 8.0 - t * 1.7) + 0.3 * sin(u * 19.0 + t * 1.1 + seed * 2.0);
  float inward = which < 0.5 ? -1.0 : 1.0;
  p.x += inward * (place * band + snake * band * 0.7);
  // Over the rock it lies in front of the face; towards the opening it sinks in.
  p.z += 0.07 + (place + 1.0) * 0.035 + cos(u * 6.0 - t + seed * 3.0) * 0.012;
  return p;
}

void main() {
  float u = aU;
  vec4 a = modelViewMatrix * vec4(strandAt(u), 1.0);
  vec4 b = modelViewMatrix * vec4(strandAt(min(1.0, u + 0.008)), 1.0);
  vec4 c = modelViewMatrix * vec4(strandAt(max(0.0, u - 0.008)), 1.0);
  vec2 dir = b.xy - c.xy;
  dir = length(dir) > 0.000001 ? normalize(dir) : vec2(0.0, 1.0);
  vec2 normal = vec2(-dir.y, dir.x);
  float scale = length(modelViewMatrix[0].xyz);
  float swell = 0.6 + 0.4 * sin(u * 11.0 + aStrand.w * 17.0 - uTime * 0.5);
  float width = aStrand.z * swell * (1.0 - smoothstep(0.75, 1.0, u) * 0.6);
  a.xy += normal * aSide * width * scale;
  vU = u;
  vSide = aSide;
  vAcross = aStrand.y;
  vSeed = aStrand.w;
  gl_Position = projectionMatrix * a;
}
`;

const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uGo;
uniform vec3 uIce;
uniform vec3 uCyan;
uniform vec3 uViolet;
uniform vec3 uLavender;
uniform vec3 uPink;
uniform vec3 uPeach;
varying float vU;
varying float vSide;
varying float vAcross;
varying float vSeed;

void main() {
  float s = abs(vSide);
  // Across the band: ice and cyan by the opening, violet and lavender in
  // the middle, pink over the rock; peach low down; drifting slowly.
  float k = clamp((vAcross + 1.0) * 0.5 + sin(vU * 5.0 - uTime * 0.2 + vSeed * 6.0) * 0.08, 0.0, 1.0);
  vec3 colour = mix(uIce, uCyan, smoothstep(0.0, 0.25, k));
  colour = mix(colour, uViolet, smoothstep(0.25, 0.5, k));
  colour = mix(colour, uLavender, smoothstep(0.5, 0.7, k));
  colour = mix(colour, uPink, smoothstep(0.7, 1.0, k));
  colour = mix(colour, uPeach, (1.0 - smoothstep(0.0, 0.25, vU)) * smoothstep(0.5, 1.0, k) * 0.45);

  // A translucent strand with a glowing edge and a fine bright core.
  float body = pow(1.0 - s, 1.6) * 0.45;
  float edge = exp(-pow((s - 0.7) / 0.18, 2.0)) * 0.55;
  float core = exp(-pow(vSide / 0.22, 2.0)) * 0.5;
  // Light travelling up it; some stretches almost vanish, then return.
  float pulse = 0.35 + 0.65 * smoothstep(-0.3, 1.0, sin(vU * 9.0 - uTime * (0.9 + vSeed) + vSeed * 20.0));
  float life = smoothstep(0.0, 0.12, vU) * (1.0 - smoothstep(0.8, 1.0, vU));
  float strength = (0.6 + uEnergy * 0.2) * (1.0 - uGo * 0.7);
  float a = (body + (edge + core) * pulse) * life * strength;
  colour = mix(colour, vec3(1.0), core * pulse * 0.45);
  gl_FragColor = vec4(colour * a, a);
}
`;

/** One edge of the opening, bottom to top, just inside it, drawing to the peak above. */
function edgePath(rows: Rows, side: 1 | 2): Vector3[] {
  const apexRow = rows[rows.length - 1]!;
  const apexX = (apexRow[1] + apexRow[2]) / 2;
  const top = apexRow[0] + 0.06;
  const near = (y: number) => {
    let best = rows[0]!;
    for (const row of rows) if (Math.abs(row[0] - y) < Math.abs(best[0] - y)) best = row;
    return best;
  };
  const raw: Vector3[] = [];
  for (let i = 0; i < EDGE_POINTS; i += 1) {
    const y = (i / (EDGE_POINTS - 1)) * top;
    const row = near(Math.min(y, apexRow[0]));
    const over = Math.min(1, Math.max(0, (y - apexRow[0]) / 0.06));
    const x = row[side] + (apexX - row[side]) * over;
    raw.push(new Vector3(x, y, -0.04 + Math.min(1, y / 0.2) * 0.08));
  }
  // Smoothed: the measured outline steps from cell to cell.
  return raw.map((point, i) => {
    let sum = 0;
    let n = 0;
    for (let k = -3; k <= 3; k += 1) {
      const other = raw[i + k];
      if (!other) continue;
      sum += other.x;
      n += 1;
    }
    return new Vector3(sum / n, point.y, point.z);
  });
}

export function createRiftRibbons(rows: Rows, compact: boolean): RiftRibbons {
  const bandCount = compact ? BAND.compact : BAND.wide;
  const leftCount = compact ? LEFT.compact : LEFT.wide;
  type Strand = [edge: number, across: number, width: number, seed: number];
  const strands: Strand[] = [];
  let seed = 7;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < bandCount; i += 1) {
    const across = (i / Math.max(1, bandCount - 1)) * 2 - 1;
    strands.push([0, across + (random() - 0.5) * 0.08, 0.007 + random() * 0.014, random()]);
  }
  for (let i = 0; i < leftCount; i += 1) {
    // The left edge's strands keep to the blue end of the band.
    strands.push([1, -1 + random() * 0.5, 0.003 + random() * 0.006, random()]);
  }

  const verts = strands.length * (ALONG + 1) * 2;
  const u = new Float32Array(verts);
  const side = new Float32Array(verts);
  const strand = new Float32Array(verts * 4);
  const index: number[] = [];
  let v = 0;
  for (const values of strands) {
    const base = v;
    for (let i = 0; i <= ALONG; i += 1) {
      for (const s of [-1, 1]) {
        u[v] = i / ALONG;
        side[v] = s;
        strand.set(values, v * 4);
        v += 1;
      }
      if (i < ALONG) {
        const a = base + i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geometry = new BufferGeometry();
  // Positions are made in the shader; this only sizes the draw.
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(verts * 3), 3));
  geometry.setAttribute("aU", new BufferAttribute(u, 1));
  geometry.setAttribute("aSide", new BufferAttribute(side, 1));
  geometry.setAttribute("aStrand", new BufferAttribute(strand, 4));
  geometry.setIndex(index);

  const material = new ShaderMaterial({
    uniforms: {
      uRightEdge: { value: edgePath(rows, 2) },
      uLeftEdge: { value: edgePath(rows, 1) },
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uGo: { value: 0 },
      uIce: { value: new Color("#7cc4ff") },
      uCyan: { value: new Color("#5ef0ff") },
      uViolet: { value: new Color("#8c5cff") },
      uLavender: { value: new Color("#c7a0ff") },
      uPink: { value: new Color("#ff8fdc") },
      uPeach: { value: new Color("#ffb48a") },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "rift-ribbons";
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;

  return {
    mesh,
    update: (time, energy, go) => {
      material.uniforms.uTime!.value = time;
      material.uniforms.uEnergy!.value = energy;
      material.uniforms.uGo!.value = go;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
