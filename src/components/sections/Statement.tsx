import { Fragment } from "react";

import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";
import { BioStory } from "@/motion/BioStory";

import { RenderPasses } from "./RenderPasses";

import { AboutArrival } from "./AboutArrival";
import styles from "./Statement.module.css";

type Passage = (typeof siteContent.statement.passages)[number];
/**
 * The title as words the dust can land on. A line break in the content is a
 * real one; the title still reads, selects and copies as one sentence.
 */
function titleWords({ title, accent }: Passage) {
  return title.split("\n").map((line, row) => (
    <Fragment key={row}>
      {row > 0 ? " " : null}
      <span className={styles.titleLine}>
        {line.split(" ").map((word, index, words) => (
          <Fragment key={index}>
            <span
              className={styles.word}
              data-title-word=""
              data-accent={accent && word.replace(/[.,;:!?’']+$/u, "") === accent ? "" : undefined}
            >
              {word}
            </span>
            {index < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </Fragment>
  ));
}

/**
 * Personal statement.
 *
 * Three passages take turns beside the unchanged rift. Language briefly
 * resembles matter, becomes readable HTML, then leaves grains falling to water.
 * Without motion, all three passages stack in normal document order.
 */
export function Statement() {
  const { statement } = siteContent;

  return (
    <section id={sectionAnchors.about} className={styles.section} aria-labelledby="about-title">
      <AboutArrival />
      <BioStory />
      <RenderPasses />
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
                  data-moment={passage.moment}
                >
                  <Title id={index === 0 ? "about-title" : undefined} className={styles.title}>
                    {titleWords(passage)}
                  </Title>
                  <div data-bio-copy>
                    {passage.body ? <p className={styles.body}>{passage.body}</p> : null}
                    {passage.aside ? <p className={styles.aside}>{passage.aside}</p> : null}
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
