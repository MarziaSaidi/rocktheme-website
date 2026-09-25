/**
 * Channel between the Selected Work gallery and the scene.
 *
 * Each project has its own stone; the gallery hands the scene one screen image
 * per stone, in project order. That is all that crosses: plain URLs. Where the
 * camera stands, and so which stone is in view, follows the page scroll
 * through the camera journey, which the gallery reads from the same table
 * (workJourney.ts). The scene learns nothing about projects.
 */

type Listener = () => void;

let faces: readonly string[] = [];
const listeners = new Set<Listener>();

/** One screen image URL per stone, in project order. */
export function setMonolithFaces(next: readonly string[]): void {
  faces = next;
  listeners.forEach((listener) => listener());
}

export function getMonolithFaces(): readonly string[] {
  return faces;
}

export function subscribeMonolith(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
