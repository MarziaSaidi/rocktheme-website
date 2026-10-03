/**
 * Prepares the rift beside the bio: the cracked mountain the way into
 * /my-world opens through, and the stones floating round it.
 *
 * Both sources are single Tripo meshes far too heavy for the web (1.9 M and
 * 1.4 M triangles, 10 MB normal maps). Each is reduced with meshoptimizer's
 * simplifier, its maps resized to WebP, and the result meshopt-compressed.
 *
 * The stones arrive as one mesh. Each stone is a separate island of it, so
 * islands are found by flood fill across shared (welded) positions, and
 * every vertex is given `_CHUNK` (vec4): its stone's centre in model space
 * and a per-stone random number in w. The mesh stays one draw call; the
 * shader in rift.ts moves every stone as a rigid body.
 *
 * The mountain's opening is measured here too, once: the mesh is drawn flat
 * onto a grid as seen from the front, and the cells it leaves open that the
 * outside cannot reach (except from below, where the crack meets the water)
 * are the crack. Its outline, row by row, goes to opening.json; the world
 * behind is drawn into exactly that shape.
 *
 * Usage: node scripts/prepare-rift.mjs [source folder, default assets-src/rift]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import {
  prune,
  quantize,
  reorder,
  simplify,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const sourceFolder = process.argv[2] ?? "assets-src/rift";
const outputFolder = "public/assets/rift";

const SOURCES = [
  {
    file: "cracked mountain.glb",
    output: "mountain.glb",
    /** Seen large and close, through the dive: keeps plenty of its relief. */
    ratio: 0.15,
    error: 0.0008,
    mapSize: 2048,
    stones: false,
  },
  {
    file: "floating stones.glb",
    output: "stones.glb",
    ratio: 0.08,
    error: 0.002,
    mapSize: 1024,
    stones: true,
  },
];

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
await mkdir(outputFolder, { recursive: true });

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

/** Tags every vertex with its stone: the island of the mesh it belongs to. */
function tagStones(document) {
  const root = document.getRoot();
  const primitive = root.listMeshes()[0].listPrimitives()[0];
  const positions = primitive.getAttribute("POSITION").getArray();
  const indices = primitive.getIndices().getArray();
  const vertexCount = positions.length / 3;

  // UV seams split vertices; stones are joined by position, not by index.
  const weldId = new Uint32Array(vertexCount);
  const keys = new Map();
  for (let v = 0; v < vertexCount; v += 1) {
    const key = `${Math.round(positions[v * 3] * 1e5)},${Math.round(positions[v * 3 + 1] * 1e5)},${Math.round(positions[v * 3 + 2] * 1e5)}`;
    let id = keys.get(key);
    if (id === undefined) {
      id = keys.size;
      keys.set(key, id);
    }
    weldId[v] = id;
  }
  const parent = new Int32Array(keys.size).map((_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const a = find(weldId[indices[t]]);
    const b = find(weldId[indices[t + 1]]);
    const c = find(weldId[indices[t + 2]]);
    parent[b] = a;
    parent[find(c)] = a;
  }

  // Each island's centre and size.
  const islands = new Map();
  for (let v = 0; v < vertexCount; v += 1) {
    const root = find(weldId[v]);
    let island = islands.get(root);
    if (!island) {
      island = { sum: [0, 0, 0], count: 0 };
      islands.set(root, island);
    }
    island.sum[0] += positions[v * 3];
    island.sum[1] += positions[v * 3 + 1];
    island.sum[2] += positions[v * 3 + 2];
    island.count += 1;
  }
  // Specks too small to read as stones still move, with the nearest stone.
  const real = [...islands.entries()].filter(([, island]) => island.count >= 60);
  let seed = 7;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const centres = new Map(
    real.map(([id, island]) => [
      id,
      [
        island.sum[0] / island.count,
        island.sum[1] / island.count,
        island.sum[2] / island.count,
        random(),
      ],
    ]),
  );
  const nearest = (x, y, z) => {
    let best = null;
    let distance = Infinity;
    for (const centre of centres.values()) {
      const d = (centre[0] - x) ** 2 + (centre[1] - y) ** 2 + (centre[2] - z) ** 2;
      if (d < distance) {
        distance = d;
        best = centre;
      }
    }
    return best;
  };
  const chunk = new Float32Array(vertexCount * 4);
  for (let v = 0; v < vertexCount; v += 1) {
    const root = find(weldId[v]);
    const centre =
      centres.get(root) ?? nearest(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    chunk.set(centre, v * 4);
  }
  primitive.setAttribute(
    "_CHUNK",
    document
      .createAccessor("chunk")
      .setType("VEC4")
      .setArray(chunk)
      .setBuffer(root.listBuffers()[0]),
  );
  return centres.size;
}

/**
 * The crack through the mountain, as seen from the front: rows of
 * [height, left, right] in model space, bottom to top.
 */
function measureOpening(document) {
  const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
  const positions = primitive.getAttribute("POSITION").getArray();
  const indices = primitive.getIndices().getArray();
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minY = Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }
  const COLS = 320;
  const ROWS = 260;
  const cellX = (x) => ((x - minX) / (maxX - minX)) * (COLS - 1);
  const cellY = (y) => ((y - minY) / (maxY - minY)) * (ROWS - 1);
  const solid = new Uint8Array(COLS * ROWS);
  // Every triangle, filled, seen straight on.
  for (let t = 0; t < indices.length; t += 3) {
    const ax = cellX(positions[indices[t] * 3]);
    const ay = cellY(positions[indices[t] * 3 + 1]);
    const bx = cellX(positions[indices[t + 1] * 3]);
    const by = cellY(positions[indices[t + 1] * 3 + 1]);
    const cx = cellX(positions[indices[t + 2] * 3]);
    const cy = cellY(positions[indices[t + 2] * 3 + 1]);
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const x1 = Math.min(COLS - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const y1 = Math.min(ROWS - 1, Math.ceil(Math.max(ay, by, cy)));
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(area) < 1e-9) {
      solid[Math.round(ay) * COLS + Math.round(ax)] = 1;
      continue;
    }
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const w0 = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / area;
        const w1 = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) solid[y * COLS + x] = 1;
      }
    }
  }
  // Outside: reachable from the left, right and top, not from below.
  const outside = new Uint8Array(COLS * ROWS);
  const queue = [];
  const seed = (x, y) => {
    const i = y * COLS + x;
    if (solid[i] || outside[i]) return;
    outside[i] = 1;
    queue.push(i);
  };
  for (let y = 0; y < ROWS; y += 1) {
    seed(0, y);
    seed(COLS - 1, y);
  }
  for (let x = 0; x < COLS; x += 1) seed(x, ROWS - 1);
  while (queue.length) {
    const i = queue.pop();
    const x = i % COLS;
    const y = (i - x) / COLS;
    if (x > 0) seed(x - 1, y);
    if (x < COLS - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < ROWS - 1) seed(x, y + 1);
  }
  // The crack: the largest open region left, row by row.
  const label = new Int32Array(COLS * ROWS).fill(-1);
  let best = { id: -1, size: 0 };
  let next = 0;
  for (let start = 0; start < COLS * ROWS; start += 1) {
    if (solid[start] || outside[start] || label[start] !== -1) continue;
    const id = next++;
    let size = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const i = stack.pop();
      size += 1;
      const x = i % COLS;
      for (const j of [i - 1, i + 1, i - COLS, i + COLS]) {
        if (j < 0 || j >= COLS * ROWS) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === COLS - 1)) continue;
        if (solid[j] || outside[j] || label[j] !== -1) continue;
        label[j] = id;
        stack.push(j);
      }
    }
    if (size > best.size) best = { id, size };
  }
  const rows = [];
  for (let y = 0; y < ROWS; y += 1) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < COLS; x += 1) {
      if (label[y * COLS + x] !== best.id) continue;
      if (left < 0) left = x;
      right = x;
    }
    if (left < 0) continue;
    const toX = (c) => minX + (c / (COLS - 1)) * (maxX - minX);
    rows.push([
      +(minY + (y / (ROWS - 1)) * (maxY - minY)).toFixed(5),
      +toX(left - 0.5).toFixed(5),
      +toX(right + 0.5).toFixed(5),
    ]);
  }
  return { bounds: { min: [minX, minY], max: [maxX, maxY] }, rows };
}

for (const source of SOURCES) {
  const document = await io.read(join(sourceFolder, source.file));
  const root = document.getRoot();
  // Tripo writes extensions three.js does not need here.
  for (const extension of root.listExtensionsUsed()) {
    if (extension.extensionName !== "KHR_texture_transform") extension.dispose();
  }
  const before = root.listMeshes()[0].listPrimitives()[0].getIndices().getCount();

  await document.transform(weld());
  const stones = source.stones ? tagStones(document) : 0;
  await document.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio: source.ratio, error: source.error }),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [source.mapSize, source.mapSize],
      quality: 86,
    }),
    prune(),
    reorder({ encoder: MeshoptEncoder }),
    // Positions and _CHUNK stay float: the stone centres must share the
    // vertices' space (see scripts/fracture-doorway.mjs).
    quantize({ pattern: /^(NORMAL|TEXCOORD_0)$/ }),
  );
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  if (!source.stones) {
    const opening = measureOpening(document);
    await writeFile(join(outputFolder, "opening.json"), JSON.stringify(opening));
    console.log(`opening: ${opening.rows.length} rows`);
  }

  const after = root.listMeshes()[0].listPrimitives()[0].getIndices().getCount();
  const output = join(outputFolder, source.output);
  await io.write(output, document);
  console.log(
    `${source.file}: ${before / 3} → ${after / 3} triangles${stones ? `, ${stones} stones` : ""} → ${output}`,
  );
}
