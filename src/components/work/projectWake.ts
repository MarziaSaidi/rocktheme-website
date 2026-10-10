import { REPLAY_EVENT } from "@/motion/DecodeText";
import { createFrameGuard } from "@/motion/frameGuard";

/**
 * Selected Work: the project wakes together (docs/typography-motion-system.md,
 * §5, Selected Work).
 *
 * Pointing at the title, the case-study link or the floating screens, or
 * focusing the link, wakes all three at once: moonlight rises into the title,
 * the link decodes and its arrow swaps, and the composition opens around its
 * main screen (supporting screens drift 4 px outward, the main one lifts 3 px
 * and brightens). Leaving releases them together, slower than they came.
 *
 * Separately, while the camera stands at the project (`data-camera-settled`),
 * a little moonlight rests in the title; it drains as the camera starts to
 * leave, before the frozen exit.
 *
 * Camera, layout and the entrance and exit sequences are untouched: this only
 * animates properties they don't use (the registered `--title-rest` and
 * `--title-rise`, the screens' `translate`, the main image's `filter`), with
 * the Web Animations API, never by rewriting a transition. Mouse and keyboard
 * only; touch never wakes anything. Nothing runs with reduced motion.
 *
 * Performance guard: while a wake or its release is animating, frames are
 * sampled by the shared frame guard (frameGuard.ts). If they slip, the wake
 * lets go and rests for the rest of the visit, on every project: the title
 * light, the opening screens and the replay it gives the link. Everything
 * else stays as it is: the link's own decode on hover and focus, the resting
 * light while the camera stands at a project, the screens' drift, and the
 * frozen entrances and exits.
 */

/** One guard for the whole visit: once the wake has cost frames, it rests on every project. */
const wakeGuard = createFrameGuard();
/** The wake's first frames read the screens' boxes and start its animations: a one-off. */
const WAKE_WARMUP_FRAMES = 2;

const EASE_IN = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_OUT = "cubic-bezier(0.5, 0, 0.75, 0)";
/** Title light: resting while the camera is here, and woken. */
const REST_LIGHT = 0.2;
const WAKE_LIGHT = 0.62;
/** Passing over the screens on the way elsewhere isn't attention: wait a beat. */
const DWELL_MS = 140;
/** Leaving one part for another (title → link) shouldn't flicker the wake. */
const HANDOFF_MS = 90;
/** How long a phone's arrival wake holds before it settles back. */
const ARRIVAL_WAKE_MS = 1400;
/** Screen boxes are read at most this often, never once per move. */
const RECT_MS = 200;

const numberOf = (element: Element, property: string) =>
  parseFloat(getComputedStyle(element).getPropertyValue(property)) || 0;

export function bindProjectWake(project: HTMLElement): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const title = project.querySelector<HTMLElement>("[data-wake-title]");
  const light = project.querySelector<HTMLElement>("[data-wake-light]");
  const link = project.querySelector<HTMLElement>("[data-work-view]");
  const visual = project.querySelector<HTMLElement>("[data-wake-visual]");
  if (reduced.matches || !title || !light || !link) return () => {};

  const root = document.documentElement;
  const over = new Set<string>();
  let awake = false;
  let rise: Animation | null = null;
  let rest: Animation | null = null;
  let restOn = false;
  let pieces: Animation[] = [];
  let releaseTimer = 0;
  /*
   * A phone has no hover, so the project wakes once, by itself, when the
   * camera arrives at it, and settles back after a beat (§13, Mobile). Never
   * again during the visit; a pointer that can hover gets the hover instead.
   */
  const noHover = window.matchMedia("(hover: none)").matches;
  let arrivalWoken = false;
  let arrivalTimer = 0;
  let dwellTimer = 0;
  let rects: DOMRect[] | null = null;
  let rectsAt = 0;

  /**
   * Animates one title light from wherever it is now. The current value is
   * read before the previous animation is cancelled: cancelling first would
   * drop the light to 0 and the release would be a cut, not a drain.
   */
  const animateLight = (
    property: "--title-rest" | "--title-rise",
    to: number,
    rising: boolean,
    previous: Animation | null,
  ) => {
    const from = numberOf(light, property);
    previous?.cancel();
    return light.animate([{ [property]: from }, { [property]: to }], {
      duration: rising
        ? property === "--title-rest"
          ? 900
          : 380
        : property === "--title-rest"
          ? 420
          : 620,
      easing: rising || property === "--title-rise" ? EASE_IN : EASE_OUT,
      fill: "forwards",
    });
  };

  const syncRest = () => {
    const on = root.hasAttribute("data-camera-settled");
    if (on === restOn) return;
    restOn = on;
    rest = animateLight("--title-rest", on ? REST_LIGHT : 0, on, rest);
    if (on && noHover && !arrivalWoken) {
      arrivalWoken = true;
      wake();
      arrivalTimer = window.setTimeout(() => {
        if (over.size === 0) release();
      }, ARRIVAL_WAKE_MS);
    }
  };

  const screens = () =>
    visual ? [...visual.querySelectorAll<HTMLElement>("[data-placement]")] : [];

  // Frames are sampled only while the wake or its release animates.
  let sampleFrame = 0;
  let sampleLast = 0;
  let sampleUntil = 0;
  const tripGuard = () => {
    const section = project.closest("section");
    if (section) section.dataset.wakeGuard = "tripped";
    over.clear();
    release(true);
  };
  const sampleTick = (now: number) => {
    if (sampleLast !== 0 && !wakeGuard.tripped && wakeGuard.sample(now - sampleLast)) tripGuard();
    sampleLast = now;
    if (now < sampleUntil && !wakeGuard.tripped) sampleFrame = requestAnimationFrame(sampleTick);
    else {
      sampleFrame = 0;
      sampleLast = 0;
    }
  };
  const sampleFor = (ms: number) => {
    if (wakeGuard.tripped) return;
    sampleUntil = Math.max(sampleUntil, performance.now() + ms);
    if (!sampleFrame) sampleFrame = requestAnimationFrame(sampleTick);
  };

  const wake = () => {
    if (awake || wakeGuard.tripped) return;
    awake = true;
    wakeGuard.warmUp(WAKE_WARMUP_FRAMES);
    sampleFor(460);
    project.dataset.wake = "";
    rise = animateLight("--title-rise", WAKE_LIGHT, true, rise);
    link.dispatchEvent(new Event(REPLAY_EVENT));
    // The composition opens around its main screen; nothing scales.
    const all = screens();
    const main = all.find((piece) => piece.dataset.placement === "main") ?? all[0];
    if (!main) return;
    const centre = main.getBoundingClientRect();
    const cx = centre.left + centre.width / 2;
    const cy = centre.top + centre.height / 2;
    pieces.forEach((animation) => animation.cancel());
    pieces = all.flatMap((piece) => {
      const timing = { duration: 380, easing: EASE_IN, fill: "forwards" } as const;
      // Added to the screens' own slow drift (also on `translate`), never replacing it.
      const drift = { ...timing, composite: "add" } as const;
      if (piece === main) {
        const image = piece.querySelector("img");
        return [
          piece.animate([{ translate: "0 0" }, { translate: "0 -3px" }], drift),
          ...(image
            ? [image.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.04)" }], timing)]
            : []),
        ];
      }
      const box = piece.getBoundingClientRect();
      const dx = box.left + box.width / 2 - cx;
      const dy = box.top + box.height / 2 - cy;
      const length = Math.hypot(dx, dy) || 1;
      const to = `${((dx / length) * 4).toFixed(2)}px ${((dy / length) * 4).toFixed(2)}px`;
      return [
        piece.animate([{ translate: "0 0" }, { translate: to }], { ...drift, duration: 420 }),
      ];
    });
  };

  const release = (quick = false) => {
    if (!awake) return;
    awake = false;
    delete project.dataset.wake;
    rise = animateLight("--title-rise", 0, false, rise);
    if (quick) rise.updatePlaybackRate(2);
    // Back the way they came, slower than they arrived (a negative rate keeps the reverse).
    pieces.forEach((animation) => {
      animation.reverse();
      animation.updatePlaybackRate(quick ? -2 : -0.65);
    });
    sampleFor(quick ? 340 : 680);
  };

  const enter = (part: string) => {
    over.add(part);
    window.clearTimeout(releaseTimer);
    // Only once the card is shown; its own entrance owns everything before that.
    if (project.querySelector("[data-shown]")) wake();
  };
  const leave = (part: string) => {
    over.delete(part);
    window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => {
      if (over.size === 0) release();
    }, HANDOFF_MS);
  };

  const mouse = (handler: () => void) => (event: PointerEvent) => {
    if (event.pointerType === "mouse") handler();
  };
  const titleEnter = mouse(() => enter("title"));
  const titleLeave = mouse(() => leave("title"));
  const linkEnter = mouse(() => enter("link"));
  const linkLeave = mouse(() => leave("link"));
  const focus = () => {
    if (link.matches(":focus-visible")) enter("focus");
  };
  const blur = () => leave("focus");
  // The screens take no pointer events (they float over the glass): hit-test them.
  const move = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !visual) return;
    const now = performance.now();
    if (!rects || now - rectsAt > RECT_MS) {
      rects = screens().map((piece) => piece.getBoundingClientRect());
      rectsAt = now;
    }
    const hit = rects.some(
      (box) =>
        event.clientX > box.left &&
        event.clientX < box.right &&
        event.clientY > box.top &&
        event.clientY < box.bottom,
    );
    if (hit && !over.has("visual")) {
      if (!dwellTimer) {
        dwellTimer = window.setTimeout(() => {
          dwellTimer = 0;
          enter("visual");
        }, DWELL_MS);
      }
    } else if (!hit) {
      window.clearTimeout(dwellTimer);
      dwellTimer = 0;
      if (over.has("visual")) leave("visual");
    }
  };

  title.addEventListener("pointerenter", titleEnter);
  title.addEventListener("pointerleave", titleLeave);
  link.addEventListener("pointerenter", linkEnter);
  link.addEventListener("pointerleave", linkLeave);
  link.addEventListener("focus", focus);
  link.addEventListener("blur", blur);
  // The screens are hit-tested from moves, so a pointer leaving the window
  // over them never reports leaving them: let everything go then.
  const away = () => {
    window.clearTimeout(dwellTimer);
    dwellTimer = 0;
    for (const part of ["visual", "title", "link"]) if (over.has(part)) leave(part);
  };
  window.addEventListener("pointermove", move, { passive: true });
  document.documentElement.addEventListener("pointerleave", away);
  window.addEventListener("blur", away);
  // Filtered to one attribute, so the scene's per-frame style writes never reach it.
  const settled = new MutationObserver(syncRest);
  settled.observe(root, { attributes: true, attributeFilter: ["data-camera-settled"] });
  syncRest();
  // A link already focused when the card arrives (keyboard entry) wakes it.
  if (document.activeElement === link) focus();

  return () => {
    title.removeEventListener("pointerenter", titleEnter);
    title.removeEventListener("pointerleave", titleLeave);
    link.removeEventListener("pointerenter", linkEnter);
    link.removeEventListener("pointerleave", linkLeave);
    link.removeEventListener("focus", focus);
    link.removeEventListener("blur", blur);
    window.removeEventListener("pointermove", move);
    document.documentElement.removeEventListener("pointerleave", away);
    window.removeEventListener("blur", away);
    settled.disconnect();
    window.clearTimeout(releaseTimer);
    window.clearTimeout(dwellTimer);
    window.clearTimeout(arrivalTimer);
    // The card is leaving (its frozen exit is starting): everything drains, quickly.
    over.clear();
    release(true);
    if (sampleFrame) cancelAnimationFrame(sampleFrame);
    sampleFrame = 0;
    if (restOn) {
      restOn = false;
      rest = animateLight("--title-rest", 0, false, rest);
    }
  };
}
