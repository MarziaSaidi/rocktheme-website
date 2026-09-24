import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";

import { getProjectRoute, type Project } from "@/content/projects";

import styles from "./ProjectPlane.module.css";

type ProjectPlaneProps = Readonly<{
  project: Project;
  /** Position in the currently displayed collection. */
  displayIndex?: number;
  variant: "hero" | "corridor";
  /** Label for the masked reveal that Stage 4 animates. */
  viewLabel: string;
  /** Hero planes are supporting imagery, so their headings stay at h3. */
  headingLevel?: "h2" | "h3";
  /** Which edge the label block hangs from. */
  labelAlign?: "start" | "end";
  /**
   * Pairs this plane's media with the same media on the case-study page so the
   * browser morphs between them. A view-transition name must be unique in the
   * document, so only one place on a page may claim it.
   */
  transitionName?: string;
  priority?: boolean;
  sizes: string;
}>;

const SCENE_DEPTH = { near: 0, mid: 1, far: 2 } as const;

function formatIndex(order: number): string {
  return order.toString().padStart(2, "0");
}

export function ProjectPlane({
  project,
  displayIndex,
  variant,
  viewLabel,
  headingLevel: Heading = "h3",
  labelAlign = "start",
  transitionName,
  priority = false,
  sizes,
}: ProjectPlaneProps) {
  const { homepageImage } = project;

  const screen = (
    <Image
      className={styles.screen}
      src={homepageImage.src}
      alt={homepageImage.alt}
      width={homepageImage.width}
      height={homepageImage.height}
      sizes={sizes}
      priority={priority}
    />
  );

  return (
    <article
      className={styles.plane}
      data-variant={variant}
      data-depth={SCENE_DEPTH[project.scenePlacement]}
      data-emphasis={project.visualEmphasis}
      data-accent={project.accentBehavior}
      data-align={labelAlign}
    >
      <div className={styles.label}>
        <p className={styles.index}>{formatIndex(displayIndex ?? project.order)}</p>
        <span className={styles.rule} aria-hidden="true" />
        <div className={styles.identity}>
          <Heading className={styles.title}>
            <Link className={styles.link} href={getProjectRoute(project)}>
              {project.title}
            </Link>
          </Heading>
          {variant === "corridor" ? (
            <p className={styles.meta}>
              {project.category}
              <span aria-hidden="true"> — </span>
              {project.role.join(" + ")}
              <span aria-hidden="true"> — </span>
              {project.year}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.stage}>
        {transitionName ? (
          <ViewTransition name={transitionName}>
            <div className={styles.frame}>{screen}</div>
          </ViewTransition>
        ) : (
          <div className={styles.frame}>{screen}</div>
        )}
        <span className={styles.pool} aria-hidden="true" />
      </div>

      <p className={styles.view} aria-hidden="true">
        {viewLabel}
        <span className={styles.arrow}>↗</span>
      </p>
    </article>
  );
}
