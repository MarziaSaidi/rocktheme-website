/**
 * Builds every asset the winter cabin loads, from Poly Haven (CC0).
 *
 *   npm run prepare:cabin            download what is missing, then rebuild
 *   npm run prepare:cabin -- --force rebuild outputs even if they exist
 *
 * Raw downloads are cached in assets-src/cabin (git-ignored). Web copies are
 * written to public/assets/cabin with a manifest that records each source,
 * its licence and the sun direction measured from the sky photograph.
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, "assets-src/cabin");
const out = join(root, "public/assets/cabin");
const force = process.argv.includes("--force");
const API = "https://api.polyhaven.com";

/** Props: Poly Haven id, texture edge in px, triangle budget. */
const PROPS = [
  ["vintage_electric_kettle", 512, 20000],
  ["tea_set_01", 512, 30000],
  ["Rockingchair_01", 1024, 20000],
  ["ArmChair_01", 1024, 20000],
  ["hatchet", 512, 6000],
  ["wooden_axe", 512, 6000],
  ["Lantern_01", 512, 20000],
  ["WoodenTable_01", 1024, 10000],
  ["desk_lamp_arm_01", 512, 20000],
  ["painted_wooden_chair_01", 1024, 10000],
  ["book_encyclopedia_set_01", 512, 20000],
  ["painted_wooden_cabinet", 1024, 20000],
  ["electric_stove", 1024, 20000],
  ["pot_enamel_01", 512, 10000],
  ["brass_pot_01", 512, 10000],
  ["brass_pan_01", 512, 8000],
  ["wooden_cutting_board", 512, 4000],
  ["wooden_spoon", 256, 3000],
  ["wicker_basket_01", 512, 20000],
  ["metal_jug", 512, 8000],
  ["Shelf_01", 1024, 8000],
  ["Ottoman_01", 1024, 12000],
  ["modern_arm_chair_01", 1024, 25000],
  ["coffee_table_round_01", 1024, 10000],
  ["dining_chair_02", 1024, 15000],
];

/** Surfaces: Poly Haven texture id and the role it plays. */
const MATERIALS = [
  ["wood_trunk_wall", "walls"],
  ["roof_slates_02", "roof"],
  ["rustic_stone_wall", "stone"],
  ["wood_floor_worn", "floor"],
  ["snow_02", "snow"],
  ["raw_plank_wall", "timber"],
];

const SKY = "horn-koppe_snow";

/**
 * The fir: the fullest of the three in fir_sapling_medium, an 8 m young
 * fir. Its needles are real geometry, so detail is reduced by keeping a share
 * of whole twigs. Two builds: full for desktop, lighter for phones.
 */
const FIR = { id: "fir_sapling_medium", node: "fir_sapling_medium_a_LOD0", woodRatio: 0.15 };
const FIR_BUILDS = [
  { file: "fir.glb", twigKeep: 0.32 },
  { file: "fir-lite.glb", twigKeep: 0.15 },
];

// ------------------------------------------------------------------ helpers

const exists = async (path) =>
  stat(path).then(
    (info) => info.size > 0,
    () => false,
  );

async function json(url) {
  const response = await fetch(url, { headers: { "User-Agent": "marzia-portfolio-build" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function download(url, path, { range } = {}) {
  if (await exists(path)) return path;
  await mkdir(dirname(path), { recursive: true });
  const headers = { "User-Agent": "marzia-portfolio-build" };
  if (range) headers.Range = `bytes=${range[0]}-${range[1] - 1}`;
  const response = await fetch(url, { headers });
  if (!response.ok || !response.body) throw new Error(`${response.status} ${url}`);
  if (range && response.status !== 206) throw new Error(`Range not honoured for ${url}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(path));
  return path;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

async function createIO() {
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
}

function triangleCount(document) {
  let count = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      count += (indices ? indices.getCount() : primitive.getAttribute("POSITION").getCount()) / 3;
    }
  }
  return count;
}

/** The shared web treatment: tidy, simplify to budget, WebP, meshopt. */
async function optimise(document, { textureSize, triangles }) {
  await document.transform(dedup(), prune(), weld());
  const before = triangleCount(document);
  if (triangles && before > triangles) {
    await document.transform(
      simplify({ simplifier: MeshoptSimplifier, ratio: triangles / before, error: 0.002 }),
    );
  }
  await document.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [textureSize, textureSize],
      quality: 82,
    }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  return { before, after: triangleCount(document) };
}

// ------------------------------------------------------------------ props

async function buildProp(io, [id, textureSize, triangles]) {
  const target = join(out, "props", `${id}.glb`);
  if (!force && (await exists(target))) return { id, skipped: true };

  const files = await json(`${API}/files/${id}`);
  const gltf = files.gltf["1k"].gltf;
  const folder = join(cache, "props", id);
  const main = await download(gltf.url, join(folder, `${id}.gltf`));
  for (const [relative, entry] of Object.entries(gltf.include)) {
    await download(entry.url, join(folder, relative));
  }

  const document = await io.read(main);
  const counts = await optimise(document, { textureSize, triangles });
  await mkdir(dirname(target), { recursive: true });
  await io.write(target, document);
  return { id, ...counts, bytes: (await stat(target)).size };
}

// ------------------------------------------------------------------ materials

async function buildMaterial([id, role]) {
  const folder = join(out, "materials", role);
  const files = await json(`${API}/files/${id}`);
  const maps = {
    color: files.Diffuse?.["1k"]?.jpg ?? files.diff?.["1k"]?.jpg,
    normal: files.nor_gl?.["1k"]?.jpg,
    orm: files.arm?.["1k"]?.jpg,
  };
  const written = {};
  for (const [name, entry] of Object.entries(maps)) {
    if (!entry) throw new Error(`${id} has no ${name} map at 1k`);
    const source = await download(entry.url, join(cache, "materials", id, `${name}.jpg`));
    const target = join(folder, `${name}.webp`);
    if (force || !(await exists(target))) {
      await mkdir(folder, { recursive: true });
      await sharp(source)
        .resize(1024, 1024)
        .webp({ quality: name === "color" ? 82 : 88 })
        .toFile(target);
    }
    written[name] = (await stat(target)).size;
  }
  return { id, role, bytes: Object.values(written).reduce((a, b) => a + b, 0) };
}

// ------------------------------------------------------------------ sky

/**
 * The sun's direction, from the brightest patch of the tonemapped photo.
 * Pixels in the top 0.02% of luminance are averaged so a clipped sun disc
 * gives its centre rather than one arbitrary pixel.
 */
async function measureSun(source) {
  const width = 1024;
  const { data, info } = await sharp(source)
    .resize(width, width / 2)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminance = new Float32Array(info.width * info.height);
  for (let i = 0; i < luminance.length; i++) {
    luminance[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
  }
  const sorted = Float32Array.from(luminance).sort();
  const threshold = sorted[Math.floor(sorted.length * 0.9998)];
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let y = 0; y < info.height / 2; y++) {
    for (let x = 0; x < info.width; x++) {
      if (luminance[y * info.width + x] < threshold) continue;
      const phi = (x / info.width) * Math.PI * 2;
      const theta = (y / info.height) * Math.PI;
      // three.js equirectangular convention: u = atan2(z, x) / 2π + 0.5.
      sx += -Math.cos(phi) * Math.sin(theta);
      sy += Math.cos(theta);
      sz += -Math.sin(phi) * Math.sin(theta);
    }
  }
  const length = Math.hypot(sx, sy, sz) || 1;
  return [sx / length, sy / length, sz / length].map((value) => Number(value.toFixed(4)));
}

async function buildSky() {
  const files = await json(`${API}/files/${SKY}`);
  const folder = join(out, "sky");
  await mkdir(folder, { recursive: true });

  const hdr = await download(files.hdri["1k"].hdr.url, join(cache, "sky", `${SKY}_1k.hdr`));
  const hdrTarget = join(folder, "lighting.hdr");
  if (force || !(await exists(hdrTarget))) await writeFile(hdrTarget, await readFile(hdr));

  const photo = await download(files.tonemapped.url, join(cache, "sky", `${SKY}_tonemapped.jpg`));
  const backdrop = join(folder, "backdrop.webp");
  if (force || !(await exists(backdrop))) {
    await sharp(photo, { limitInputPixels: false })
      .resize(6144, 3072)
      .webp({ quality: 80 })
      .toFile(backdrop);
  }
  return {
    id: SKY,
    sun: await measureSun(photo),
    bytes: (await stat(hdrTarget)).size + (await stat(backdrop)).size,
  };
}

// ------------------------------------------------------------------ fir

/**
 * The fir. Poly Haven ships its firs as three full-detail trees in one large
 * buffer; only the chosen tree is fetched, with a range request for its bytes.
 * Its twig cards are then thinned (whole cards removed, never reshaped) and
 * the trunk and bark are simplified.
 */
async function buildFir(io, { file, twigKeep }) {
  const target = join(out, "props", file);
  if (!force && (await exists(target))) return { id: file, skipped: true };

  const files = await json(`${API}/files/${FIR.id}`);
  const gltfEntry = files.gltf["1k"].gltf;
  const folder = join(cache, FIR.id);
  const gltfPath = await download(gltfEntry.url, join(folder, "source.gltf"));
  const source = JSON.parse(await readFile(gltfPath, "utf8"));

  const node = source.nodes.find((candidate) => candidate.name === FIR.node);
  const mesh = source.meshes[node.mesh];
  const accessorIds = mesh.primitives.flatMap((primitive) => [
    ...Object.values(primitive.attributes),
    primitive.indices,
  ]);
  const viewIds = [...new Set(accessorIds.map((id) => source.accessors[id].bufferView))];
  const start = Math.min(...viewIds.map((id) => source.bufferViews[id].byteOffset ?? 0));
  const end = Math.max(
    ...viewIds.map(
      (id) => (source.bufferViews[id].byteOffset ?? 0) + source.bufferViews[id].byteLength,
    ),
  );

  const binName = Object.keys(gltfEntry.include).find((name) => name.endsWith(".bin"));
  await download(gltfEntry.include[binName].url, join(folder, "tree.bin"), {
    range: [start, end],
  });
  for (const [relative, entry] of Object.entries(gltfEntry.include)) {
    if (relative !== binName) await download(entry.url, join(folder, relative));
  }

  // A glTF holding just this tree, its views rebased onto the slice.
  const viewMap = new Map(viewIds.map((id, index) => [id, index]));
  const accessorMap = new Map(accessorIds.map((id, index) => [id, index]));
  const sliced = {
    asset: source.asset,
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "fir", mesh: 0 }],
    meshes: [
      {
        name: "fir",
        primitives: mesh.primitives.map((primitive) => ({
          ...primitive,
          attributes: Object.fromEntries(
            Object.entries(primitive.attributes).map(([key, id]) => [key, accessorMap.get(id)]),
          ),
          indices: accessorMap.get(primitive.indices),
        })),
      },
    ],
    accessors: accessorIds.map((id) => ({
      ...source.accessors[id],
      bufferView: viewMap.get(source.accessors[id].bufferView),
    })),
    bufferViews: viewIds.map((id) => ({
      ...source.bufferViews[id],
      buffer: 0,
      byteOffset: (source.bufferViews[id].byteOffset ?? 0) - start,
    })),
    buffers: [{ uri: "tree.bin", byteLength: end - start }],
    materials: source.materials,
    textures: source.textures,
    images: source.images,
    samplers: source.samplers,
  };
  const slicedPath = join(folder, "tree.gltf");
  await writeFile(slicedPath, JSON.stringify(sliced));

  const document = await io.read(slicedPath);
  await document.transform(dedup(), prune());
  const before = triangleCount(document);
  for (const primitive of document.getRoot().listMeshes()[0].listPrimitives()) {
    const name = primitive.getMaterial()?.getName() ?? "";
    if (name.includes("twig") || name.includes("dead")) thinCards(primitive, twigKeep);
  }
  await document.transform(prune(), weld());
  // Simplify the wood only; cards are already as light as they will get.
  for (const primitive of document.getRoot().listMeshes()[0].listPrimitives()) {
    const name = primitive.getMaterial()?.getName() ?? "";
    if (!name.includes("twig") && !name.includes("dead")) {
      simplifyPrimitive(primitive, FIR.woodRatio);
    }
  }
  await document.transform(
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 82 }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await io.write(target, document);
  return { id: file, before, after: triangleCount(document), bytes: (await stat(target)).size };
}

/** Removes whole twigs (connected triangle islands), keeping a share. */
function thinCards(primitive, keep) {
  const indices = primitive.getIndices();
  const array = indices.getArray();
  const vertexCount = primitive.getAttribute("POSITION").getCount();
  const parent = new Int32Array(vertexCount).map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let t = 0; t < array.length; t += 3) {
    const a = find(array[t]);
    parent[find(array[t + 1])] = a;
    parent[find(array[t + 2])] = a;
  }
  // A stable hash per card, so the same cards survive every rebuild.
  const keepCard = (rootIndex) => {
    let h = rootIndex * 2654435761;
    h = (h ^ (h >>> 15)) >>> 0;
    return (h % 10000) / 10000 < keep;
  };
  const kept = [];
  for (let t = 0; t < array.length; t += 3) {
    if (keepCard(find(array[t]))) kept.push(array[t], array[t + 1], array[t + 2]);
  }
  const Typed = array.constructor;
  indices.setArray(new Typed(kept));
}

function simplifyPrimitive(primitive, ratio) {
  const indices = primitive.getIndices();
  const position = primitive.getAttribute("POSITION");
  const target = Math.floor((indices.getCount() * ratio) / 3) * 3;
  const [simplified] = MeshoptSimplifier.simplify(
    new Uint32Array(indices.getArray()),
    new Float32Array(position.getArray()),
    3,
    target,
    0.01,
    ["LockBorder"],
  );
  const Typed = indices.getArray().constructor;
  indices.setArray(new Typed(simplified));
}

// ------------------------------------------------------------------ run

const io = await createIO();
await mkdir(out, { recursive: true });

const report = { props: [], materials: [], sky: null };
for (const prop of PROPS) {
  const result = await buildProp(io, prop);
  report.props.push(result);
  console.log(
    result.skipped
      ? `  prop ${result.id}: kept`
      : `  prop ${result.id}: ${result.before}→${result.after} tris, ${kb(result.bytes)}`,
  );
}
for (const material of MATERIALS) {
  const result = await buildMaterial(material);
  report.materials.push(result);
  console.log(`  material ${result.role} (${result.id}): ${kb(result.bytes)}`);
}
report.sky = await buildSky();
console.log(`  sky ${report.sky.id}: sun ${report.sky.sun.join(", ")}, ${kb(report.sky.bytes)}`);
for (const build of FIR_BUILDS) {
  const result = await buildFir(io, build);
  console.log(
    result.skipped
      ? `  ${result.id}: kept`
      : `  ${result.id}: ${result.before}→${result.after} tris, ${kb(result.bytes)}`,
  );
}

const previous = await readFile(join(out, "manifest.json"), "utf8").then(JSON.parse, () => ({}));
const manifest = {
  licence: "CC0 1.0 — Poly Haven (polyhaven.com). No attribution required.",
  sun: report.sky.sun,
  sky: { id: SKY, source: `https://polyhaven.com/a/${SKY}` },
  props: Object.fromEntries(
    PROPS.map(([id]) => [id, { file: `props/${id}.glb`, source: `https://polyhaven.com/a/${id}` }]),
  ),
  fir: {
    files: FIR_BUILDS.map((build) => `props/${build.file}`),
    source: `https://polyhaven.com/a/${FIR.id}`,
    note: "Tree a only, whole twigs thinned",
  },
  materials: Object.fromEntries(
    MATERIALS.map(([id, role]) => [
      role,
      { folder: `materials/${role}`, source: `https://polyhaven.com/a/${id}` },
    ]),
  ),
};
if (JSON.stringify(previous) !== JSON.stringify(manifest)) {
  await writeFile(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log("Cabin assets ready in public/assets/cabin");
