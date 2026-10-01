import type { Metadata } from "next";

import { ParticleWord } from "@/components/experiment/ParticleWord";
import { pageLandmarkIds } from "@/config/sections";

export const metadata: Metadata = {
  title: "Experiment",
  description: "A particle word that scatters under the cursor.",
};

export default function ExperimentPage() {
  return (
    <main id={pageLandmarkIds.main}>
      <ParticleWord />
    </main>
  );
}
