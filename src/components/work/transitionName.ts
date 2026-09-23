/**
 * Shared view-transition identity for a project's media.
 *
 * The corridor plane and the case-study hero use the same name, so the browser
 * morphs one into the other during navigation. Derived from the slug, so it is
 * generated for every project and hardcoded for none.
 *
 * A view-transition name must be unique in the document, which is why only the
 * corridor claims it. The hero cluster shows the same projects and would
 * otherwise collide.
 */
export function projectTransitionName(slug: string): string {
  return `project-media-${slug}`;
}
