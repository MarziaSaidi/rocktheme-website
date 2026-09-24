import { DisplayHeading } from "@/components/primitives/DisplayHeading";
import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { ProjectPlane } from "@/components/work/ProjectPlane";
import { projectTransitionName } from "@/components/work/transitionName";
import { sectionAnchors } from "@/config/sections";
import type { Project } from "@/content/projects";
import { siteContent } from "@/content/site/siteContent";
import { CorridorPin } from "@/motion/CorridorPin";

import styles from "./SelectedWork.module.css";

type SelectedWorkProps = Readonly<{
  projects: readonly Project[];
}>;

function formatCount(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Selected Work.
 *
 * Every project is rendered by the same `ProjectPlane`, from the registry, in
 * registry order. There is no branch on a slug, no per-project position, and no
 * assumption about how many projects exist: placement comes from each record, the index rail
 * counts the array, and the pinned scroll length is derived from the count.
 *
 * The corridor is a native horizontally scrollable list. `CorridorPin` upgrades
 * it on the desktop breakpoint into a pinned section whose horizontal travel
 * follows the page's own vertical scroll. Without JavaScript, on a narrow
 * screen, or under reduced motion, the list stays exactly as rendered here.
 */
export function SelectedWork({ projects }: SelectedWorkProps) {
  const { work } = siteContent;

  return (
    <section
      id={sectionAnchors["selected-work"]}
      className={styles.section}
      aria-labelledby="work-title"
    >
      <CorridorPin sectionId="selected-work" />

      <div className={styles.pin} data-corridor-pin="">
        <div className={styles.viewport}>
          {/* Inside the viewport so it travels with the pinned frame. */}
          <EnvironmentLayer sectionId="selected-work" />

          <div className={styles.inner}>
            <p className={styles.tally} aria-hidden="true">
              {/* Counts up as the corridor advances; falls back to the first. */}
              <span className={styles.tallyActive} />
              <span className={styles.tallyRule} />
              <span>{formatCount(projects.length)}</span>
            </p>

            <div className={styles.header}>
              <DisplayHeading
                id="work-title"
                size="l"
                lines={[work.displayHeading]}
                accessibleText={work.displayHeading}
              />
              <p className={styles.lead}>{work.lead}</p>
            </div>
          </div>

          <div
            className={styles.corridor}
            role="group"
            aria-label={work.corridorLabel}
            tabIndex={0}
          >
            <ol className={styles.track} data-corridor-track="">
              {projects.map((project, index) => (
                <li key={project.slug} className={styles.item} data-corridor-item="">
                  <ProjectPlane
                    project={project}
                    displayIndex={index + 1}
                    variant="corridor"
                    viewLabel={work.viewLabel}
                    transitionName={projectTransitionName(project.slug)}
                    sizes="(max-width: 47.99rem) 86vw, (max-width: 63.99rem) 46vw, 30vw"
                  />
                </li>
              ))}
            </ol>
          </div>

          <p className={styles.hint}>
            {work.corridorHint}
            <span aria-hidden="true"> ↔</span>
          </p>
        </div>
      </div>
    </section>
  );
}
