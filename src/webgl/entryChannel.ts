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

/*
 * Loading order. The doorway is the first thing a visitor sees, so the
 * landscape behind the gate holds its own (much heavier) downloads until the
 * doorway is standing. The gate says when; a timeout keeps the landscape from
 * waiting forever on a failed or blocked doorway.
 */

let doorwayStanding = false;
const doorwayWaiters = new Set<Listener>();

export function markDoorwayStanding(): void {
  doorwayStanding = true;
  doorwayWaiters.forEach((resume) => resume());
  doorwayWaiters.clear();
}

/** Resolves once the doorway stands, the gate is gone, or `limitMs` passes. */
export function afterDoorway(limitMs = 8000): Promise<void> {
  if (doorwayStanding || !document.querySelector("[data-site-entry]")) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      doorwayWaiters.delete(done);
      resolve();
    };
    const timer = window.setTimeout(done, limitMs);
    doorwayWaiters.add(done);
  });
}
