import { sectionIds, siteContent } from "@/content/site/siteContent";

import styles from "./SkipLink.module.css";

export function SkipLink() {
  return (
    <a className={styles.skipLink} href={`#${sectionIds.main}`}>
      {siteContent.skipLinkLabel}
    </a>
  );
}
