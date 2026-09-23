/**
 * Shared pointer source.
 *
 * One listener set, one truth. The custom cursor, the particle field and the
 * floor ripples all read the same sample, which is what lets the cursor, the
 * particles and the water agree about where the visitor is.
 *
 * Subscribers are called once per pointer event, not once per frame. Render
 * loops should read `snapshot()` on their own schedule instead.
 */
export type PointerSample = Readonly<{
  /** Client coordinates in CSS pixels. */
  x: number;
  y: number;
  /** Movement since the previous sample, in CSS pixels. */
  dx: number;
  dy: number;
  /** Magnitude of recent movement in px per second, smoothed. */
  speed: number;
  /** True once a fine pointer has actually moved. */
  active: boolean;
  /** True while the pointer is inside the document. */
  inside: boolean;
  timeStamp: number;
}>;

export type PointerSource = Readonly<{
  snapshot: () => PointerSample;
  subscribe: (listener: (sample: PointerSample) => void) => () => void;
  destroy: () => void;
}>;

const EMPTY: PointerSample = {
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
  speed: 0,
  active: false,
  inside: false,
  timeStamp: 0,
};

export function createPointerSource(): PointerSource {
  let sample = EMPTY;
  const listeners = new Set<(next: PointerSample) => void>();

  const publish = (next: PointerSample) => {
    sample = next;
    listeners.forEach((listener) => listener(next));
  };

  const handleMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    const now = event.timeStamp;
    const previous = sample;
    const dx = previous.active ? event.clientX - previous.x : 0;
    const dy = previous.active ? event.clientY - previous.y : 0;
    const elapsed = previous.active ? Math.max(1, now - previous.timeStamp) : 16;
    const instant = (Math.hypot(dx, dy) / elapsed) * 1000;

    publish({
      x: event.clientX,
      y: event.clientY,
      dx,
      dy,
      // Smoothed so a single jittery event cannot spike downstream behaviour.
      speed: previous.speed + (instant - previous.speed) * 0.25,
      active: true,
      inside: true,
      timeStamp: now,
    });
  };

  const handleLeave = () => {
    publish({ ...sample, dx: 0, dy: 0, speed: 0, inside: false });
  };

  const handleEnter = () => {
    publish({ ...sample, inside: true });
  };

  window.addEventListener("pointermove", handleMove, { passive: true });
  document.addEventListener("pointerleave", handleLeave);
  document.addEventListener("pointerenter", handleEnter);

  return {
    snapshot: () => sample,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy: () => {
      window.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerleave", handleLeave);
      document.removeEventListener("pointerenter", handleEnter);
      listeners.clear();
      sample = EMPTY;
    },
  };
}
