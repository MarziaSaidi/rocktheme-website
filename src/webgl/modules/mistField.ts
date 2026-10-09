/** Shared world-space banks for water slices and mountain valley haze. */
export const MIST_FIELD_GLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float total = 0.0;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      if (i >= uOctaves) break;
      value += noise2D(p) * amplitude;
      total += amplitude;
      p = rotation * p * 2.03 + vec2(17.1, 9.2);
      amplitude *= 0.5;
    }
    return value / total;
  }


  float mistBank(vec2 flow, float scale) {
    vec2 p = flow * scale;
    vec2 warp = vec2(fbm(p * 0.6 + 3.1), fbm(p * 0.6 + vec2(8.3, 1.7))) - 0.5;
    return fbm(p + warp * 1.3);
  }
`;
