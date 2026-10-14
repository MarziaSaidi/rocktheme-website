"use client";

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
import { ProjectRowGlow } from "./ProjectRowGlow";

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
  const [active, setActive] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialog.current?.close();
  return (
    <>
      <div className={styles.entry}>
        <button
          ref={opener}
          type="button"
          data-action-button=""
          aria-haspopup="dialog"
          onClick={() => {
            setOpen(true);
            dialog.current?.showModal();
          }}
        >
          <ActionContent text="Explore my work" arrow="↗" />
        </button>
      </div>
      <dialog
        ref={dialog}
        className={styles.index}
        aria-labelledby="project-index-title"
        onClose={() => {
          setOpen(false);
          setActive(null);
          opener.current?.focus();
        }}
      >
        <div className={styles.sheet}>
          <header className={styles.bar}>
            <span>Marzia Saidi</span>
            <h2 id="project-index-title">
              Projects <span>/ Selected work</span>
            </h2>
            <button
              type="button"
              className={styles.close}
              onClick={close}
              aria-label="Close project index"
            >
              ×
            </button>
          </header>
          <nav
            className={styles.works}
            aria-label="Project index"
            onPointerLeave={() => setActive(null)}
          >
            {projects.map((item, i) => (
              <div
                key={item.slug}
                className={styles.row}
                data-active={active === i ? "" : undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") setActive(i);
                }}
                onFocus={() => setActive(i)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setActive(null);
                }}
              >
                {open && (
                  <ProjectRowGlow
                    src={
                      item.slug === "survue"
                        ? "/images/projects/survue/story/user-flow.png"
                        : item.image.src
                    }
                    diagram={item.slug === "survue"}
                    active={active === i}
                  />
                )}
                <Link
                  href={item.href}
                  className={styles.rowHit}
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => {
                    rememberWorkReturn(item.slug);
                    emitSoundEvent("project:open");
                    close();
                  }}
                />
                <Link
                  href={item.href}
                  className={styles.title}
                  data-work-view=""
                  onClick={() => {
                    rememberWorkReturn(item.slug);
                    emitSoundEvent("project:open");
                    close();
                  }}
                >
                  {item.title}
                </Link>
                <span className={styles.year}>{item.year}</span>
                <span className={styles.meta}>{item.category}</span>
                <Link
                  href={item.href}
                  className={styles.view}
                  data-action-button=""
                  data-work-view=""
                  aria-label={`View ${item.title} case study`}
                  onClick={() => {
                    rememberWorkReturn(item.slug);
                    emitSoundEvent("project:open");
                    close();
                  }}
                >
                  <ActionContent text="View project" arrow="↗" />
                </Link>
              </div>
            ))}
          </nav>
          <footer className={styles.bottom}>
            <button type="button" data-action-button="" onClick={close}>
              <ActionContent text="To overview" arrow="←" />
            </button>
            <span>{projects.length} selected projects</span>
            <button
              type="button"
              data-action-button=""
              className={styles.worldRoute}
              onClick={() => {
                close();
                beginGuidedJourney();
              }}
            >
              <ActionContent text="Scenic route" arrow="→" />
            </button>
          </footer>
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
