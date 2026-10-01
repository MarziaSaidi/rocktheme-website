"use client";

import { useEffect, useRef } from "react";

import { mountMarziaParticles } from "@/experiments/marziaParticles";

import styles from "./ParticleWord.module.css";

/** Full-screen stage for the old site's particle "MARZIA" word. */
export function ParticleWord() {
  const stage = useRef<HTMLElement>(null);
  const hint = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!stage.current) return;
    return mountMarziaParticles(stage.current, hint.current);
  }, []);

  return (
    <section ref={stage} className={styles.stage} aria-label="Particle word experiment">
      <span ref={hint} className={styles.hint} aria-hidden="true">
        Your cursor disrupts Marzia
      </span>
    </section>
  );
}
