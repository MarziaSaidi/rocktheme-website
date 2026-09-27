/**
 * Splits the entry doorway into its stones, so the gate can take it apart.
 *
 * The doorway is one scanned mesh. Its texture has no glow baked in, but its
 * joints are there: the gaps between stones are the darkest, least green
 * texels of the albedo (the same test crackEnergy.ts lights them with). Every
 * triangle is sampled against that test; triangles that are not seam are
 * flood-filled across shared edges, and each connected region is one stone.
 * Seams then join the stone beside them, slivers join a neighbour, and a
 * region still too large (ivy can bridge two stones) is split by k-means.
 *
 * The mesh stays one draw call. Each vertex carries `_CHUNK` (vec4): its
 * piece's centre in model space, and a per-piece random number in w. Only
 * what sits at the waterline keeps w = -1 and never moves; everything above
 * it breaks into small pieces (about 200) that the entry gathers into a ring.
 * The shader in doorwayShatter.ts does the rest.
 *
 * Usage: node scripts/fracture-doorway.mjs <source intro-arch.glb> [output]
 * The source is the uncompressed prepared doorway (prepare-rocks.mjs
 * --intro-arch). The output is meshopt-compressed with a WebP normal map.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { quantize, reorder, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const [source, output = "public/assets/rocks/intro-arch.glb"] = process.argv.slice(2);
if (!source) throw new Error("Usage: node scripts/fracture-doorway.mjs <source.glb> [output.glb]");

/** Model-space height below which the stone stays: what sits at the waterline. */
const BASE_HEIGHT = 0.03;
/** Stones smaller than this many triangles are slivers and join a neighbour. */
const MIN_TRIANGLES = 90;
/** Stones larger than this are split, so no piece is a whole pillar. */
const MAX_TRIANGLES = 1300;
/** Albedo luminance under which a texel counts as seam (see crackMask). */
const SEAM_LOW = 0.0025;
const SEAM_HIGH = 0.011;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const document = await io.read(source);
const root = document.getRoot();
const primitive = root.listMeshes()[0].listPrimitives()[0];
const material = primitive.getMaterial();

const positions = primitive.getAttribute("POSITION").getArray();
const normals = primitive.getAttribute("NORMAL").getArray();
const uvs = primitive.getAttribute("TEXCOORD_0").getArray();
const indices = primitive.getIndices().getArray();
const triangleCount = indices.length / 3;

// ------------------------------------------------------------ the albedo
const baseTexture = material.getBaseColorTexture();
const { data: albedo, info } = await sharp(Buffer.from(baseTexture.getImage()))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const linear = new Float32Array(256).map((_, i) => toLinear(i));
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const seamAt = (u, v) => {
  const x = Math.min(info.width - 1, Math.max(0, Math.floor(u * info.width)));
  const y = Math.min(info.height - 1, Math.max(0, Math.floor(v * info.height)));
  const i = (y * info.width + x) * 3;
  const r = linear[albedo[i]];
  const g = linear[albedo[i + 1]];
  const b = linear[albedo[i + 2]];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const green = g - Math.max(r, b);
  return (1 - smoothstep(SEAM_LOW, SEAM_HIGH, lum)) * (1 - smoothstep(0.004, 0.02, green));
};

// ------------------------------------------------------------ triangles
const centroid = new Float32Array(triangleCount * 3);
const seam = new Uint8Array(triangleCount);
const base = new Uint8Array(triangleCount);
for (let t = 0; t < triangleCount; t += 1) {
  let seamSum = 0;
  for (let k = 0; k < 3; k += 1) {
    const v = indices[t * 3 + k];
    centroid[t * 3] += positions[v * 3] / 3;
    centroid[t * 3 + 1] += positions[v * 3 + 1] / 3;
    centroid[t * 3 + 2] += positions[v * 3 + 2] / 3;
    seamSum += seamAt(uvs[v * 2], uvs[v * 2 + 1]);
  }
  const a = indices[t * 3];
  const b = indices[t * 3 + 1];
  const c = indices[t * 3 + 2];
  const mu = (uvs[a * 2] + uvs[b * 2] + uvs[c * 2]) / 3;
  const mv = (uvs[a * 2 + 1] + uvs[b * 2 + 1] + uvs[c * 2 + 1]) / 3;
  seamSum += seamAt(mu, mv) * 2;
  seam[t] = seamSum / 5 > 0.5 ? 1 : 0;
  base[t] = centroid[t * 3 + 1] < BASE_HEIGHT ? 1 : 0;
}

// Adjacency across shared edges. UV seams split vertices, so edges are keyed
// by welded positions, not by index.
const weld = new Map();
const welded = new Uint32Array(positions.length / 3);
for (let v = 0; v < welded.length; v += 1) {
  const key = `${Math.round(positions[v * 3] * 1e5)},${Math.round(positions[v * 3 + 1] * 1e5)},${Math.round(positions[v * 3 + 2] * 1e5)}`;
  let id = weld.get(key);
  if (id === undefined) {
    id = weld.size;
    weld.set(key, id);
  }
  welded[v] = id;
}
const edgeOwner = new Map();
const neighbours = Array.from({ length: triangleCount }, () => []);
for (let t = 0; t < triangleCount; t += 1) {
  for (let k = 0; k < 3; k += 1) {
    const a = welded[indices[t * 3 + k]];
    const b = welded[indices[t * 3 + ((k + 1) % 3)]];
    const key = a < b ? a * 4194304 + b : b * 4194304 + a;
    const other = edgeOwner.get(key);
    if (other === undefined) edgeOwner.set(key, t);
    else {
      neighbours[t].push(other);
      neighbours[other].push(t);
    }
  }
}

// ------------------------------------------------------------ the stones
const UNSET = -1;
const chunk = new Int32Array(triangleCount).fill(UNSET);
const BASE_CHUNK = 0;
let chunkCount = 1;
for (let t = 0; t < triangleCount; t += 1) if (base[t]) chunk[t] = BASE_CHUNK;

// Flood-fill the non-seam stone above the base.
const sizes = [0];
for (let start = 0; start < triangleCount; start += 1) {
  if (chunk[start] !== UNSET || seam[start]) continue;
  const id = chunkCount++;
  let size = 0;
  const stack = [start];
  chunk[start] = id;
  while (stack.length) {
    const t = stack.pop();
    size += 1;
    for (const n of neighbours[t]) {
      if (chunk[n] === UNSET && !seam[n] && !base[n]) {
        chunk[n] = id;
        stack.push(n);
      }
    }
  }
  sizes[id] = size;
}

// Slivers are released to be absorbed below.
for (let t = 0; t < triangleCount; t += 1) {
  const id = chunk[t];
  if (id > BASE_CHUNK && sizes[id] < MIN_TRIANGLES) chunk[t] = UNSET;
}

// Seams and slivers join the stone they touch: a breadth-first grow from every stone at once.
let frontier = [];
for (let t = 0; t < triangleCount; t += 1) if (chunk[t] !== UNSET) frontier.push(t);
while (frontier.length) {
  const next = [];
  for (const t of frontier) {
    for (const n of neighbours[t]) {
      if (chunk[n] === UNSET) {
        // The base never grows upward into the arch.
        chunk[n] = chunk[t] === BASE_CHUNK && !base[n] ? UNSET : chunk[t];
        if (chunk[n] !== UNSET) next.push(n);
      }
    }
  }
  frontier = next;
}
// Anything unreachable (loose islands) is nearest-centroid assigned below.

// Recount, then split the stones ivy has bridged.
const members = new Map();
for (let t = 0; t < triangleCount; t += 1) {
  const id = chunk[t];
  if (id === UNSET || id === BASE_CHUNK) continue;
  if (!members.has(id)) members.set(id, []);
  members.get(id).push(t);
}
const finalChunk = new Int32Array(triangleCount).fill(UNSET);
let finalCount = 1;
for (let t = 0; t < triangleCount; t += 1) if (chunk[t] === BASE_CHUNK) finalChunk[t] = BASE_CHUNK;
const kmeans = (tris, k) => {
  const seeds = [];
  // Farthest-point seeding: even pieces, deterministic.
  seeds.push(tris[0]);
  const dist = new Float32Array(tris.length).fill(Infinity);
  while (seeds.length < k) {
    const s = seeds[seeds.length - 1];
    let best = 0;
    tris.forEach((t, i) => {
      const dx = centroid[t * 3] - centroid[s * 3];
      const dy = centroid[t * 3 + 1] - centroid[s * 3 + 1];
      const dz = centroid[t * 3 + 2] - centroid[s * 3 + 2];
      dist[i] = Math.min(dist[i], dx * dx + dy * dy + dz * dz);
      if (dist[i] > dist[best]) best = i;
    });
    seeds.push(tris[best]);
  }
  let centres = seeds.map((s) => [centroid[s * 3], centroid[s * 3 + 1], centroid[s * 3 + 2]]);
  const label = new Int32Array(tris.length);
  for (let round = 0; round < 8; round += 1) {
    tris.forEach((t, i) => {
      let best = 0;
      let bestD = Infinity;
      centres.forEach(([x, y, z], c) => {
        const d =
          (centroid[t * 3] - x) ** 2 +
          (centroid[t * 3 + 1] - y) ** 2 +
          (centroid[t * 3 + 2] - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      });
      label[i] = best;
    });
    const sums = centres.map(() => [0, 0, 0, 0]);
    tris.forEach((t, i) => {
      const s = sums[label[i]];
      s[0] += centroid[t * 3];
      s[1] += centroid[t * 3 + 1];
      s[2] += centroid[t * 3 + 2];
      s[3] += 1;
    });
    centres = sums.map((s, c) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centres[c]));
  }
  return label;
};
for (const tris of members.values()) {
  if (tris.length <= MAX_TRIANGLES) {
    const id = finalCount++;
    for (const t of tris) finalChunk[t] = id;
    continue;
  }
  const k = Math.ceil(tris.length / (MAX_TRIANGLES * 0.7));
  const label = kmeans(tris, k);
  const first = finalCount;
  finalCount += k;
  tris.forEach((t, i) => (finalChunk[t] = first + label[i]));
}

// ------------------------------------------------------------ centres
const centres = Array.from({ length: finalCount }, () => [0, 0, 0, 0]);
for (let t = 0; t < triangleCount; t += 1) {
  const id = finalChunk[t];
  if (id <= BASE_CHUNK) continue;
  const c = centres[id];
  c[0] += centroid[t * 3];
  c[1] += centroid[t * 3 + 1];
  c[2] += centroid[t * 3 + 2];
  c[3] += 1;
}
centres.forEach((c) => {
  if (c[3]) {
    c[0] /= c[3];
    c[1] /= c[3];
    c[2] /= c[3];
  }
});
// Stray islands: the nearest stone (or the base, if they sit at the water).
for (let t = 0; t < triangleCount; t += 1) {
  if (finalChunk[t] !== UNSET) continue;
  if (base[t]) {
    finalChunk[t] = BASE_CHUNK;
    continue;
  }
  let best = BASE_CHUNK;
  let bestD = Infinity;
  for (let id = 1; id < finalCount; id += 1) {
    const c = centres[id];
    if (!c[3]) continue;
    const d =
      (centroid[t * 3] - c[0]) ** 2 +
      (centroid[t * 3 + 1] - c[1]) ** 2 +
      (centroid[t * 3 + 2] - c[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  finalChunk[t] = best;
}

/*
 * Each piece's place on the entry ring, 0 to 1 round it. Pieces are ranked
 * by where they sit around the opening and spaced evenly in that order, so
 * the ring is even, and every piece travels out to the slot nearest it
 * without crossing another's path. The shader hashes this value for
 * anything that should look random.
 */
const OPENING_CENTRE = [-0.012, 0.465];
const ranked = centres
  .map((c, id) => ({ id, c }))
  .filter(({ id, c }) => id > BASE_CHUNK && c[3] > 0)
  .map(({ id, c }) => ({
    id,
    angle: Math.atan2(c[1] - OPENING_CENTRE[1], c[0] - OPENING_CENTRE[0]),
  }))
  .sort((a, b) => a.angle - b.angle);
const slot = new Map(ranked.map(({ id }, rank) => [id, (rank + 0.5) / ranked.length]));
const seedOf = (id) => slot.get(id) ?? 0;

// ------------------------------------------------------------ rebuild
// A vertex shared by two stones is duplicated, so each belongs to one.
const remap = new Map();
const outPositions = [];
const outNormals = [];
const outUvs = [];
const outChunk = [];
const outIndices = new Uint32Array(indices.length);
for (let t = 0; t < triangleCount; t += 1) {
  const id = finalChunk[t];
  for (let k = 0; k < 3; k += 1) {
    const v = indices[t * 3 + k];
    const key = v * 4096 + id;
    let n = remap.get(key);
    if (n === undefined) {
      n = remap.size;
      remap.set(key, n);
      outPositions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      outNormals.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
      outUvs.push(uvs[v * 2], uvs[v * 2 + 1]);
      const c = centres[id];
      if (id === BASE_CHUNK) outChunk.push(0, 0, 0, -1);
      else outChunk.push(c[0], c[1], c[2], seedOf(id));
    }
    outIndices[t * 3 + k] = n;
  }
}

primitive.getAttribute("POSITION").setArray(new Float32Array(outPositions));
primitive.getAttribute("NORMAL").setArray(new Float32Array(outNormals));
primitive.getAttribute("TEXCOORD_0").setArray(new Float32Array(outUvs));
primitive.getIndices().setArray(outIndices);
const chunkAccessor = document
  .createAccessor("chunk")
  .setType("VEC4")
  .setArray(new Float32Array(outChunk))
  .setBuffer(root.listBuffers()[0]);
primitive.setAttribute("_CHUNK", chunkAccessor);

const stoneSizes = centres
  .slice(1)
  .map((c) => c[3])
  .filter(Boolean)
  .sort((a, b) => a - b);
console.log(
  `stones: ${stoneSizes.length}, triangles per stone min ${stoneSizes[0]} median ${
    stoneSizes[Math.floor(stoneSizes.length / 2)]
  } max ${stoneSizes[stoneSizes.length - 1]}; base ${base.reduce((a, b) => a + b, 0)} triangles; vertices ${
    welded.length
  } → ${remap.size}`,
);

// ------------------------------------------------------------ compress
/*
 * Positions and _CHUNK stay float. Quantizing positions rescales them through
 * the node, and the stone centres in _CHUNK would no longer share their space:
 * every piece would sit off its place by its own quantized coordinates. (The
 * one-step meshopt() transform quantizes everything, which is why it is not
 * used.) Normals and UVs are quantized; meshopt then compresses all of it.
 */
await document.transform(
  textureCompress({ encoder: sharp, targetFormat: "webp", slots: /^normalTexture$/, quality: 92 }),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ pattern: /^(NORMAL|TEXCOORD_0)$/ }),
);
document
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(output, document);
console.log(`wrote ${output}`);
