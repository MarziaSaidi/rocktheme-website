import assert from "node:assert/strict";
import test from "node:test";
import { ProjectStepper } from "../src/motion/projectStepper";

const settle = (gallery: ProjectStepper, now: number) => {
  gallery.ready(true, now);
  return now + 1800;
};

test("every visit uses the same forward and reverse swaps", () => {
  const gallery = new ProjectStepper(2, 1700);
  let now = 0;
  for (let visit = 0; visit < 4; visit++) {
    gallery.enter(0, now);
    now = settle(gallery, now);
    assert.equal(gallery.input(1, now), "swap");
    assert.deepEqual(gallery.transition, { from: 0, to: 1, direction: 1 });
    gallery.complete();
    now = settle(gallery, now + 1200);
    assert.equal(gallery.input(1, now), "exit");
    assert.equal(gallery.station, null);

    gallery.enter(1, now + 5000);
    now = settle(gallery, now + 5000);
    assert.equal(gallery.input(-1, now), "swap");
    assert.deepEqual(gallery.transition, { from: 1, to: 0, direction: -1 });
    gallery.complete();
    now = settle(gallery, now + 1200);
    assert.equal(gallery.input(-1, now), "exit");
    assert.equal(gallery.station, null);
    now += 5000;
  }
});

test("a fling cannot select another project during a swap or while the camera settles", () => {
  const gallery = new ProjectStepper(2, 1700);
  gallery.enter(0, 0);
  gallery.ready(true, 0);
  assert.equal(gallery.input(1, 1800), "swap");
  for (let now = 1810; now < 3000; now += 10) {
    assert.equal(gallery.input(1, now), "hold");
    assert.equal(gallery.input(-1, now), "hold");
    assert.equal(gallery.station, 0);
  }
  gallery.complete();
  gallery.ready(false, 3000);
  assert.equal(gallery.input(1, 5000), "hold");
  gallery.ready(true, 5100);
  assert.equal(gallery.input(1, 5200), "hold");
  assert.equal(gallery.input(1, 7000), "exit");
});

test("leaving through navigation clears a pending transition before the next visit", () => {
  const gallery = new ProjectStepper(2, 1700);
  gallery.enter(0, 0);
  gallery.ready(true, 0);
  gallery.input(1, 1800);
  gallery.leave();
  gallery.complete();
  assert.equal(gallery.station, null);
  gallery.enter(1, 6000);
  gallery.ready(true, 6000);
  assert.equal(gallery.input(-1, 8000), "swap");
});
