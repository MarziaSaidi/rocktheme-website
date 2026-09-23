import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";

import {
  getNextProject,
  getProjectRoute,
  type BlockWidth,
  type CaseStudyBlock,
  type ImageMedia,
  type Project,
  type ProjectMedia,
} from "@/content/projects";
import { projectTransitionName } from "@/components/work/transitionName";

import styles from "./CaseStudyBlocks.module.css";

/**
 * Case-study block renderer.
 *
 * One switch over the block schema, no branch anywhere on a slug or a title.
 * Adding a project adds no code here; adding a block *type* adds one case.
 */

type CaseStudyBlocksProps = Readonly<{
  project: Project;
  blocks: readonly CaseStudyBlock[];
}>;

function MediaFigure({
  media,
  caption,
  sizes,
  priority = false,
  transitionName,
  width = "column",
}: Readonly<{
  media: ProjectMedia;
  caption?: string;
  sizes: string;
  priority?: boolean;
  transitionName?: string;
  width?: BlockWidth;
}>) {
  const inner = (
    <div className={styles.mediaFrame}>
      {media.kind === "image" ? (
        <Image
          className={styles.media}
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          sizes={sizes}
          priority={priority}
        />
      ) : (
        <video
          className={styles.media}
          src={media.src}
          poster={media.poster.src}
          controls
          preload="metadata"
          title={media.title}
        />
      )}
    </div>
  );

  const frame = transitionName ? (
    <ViewTransition name={transitionName}>{inner}</ViewTransition>
  ) : (
    inner
  );

  if (!caption) {
    return frame;
  }

  return (
    <figure className={styles.figure} data-width={width}>
      {frame}
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}

function GalleryImage({ image, sizes }: Readonly<{ image: ImageMedia; sizes: string }>) {
  return (
    <li className={styles.galleryItem}>
      <Image
        className={styles.media}
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes={sizes}
      />
    </li>
  );
}

export function CaseStudyBlocks({ project, blocks }: CaseStudyBlocksProps) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case "hero":
            return (
              <section key={block.id} className={styles.block} data-width="wide">
                <MediaFigure
                  media={block.media}
                  caption={block.caption}
                  sizes="(max-width: 63.99rem) 92vw, 80rem"
                  priority
                  width="wide"
                  // Pairs with the corridor plane so the two morph into one another.
                  transitionName={projectTransitionName(project.slug)}
                />
              </section>
            );

          case "introduction":
            return (
              <section key={block.id} className={styles.block}>
                {block.body.map((paragraph) => (
                  <p key={paragraph} className={styles.introduction}>
                    {paragraph}
                  </p>
                ))}
              </section>
            );

          case "text":
            return (
              <section key={block.id} className={styles.block} data-tone={block.tone ?? "body"}>
                {block.heading ? <h2 className={styles.blockHeading}>{block.heading}</h2> : null}
                {block.body.map((paragraph) => (
                  <p key={paragraph} className={styles.body}>
                    {paragraph}
                  </p>
                ))}
              </section>
            );

          case "image":
          case "video": {
            const width = block.width ?? "column";
            return (
              <section key={block.id} className={styles.block} data-width={width}>
                <MediaFigure
                  media={block.media}
                  caption={block.caption}
                  width={width}
                  sizes={
                    width === "full"
                      ? "100vw"
                      : width === "wide"
                        ? "(max-width: 63.99rem) 92vw, 80rem"
                        : "(max-width: 63.99rem) 92vw, 46rem"
                  }
                />
              </section>
            );
          }

          case "gallery":
            return (
              <section key={block.id} className={styles.block} data-width="wide">
                <ul className={styles.gallery} data-columns={block.columns ?? "two"}>
                  {block.images.map((image) => (
                    <GalleryImage
                      key={image.src}
                      image={image}
                      sizes="(max-width: 47.99rem) 92vw, 28rem"
                    />
                  ))}
                </ul>
                {block.caption ? <p className={styles.caption}>{block.caption}</p> : null}
              </section>
            );

          case "split-text-media":
            return (
              <section
                key={block.id}
                className={styles.split}
                data-media-position={block.mediaPosition}
              >
                <div className={styles.splitText}>
                  {block.heading ? <h2 className={styles.blockHeading}>{block.heading}</h2> : null}
                  {block.body.map((paragraph) => (
                    <p key={paragraph} className={styles.body}>
                      {paragraph}
                    </p>
                  ))}
                </div>
                <MediaFigure media={block.media} sizes="(max-width: 63.99rem) 92vw, 34rem" />
              </section>
            );

          case "metrics":
            return (
              <section key={block.id} className={styles.block}>
                {block.heading ? <h2 className={styles.blockHeading}>{block.heading}</h2> : null}
                <dl className={styles.metrics} data-columns={block.columns ?? "three"}>
                  {block.metrics.map((metric) => (
                    <div key={metric.label} className={styles.metric}>
                      <dt className={styles.metricLabel}>{metric.label}</dt>
                      <dd className={styles.metricValue}>{metric.value}</dd>
                      {metric.context ? (
                        <dd className={styles.metricContext}>{metric.context}</dd>
                      ) : null}
                    </div>
                  ))}
                </dl>
              </section>
            );

          case "quote":
            return (
              <section key={block.id} className={styles.block}>
                <figure className={styles.quote}>
                  <blockquote className={styles.quoteText}>{block.quote}</blockquote>
                  <figcaption className={styles.quoteAttribution}>
                    {block.attribution.name}
                    {block.attribution.role ? (
                      <span className={styles.quoteRole}>{block.attribution.role}</span>
                    ) : null}
                  </figcaption>
                </figure>
              </section>
            );

          case "process":
            return (
              <section key={block.id} className={styles.block}>
                {block.heading ? <h2 className={styles.blockHeading}>{block.heading}</h2> : null}
                <ol className={styles.process}>
                  {block.steps.map((step, index) => (
                    <li key={step.title} className={styles.step}>
                      <p className={styles.stepIndex}>{(index + 1).toString().padStart(2, "0")}</p>
                      <h3 className={styles.stepTitle}>{step.title}</h3>
                      <p className={styles.body}>{step.description}</p>
                    </li>
                  ))}
                </ol>
              </section>
            );

          case "next-project": {
            const next = getNextProject(project);
            return (
              <nav key={block.id} className={styles.next} aria-label="Next project">
                <p className={styles.nextLabel}>Next project</p>
                <Link className={styles.nextLink} href={getProjectRoute(next)}>
                  {next.title}
                  <span aria-hidden="true"> ↗</span>
                </Link>
              </nav>
            );
          }
        }
      })}
    </>
  );
}
