import Link from "next/link";
import type { CSSProperties } from "react";

import { siteContent } from "@/content/site/siteContent";
import { DecodeText } from "@/motion/DecodeText";
import { SoundToggle } from "@/sound/SoundToggle";

import { MobileMenu } from "./MobileMenu";
import { PrimaryNav } from "./PrimaryNav";

import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.scrim} aria-hidden="true" />

      <Link className={styles.wordmark} href="/" style={{ "--nav-index": 0 } as CSSProperties}>
        {siteContent.name}
      </Link>

      <PrimaryNav />

      <p
        className={styles.status}
        style={{ "--nav-index": siteContent.navigation.length + 1 } as CSSProperties}
      >
        <SoundToggle />

        <span className={styles.availability}>
          <DecodeText text={siteContent.availability.label} />
        </span>
      </p>

      <MobileMenu
        toggleClassName={styles.menu}
        toggleStyle={{ "--nav-index": 1 } as CSSProperties}
      />
    </header>
  );
}
