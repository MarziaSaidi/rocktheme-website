import type { Metadata } from "next";

import { CabinWorld } from "@/components/cabin/CabinWorld";
import { pageLandmarkIds } from "@/config/sections";

export const metadata: Metadata = {
  title: "The Winter Cabin",
  description: "A small cabin in the snow, for getting to know Marzia a little better.",
};

export default function CabinPage() {
  return (
    <main id={pageLandmarkIds.main}>
      <CabinWorld />
    </main>
  );
}
