import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { MonolithGallery, type GalleryProject } from "@/components/work/MonolithGallery";
import { sectionAnchors, sectionHref } from "@/config/sections";
import { getProjectRoute, type Project } from "@/content/projects";
import { siteContent } from "@/content/site/siteContent";

import styles from "./SelectedWork.module.css";

type SelectedWorkProps = Readonly<{
  projects: readonly Project[];
}>;

/**
 * Selected Work.
 *
 * The featured projects share one stone: the first is on its front face, the
 * next on the back. The stone never moves; the gallery walks the camera round
 * it from one face to the other. The stone
 * and mountains are scene decoration; every project fact here is HTML.
 *
 * Only the few fields the gallery shows cross into the client component, so
 * the case-study bodies stay on the server.
 */
export function SelectedWork({ projects }: SelectedWorkProps) {
  const { work } = siteContent;

  const gallery: GalleryProject[] = projects.map((project) => ({
    slug: project.slug,
    title: project.title,
    role: project.role.join(" + "),
    description: project.shortDescription,
    href: getProjectRoute(project),
    image: { src: project.homepageImage.src, alt: project.homepageImage.alt },
  }));

  return (
    <section
      id={sectionAnchors["selected-work"]}
      className={styles.section}
      aria-labelledby="work-title"
    >
      <MonolithGallery
        projects={gallery}
        headingId="work-title"
        heading={work.displayHeading}
        galleryLabel={work.galleryLabel}
        viewLabel={work.viewLabel}
        scrollLabel={work.scrollLabel}
        previousLabel={work.previousLabel}
        nextLabel={work.nextLabel}
        continueLabel={work.continueLabel}
        continueHref={sectionHref("about")}
      >
        {/* Inside the stage so the fallback backdrop stays pinned with it. */}
        <EnvironmentLayer sectionId="selected-work" />
      </MonolithGallery>
    </section>
  );
}
