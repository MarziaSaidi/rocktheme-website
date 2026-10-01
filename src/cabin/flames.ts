import { AdditiveBlending, DoubleSide, Group, Mesh, PlaneGeometry } from "three";
import { abs, color, float, mix, mx_noise_float, pow, smoothstep, time, uv, vec3 } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

/**
 * A wood fire's flames, drawn by a shader on three crossed planes so they
 * hold up from any side. Noise rising through the shape makes the tongues;
 * the heat ramp runs from deep orange at the edges to near white at the core.
 */
export function buildFlames({ width = 0.46, height = 0.5 } = {}) {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });

  const p = uv();
  const rising = time.mul(1.5);
  const turbulence = mx_noise_float(vec3(p.x.mul(3.2), p.y.mul(2.4).sub(rising), time.mul(0.35)))
    .mul(0.6)
    .add(
      mx_noise_float(vec3(p.x.mul(7), p.y.mul(5).sub(rising.mul(1.6)), time.mul(0.6))).mul(0.25),
    );

  // Narrower as it rises; the noise eats into the outline to make tongues.
  const across = abs(p.x.sub(0.5)).mul(2);
  const taper = float(1).sub(p.y.mul(0.82));
  const outline = across.div(taper.max(0.05)).add(turbulence.mul(0.6)).add(p.y.mul(0.2));
  // smoothstep needs rising edges in WGSL, so the falloffs are written as 1 − rise.
  const body = float(1)
    .sub(smoothstep(0.25, 1, outline))
    .mul(smoothstep(0, 0.06, p.y))
    .mul(float(1).sub(smoothstep(0.55, 1, p.y)));

  const heat = pow(body, float(2.4));
  const flameColour = mix(color("#c2370a"), mix(color("#ff9a2e"), color("#fff1c9"), heat), heat);
  material.colorNode = flameColour.mul(body).mul(2.1);
  material.opacityNode = body;

  const geometry = new PlaneGeometry(width, height);
  geometry.translate(0, height / 2, 0);
  const group = new Group();
  for (const turn of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const plane = new Mesh(geometry, material);
    plane.rotation.y = turn;
    plane.renderOrder = 2;
    group.add(plane);
  }

  return {
    group,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
