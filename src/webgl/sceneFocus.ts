import type { ObstacleRect } from "./modules/particleField";

/**
 * Focus channel between the page and the scene.
 *
 * A section publishes the screen rectangle it wants the environment to respond
 * to; the canvas subscribes and forwards it. The channel carries geometry only,
 * which is what keeps the page and the scene independent: a section
 * knows nothing about particles, and the scene knows nothing about projects.
 */

let current: ObstacleRect | null = null;
const listeners = new Set<(rect: ObstacleRect | null) => void>();

export function setSceneFocus(rect: ObstacleRect | null): void {
  current = rect;
  listeners.forEach((listener) => listener(rect));
}

export function subscribeSceneFocus(listener: (rect: ObstacleRect | null) => void): () => void {
  listeners.add(listener);
  // Replay the current value so a late subscriber is never out of step.
  listener(current);

  return () => {
    listeners.delete(listener);
  };
}

export type { ObstacleRect };
