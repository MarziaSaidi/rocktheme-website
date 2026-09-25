import { DisplayHeading } from "@/components/primitives/DisplayHeading";
import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";

import styles from "./Hero.module.css";

export function Hero() {
  const { hero } = siteContent;

  return (
    <section id={sectionAnchors.hero} className={styles.hero} aria-labelledby="hero-title">
      {/*
       * On desktop the section is a runway and this stage holds still in it,
       * so the camera can travel to a second view while the copy is read.
       */}
      <div className={styles.stage}>
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
            <a className={styles.scroll} href={`#${sectionAnchors["selected-work"]}`}>
              <span className={styles.scrollMark} aria-hidden="true" />
              {hero.scrollLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
