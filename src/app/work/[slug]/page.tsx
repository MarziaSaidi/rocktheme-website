import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CaseStudyWorkspace } from "@/components/work/CaseStudyWorkspace";
import { pageLandmarkIds, sectionAnchors } from "@/config/sections";
import { getCaseStudyStages, getProjectBySlug, getProjectStaticParams } from "@/content/projects";
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

  return (
    <main id={pageLandmarkIds.main} className={styles.page} data-case-study-page="">
      <CaseStudyWorkspace project={project} stages={getCaseStudyStages(project)} />
      <p className={styles.back}>
        <Link className={styles.backLink} href={`/#${sectionAnchors["selected-work"]}`}>
          <span aria-hidden="true">← </span>
          {siteContent.work.displayHeading}
        </Link>
      </p>
    </main>
  );
}
