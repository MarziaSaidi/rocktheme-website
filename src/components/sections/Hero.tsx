import { DisplayHeading } from "@/components/primitives/DisplayHeading";
import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";

import styles from "./Hero.module.css";

export function Hero() {
  const { hero, work } = siteContent;

  return (
    <section id={sectionAnchors.hero} className={styles.hero} aria-labelledby="hero-title">
      <EnvironmentLayer sectionId="hero" />

      <div className={styles.inner}>
        <div className={styles.statement}>
          <DisplayHeading
            id="hero-title"
            as="h1"
            size="xl"
            className={styles.headline}
            sceneObstacle
            lines={hero.displayLines}
            accessibleText={hero.accessibleHeading}
          />
          <p className={styles.lead} data-scene-obstacle="">
            {hero.lead}
          </p>
          <p className={styles.scroll}>
            <span className={styles.scrollRule} aria-hidden="true" />
            {hero.scrollLabel}
          </p>
        </div>
      </div>

      <div className={styles.baseline}>
        <a className={styles.baselineLink} href={`#${sectionAnchors["selected-work"]}`}>
          {work.displayHeading}
          <span className={styles.baselineRule} aria-hidden="true" />
        </a>
        <span className={styles.baselineIndex} aria-hidden="true">
          01
        </span>
      </div>
    </section>
  );
}
