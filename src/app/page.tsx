import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/sections/Hero";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { Statement } from "@/components/sections/Statement";
import { getFeaturedProjects } from "@/content/projects";
import { sectionIds } from "@/content/site/siteContent";
import { SceneCanvas } from "@/webgl/SceneCanvas";

export default function Home() {
  const projects = getFeaturedProjects();

  return (
    <>
      <SceneCanvas />
      <main id={sectionIds.main}>
        <Hero />
        <SelectedWork projects={projects} />
        <Statement />
      </main>
      <SiteFooter />
    </>
  );
}
