import type { Metadata } from "next";
import { ReferencePortfolio } from "./ReferencePortfolio";

export const metadata: Metadata = {
  title: "Portfolio preview",
  robots: { index: false, follow: false },
};

export default function HiringPreview() {
  return <ReferencePortfolio />;
}
