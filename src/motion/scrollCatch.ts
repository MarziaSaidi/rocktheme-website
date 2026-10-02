/**
 * Scroll stops: places on the page a fast scroll is not allowed to fly past.
 *
 * The page keeps its native scroll and the camera keeps its spring. All this
 * does is notice when the visitor's own scrolling (wheel, trackpad, touch,
 * keys) is about to cross a stop before what lives there has been seen, put
 * the page exactly on the stop instead, and hold it there until the moment has
 * played for long enough. Then it lets go and the next gesture carries on.
 *
 * A visitor who is already taking their time never feels it: a stop whose
 * moment has been on screen for its full reading time is not caught at all.
 * Jumps the visitor asks for (the nav, Home/End, dragging the scrollbar) are
 * never caught either, and a caught hold gives way to any of them.
 */

export type ScrollStop = Readonly<{
  /** Tell the stop whether its moment is on screen right now. */
  setReady: (ready: boolean) => void;
  remove: () => void;
}>;

type StopOptions = Readonly<{
  /** The page offset to stop at, measured fresh each time; null to skip. */
  position: () => number | null;
  /** How long the moment needs to have been on screen, in ms, before letting go. */
  readFor: number;
  /**
   * The longest this stop may hold, in ms, if its moment never shows. Only a
   * backstop: set it well past the moment's own length, or the hold can let
   * go just before the moment has finished.
   */
  maxHold?: number;
}>;

type Stop = StopOptions & { readySince: number | null };

/** Shortest hold, however quickly the moment shows. */
const MIN_HOLD = 600;
/** Longest hold by default, in case the moment never shows (no WebGL, a slow device). */
const MAX_HOLD = 6500;
/**
 * Input has to pause this long before the hold lets go, so the tail of a
 * trackpad fling is absorbed rather than carried on past the stop.
 */
const QUIET = 180;
/** Scrolling within this long of wheel or key input counts as the visitor's own. */
const INPUT_RECENT = 400;
/** Touch momentum carries on without events, so touch counts for longer. */
const TOUCH_RECENT = 1600;
/**
 * Right after a touch catch the browser may still apply a scroll step it had
 * queued; for this long, movement is put back rather than ending the hold.
 */
const SETTLE_GRACE = 250;
/** A held page moved further than this by anything else means a jump was asked for. */
const BREAK_DISTANCE = 48;

const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Spacebar"]);

const stops = new Set<Stop>();
let hold: { stop: Stop; y: number; since: number; lastInput: number } | null = null;
let lastInput = -Infinity;
let lastTouch = -Infinity;
let previousY = 0;
let frame = 0;
let listening = false;

const now = () => performance.now();

function seen(stop: Stop, at: number) {
  return stop.readySince !== null && at - stop.readySince >= stop.readFor;
}

/** The first unseen stop met going from `from` to `to`, or null. */
function crossed(from: number, to: number): { stop: Stop; y: number } | null {
  if (from === to) return null;
  const at = now();
  const down = to > from;
  let best: { stop: Stop; y: number } | null = null;
  stops.forEach((stop) => {
    if (seen(stop, at)) return;
    const y = stop.position();
    if (y === null) return;
    const meets = down ? from < y - 1 && to >= y : from > y + 1 && to <= y;
    if (!meets) return;
    if (!best || Math.abs(y - from) < Math.abs(best.y - from)) best = { stop, y };
  });
  return best;
}

/**
 * A touch scroll, once under way, can't be cancelled from its events, and its
 * momentum runs on without any. So a hold caught from touch freezes the page's
 * own scrolling instead, which stops the finger and the momentum alike. The
 * scroll position is untouched, and code (the nav) can still scroll it.
 */
let frozen = false;
function freeze(on: boolean) {
  if (on === frozen) return;
  frozen = on;
  const value = on ? "hidden" : "";
  document.documentElement.style.overflow = value;
  document.body.style.overflow = value;
}

function catchAt(target: { stop: Stop; y: number }, touch: boolean) {
  const at = now();
  hold = { stop: target.stop, y: target.y, since: at, lastInput: at };
  if (touch) freeze(true);
  // Instant: the camera's spring already smooths the page's motion.
  window.scrollTo({ top: target.y, behavior: "instant" });
  previousY = target.y;
  if (frame === 0) frame = requestAnimationFrame(watch);
}

function release() {
  hold = null;
  freeze(false);
  if (frame !== 0) cancelAnimationFrame(frame);
  frame = 0;
}

function watch() {
  frame = 0;
  if (!hold) return;
  const at = now();
  const { stop, since, lastInput: input } = hold;
  const held = at - since;
  const read = stop.readySince !== null && at - Math.max(stop.readySince, since) >= stop.readFor;
  if (held >= (stop.maxHold ?? MAX_HOLD) || (held >= MIN_HOLD && read && at - input >= QUIET)) {
    release();
    return;
  }
  frame = requestAnimationFrame(watch);
}

function editable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

function onWheel(event: WheelEvent) {
  // A pinch on a trackpad arrives as a ctrl-wheel: that is zoom, not scroll.
  if (event.ctrlKey) return;
  const at = now();
  lastInput = at;
  if (hold) {
    event.preventDefault();
    hold.lastInput = at;
    return;
  }
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  const from = window.scrollY;
  const end = document.documentElement.scrollHeight - window.innerHeight;
  const to = Math.min(end, Math.max(0, from + event.deltaY * unit));
  // Caught before the page moves, so nothing ever overshoots and comes back.
  const target = crossed(from, to);
  if (target) {
    event.preventDefault();
    catchAt(target, false);
  }
}

function onKey(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (editable(event.target)) return;
  // Home and End are jumps the visitor asked for; they are not caught.
  if (!SCROLL_KEYS.has(event.key)) return;
  const at = now();
  lastInput = at;
  if (hold) {
    event.preventDefault();
    hold.lastInput = at;
  }
}

function onTouchStart() {
  lastTouch = now();
}

function onTouchMove(event: TouchEvent) {
  const at = now();
  lastTouch = at;
  // Pinch zoom (two fingers) stays the visitor's.
  if (!hold || event.touches.length > 1) return;
  // A scroll already under way can't be cancelled; the freeze holds it then.
  if (event.cancelable) event.preventDefault();
  hold.lastInput = at;
}

function onScroll() {
  const y = window.scrollY;
  const from = previousY;
  previousY = y;
  if (hold) {
    if (Math.abs(y - hold.y) <= BREAK_DISTANCE) return;
    // A step the browser had already queued when the hold caught: undo it.
    if (frozen && now() - hold.since < SETTLE_GRACE) {
      window.scrollTo({ top: hold.y, behavior: "instant" });
      previousY = hold.y;
      return;
    }
    release();
    return;
  }
  const at = now();
  const touch = at - lastTouch < TOUCH_RECENT;
  if (!touch && at - lastInput >= INPUT_RECENT) return;
  // Keys, touch momentum, or a wheel step already under way: caught as soon
  // as the stop is passed, which is at most a step beyond it.
  const target = crossed(from, y);
  if (target) catchAt(target, touch);
}

function listen(on: boolean) {
  if (on === listening) return;
  listening = on;
  if (on) {
    previousY = window.scrollY;
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
  } else {
    release();
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("scroll", onScroll);
  }
}

export function addScrollStop(options: StopOptions): ScrollStop {
  const stop: Stop = { ...options, readySince: null };
  stops.add(stop);
  listen(true);
  return {
    setReady: (ready) => {
      if (ready && stop.readySince === null) stop.readySince = now();
      if (!ready) stop.readySince = null;
    },
    remove: () => {
      stops.delete(stop);
      if (hold?.stop === stop) release();
      if (stops.size === 0) listen(false);
    },
  };
}
