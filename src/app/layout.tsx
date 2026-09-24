import type { Metadata } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";
import { SiteEntry } from "@/components/entry/SiteEntry";
import { pageLandmarkIds } from "@/config/sections";
import { CustomCursor } from "@/motion/CustomCursor";
import { SoundProvider } from "@/sound/SoundProvider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Interim monumental condensed display face.
 * Replace with a licensed Druk Condensed cut if that licence is acquired.
 */
const displayCondensed = Anton({
  variable: "--font-anton",
  weight: "400",
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
      className={`${geistSans.variable} ${geistMono.variable} ${displayCondensed.variable}`}
    >
      <body id={pageLandmarkIds.top}>
        {/* Owns the audio context. Nothing else may create one. */}
        <SoundProvider />
        <CustomCursor />
        <SiteEntry>
          <SkipLink />
          <SiteHeader />
          {children}
        </SiteEntry>
      </body>
    </html>
  );
}
