import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { MonolithGallery, type GalleryProject } from "@/components/work/MonolithGallery";
import { sectionAnchors } from "@/config/sections";
import { getProjectRoute, type Project } from "@/content/projects";
import { siteContent } from "@/content/site/siteContent";

import styles from "./SelectedWork.module.css";

type SelectedWorkProps = Readonly<{
  projects: readonly Project[];
}>;

/*
 * Survue's floating composition, every piece a real screen from the project.
 * `crop` frames a part of a screen (CSS object-position) where the piece is
 * a tile rather than a whole phone.
 */
const survueMainVisual = {
  src: "/images/projects/survue/story/welcome-dark.png",
  alt: "Survue launch screen: the Survue wordmark over a cyclist riding through woodland.",
  width: 430,
  height: 932,
} as const;

const survueSupportingVisuals = [
  {
    src: "/images/projects/survue/story/gallery.png",
    alt: "Survue Gallery with the cyclist's automatic recordings.",
    width: 430,
    height: 932,
    placement: "back",
    crop: "50% 0%",
  },
  {
    src: "/images/projects/survue/story/detection-level-one.png",
    alt: "Survue detection screen: a vehicle approaching at risk level 1.",
    width: 430,
    height: 932,
    placement: "secondary",
  },
  {
    src: "/images/projects/survue/story/idea-risk-level.png",
    alt: "Survue alert: medium risk, a vehicle is approaching from behind.",
    width: 440,
    height: 956,
    placement: "detail",
    crop: "50% 45%",
  },
] as const;

/*
 * Quill & Pigeon's composition follows the contact import: the CSV going
 * in (back), the table where it is reviewed and validated (main), duplicate
 * errors lifted out of that table (in front), and the saved contacts coming
 * out the other side (behind, lower right). Every piece is a real screen from
 * the case study; `frame` cuts out part of one.
 */
const quillMainVisual = {
  src: "/images/projects/quill-and-pigeon/story/validation-errors.png",
  alt: "Quill & Pigeon contact review table with 15 alerts to review and duplicate-nickname errors.",
  width: 2042,
  height: 1190,
  sizes: "(min-width: 1024px) 44vw, 0px",
} as const;

const quillSupportingVisuals = [
  {
    src: "/images/projects/quill-and-pigeon/story/selected-file.png",
    alt: "Import Contacts dialog with Quill_and_Pigeon-Contact_Import.csv selected for upload.",
    width: 1338,
    height: 492,
    placement: "back",
    sizes: "(min-width: 1024px) 26vw, 0px",
  },
  {
    src: "/images/projects/quill-and-pigeon/story/import-success.png",
    alt: "Import completed: Rob and Liz saved successfully.",
    width: 2040,
    height: 1008,
    placement: "secondary",
    frame: { x: 0.235, y: 0.19, w: 0.53, h: 0.37 },
    // Only half the screen shows, so the image is loaded at twice the piece.
    sizes: "(min-width: 1024px) 50vw, 0px",
  },
  {
    src: "/images/projects/quill-and-pigeon/story/validation-errors.png",
    alt: "Two contact rows with their nicknames flagged as duplicates.",
    width: 2042,
    height: 1190,
    placement: "detail",
    frame: { x: 0.03, y: 0.525, w: 0.31, h: 0.16 },
    // A third of the screen, enlarged: loaded at the whole screen's size.
    sizes: "(min-width: 1024px) 80vw, 0px",
  },
] as const;

const compositions: Record<string, Pick<GalleryProject, "mainVisual" | "supportingVisuals">> = {
  "quill-and-pigeon": { mainVisual: quillMainVisual, supportingVisuals: quillSupportingVisuals },
  survue: { mainVisual: survueMainVisual, supportingVisuals: survueSupportingVisuals },
};

/**
 * Selected Work.
 *
 * Each featured project has a rear glass information plane and a separate
 * foreground visual layer over the landscape. Every project fact here is
 * HTML, taken from the project records.
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
    meta: [project.category, String(project.year)],
    description: project.shortDescription,
    href: getProjectRoute(project),
    ...compositions[project.slug],
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
        enterLabel={work.enterLabel}
        nextLabel={work.nextLabel}
        previousLabel={work.previousLabel}
      >
        {/* Inside the stage so the fallback backdrop stays pinned with it. */}
        <EnvironmentLayer sectionId="selected-work" />
      </MonolithGallery>
    </section>
  );
}
