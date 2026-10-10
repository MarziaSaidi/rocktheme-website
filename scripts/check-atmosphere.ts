import assert from "node:assert/strict";
import test from "node:test";
import { MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from "three";
import { applyDistanceFog, createDistanceFogUniforms } from "../src/webgl/modules/distanceFog";
import { createWeatherUniforms } from "../src/webgl/core/weather";
import { distanceFogConfig } from "../src/webgl/sceneConfig";

test("mountain transport replaces scene fog once and preserves shared lightning after extinction", () => {
  const material = new MeshStandardMaterial();
  const weather = createWeatherUniforms();
  const uniforms = createDistanceFogUniforms(distanceFogConfig, weather);
  applyDistanceFog(material, uniforms);
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\n#include <begin_vertex>",
    fragmentShader: "#include <common>\n#include <fog_fragment>",
  } as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, null!);
  assert.equal(material.fog, false);
  assert.strictEqual(shader.uniforms.uWeatherFlash, weather.uWeatherFlash);
  assert.equal(shader.fragmentShader.match(/gl_FragColor.rgb = mix/g)?.length, 1);
  assert.ok(shader.fragmentShader.includes("atmospherePath(vAtmosWorld, cameraPosition"));
  assert.ok(!/uniform.*scroll/i.test(shader.fragmentShader));
  assert.ok(
    shader.fragmentShader.indexOf("gl_FragColor.rgb += airLight") >
      shader.fragmentShader.indexOf("gl_FragColor.rgb = mix"),
  );
  assert.ok(!shader.fragmentShader.includes("mix(gl_FragColor.rgb, uAerialMist"));
  material.dispose();
});
