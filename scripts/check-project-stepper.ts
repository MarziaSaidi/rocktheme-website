import assert from "node:assert/strict";
import test from "node:test";
import { ProjectStepper } from "../src/motion/projectStepper";

test("every visit uses the same forward and reverse swaps", () => {
  const gallery = new ProjectStepper(2, 1700);
  let now = 0;
  for (let visit = 0; visit < 4; visit++) {
    gallery.enter(0, now);
    now += 1800;
    assert.equal(gallery.input(1, now), "swap");
    assert.deepEqual(gallery.transition, { from: 0, to: 1, direction: 1 });
    gallery.complete();
    now += 1800;
    assert.equal(gallery.input(1, now), "exit");
    assert.equal(gallery.station, null);

    now += 5000;
    gallery.enter(1, now);
    now += 1800;
    assert.equal(gallery.input(-1, now), "swap");
    assert.deepEqual(gallery.transition, { from: 1, to: 0, direction: -1 });
    gallery.complete();
    now += 1800;
    assert.equal(gallery.input(-1, now), "exit");
    assert.equal(gallery.station, null);
    now += 5000;
  }
});

test("continuous upward input cannot indefinitely reset the display hold", () => {
  const gallery = new ProjectStepper(2, 1700);
  gallery.enter(1, 0);
  let swaps = 0;
  for (let now = 100; now <= 6000; now += 100) {
    const action = gallery.input(-1, now);
    if (now < 1700) assert.equal(action, "hold");
    if (action === "swap") swaps++;
  }
  assert.equal(swaps, 1);
  assert.deepEqual(gallery.transition, { from: 1, to: 0, direction: -1 });
});

test("one early upward request runs when the hold ends, without another gesture", () => {
  const gallery = new ProjectStepper(2, 1700);
  gallery.enter(1, 0);
  assert.equal(gallery.input(-1, 100), "hold");
  assert.equal(gallery.pendingDelay(100), 1600);
  assert.equal(gallery.advance(1699), "hold");
  assert.equal(gallery.advance(1700), "swap");
  assert.deepEqual(gallery.transition, { from: 1, to: 0, direction: -1 });
});

test("a fling during the swap cannot queue another advance", () => {
  const gallery = new ProjectStepper(2, 1700);
  gallery.enter(1, 0);
  assert.equal(gallery.input(-1, 1800), "swap");
  for (let now = 1810; now < 3000; now += 10) {
    assert.equal(gallery.input(-1, now), "hold");
    assert.equal(gallery.pendingDelay(now), null);
  }
  gallery.complete();
  assert.equal(gallery.advance(6000), "hold");
  assert.equal(gallery.station, 0);
});

test("the next upward request exits after the remaining display time, without mouse movement", () => {
  const gallery = new ProjectStepper(2, 1700);
  gallery.enter(1, 0);
  gallery.input(-1, 1800);
  gallery.complete(); // 1200 ms horizontal transition finishes at 3000.
  assert.equal(gallery.input(-1, 3050), "hold");
  assert.equal(gallery.pendingDelay(3050), 450);
  assert.equal(gallery.advance(3500), "exit");
  assert.equal(gallery.station, null);
});

test("a pending request keeps only the latest requested direction", () => {
  const gallery = new ProjectStepper(2, 1700);
  gallery.enter(0, 0);
  gallery.input(1, 100);
  gallery.input(-1, 200);
  assert.equal(gallery.advance(1700), "exit");
});

test("navigation cancels pending input and any transition before the next visit", () => {
  const gallery = new ProjectStepper(2, 1700);
  gallery.enter(1, 0);
  gallery.input(-1, 100);
  gallery.leave();
  assert.equal(gallery.pendingDelay(1700), null);
  assert.equal(gallery.advance(1700), "native");
  gallery.enter(0, 2000);
  assert.equal(gallery.advance(4000), "hold");
  assert.equal(gallery.input(1, 4000), "swap");
  gallery.leave();
  gallery.complete();
  assert.equal(gallery.station, null);
});
