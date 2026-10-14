import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { rigRobotGait } from "../src/webgl/modules/robotGait";
function fixture() {
  const bytes = readFileSync("public/assets/hero/robot.glb"),
    jsonSize = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString());
  const accessor = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
  const view = gltf.bufferViews[accessor.bufferView];
  const data = new Float32Array(
    bytes.buffer,
    bytes.byteOffset + 28 + jsonSize + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
    accessor.count * 3,
  ).slice();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(data, 3));
  return { data, rig: rigRobotGait(new Mesh(geometry, new MeshStandardMaterial())) };
}
test("the existing robot silhouette is unchanged in the seated bind pose", () => {
  const { data, rig } = fixture(),
    point = new Vector3();
  for (let i = 0; i < data.length / 3; i++) {
    rig.mesh.getVertexPosition(i, point);
    assert.ok(
      point.distanceTo(new Vector3(data[i * 3], data[i * 3 + 1], data[i * 3 + 2])) < 0.000001,
    );
  }
  rig.destroy();
});
test("every vertex has normalized nonnegative skin weights and valid joints", () => {
  const { rig } = fixture(),
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
test("standing raises the torso while the lowest foot remains near its original ground plane", () => {
  const { rig } = fixture(),
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
test("walking articulates opposite legs and returns cleanly to the seated pose", () => {
  const { rig } = fixture();
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
