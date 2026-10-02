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

export function rememberWorkReturn(slug: string): void {
  try {
    window.sessionStorage.setItem(RETURN_KEY, slug);
  } catch {
    // Blocked storage only means the return lands at the top of the gallery.
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
