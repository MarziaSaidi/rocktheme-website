import { getFeaturedProjects } from "@/content/projects";
import { SceneCanvas } from "@/webgl/SceneCanvas";

/**
 * The world the Work index and the About page share. The scene lives here, so
 * moving between the two keeps it loaded and the camera flies between them
 * instead of the landscape mounting again.
 */
export default function WorldLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SceneCanvas workCount={getFeaturedProjects().length} />
      {children}
    </>
  );
}
