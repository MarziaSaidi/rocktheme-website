import type { Metadata } from "next";
import { Barlow_Condensed, Manrope, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";
import { WorldHandoff } from "@/components/cabin/WorldHandoff";
import { SiteEntry } from "@/components/entry/SiteEntry";
import { pageLandmarkIds } from "@/config/sections";
import { CustomCursor } from "@/motion/CustomCursor";
import { PressFeedback } from "@/motion/PressFeedback";
import { SoundProvider } from "@/sound/SoundProvider";

import "./globals.css";

const readingSans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* Shared architectural display face for the hero and section headings. */
const displayCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
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
    <html
      lang="en"
      className={`${readingSans.variable} ${geistMono.variable} ${displayCondensed.variable}`}
    >
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
      </body>
    </html>
  );
}
