import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseStudyWorkspace } from "@/components/work/CaseStudyWorkspace";
import { pageLandmarkIds } from "@/config/sections";
import {
  getCaseStudyStages,
  getNextProject,
  getProjectBySlug,
  getProjectRoute,
  getProjectStaticParams,
} from "@/content/projects";

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
      <CaseStudyWorkspace
        project={project}
        stages={getCaseStudyStages(project)}
        next={
          next.slug !== project.slug
            ? { title: next.title, href: getProjectRoute(next) }
            : undefined
        }
      />
    </main>
  );
}
