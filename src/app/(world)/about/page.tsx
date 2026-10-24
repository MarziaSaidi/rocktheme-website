import type { Metadata } from "next";

import { JourneyDip } from "@/components/environment/JourneyDip";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/sections/Hero";
import { InShort } from "@/components/sections/InShort";
import { RiftControl } from "@/components/sections/RiftControl";
import { Statement } from "@/components/sections/Statement";
import { pageLandmarkIds } from "@/config/sections";
import { PageJourney } from "@/webgl/PageJourney";

export const metadata: Metadata = {
  title: "About",
};

export default function About() {
  return (
    // One element: a navigation scrolls the page's fragment into view, and a
    // fragment of several would be scrolled to the rift's hint, deep in the bio.
    <div>
      <main id={pageLandmarkIds.main}>
        <Hero />
        <Statement />
        <InShort />
      </main>
      <SiteFooter />
      <JourneyDip />
      <RiftControl />
      <PageJourney />
    </div>
  );
}
