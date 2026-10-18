import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowGlyph } from "@/components/primitives/ArrowGlyph";
import { SwapGlyph } from "@/components/primitives/SwapGlyph";
import { CaseStudyWorkspace } from "@/components/work/CaseStudyWorkspace";
import { pageLandmarkIds, sectionAnchors } from "@/config/sections";
import {
  getCaseStudyStages,
  getNextProject,
  getProjectBySlug,
  getProjectRoute,
  getProjectStaticParams,
} from "@/content/projects";
import { siteContent } from "@/content/site/siteContent";

import styles from "./page.module.css";

type CaseStudyPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export function generateStaticParams() {
  return [...getProjectStaticParams()];
}

export async function generateMetadata({ params }: CaseStudyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    return {};
  }

  return {
    title: project.seo.title,
    description: project.seo.description,
    alternates: { canonical: project.caseStudyUrl },
  };
}

/**
 * Case-study route.
 *
 * Every route, its metadata, its content and its next-project link come from
 * the registry. There is no per-project code path anywhere on this page.
 */
export default async function CaseStudyPage({ params }: CaseStudyPageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  const next = getNextProject(project);

  return (
    <main id={pageLandmarkIds.main} className={styles.page} data-case-study-page="">
      <CaseStudyWorkspace project={project} stages={getCaseStudyStages(project)} />
      <nav className={styles.back} aria-label="Case studies">
        <Link className={styles.backLink} href={`/#${sectionAnchors["selected-work"]}`}>
          <SwapGlyph direction="left" className={styles.backArrow}>
            <ArrowGlyph direction="left" />
          </SwapGlyph>
          {siteContent.work.displayHeading}
        </Link>
        {next.slug !== project.slug ? (
          <Link className={styles.backLink} href={getProjectRoute(next)}>
            <span className={styles.nextLabel}>Next case study</span>{" "}
            {next.title}
            <SwapGlyph direction="right" className={styles.backArrow}>
              <ArrowGlyph direction="right" />
            </SwapGlyph>
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
