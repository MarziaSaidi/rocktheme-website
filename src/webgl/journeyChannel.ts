/**
 * Where the page wants the camera, from the page to the scene.
 *
 * The camera journey (core/cameraJourney.ts) is still one scroll offset in,
 * one pose out. What changed is who supplies that offset. The Work index never
 * scrolls: it names the project on show, and the scene stands at that
 * project's hold. The About page scrolls, and its scroll carries on from where
 * the descent after the last project ends, down at the water. Moving from one
 * page to the other moves the offset, and the scene's scroll spring flies the
 * camera between them.
 */
export type JourneyView =
  /** The Work index, standing at project `station` of `count`. */
  | Readonly<{ kind: "work"; station: number; count: number }>
  /** A page whose own scroll drives the camera from the water onward. */
  | Readonly<{ kind: "page" }>;

let current: JourneyView | null = null;
const listeners = new Set<(view: JourneyView | null) => void>();

export function publishJourneyView(next: JourneyView | null) {
  if (
    current?.kind === next?.kind &&
    (current?.kind !== "work" ||
      (next?.kind === "work" && current.station === next.station && current.count === next.count))
  ) {
    return;
  }
  current = next;
  listeners.forEach((listener) => listener(current));
}

export function subscribeJourneyView(listener: (view: JourneyView | null) => void) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
