import { WorkIndex, type IndexProject } from "@/components/work/WorkIndex";
import { pageLandmarkIds } from "@/config/sections";
import { getFeaturedProjects, getProjectRoute } from "@/content/projects";

/*
 * Each project's own wordmark, taken from its website and kept as a light
 * mask: the index draws it in particles. `width` is the mark's drawn width on
 * a desktop screen; its height follows the image.
 */
const wordmarks: Record<string, IndexProject["wordmark"]> = {
  "quill-and-pigeon": {
    src: "/images/projects/quill-and-pigeon/logo.png",
    width: 760,
    aspect: 1600 / 180,
  },
  survue: { src: "/images/projects/survue/logo.png", width: 470, aspect: 720 / 185 },
};

export default function Home() {
  const projects: IndexProject[] = getFeaturedProjects().map((project) => ({
    slug: project.slug,
    title: project.title,
    year: String(project.year),
    role: project.role.join(" + "),
    category: project.category,
    href: getProjectRoute(project),
    wordmark: wordmarks[project.slug] ?? null,
  }));

  return (
    <main id={pageLandmarkIds.main}>
      <WorkIndex projects={projects} />
    </main>
  );
}
