/**
 * The snow doorway's link between the scene and the page.
 *
 * The scene publishes where the doorway's opening is on screen (or null when
 * it is not there to be used); the page lays a real button over it and sends
 * back whether the visitor is hovering it and how far they have held it.
 */
export type DoorwayRect = Readonly<{ x: number; y: number; width: number; height: number }>;

let rect: DoorwayRect | null = null;
const listeners = new Set<(rect: DoorwayRect | null) => void>();

let hover = false;
let hold = 0;

export function publishDoorwayRect(next: DoorwayRect | null) {
  const changed =
    (rect === null) !== (next === null) ||
    (rect !== null &&
      next !== null &&
      (Math.abs(rect.x - next.x) > 0.5 ||
        Math.abs(rect.y - next.y) > 0.5 ||
        Math.abs(rect.width - next.width) > 0.5 ||
        Math.abs(rect.height - next.height) > 0.5));
  if (!changed) return;
  rect = next;
  listeners.forEach((listener) => listener(rect));
}

export function subscribeDoorwayRect(listener: (rect: DoorwayRect | null) => void) {
  listeners.add(listener);
  listener(rect);
  return () => {
    listeners.delete(listener);
  };
}

export function setDoorwayHover(next: boolean) {
  hover = next;
}

/** How far the visitor has held the doorway, 0 to 1. */
export function setDoorwayHold(next: number) {
  hold = Math.min(1, Math.max(0, next));
}

export function getDoorwayInput() {
  return { hover, hold };
}

/**
 * The opening's centre and size on screen whenever the doorway is there at
 * all, with how present it is. The bio's dust streams out of it and back in.
 */
export type DoorwayAnchor = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  presence: number;
}>;

let anchor: DoorwayAnchor | null = null;

export function publishDoorwayAnchor(next: DoorwayAnchor | null) {
  anchor = next;
}

export function getDoorwayAnchor() {
  return anchor;
}

/**
 * How long the camera stays at the bio once the sentence is centred, in
 * viewport heights of scroll, before it sets off for Contact. The sentence
 * crumbles back into the doorway over this stretch.
 */
export const BIO_DWELL = 0.55;
