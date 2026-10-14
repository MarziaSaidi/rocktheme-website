"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ActionContent } from "@/components/primitives/ActionContent";
import {
  beginGuidedJourney,
  engageGuide,
  skipGuidedJourney,
  subscribeGuidePhase,
  subscribeGuideRect,
  type GuidePhase,
} from "@/webgl/robotGuideChannel";
import { rememberWorkReturn } from "@/components/work/workReturn";
import { emitSoundEvent } from "@/sound/soundEvents";
import styles from "./ProjectExplorer.module.css";

export type ExplorerProject = Readonly<{
  slug: string;
  title: string;
  year: number;
  category: string;
  description: string;
  href: string;
  image: { src: string; alt: string; width: number; height: number };
}>;

export function ProjectIndex({ projects }: Readonly<{ projects: readonly ExplorerProject[] }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(0);
  const project = projects[active];
  return (
    <>
      <div className={styles.entry}>
        <button
          ref={opener}
          type="button"
          data-action-button=""
          onClick={() => dialog.current?.showModal()}
          aria-haspopup="dialog"
        >
          <ActionContent text="Explore my work" arrow="↗" />
        </button>
      </div>
      <dialog
        ref={dialog}
        className={styles.index}
        aria-labelledby="project-index-title"
        onClose={() => opener.current?.focus()}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <div className={styles.sheet}>
          <div className={styles.bar}>
            <span>Marzia Saidi / Selected work</span>
            <button
              type="button"
              className={styles.close}
              onClick={() => dialog.current?.close()}
              aria-label="Close project index"
            >
              Close <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className={styles.editorial}>
            <div className={styles.list}>
              <p className={styles.eyebrow}>Choose a story</p>
              <h2 id="project-index-title">Work, up close.</h2>
              <nav aria-label="Project index">
                {projects.map((item, i) => (
                  <Link
                    key={item.slug}
                    href={item.href}
                    className={styles.row}
                    data-active={active === i ? "" : undefined}
                    data-work-view=""
                    onPointerEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onClick={() => {
                      rememberWorkReturn(item.slug);
                      emitSoundEvent("project:open");
                      dialog.current?.close();
                    }}
                  >
                    <span className={styles.number}>{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className={styles.title}>{item.title}</span>
                      <span className={styles.meta}>
                        {item.category} / {item.year}
                      </span>
                    </span>
                    <span className={styles.arrow} aria-hidden="true">
                      ↗
                    </span>
                  </Link>
                ))}
              </nav>
              <button
                type="button"
                className={styles.worldRoute}
                onClick={() => {
                  dialog.current?.close();
                  beginGuidedJourney();
                }}
              >
                Take the scenic route <span aria-hidden="true">→</span>
              </button>
            </div>
            {project && (
              <figure key={project.slug} className={styles.preview}>
                <div className={styles.image}>
                  <Image
                    src={project.image.src}
                    alt={project.image.alt}
                    fill
                    sizes="(max-width: 767px) 85vw, 42vw"
                  />
                </div>
                <figcaption>
                  <span>{project.description}</span>
                  <span>
                    {String(active + 1).padStart(2, "0")} /{" "}
                    {String(projects.length).padStart(2, "0")}
                  </span>
                </figcaption>
              </figure>
            )}
          </div>
          <div className={styles.bottom}>
            <span>Design, built to be used.</span>
            <span>{projects.length} selected projects</span>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function RobotGuide({ firstProject }: Readonly<{ firstProject: string }>) {
  const robot = useRef<HTMLButtonElement>(null);
  const [stage, setStage] = useState<GuidePhase>("idle");
  const traveling = stage !== "idle";
  useEffect(
    () =>
      subscribeGuideRect((rect) => {
        const el = robot.current;
        if (!el) return;
        el.hidden = !rect;
        if (rect) {
          el.style.left = `${rect.x}px`;
          el.style.top = `${rect.y}px`;
          el.style.width = `${rect.width}px`;
          el.style.height = `${rect.height}px`;
        }
      }),
    [],
  );
  useEffect(() => subscribeGuidePhase(setStage), []);
  useEffect(() => () => engageGuide(false), []);
  return (
    <>
      <button
        ref={robot}
        hidden
        type="button"
        className={styles.guide}
        aria-label="Follow the robot to explore my projects"
        aria-describedby="robot-guide-hint"
        data-cursor="action"
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") engageGuide(true);
        }}
        onPointerLeave={() => engageGuide(false)}
        onFocus={() => engageGuide(true)}
        onBlur={() => engageGuide(false)}
        onClick={() => {
          engageGuide(true);
          beginGuidedJourney();
        }}
      >
        <span className={styles.invitation}>
          <span className={styles.guideLine} />
          <span>
            Follow me <span aria-hidden="true">↗</span>
          </span>
          <span id="robot-guide-hint" className={styles.whisper}>
            I know a way.
          </span>
        </span>
      </button>
      {traveling && (
        <div className={styles.journey} role="status">
          <span className={styles.path} aria-hidden="true" />
          <span>
            <span className={styles.eyebrow}>
              {stage === "standing"
                ? "Getting to my feet"
                : stage === "walking"
                  ? "Follow my steps"
                  : "Across the water"}
            </span>
            <span className={styles.destination}>{firstProject}</span>
          </span>
          <button type="button" data-guide-skip="" onClick={skipGuidedJourney}>
            Skip journey <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </>
  );
}
