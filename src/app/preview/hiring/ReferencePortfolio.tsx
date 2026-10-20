"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { siteContent } from "@/content/site/siteContent";
import styles from "./page.module.css";
import Piece from "./ReferencePiece";
import { FairyVisit } from "./FairyVisit";
import { RotatingStatus } from "./RotatingStatus";

type ProjectId = "quill-and-pigeon" | "survue";
type Filter = "All" | "Mobile app" | "Web design";
const projects: { id: ProjectId; name: string; year: string; category: Filter; summary: string }[] =
  [
    {
      id: "quill-and-pigeon",
      name: "Quill & Pigeon",
      year: "2025",
      category: "Web design",
      summary:
        "Designed and shipped a spreadsheet-import interface with editable review, validation and saved-contact confirmation.",
    },
    {
      id: "survue",
      name: "Survue",
      year: "2024",
      category: "Mobile app",
      summary:
        "Designed a cycling-safety app’s structure and interactions, and built theme, sound, user-warning and Help settings in C#.",
    },
  ];

function Contact() {
  const [copied, setCopied] = useState(false);
  return (
    <p className={styles.contact}>
      You can reach me through{" "}
      <span className={styles.tooltip}>
        <a
          href={siteContent.email.href}
          onClick={async (e) => {
            if (!navigator.clipboard) return;
            e.preventDefault();
            try {
              await navigator.clipboard.writeText("marzia.saidi67@gmail.com");
              setCopied(true);
            } catch {
              window.location.href = siteContent.email.href;
            }
          }}
        >
          email
        </a>
        <span role="tooltip">{copied ? "Copied!" : "Copy to clipboard"}</span>
      </span>
      , find me on{" "}
      <a href={siteContent.github.href} target="_blank" rel="noreferrer">
        GitHub
      </a>
      , or{" "}
      <a href={siteContent.linkedIn.href} target="_blank" rel="noreferrer">
        LinkedIn
      </a>
      .
    </p>
  );
}

export function ReferencePortfolio() {
  const [filter, setFilter] = useState<Filter>("All");
  const [hovered, setHovered] = useState<ProjectId | null>(null);
  const [expanded, setExpanded] = useState<ProjectId | null>(null);
  const pane = useRef<HTMLDivElement>(null);
  const cards = useRef<Partial<Record<ProjectId, HTMLLIElement | null>>>({});
  const visible = projects.filter((p) => filter === "All" || p.category === filter);
  const expand = (id: ProjectId) => {
    setFilter("All");
    setExpanded(id);
    window.history.replaceState(null, "", `#project-${id}`);
    if (expanded === id)
      cards.current[id]?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  };
  useEffect(() => {
    if (expanded)
      cards.current[expanded]?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  }, [expanded]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const id = location.hash.replace("#project-", "");
      if (id === "quill-and-pigeon" || id === "survue") setExpanded(id);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const dim = (id: ProjectId) =>
    filter !== "All" ? !visible.some((p) => p.id === id) : hovered !== null && hovered !== id;
  return (
    <main className={styles.page} data-reference-preview="" id="main">
      <div className={styles.pane} ref={pane} id="portfolio-main-pane">
        <div className={styles.columns}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarTop}>
              <button
                className={styles.mark}
                aria-label="Back to top"
                onClick={() => {
                  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "instant"
                    : "smooth";
                  if (window.matchMedia("(min-width: 1180px)").matches)
                    pane.current?.scrollTo({ top: 0, behavior });
                  else window.scrollTo({ top: 0, behavior });
                }}
              >
                <span lang="fa" dir="rtl">
                  مرضیه
                </span>
              </button>
              <div className={styles.introduction}>
                <h1>
                  Hi, I’m <em>Marzia Saidi</em>, a design engineer who designs product interfaces
                  and ships the code behind them.
                </h1>
                <RotatingStatus />
              </div>
            </div>
            <div className={styles.projectNav}>
              <div className={styles.filters} role="group" aria-label="Filter projects">
                {(["All", "Mobile app", "Web design"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => {
                      setFilter(f);
                      setExpanded(null);
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <ul>
                {visible.map((p) => (
                  <li
                    key={p.id}
                    onMouseEnter={() => setHovered(p.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <a
                      href={`#project-${p.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        expand(p.id);
                      }}
                    >
                      <span>{p.name}</span>
                      <span>{p.year}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.sidebarContact}>
              <Contact />
              <Link href="/" prefetch={false} className={styles.interactive}>
                Explore my interactive portfolio ↗
              </Link>
            </div>
          </aside>
          <div className={styles.content}>
            <section className={styles.matSection} aria-label="Interactive project collage">
              <div className={styles.matStage}>
                <div className={styles.matWrap}>
                  <div className={styles.mat}>
                    <Image
                      className={styles.matBackground}
                      src="/preview/hiring/cutting-mat.png"
                      alt="Blue cutting mat with grid markings"
                      fill
                      sizes="(max-width: 899px) 100vw, 76vw"
                      priority
                    />
                    {filter !== "All" && (
                      <button
                        className={styles.clearFilter}
                        aria-label="Clear project filter"
                        onClick={() => setFilter("All")}
                      />
                    )}
                    <Piece
                      label="Software designer illustration. Drag to move on the cutting mat."
                      className={styles.polaroid}
                      dimmed={filter !== "All" || hovered !== null}
                      dragDisabled={filter !== "All"}
                      x={48}
                      y={10}
                      rotate={2}
                    >
                      <FairyVisit>
                        <Image
                          src="/preview/hiring/software-designer-cutout.webp"
                          alt="An original cartoon of a software designer working at a laptop in a cozy workspace"
                          width={768}
                          height={1024}
                          draggable={false}
                        />
                      </FairyVisit>
                    </Piece>

                    <Piece
                      label="Quill & Pigeon letterbox. Drag to move, or select to view in the gallery."
                      className={styles.reviewPiece}
                      x={filter === "All" ? 29 : 41}
                      y={filter === "All" ? 65 : 44}
                      rotate={filter === "All" ? 3 : 0}
                      dragDisabled={filter !== "All"}
                      onSelect={() => expand("quill-and-pigeon")}
                      dimmed={dim("quill-and-pigeon")}
                    >
                      <Image
                        src="/preview/hiring/letterbox.webp"
                        alt="Cute letterbox representing Quill & Pigeon"
                        width={512}
                        height={505}
                        draggable={false}
                      />
                      <span className={styles.projectLabel} aria-hidden="true">
                        Quill &amp; Pigeon <span>↓</span>
                      </span>
                    </Piece>

                    <Piece
                      label="Survue car. Drag to move, or select to view in the gallery."
                      className={styles.survuePiece}
                      x={filter === "All" ? 12 : 36}
                      y={filter === "All" ? 35 : 44}
                      rotate={filter === "All" ? 9 : 0}
                      dragDisabled={filter !== "All"}
                      onSelect={() => expand("survue")}
                      dimmed={dim("survue")}
                    >
                      <Image
                        src="/preview/hiring/car.webp"
                        alt="Cute car representing Survue"
                        width={512}
                        height={427}
                        draggable={false}
                      />
                      <span className={styles.projectLabel} aria-hidden="true">
                        Survue <span>↓</span>
                      </span>
                    </Piece>
                    <Piece
                      label="Name card. Drag to move on the cutting mat."
                      className={styles.namePiece}
                      dimmed={filter !== "All" || hovered !== null}
                      dragDisabled={filter !== "All"}
                      x={6}
                      y={10}
                      rotate={-9}
                    >
                      <p>
                        hi, i’m M<em>arzia</em>!
                      </p>
                    </Piece>
                  </div>
                </div>
                <p className={styles.playHint}>play with the pieces!</p>
              </div>
            </section>
            <section id="work" className={styles.work} aria-labelledby="work-title">
              <div className={styles.workInner}>
                <header>
                  <h2 id="work-title">Selected work</h2>
                  <p>Product design and code, from concept to working interfaces.</p>
                </header>
                <ul className={styles.gallery}>
                  {visible.map((p) => (
                    <li
                      id={`project-${p.id}`}
                      key={p.id}
                      ref={(el) => {
                        cards.current[p.id] = el;
                      }}
                      className={styles.galleryItem}
                      data-expanded={expanded === p.id}
                    >
                      <Link
                        href={`/preview/hiring/work/${p.id}`}
                        className={styles.cover}
                        aria-label={`Open ${p.name} case study`}
                      >
                        {p.id === "quill-and-pigeon" ? (
                          <Image
                            className={styles.quillCover}
                            src="/images/projects/quill-and-pigeon/story/review-contacts.png"
                            alt="Quill & Pigeon editable recipient review"
                            width={2048}
                            height={722}
                            sizes="(max-width: 639px) 45vw, 60vw"
                          />
                        ) : (
                          <div className={styles.phoneCover}>
                            <Image
                              src="/images/projects/survue/story/detection-level-one.png"
                              alt="Survue vehicle-warning design"
                              width={430}
                              height={932}
                              sizes="(max-width:639px) 20vw, 25vw"
                            />
                            <Image
                              src="/images/projects/survue/story/settings-theme.png"
                              alt="Survue settings implemented in C#"
                              width={430}
                              height={932}
                              sizes="(max-width:639px) 20vw, 25vw"
                            />
                          </div>
                        )}
                      </Link>
                      <div className={styles.cardTitle}>
                        <Link href={`/preview/hiring/work/${p.id}`}>
                          <h3>{p.name}</h3>
                        </Link>
                        <div>
                          <span>{p.category === "Web design" ? "Web" : "Mobile"}</span>
                          <span>{p.year}</span>
                        </div>
                      </div>
                      <p>{p.summary}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
