/**
 * The active project, from Selected Work to the rest of the page.
 *
 * The gallery publishes a station when a project's details are shown and no
 * swap is in progress (the same moment it plays the readout sound), and null
 * when no project is shown. The header's project counter listens.
 */
export type WorkStation = Readonly<{ station: number; count: number }>;

let current: WorkStation | null = null;
const listeners = new Set<(station: WorkStation | null) => void>();

export function publishWorkStation(next: WorkStation | null) {
  if (current?.station === next?.station && current?.count === next?.count) return;
  current = next;
  listeners.forEach((listener) => listener(current));
}

export function subscribeWorkStation(listener: (station: WorkStation | null) => void) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
