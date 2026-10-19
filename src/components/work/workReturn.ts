/**
 * The way back from a case study.
 *
 * Opening a project from Selected Work remembers which one it was. Coming
 * back to the gallery by a link (the case study's back link, the nav's Work)
 * then lands on that project's card, where the visitor left, rather than at
 * the top of the runway. The browser's own Back needs none of this: it
 * restores the scroll position itself.
 */

const RETURN_KEY = "marzia-saidi:work-return";
const FOCUS_KEY = `${RETURN_KEY}:focus`;

export function rememberWorkReturn(slug: string, keyboard = false): void {
  try {
    window.sessionStorage.setItem(RETURN_KEY, slug);
    window.sessionStorage.setItem(FOCUS_KEY, String(keyboard));
  } catch {
    // Blocked storage only means the return lands at the top of the gallery.
  }
}

/** Restore keyboard context once, alongside the remembered project. */
export function takeWorkReturnFocus(): boolean {
  try {
    const focus = window.sessionStorage.getItem(FOCUS_KEY) === "true";
    window.sessionStorage.removeItem(FOCUS_KEY);
    return focus;
  } catch {
    return false;
  }
}

/** The project to return to, read once: a later visit starts fresh. */
export function takeWorkReturn(): string | null {
  try {
    const slug = window.sessionStorage.getItem(RETURN_KEY);
    window.sessionStorage.removeItem(RETURN_KEY);
    return slug;
  } catch {
    return null;
  }
}
