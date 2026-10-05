/**
 * The bio's dust between the page and the scene.
 *
 * The page runs the choreography: which grain is where on screen, how fast it
 * is moving and how far it has lifted towards the viewer. When the scene is
 * running it draws them inside the world, at the rift's depth, where the
 * water reflects them; the page only draws them itself when the scene is not
 * reading them.
 *
 * Page → scene: the grains and the exposure of their streaks.
 * Scene → page: that it is reading them.
 */

/** Floats per grain: x, y (CSS px), size (px), colour (0 lavender … 1 porcelain), alpha, vx, vy (px/s), lift (0 … 1). */
export const BIO_DUST_STRIDE = 8;

export type BioDustFrame = Readonly<{
  grains: Float32Array;
  count: number;
  /** Seconds of motion each grain is smeared over: longer when the visitor scrolls fast. */
  exposure: number;
}>;

let frame: BioDustFrame | null = null;
let readAt = -Infinity;

export function publishBioDust(next: BioDustFrame | null) {
  frame = next;
}

/** The scene takes the latest grains; reading also tells the page the scene is drawing them. */
export function readBioDust() {
  readAt = performance.now();
  return frame;
}

/** Whether the scene has read the grains recently enough to be the one drawing them. */
export function sceneDrawsBioDust() {
  return performance.now() - readAt < 250;
}
