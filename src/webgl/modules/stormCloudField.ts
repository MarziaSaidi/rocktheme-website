import { SKY_DETAIL } from "../weather/shaders";

/** Shared cloud texture is sampled continuously across the water and terrain. */
export const STORM_CLOUD_GLSL = /* glsl */ `
  uniform sampler2D uWeatherSkyTexture;
  ${SKY_DETAIL}
`;
