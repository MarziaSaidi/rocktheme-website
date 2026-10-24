import { siteContent } from "@/content/site/siteContent";

import styles from "./InShort.module.css";

/** The facts, in short: what I do, the work, the background, how this site is made. */
export function InShort() {
  const { inShort } = siteContent;

  return (
    <section className={styles.section} data-scene-section="about" aria-labelledby="in-short-title">
      <h2 id="in-short-title" className={styles.label}>
        {inShort.label}
      </h2>
      <dl className={styles.rows}>
        {inShort.rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <dt className={styles.label}>{row.label}</dt>
            <dd className={styles.items}>
              {row.items.map((item, index) => (
                <p key={index} className={styles.item}>
                  <span>
                    {"text" in item && item.text ? (
                      <span className={styles.text}>{item.text}</span>
                    ) : null}
                    {"note" in item && item.note ? (
                      <span className={styles.note}>{item.note}</span>
                    ) : null}
                  </span>
                  {"year" in item && item.year ? (
                    <span className={styles.year}>{item.year}</span>
                  ) : null}
                </p>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
