import { Fragment, type ReactNode } from "react";

import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { sectionIds, siteContent } from "@/content/site/siteContent";
import { SectionMotion } from "@/motion/SectionMotion";

import styles from "./Statement.module.css";

/**
 * Marks the emphasised terms. The words come from content, so the component
 * never names one itself; it only publishes each as `data-term` so the
 * stylesheet can give it its own treatment.
 */
function markEmphasis(text: string, terms: readonly string[]): ReactNode {
  if (terms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`\\b(${terms.join("|")})\\b`, "g");
  const pieces = text.split(pattern);

  return pieces.map((piece, index) =>
    terms.includes(piece) ? (
      <span key={`${piece}-${index}`} className={styles.term} data-term={piece}>
        {piece}
      </span>
    ) : (
      <Fragment key={`text-${index}`}>{piece}</Fragment>
    ),
  );
}

/**
 * Personal statement.
 *
 * The calm scene. Both paragraphs are ordinary, selectable, semantic text: the
 * per-term treatments are applied to the real words in place, never to a
 * duplicate or a per-character split, so selecting and copying the sentence
 * gives the sentence.
 */
export function Statement() {
  const { statement } = siteContent;
  const [thesis, ...rest] = statement.paragraphs;

  return (
    <section id={sectionIds.about} className={styles.section} aria-labelledby="about-title">
      {/* Solid text reveals independently of the ambient particle current. */}
      <SectionMotion sectionId={sectionIds.about} />

      <EnvironmentLayer variant="calm" horizon={80} />

      <div className={styles.inner}>
        <p className={styles.eyebrow}>{statement.heading}</p>
        <h2 id="about-title" className={styles.thesis}>
          {thesis}
        </h2>
        {rest.map((paragraph) => (
          <p key={paragraph} className={styles.body}>
            {markEmphasis(paragraph, statement.emphasis)}
          </p>
        ))}
      </div>
    </section>
  );
}
