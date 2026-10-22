import assert from "node:assert/strict";
import test from "node:test";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { rigRobotGait } from "../src/webgl/modules/robotGait";

// The delivered robot is meshopt-compressed (scripts/prepare-homepage-assets.mjs);
// its positions stay full float, so they decode to the same values the browser sees.
let positions: Promise<Float32Array> | undefined;
function robotPositions() {
  positions ??= MeshoptDecoder.ready
    .then(() =>
      new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
        .read("public/assets/hero/robot.glb"),
    )
    .then((document) =>
      Float32Array.from(
        document
          .getRoot()
          .listMeshes()[0]!
          .listPrimitives()[0]!
          .getAttribute("POSITION")!
          .getArray()!,
      ),
    );
  return positions;
}

async function fixture() {
  const data = (await robotPositions()).slice();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(data, 3));
  return { data, rig: rigRobotGait(new Mesh(geometry, new MeshStandardMaterial())) };
}
test("the existing robot silhouette is unchanged in the seated bind pose", async () => {
  const { data, rig } = await fixture(),
    point = new Vector3();
  for (let i = 0; i < data.length / 3; i++) {
    rig.mesh.getVertexPosition(i, point);
    assert.ok(
      point.distanceTo(new Vector3(data[i * 3], data[i * 3 + 1], data[i * 3 + 2])) < 0.000001,
    );
  }
  rig.destroy();
});
test("every vertex has normalized nonnegative skin weights and valid joints", async () => {
  const { rig } = await fixture(),
    weights = rig.mesh.geometry.getAttribute("skinWeight"),
    joints = rig.mesh.geometry.getAttribute("skinIndex");
  for (let i = 0; i < weights.count; i++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      const w = weights.array[i * 4 + j]!;
      assert.ok(w >= 0 && w <= 1);
      sum += w;
      assert.ok(joints.array[i * 4 + j]! < rig.mesh.skeleton.bones.length);
    }
    assert.ok(Math.abs(sum - 1) < 0.000001);
  }
  rig.destroy();
});
test("standing raises the torso while the lowest foot remains near its original ground plane", async () => {
  const { rig } = await fixture(),
    point = new Vector3();
  for (let i = 0; i < 180; i++) rig.update(1 / 60, 1, 0);
  let min = Infinity,
    max = -Infinity;
  const count = rig.mesh.geometry.getAttribute("position").count;
  for (let i = 0; i < count; i++) {
    rig.mesh.getVertexPosition(i, point);
    assert.ok([point.x, point.y, point.z].every(Number.isFinite));
    min = Math.min(min, point.y);
    max = Math.max(max, point.y);
  }
  assert.ok(min > -0.03 && min < 0.04, `Foot level ${min}`);
  assert.ok(max > 1.18 && max < 1.26, `Standing height ${max}`);
  rig.destroy();
});
test("walking articulates opposite legs and returns cleanly to the seated pose", async () => {
  const { rig } = await fixture();
  for (let i = 0; i < 180; i++) rig.update(1 / 60, 1, 0);
  const left = rig.mesh.skeleton.bones.find((b) => b.name === "hip-1")!,
    right = rig.mesh.skeleton.bones.find((b) => b.name === "hip--1")!;
  let separation = 0;
  for (let i = 0; i < 90; i++) {
    rig.update(1 / 60, 1, 1);
    separation = Math.max(separation, Math.abs(left.rotation.z - right.rotation.z));
  }
  assert.ok(separation > 0.4, `Alternating leg swing ${separation}`);
  for (let i = 0; i < 240; i++) rig.update(1 / 60, 0, 0);
  assert.equal(left.rotation.z, 0);
  assert.equal(right.rotation.z, 0);
  assert.equal(rig.mesh.skeleton.bones[0]!.position.y, 0);
  rig.destroy();
});

test("the planted boot stays fixed as the body advances during support", async () => {
  const { rig } = await fixture();
  for (let i = 0; i < 180; i++) rig.update(1 / 60, 1, 1, 0.02);
  const ankle = rig.mesh.skeleton.bones.find((b) => b.name === "ankle-1")!;
  const foot = new Vector3();
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i <= 40; i++) {
    const distance = 0.02 + i * 0.002;
    rig.update(1 / 60, 1, 1, distance);
    ankle.getWorldPosition(foot);
    const contact = foot.x - distance;
    min = Math.min(min, contact);
    max = Math.max(max, contact);
  }
  assert.ok(max - min < 0.003, `Support foot drift ${max - min}`);
  rig.destroy();
});
