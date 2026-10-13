import { SiteFooter } from "@/components/layout/SiteFooter";
import { RobotGuide } from "@/components/sections/ProjectExplorer";
import { Hero } from "@/components/sections/Hero";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { RiftControl } from "@/components/sections/RiftControl";
import { Statement } from "@/components/sections/Statement";
import { pageLandmarkIds } from "@/config/sections";
import { getFeaturedProjects } from "@/content/projects";
import { SceneCanvas } from "@/webgl/SceneCanvas";

export default function Home() {
  const projects = getFeaturedProjects();

  return (
    <>
      <SceneCanvas />
      <RiftControl />
      <RobotGuide firstProject={projects[0]?.title ?? "Selected work"} />
      <main id={pageLandmarkIds.main}>
        <Hero
          projects={projects.map((project) => ({
            slug: project.slug,
            title: project.title,
            year: project.year,
            category: project.category,
            description: project.shortDescription,
            href: project.caseStudyUrl,
            image:
              project.slug === "quill-and-pigeon"
                ? {
                    src: "/images/projects/quill-and-pigeon/story/validation-errors.png",
                    alt: "Quill & Pigeon contact review and validation interface",
                    width: 2042,
                    height: 1190,
                  }
                : project.homepageImage,
          }))}
        />
        <SelectedWork projects={projects} />
        <Statement />
      </main>
      <SiteFooter />
    </>
  );
}
