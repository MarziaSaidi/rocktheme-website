import { Fragment, type CSSProperties, type ReactNode } from "react";

import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";
import { ReadingLight } from "@/motion/ReadingLight";
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
 * The thesis as words that light in reading order. Each word is an ordinary
 * inline span carrying its index, and the spaces stay real text, so the
 * heading still reads, selects and copies as one sentence. Emphasised terms
 * are marked without their trailing punctuation.
 */
function readingWords(text: string, terms: readonly string[]): ReactNode {
  const words = text.split(" ");
  return words.map((word, index) => {
    const core = word.replace(/[.,;:!?]+$/, "");
    const tail = word.slice(core.length);
    const style = { "--i": index } as CSSProperties;
    return (
      <Fragment key={`${word}-${index}`}>
        {terms.includes(core) ? (
          <>
            <span className={styles.word} style={style} data-term={core}>
              {core}
            </span>
            <span className={styles.word} style={style}>
              {tail}
            </span>
          </>
        ) : (
          <span className={styles.word} style={style}>
            {word}
          </span>
        )}
        {index < words.length - 1 ? " " : null}
      </Fragment>
    );
  });
}

/**
 * Personal statement.
 *
 * The calm scene. The thesis is read, not played: its words light in order as
 * the page scrolls through the section, and the emphasised terms settle in
 * lavender. The text is ordinary, selectable, semantic text throughout.
 */
export function Statement() {
  const { statement } = siteContent;
  const [thesis, ...rest] = statement.paragraphs;

  return (
    <section id={sectionAnchors.about} className={styles.section} aria-labelledby="about-title">
      {/* Solid text reveals independently of the ambient particle current. */}
      <SectionMotion sectionId={sectionAnchors.about} />
      <ReadingLight sectionId={sectionAnchors.about} selector="#about-title" />

      <EnvironmentLayer sectionId="about" />

      <div className={styles.inner}>
        <h2
          id="about-title"
          className={styles.thesis}
          style={{ "--count": thesis?.split(" ").length ?? 0 } as CSSProperties}
        >
          {thesis ? readingWords(thesis, statement.emphasis) : null}
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
