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

/*
 * Keyboard arrival (docs/typography-motion-system.md, §15). A link to Selected
 * Work activated from the keyboard (a click with no pointer, `detail` 0) on
 * another page asks the gallery to move focus to the first shown project's
 * case-study link when it mounts. The request survives the client-side
 * navigation and is read once.
 */
let focusRequested = false;

/** Whether `link` points at Selected Work on the home page. */
export function isWorkLink(link: Element): link is HTMLAnchorElement {
  if (!(link instanceof HTMLAnchorElement)) return false;
  const url = new URL(link.href, location.href);
  return url.origin === location.origin && url.pathname === "/" && url.hash === "#selected-work";
}

/** Watches for keyboard-activated links to Selected Work. Returns the cleanup. */
export function watchWorkLinks() {
  const click = (event: MouseEvent) => {
    // The gallery handles links on its own page and cancels the navigation.
    if (event.defaultPrevented || event.detail !== 0) return;
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (link && isWorkLink(link)) focusRequested = true;
  };
  document.addEventListener("click", click, true);
  return () => document.removeEventListener("click", click, true);
}

/** Reads, and clears, a keyboard arrival's request for focus. */
export function takeWorkFocus() {
  const requested = focusRequested;
  focusRequested = false;
  return requested;
}
