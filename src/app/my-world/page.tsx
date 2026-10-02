import type { Metadata } from "next";

import { CabinWorld } from "@/components/cabin/CabinWorld";
import { pageLandmarkIds } from "@/config/sections";

export const metadata: Metadata = {
  title: "My World",
  description:
    "A winter clearing with a cabin and an experiment lab, for getting to know Marzia a little better.",
};

export default function MyWorldPage() {
  return (
    <main id={pageLandmarkIds.main}>
      <CabinWorld />
    </main>
  );
}
