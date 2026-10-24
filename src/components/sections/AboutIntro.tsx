import { siteContent } from "@/content/site/siteContent";

import styles from "./AboutIntro.module.css";

/**
 * The About page's opening, at the water where the descent from the last
 * project ends. Scrolling on carries the camera to the bio.
 */
export function AboutIntro() {
  const { about } = siteContent;

  return (
    <section
      className={styles.intro}
      data-scene-section="about"
      aria-labelledby="about-intro-title"
    >
      <div className={styles.copy}>
        <p className={styles.label}>{about.label}</p>
        <h1 id="about-intro-title" className={styles.heading}>
          {about.heading}
        </h1>
        {about.paragraphs.map((paragraph) => (
          <p key={paragraph} className={styles.body}>
            {paragraph}
          </p>
        ))}
      </div>
      <p className={styles.cue} aria-hidden="true">
        {about.scrollLabel}
        <i />
      </p>
    </section>
  );
}
