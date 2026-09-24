import { pageLandmarkIds } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";

import styles from "./SkipLink.module.css";

export function SkipLink() {
  return (
    <a className={styles.skipLink} href={`#${pageLandmarkIds.main}`}>
      {siteContent.skipLinkLabel}
    </a>
  );
}
