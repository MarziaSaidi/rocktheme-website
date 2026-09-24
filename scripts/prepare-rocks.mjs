/** Reduce the supplied Tripo GLBs for real-time use, retaining their PBR maps. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";
import { MeshoptSimplifier } from "meshoptimizer";

const root = new URL("../public/assets/rocks/", import.meta.url);
const standardSources = [
  ["hero.glb", "hero-rock.glb"],
  ["selected work.glb", "selected-work-rock.glb"],
  ["footer.glb", "footer-rock.glb"],
];
const sources = process.argv.includes("--intro")
  ? [["rock formation 3d model.glb", "intro-rock.glb"]]
  : standardSources;
const desktop = process.argv[2];
if (!desktop) throw new Error("Usage: node scripts/prepare-rocks.mjs /path/to/source-folder");

await MeshoptSimplifier.ready;
await mkdir(root, { recursive: true });

function pad(buffer) {
  const amount = (4 - (buffer.length % 4)) % 4;
  return amount ? Buffer.concat([buffer, Buffer.alloc(amount)]) : buffer;
}

for (const [source, destination] of sources) {
  const input = await readFile(join(desktop, source));
  const jsonLength = input.readUInt32LE(12);
  const sourceJson = JSON.parse(input.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength + 8;
  const view = (index) => {
    const range = sourceJson.bufferViews[index];
    return input.subarray(
      binStart + (range.byteOffset ?? 0),
      binStart + (range.byteOffset ?? 0) + range.byteLength,
    );
  };
  const accessor = (index, ArrayType) => {
    const entry = sourceJson.accessors[index];
    const bytes = view(entry.bufferView);
    return new ArrayType(
      bytes.buffer,
      bytes.byteOffset + (entry.byteOffset ?? 0),
      entry.count * (entry.type === "VEC3" ? 3 : entry.type === "VEC2" ? 2 : 1),
    );
  };
  const primitive = sourceJson.meshes[0].primitives[0];
  const originalPositions = accessor(primitive.attributes.POSITION, Float32Array);
  const originalNormals = accessor(primitive.attributes.NORMAL, Float32Array);
  const originalUvs = accessor(primitive.attributes.TEXCOORD_0, Float32Array);
  const originalIndices = accessor(primitive.indices, Uint32Array);
  const [simplified] = MeshoptSimplifier.simplify(
    originalIndices,
    originalPositions,
    3,
    240000,
    0.012,
  );
  const remap = new Map();
  const indices = new Uint32Array(simplified.length);
  const position = [];
  const normal = [];
  const uv = [];
  for (let i = 0; i < simplified.length; i += 1) {
    const original = simplified[i];
    let target = remap.get(original);
    if (target === undefined) {
      target = remap.size;
      remap.set(original, target);
      position.push(
        originalPositions[original * 3],
        originalPositions[original * 3 + 1],
        originalPositions[original * 3 + 2],
      );
      normal.push(
        originalNormals[original * 3],
        originalNormals[original * 3 + 1],
        originalNormals[original * 3 + 2],
      );
      uv.push(originalUvs[original * 2], originalUvs[original * 2 + 1]);
    }
    indices[i] = target;
  }

  const chunks = [];
  const bufferViews = [];
  let byteLength = 0;
  const add = (buffer, target) => {
    const bufferView = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: byteLength,
      byteLength: buffer.length,
      ...(target ? { target } : {}),
    });
    const aligned = pad(buffer);
    chunks.push(aligned);
    byteLength += aligned.length;
    return bufferView;
  };
  const positions = new Float32Array(position);
  const normals = new Float32Array(normal);
  const uvs = new Float32Array(uv);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }
  const accessors = [
    {
      bufferView: add(Buffer.from(positions.buffer), 34962),
      componentType: 5126,
      count: remap.size,
      type: "VEC3",
      min,
      max,
    },
    {
      bufferView: add(Buffer.from(normals.buffer), 34962),
      componentType: 5126,
      count: remap.size,
      type: "VEC3",
    },
    {
      bufferView: add(Buffer.from(uvs.buffer), 34962),
      componentType: 5126,
      count: remap.size,
      type: "VEC2",
    },
    {
      bufferView: add(Buffer.from(indices.buffer), 34963),
      componentType: 5125,
      count: indices.length,
      type: "SCALAR",
    },
  ];
  const images = [];
  for (const image of sourceJson.images) {
    const texture = view(image.bufferView);
    const processed =
      image.mimeType === "image/png"
        ? await sharp(texture).resize(2048, 2048).png({ compressionLevel: 9 }).toBuffer()
        : await sharp(texture).resize(2048, 2048).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    images.push({ bufferView: add(processed), mimeType: image.mimeType });
  }
  const gltf = {
    asset: { version: "2.0", generator: "prepare-rocks.mjs (Tripo textures retained)" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: basename(destination, ".glb") }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
            mode: 4,
          },
        ],
      },
    ],
    materials: sourceJson.materials,
    textures: sourceJson.textures,
    samplers: sourceJson.samplers,
    images,
    accessors,
    bufferViews,
    buffers: [{ byteLength }],
  };
  const json = pad(Buffer.from(JSON.stringify(gltf), "utf8"));
  // JSON chunks use spaces for padding, unlike BIN chunks.
  for (let i = json.length - 1; i >= 0 && json[i] === 0; i -= 1) json[i] = 0x20;
  const bin = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  await writeFile(
    new URL(destination, root),
    Buffer.concat([header, jsonHeader, json, binHeader, bin]),
  );
  console.log(
    `${source}: ${originalIndices.length / 3} → ${indices.length / 3} triangles, ${Math.round(input.length / 1048576)} → ${Math.round((header.length + jsonHeader.length + json.length + binHeader.length + bin.length) / 1048576)} MiB`,
  );
}
