import { SiteFooter } from "@/components/layout/SiteFooter";
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
      <main id={pageLandmarkIds.main}>
        <Hero />
        <SelectedWork projects={projects} />
        <Statement />
      </main>
      <SiteFooter />
    </>
  );
}
