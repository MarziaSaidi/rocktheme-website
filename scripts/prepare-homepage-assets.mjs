/** Optimize a copy of the original prepared assets. Never re-encode generated output.
 * Reproduce the input with: git archive 16eeb3f public/assets | tar -x -C /tmp/homepage-source
 * Usage: node --import tsx scripts/prepare-homepage-assets.mjs /tmp/homepage-source/public/assets
 * Camera, transforms, source art, rift opening rows and per-stone _CHUNK stay fixed.
 */
import { resolve, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { prune, quantize, reorder, simplify, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
import { heroLandscapeConfig } from "../src/webgl/sceneConfig.ts";
import { resolveResponsiveValue } from "../src/config/responsive.ts";

/** Preserve the original five-probe seat; simplifying terrain must not move the robot. */
function sourceSeat(primitive, bounds) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(primitive.getAttribute("POSITION").getArray().slice(), 3),
  );
  geometry.setIndex(new BufferAttribute(primitive.getIndices().getArray().slice(), 1));
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  const size = bounds.getSize(new Vector3()),
    center = bounds.getCenter(new Vector3());
  mesh.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
  mesh.position.set(-center.x / size.x, -bounds.min.y / size.y, -center.z / size.z);
  const group = new Group();
  group.add(mesh);
  const ray = new Raycaster(),
    result = {};
  for (const viewport of ["desktop", "tablet", "mobile"]) {
    const { perch, robot } = resolveResponsiveValue(heroLandscapeConfig.placement, viewport);
    group.position.set(...perch.position);
    group.rotation.y = perch.yaw;
    group.scale.set(perch.mirror ? -perch.width : perch.width, perch.height, perch.depth);
    group.updateMatrixWorld(true);
    const reach = robot.height * 0.12,
      hits = [];
    for (const [dx, dz] of [
      [0, 0],
      [reach, 0],
      [-reach, 0],
      [0, reach],
      [0, -reach],
    ]) {
      ray.set(new Vector3(robot.x + dx, 100, robot.z + dz), new Vector3(0, -1, 0));
      const hit = ray.intersectObject(mesh, false)[0];
      if (hit) hits.push(hit.point.y);
    }
    hits.sort((a, b) => a - b);
    result[viewport] = {
      perch,
      robot,
      height: hits.length ? hits[Math.floor(hits.length / 2)] - robot.height * 0.02 : 0,
    };
  }
  geometry.dispose();
  mesh.material.dispose();
  return result;
}

const source = process.argv[2];
if (!source || resolve(source) === resolve("public/assets")) {
  throw new Error("Supply a separate directory containing the original prepared assets.");
}
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.encoder": MeshoptEncoder,
  "meshopt.decoder": MeshoptDecoder,
});
const files = [
  "hero/mountains",
  "hero/perch-rock",
  "hero/robot",
  "rocks/footer-rock",
  "selected-work/mountains",
  "rift/mountain",
];
for (const file of files) {
  for (const mobile of file.startsWith("hero/") || file.startsWith("selected-work/")
    ? [false, true]
    : [false]) {
    const document = await io.read(join(source, `${file}.glb`));
    if (file.startsWith("hero/")) {
      const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
      const positions = primitive.getAttribute("POSITION");
      const bounds = new Box3(
        new Vector3().fromArray(positions.getMinNormalized([])),
        new Vector3().fromArray(positions.getMaxNormalized([])),
      );
      document
        .getRoot()
        .listScenes()[0]
        .setExtras({
          sourceBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
          ...(file === "hero/perch-rock" ? { sourceSeat: sourceSeat(primitive, bounds) } : {}),
        });
    }
    // Runtime already discards these maps for distant mountains.
    if (file.endsWith("/mountains")) {
      for (const material of document.getRoot().listMaterials())
        material.setMetallicRoughnessTexture(null);
    }
    await document.transform(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: file === "hero/robot" ? (mobile ? 0.2 : 0.35) : mobile ? 0.12 : 0.2,
        error: mobile ? 0.002 : 0.0015,
      }),
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        resize:
          mobile && file.startsWith("selected-work/")
            ? [512, 512]
            : mobile || file.startsWith("selected-work/")
              ? [768, 768]
              : [1024, 1024],
        quality: mobile ? 86 : 90,
      }),
      prune(),
      reorder({ encoder: MeshoptEncoder }),
      quantize({
        pattern: file === "hero/robot" ? /^(NORMAL|TEXCOORD_0)$/ : /^(POSITION|NORMAL|TEXCOORD_0)$/,
        quantizePosition: 14,
        quantizeNormal: 10,
        quantizeTexcoord: 12,
      }),
    );
    document
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const output = `public/assets/${file}${mobile ? ".mobile" : ""}.glb`;
    await mkdir(resolve(output, ".."), { recursive: true });
    const bytes = await io.writeBinary(document);
    await writeFile(output, bytes);
    console.log(`${output}: ${bytes.length} bytes; gzip ${gzipSync(bytes).length}`);
  }
}
// The animated stones' float positions and _CHUNK centres must share their
// original space. Keep their already compressed geometry and textures verbatim.
await writeFile("public/assets/rift/stones.glb", await readFile(join(source, "rift/stones.glb")));
