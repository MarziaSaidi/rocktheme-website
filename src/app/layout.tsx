import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";
import { WorldHandoff } from "@/components/cabin/WorldHandoff";
import { SiteEntry } from "@/components/entry/SiteEntry";
import { pageLandmarkIds } from "@/config/sections";
import { CustomCursor } from "@/motion/CustomCursor";
import { PressFeedback } from "@/motion/PressFeedback";
import { SoundProvider } from "@/sound/SoundProvider";

import "./globals.css";

const readingSans = localFont({
  src: [
    { path: "../styles/fonts/PPFrama-Regular.woff2", weight: "400", style: "normal" },
    { path: "../styles/fonts/PPFrama-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-frama",
  display: "swap",
});

const displaySerif = localFont({
  src: "../styles/fonts/IvarHeadline-Regular.woff2",
  weight: "400",
  variable: "--font-ivar",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: {
    default: "Marzia Saidi",
    template: "%s | Marzia Saidi",
  },
  description: "Design engineering and product design portfolio of Marzia Saidi.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${readingSans.variable} ${displaySerif.variable}`}>
      <head>
        {/*
         * The CSS stand-in environment only appears when the scene asks for it
         * (`data-scene-fallback`). Without JavaScript nothing can ask, so it
         * is simply shown.
         */}
        <noscript>
          <style>{"[data-scene-section]{display:block!important}"}</style>
        </noscript>
      </head>
      <body id={pageLandmarkIds.top}>
        {/* Owns the audio context. Nothing else may create one. */}
        <SoundProvider />
        <CustomCursor />
        <PressFeedback />
        <SiteEntry>
          <SkipLink />
          <SiteHeader />
          {children}
        </SiteEntry>
        {/* Carries the way into /my-world across the route change. */}
        <WorldHandoff />
        <Analytics />
      </body>
    </html>
  );
}
