import { lightningConfig, stormSkyConfig } from "../sceneConfig";

/** The approved domain-warped cloud field, shared by sky and reflected light. */
export const STORM_CLOUD_GLSL = /* glsl */ `
  uniform float uWeatherCloudTime;
  uniform int uWeatherCloudOctaves;

  float weatherHash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float weatherNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = weatherHash(i);
    float b = weatherHash(i + vec2(1.0, 0.0));
    float c = weatherHash(i + vec2(0.0, 1.0));
    float d = weatherHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float weatherFbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float total = 0.0;
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      if (i >= uWeatherCloudOctaves) break;
      value += weatherNoise(p) * amplitude;
      total += amplitude;
      p = rotation * p * 2.03 + vec2(17.1, 9.2);
      amplitude *= 0.5;
    }
    return value / total;
  }


  float stormCloudDensity(vec3 direction) {
    vec2 p = direction.xz * ${stormSkyConfig.scale.toFixed(2)} / (0.65 + max(direction.y, 0.0));
    p += vec2(uWeatherCloudTime * 0.006, -uWeatherCloudTime * 0.002);

    // Nested fbm warps the broad banks twice before sampling cloud density.
    vec2 q = vec2(weatherFbm(p + vec2(0.0, 4.7)), weatherFbm(p + vec2(8.3, 1.7))) - 0.5;
    vec2 r = vec2(
      weatherFbm(p + q * 1.35 + vec2(1.7, 9.2)),
      weatherFbm(p + q * 1.35 + vec2(8.1, 2.8))
    ) - 0.5;
    float field = weatherFbm(p + r * 1.8);
    return smoothstep(0.24, 0.78, field);
  }
  float stormCloudResponse(vec3 direction, float cloud) {
    // Dense, irregular banks carry light; no spherical distance falloff exists.
    float structure = smoothstep(0.06, 0.72, cloud);
    structure = (0.18 + 0.82 * structure) * smoothstep(0.015, 0.45, cloud);
    return structure * (0.22 + 0.78 * weatherHorizonCell(direction));
  }
  vec3 stormCloudRadiance(vec3 direction, float cloud) {
    // Outgoing display-space radiance shared with water. Horizon extinction
    // is applied once, independently of the calm sky's coverage alpha.
    float horizon = smoothstep(0.005, 0.16, direction.y);
    return uWeatherColor * uWeatherFlash * ${lightningConfig.skyGain}
      * (0.22 * cloud + stormCloudResponse(direction, cloud)) * horizon;
  }
`;
