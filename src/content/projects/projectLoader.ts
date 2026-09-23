import { projectRegistry } from "./projectRegistry";
import type { Project } from "./project.types";

const byOrder = (left: Project, right: Project) => left.order - right.order;

export function getAllProjects(options: { includeDisabled?: boolean } = {}): readonly Project[] {
  const projects = options.includeDisabled
    ? projectRegistry
    : projectRegistry.filter((project) => project.enabled);

  return [...projects].sort(byOrder);
}

export function getFeaturedProjects(): readonly Project[] {
  return getAllProjects().filter((project) => project.featured);
}

export function getProjectBySlug(
  slug: string,
  options: { includeDisabled?: boolean } = {},
): Project | undefined {
  return getAllProjects(options).find((project) => project.slug === slug);
}

export function requireProjectBySlug(
  slug: string,
  options: { includeDisabled?: boolean } = {},
): Project {
  const project = getProjectBySlug(slug, options);

  if (!project) {
    throw new Error(`Unknown project slug: ${slug}`);
  }

  return project;
}

export function getNextProject(project: Project): Project {
  return requireProjectBySlug(project.nextProjectSlug);
}

export function getProjectRoute(project: Pick<Project, "slug">): `/work/${string}` {
  return `/work/${project.slug}`;
}

export function getProjectStaticParams(): readonly Readonly<{ slug: string }>[] {
  return getAllProjects().map(({ slug }) => ({ slug }));
}
