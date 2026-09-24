import { DisplayHeading } from "@/components/primitives/DisplayHeading";
import { EnvironmentLayer } from "@/components/environment/EnvironmentLayer";
import { pageLandmarkIds, sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";
import { CueEmitter } from "@/motion/CueEmitter";

import styles from "./SiteFooter.module.css";

const WAVEFORM_POINTS =
  "0.0,20.0 3.3,19.9 6.7,19.7 10.0,19.4 13.3,19.1 16.7,18.9 20.0,18.9 23.3,19.3 26.7,20.1 30.0,21.0 33.3,21.9 36.7,22.6 40.0,22.8 43.3,22.6 46.7,21.9 50.0,20.9 53.3,19.9 56.7,19.0 60.0,18.6 63.3,18.6 66.7,19.0 70.0,19.7 73.3,20.2 76.7,20.3 80.0,19.9 83.3,18.8 86.7,17.2 90.0,15.6 93.3,14.4 96.7,14.2 100.0,15.2 103.3,17.5 106.7,21.0 110.0,25.0 113.3,29.0 116.7,31.9 120.0,33.1 123.3,32.2 126.7,29.1 130.0,24.1 133.3,18.0 136.7,11.9 140.0,6.9 143.3,3.9 146.7,3.4 150.0,5.6 153.3,10.1 156.7,16.0 160.0,22.4 163.3,28.0 166.7,32.0 170.0,33.8 173.3,33.2 176.7,30.6 180.0,26.7 183.3,22.3 186.7,18.3 190.0,15.4 193.3,14.0 196.7,14.0 200.0,15.1 203.3,16.7 206.7,18.5 210.0,19.7 213.3,20.1 216.7,19.8 220.0,18.9 223.3,17.8 226.7,17.1 230.0,17.0 233.3,17.7 236.7,19.2 240.0,21.2 243.3,23.3 246.7,25.1 250.0,26.1 253.3,26.1 256.7,25.0 260.0,23.2 263.3,20.9 266.7,18.6 270.0,16.7 273.3,15.5 276.7,15.2 280.0,15.8 283.3,16.9 286.7,18.3 290.0,19.6 293.3,20.7 296.7,21.3 300.0,21.5 303.3,21.3 306.7,20.9 310.0,20.4 313.3,20.1 316.7,20.0 320.0,20.0";

export function SiteFooter() {
  const { contact, email, linkedIn, github, footer } = siteContent;
  const socialLinks = [email, linkedIn, github];

  return (
    <footer id={sectionAnchors.footer} className={styles.footer} aria-labelledby="contact-title">
      {/* The contact plane is the one element that speaks on arrival. */}
      <CueEmitter
        sectionId={sectionAnchors.footer}
        selector="[data-contact-plane]"
        hoverEvent="contact:hover"
        activateEvent="contact:open"
      />

      <EnvironmentLayer sectionId="footer" />

      <div className={styles.inner}>
        <div className={styles.invitation}>
          <DisplayHeading
            id="contact-title"
            size="xl"
            className={styles.headline}
            lines={contact.displayLines}
            accessibleText={contact.accessibleHeading}
          />
          <p className={styles.lead}>{contact.lead}</p>
          <a className={styles.primary} href={email.href}>
            {contact.primaryLabel}
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className={styles.conversation}>
          <a className={styles.plane} href={email.href} data-contact-plane="">
            <span className={styles.planeLabel}>
              {contact.planeLabel}
              <span aria-hidden="true">↗</span>
            </span>
            <svg
              className={styles.waveform}
              viewBox="0 0 320 40"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <polyline points={WAVEFORM_POINTS} />
            </svg>
          </a>
        </div>
      </div>

      <div className={styles.baseline}>
        <p className={styles.copyright}>{footer.copyright}</p>

        <nav className={styles.social} aria-label="Contact and profiles">
          <ul className={styles.socialList}>
            {socialLinks.map((link) => (
              <li key={link.href} className={styles.socialItem}>
                <a
                  className={styles.socialLink}
                  href={link.href}
                  {...(link.href.startsWith("http")
                    ? { target: "_blank", rel: "noreferrer noopener" }
                    : {})}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <a className={styles.backToTop} href={`#${pageLandmarkIds.top}`}>
          {footer.backToTopLabel}
          <span aria-hidden="true">↑</span>
        </a>
      </div>
    </footer>
  );
}
