import assert from "node:assert/strict";
import test from "node:test";

import { addScrollStop } from "../src/motion/scrollCatch";

test("project stops catch return crossings after a project has already been read", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const surface = new EventTarget();
  const mockWindow = Object.assign(surface, {
    scrollY: 1500,
    innerHeight: 720,
    scrollTo({ top }: { top: number }) {
      this.scrollY = top;
      surface.dispatchEvent(new Event("scroll"));
    },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: mockWindow });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: { scrollHeight: 5000, style: {} }, body: { style: {} } },
  });
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const wheel = (deltaY: number) => {
    const event = Object.assign(new Event("wheel", { cancelable: true }), {
      deltaY,
      deltaMode: 0,
      ctrlKey: false,
    });
    surface.dispatchEvent(event);
    return event;
  };
  let stop: ReturnType<typeof addScrollStop> | undefined;
  try {
    // About and other ordinary reading stops retain their existing behavior.
    stop = addScrollStop({ position: () => 1000, readFor: 0 });
    stop.setReady(true);
    assert.equal(wheel(-800).defaultPrevented, false);
    stop.remove();

    for (const [from, delta] of [
      [1500, -800],
      [500, 800],
    ]) {
      mockWindow.scrollY = from!;
      stop = addScrollStop({ position: () => 1000, readFor: 0, repeatOnCrossing: true });
      stop.setReady(true);
      assert.equal(wheel(delta!).defaultPrevented, true);
      assert.equal(mockWindow.scrollY, 1000);
      assert.equal(wheel(delta!).defaultPrevented, true, "momentum stays at the caught project");
      stop.remove();
      stop = undefined;
    }
  } finally {
    stop?.remove();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});
