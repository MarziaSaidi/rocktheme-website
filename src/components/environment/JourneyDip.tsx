import styles from "./JourneyDip.module.css";

/**
 * Dark over the landscape, never over the page: it covers the camera's cut
 * from the hero to the water (SceneCanvas sets `--journey-dip`).
 */
export function JourneyDip() {
  return <div className={styles.dip} aria-hidden="true" />;
}
