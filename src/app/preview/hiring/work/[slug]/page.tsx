import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteContent } from "@/content/site/siteContent";
import shared from "../../page.module.css";
import styles from "./study.module.css";
import { ReferenceToc } from "./ReferenceToc";
import { SurvueSections, survueSections } from "./SurvueSections";

const root = "/images/projects/";
const data = {
  "quill-and-pigeon": {
    title: "Quill & Pigeon",
    category: "Web",
    headline: "Designing and shipping recipient import.",
    intro:
      "Quill & Pigeon helps people remember important occasions and send greeting cards from independent artists. During my internship, I designed and built the spreadsheet-import interface, from file selection through editable review, validation and confirmation.",
    problem:
      "Bringing an existing recipient list into the service should not require entering everyone individually. But a readable spreadsheet can still contain mistakes. How could people inspect and correct imported information before saving it?",
    outcome:
      "A working import workflow, now available in the live beta, that separates file upload from saving contacts and confirms what was saved.",
    role: "Design + Development Intern",
    timeline: "January–August 2025",
    contribution: "Product design and frontend implementation",
    tools: "Web interface design · Frontend development",
    background:
      "Recipient information and important dates support Quill & Pigeon’s reminders and card-sending experience. My work focused on the setup step: bringing an existing spreadsheet into that system while giving people control over the information they save.",
    hero: [
      "quill-and-pigeon/story/select-file.png",
      "quill-and-pigeon/story/review-contacts.png",
      "quill-and-pigeon/story/validation-errors.png",
    ],
    features: [
      {
        title: "File selection",
        body: "The interface identifies CSV and XLSX formats and provides a template. The selected filename stays visible, with an option to replace it before continuing.",
        images: [
          "quill-and-pigeon/story/select-file.png",
          "quill-and-pigeon/story/selected-file.png",
        ],
      },
      {
        title: "Review before saving",
        body: "I designed an editable review table as the checkpoint before import. People can inspect names, addresses and dates, then correct values inside the product. This adds a step for correct files, in exchange for a chance to catch mistakes before saving.",
        images: ["quill-and-pigeon/story/review-contacts.png"],
      },
      {
        title: "Validation in context",
        body: "A summary communicates the number of alerts, while feedback beside the affected fields shows where to act. The example includes duplicate nicknames. Other contact information remains visible during correction.",
        images: ["quill-and-pigeon/story/validation-errors.png"],
      },
      {
        title: "Saved-contact confirmation",
        body: "My frontend work connects file selection, review, validation feedback and confirmation. The final dialog lists the saved contacts and the total added, closing the loop after the import action.",
        images: ["quill-and-pigeon/story/import-success.png"],
      },
    ],
    reflection:
      "The feature is shipped in the live beta. Feature-level adoption, completion-rate improvements and time savings have not been verified. To evaluate the design, I would measure completed imports, abandonment during review and replacement uploads after validation feedback.",
  },
  survue: {
    title: "Survue",
    category: "Mobile",
    headline: "A clearer view of approaching traffic.",
    intro:
      "Survue connects a rear-facing cycling device with an app for vehicle awareness and recordings. As founding product designer, I shaped the app structure, interaction flows, components and prototype. I also implemented the settings section in C#.",
    problem:
      "A rider cannot study a screen while moving. Traffic information needed a consistent visual structure, with warning changes that could be understood at a glance.",
    outcome:
      "App structure, interaction flows and visual designs, alongside an implemented C# settings section covering theme, sound, user warnings and Help. Other screens are presented as design and prototype evidence.",
    role: "Founding Product Designer",
    timeline: "September–December 2024",
    contribution: "App-wide design · C# settings implementation",
    tools: "Figma · C# · .NET",
    background:
      "The experience spans device setup, the ride itself and reviewing recordings afterward. I separated these jobs in the app structure, then explored how a familiar road view could communicate changes in vehicle position and warning state.",
    hero: [
      "survue/story/connection-page.png",
      "survue/story/detection-level-one.png",
      "survue/story/settings-theme.png",
    ],
  },
} as const;
export function generateStaticParams() {
  return Object.keys(data).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug in data ? data[slug as keyof typeof data].title : "Project"} | Preview`,
    robots: { index: false, follow: false },
  };
}
export default async function Study({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  if (!(slug in data)) notFound();
  const d = data[slug as keyof typeof data];
  const mobile = slug === "survue";
  return (
    <main id="main" className={`${shared.page} ${styles.study}`} data-reference-preview="">
      <Link
        href={`/preview/hiring#project-${slug}`}
        className={`${shared.mark} ${styles.back}`}
        aria-label="Back to portfolio"
      >
        <span lang="fa" dir="rtl">
          مرضیه
        </span>
      </Link>
      <div className={styles.hero}>
        <div className={`${styles.heroStage} ${mobile ? styles.mobileHero : styles.webHero}`}>
          {d.hero.map((src, i) => (
            <Image
              key={src}
              src={root + src}
              alt={`${d.title}: ${i === 0 ? "setup" : i === 1 ? "review and interaction" : "validation and settings"}`}
              width={mobile ? 430 : 2048}
              height={mobile ? 932 : 1000}
              sizes="(max-width: 639px) 65vw, 50vw"
              priority={i === 1}
            />
          ))}
        </div>
      </div>
      <div className={styles.content}>
        <aside className={styles.toc} aria-label="Case study sections">
          <ReferenceToc sections={mobile ? survueSections : undefined} />
        </aside>
        <article className={styles.article}>
          <section id="overview" className={styles.overview}>
            <header>
              <h1>{d.title}</h1>
              <span>{d.category}</span>
            </header>
            <div className={styles.intro}>
              <p>{d.headline}</p>
              <p>{d.intro}</p>
            </div>
            <div className={styles.problemOutcome}>
              <div>
                <h2>Problem</h2>
                <p>{d.problem}</p>
              </div>
              <div>
                <h2>Outcome</h2>
                <p>{d.outcome}</p>
              </div>
            </div>
            <dl className={styles.info}>
              <div>
                <dt>My role</dt>
                <dd>{d.role}</dd>
              </div>
              <div>
                <dt>Timeline</dt>
                <dd>{d.timeline}</dd>
              </div>
              <div>
                <dt>Contribution</dt>
                <dd>{d.contribution}</dd>
              </div>
              <div>
                <dt>Tools / practice</dt>
                <dd>{d.tools}</dd>
              </div>
            </dl>
          </section>
          <section id="background" className={styles.section}>
            <h2>Background</h2>
            <p>{d.background}</p>
          </section>
          {mobile ? (
            <SurvueSections />
          ) : (
            <>
              <section id="features" className={styles.section}>
                <h2>Features</h2>
                <div className={styles.features}>
                  {data["quill-and-pigeon"].features.map((f) => (
                    <div key={f.title} className={styles.feature}>
                      <h3>{f.title}</h3>
                      <div
                        className={`${styles.media} ${mobile ? styles.phones : styles.screens}`}
                        tabIndex={0}
                        role="group"
                        aria-label={`${f.title} product screenshots`}
                      >
                        {f.images.map((src) => (
                          <Image
                            key={src}
                            src={root + src}
                            alt={`${d.title} ${src
                              .split("/")
                              .pop()
                              ?.replaceAll("-", " ")
                              .replace(/\.(png|jpg)$/, "")}`}
                            width={mobile ? 430 : 2048}
                            height={mobile ? 932 : 1000}
                            sizes="(max-width: 639px) 90vw, 906px"
                          />
                        ))}
                      </div>
                      <p>{f.body}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section id="reflection" className={styles.section}>
                <h2>Reflection</h2>
                <p>{data["quill-and-pigeon"].reflection}</p>
              </section>
            </>
          )}
          <footer className={styles.footer}>
            <a href={siteContent.email.href}>Email</a>
            <a href={siteContent.linkedIn.href} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a href={siteContent.github.href} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <Link href={`/preview/hiring#project-${slug}`}>Back to portfolio</Link>
          </footer>
        </article>
      </div>
    </main>
  );
}
