import Link from "next/link";
import type { CSSProperties } from "react";

import { siteContent } from "@/content/site/siteContent";
import { SoundToggle } from "@/sound/SoundToggle";

import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.scrim} aria-hidden="true" />

      <Link className={styles.wordmark} href="/" style={{ "--nav-index": 0 } as CSSProperties}>
        {siteContent.name}
      </Link>

      <nav className={styles.nav} aria-label="Primary">
        <ul className={styles.navList}>
          {siteContent.navigation.map((item, index) => (
            <li
              key={item.key}
              className={styles.navItem}
              style={{ "--nav-index": index + 1 } as CSSProperties}
            >
              <Link className={styles.navLink} href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p
        className={styles.status}
        style={{ "--nav-index": siteContent.navigation.length + 1 } as CSSProperties}
      >
        <SoundToggle />

        <span className={styles.availability}>{siteContent.availability.label}</span>
      </p>
    </header>
  );
}
