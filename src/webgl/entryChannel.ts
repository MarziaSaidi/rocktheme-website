/**
 * Channel between the entry gate and the scene.
 *
 * The gate flies its own camera through the stone doorway. When that camera
 * crosses the threshold, the gate asks the scene to bring the hero camera in
 * the last few metres to its rest, so the two read as one journey. Nothing
 * else crosses: no poses, no timings.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function requestEntryArrival(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeEntryArrival(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
