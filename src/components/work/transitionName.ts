/**
 * Shared view-transition identity for a project's media.
 *
 * Any homepage media given this name morphs into the case-study hero during
 * navigation. The Selected Work stone is drawn in WebGL, so nothing on the
 * homepage claims it at present. Derived from the slug, so it is
 * generated for every project and hardcoded for none.
 *
 * A view-transition name must be unique in the document, which is why only one
 * element may claim it. The hero cluster shows the same projects and would
 * otherwise collide.
 */
export function projectTransitionName(slug: string): string {
  return `project-media-${slug}`;
}
