"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
const phrases = [
  "Building interfaces",
  "Designing product experiences",
  "Turning designs into code",
  "Refining the little details",
];
export function RotatingStatus() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      if (timer) clearInterval(timer);
      if (!preference.matches)
        timer = setInterval(() => setIndex((i) => (i + 1) % phrases.length), 6000);
    };
    sync();
    preference.addEventListener("change", sync);
    return () => {
      if (timer) clearInterval(timer);
      preference.removeEventListener("change", sync);
    };
  }, []);
  return (
    <p
      className={styles.current}
      aria-label="Designing product experiences and building interfaces"
    >
      <span className={styles.statusWindow} aria-hidden="true">
        <span key={index} className={styles.statusConvoy}>
          <span className={styles.statusFairy}>
            {(["fairyUpper", "fairyBackLeg", "fairyFrontLeg"] as const).map((part) => (
              <Image
                key={part}
                className={styles[part]}
                src="/preview/hiring/fairy-pushing.webp"
                alt=""
                width={34}
                height={40}
                unoptimized
              />
            ))}
          </span>
          <span className={styles.statusPhrase}>{phrases[index]}</span>
        </span>
      </span>
    </p>
  );
}
