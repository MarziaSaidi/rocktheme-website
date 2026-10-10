import { Fragment } from "react";
import localFont from "next/font/local";

import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";
import { BioStory } from "@/motion/BioStory";

import { AboutArrival } from "./AboutArrival";
import styles from "./Statement.module.css";

type Passage = (typeof siteContent.statement.passages)[number];
const narrativeSerif = localFont({
  src: "./fonts/SourceSerif4-Regular.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-about-serif",
});

/**
 * The title as words the dust can land on. A line break in the content is a
 * real one; the title still reads, selects and copies as one sentence.
 */
function titleWords({ title }: Passage) {
  return title.split("\n").map((line, row) => (
    <Fragment key={row}>
      {row > 0 ? " " : null}
      <span className={styles.titleLine}>
        {line.split(" ").map((word, index, words) => (
          <Fragment key={index}>
            <span className={styles.word} data-title-word="">
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
    <section
      id={sectionAnchors.about}
      className={`${styles.section} ${narrativeSerif.variable}`}
      aria-labelledby="about-title"
    >
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
