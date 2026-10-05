import { Fragment } from "react";

import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";
import { BioStory } from "@/motion/BioStory";

import { AboutArrival } from "./AboutArrival";
import styles from "./Statement.module.css";

type Passage = (typeof siteContent.statement.passages)[number];

/**
 * The title as words the dust can land on. A line break in the content is a
 * real one; the title still reads, selects and copies as one sentence.
 */
function titleWords({ title, signature }: Passage) {
  return title.split("\n").map((line, row) => (
    <Fragment key={row}>
      {row > 0 ? <br /> : null}
      {line.split(" ").map((word, index, words) => (
        <Fragment key={index}>
          <span
            className={styles.word}
            data-title-word=""
            data-signature={
              signature.motion !== "sweep" && word === signature.word ? signature.motion : undefined
            }
          >
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Fragment>
  ));
}

/**
 * Personal statement.
 *
 * Three passages take turns beside the rift. Each title comes out of it as
 * dust and goes back into it; the copy beneath is read by a light that follows
 * the scroll. Without the motion owner (no JavaScript, reduced motion, a very
 * short screen) the passages simply stack, lit and readable.
 */
export function Statement() {
  const { statement } = siteContent;

  return (
    <section id={sectionAnchors.about} className={styles.section} aria-labelledby="about-title">
      <AboutArrival />
      <BioStory />
      <EnvironmentLayer sectionId="about" />
      <div className={styles.story} data-bio-story>
        <div className={styles.stage}>
          <div className={styles.inner}>
            {statement.passages.map((passage, index) => {
              const Title = index === 0 ? "h2" : "h3";
              return (
                <article
                  key={passage.title}
                  className={styles.passage}
                  data-bio-passage
                  data-emphasis={passage.emphasis.join(" ")}
                  data-sweep={
                    passage.signature.motion === "sweep" ? passage.signature.word : undefined
                  }
                >
                  <Title id={index === 0 ? "about-title" : undefined} className={styles.title}>
                    {titleWords(passage)}
                  </Title>
                  <div className={styles.copy} data-bio-copy>
                    <p className={styles.body}>{passage.body}</p>
                    <p className={styles.aside}>{passage.aside}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
