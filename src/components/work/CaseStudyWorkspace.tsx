"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CaseStudyInfo, CaseStudyStage, Project, StoryVisual } from "@/content/projects";

import styles from "./CaseStudyWorkspace.module.css";

type CaseStudyWorkspaceProps = Readonly<{
  project: Project;
  stages: readonly CaseStudyStage[];
}>;

function StoryVideo({ visual }: { visual: Extract<StoryVisual, { type: "video" }> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const silentLoop = visual.playback === "silent-loop";

  useEffect(() => {
    if (!silentLoop) return;
    const video = videoRef.current;
    if (!video) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (motion.matches) video.pause();
      else void video.play().catch(() => {});
    };
    syncPlayback();
    motion.addEventListener("change", syncPlayback);
    return () => motion.removeEventListener("change", syncPlayback);
  }, [silentLoop]);

  return (
    <video
      ref={videoRef}
      className={styles.visualMedia}
      data-fit={visual.fit ?? "contain"}
      controls={!silentLoop}
      muted={silentLoop}
      loop={silentLoop}
      playsInline
      preload={silentLoop ? "auto" : "metadata"}
      poster={visual.media.poster.src}
      title={visual.media.title}
      src={visual.media.src}
    />
  );
}

function StoryVisualView({ visual }: { visual?: StoryVisual }) {
  if (!visual) {
    return (
      <p className={styles.textOnly}>This stage is told through its decisions and outcomes.</p>
    );
  }

  if (visual.type === "video") {
    return <StoryVideo visual={visual} />;
  }

  if (visual.type === "comparison") {
    return (
      <div className={styles.comparison}>
        {[
          [visual.before, visual.beforeLabel ?? "Before"],
          [visual.after, visual.afterLabel ?? "After"],
        ].map(([media, label]) => {
          const image = media as typeof visual.before;
          return (
            <figure key={String(label)} className={styles.comparisonItem}>
              <Image src={image.src} alt={image.alt} width={image.width} height={image.height} />
              <figcaption>{String(label)}</figcaption>
            </figure>
          );
        })}
      </div>
    );
  }

  if (visual.type === "group") {
    return (
      <div className={styles.visualGroup} data-count={Math.min(visual.images.length, 4)}>
        {visual.images.map((media) => (
          <Image
            key={media.src}
            className={styles.visualMedia}
            data-fit={visual.fit ?? "contain"}
            src={media.src}
            alt={media.alt}
            width={media.width}
            height={media.height}
            sizes="(max-width: 767px) 90vw, 48vw"
          />
        ))}
      </div>
    );
  }

  if (visual.type === "sequence") {
    return (
      <div
        className={styles.sequence}
        data-layout={visual.layout ?? "row"}
        data-tone={visual.tone ?? "dark"}
        style={{ "--sequence-count": visual.items.length } as React.CSSProperties}
      >
        {visual.heading ? <p className={styles.sequenceHeading}>{visual.heading}</p> : null}
        <div className={styles.sequenceItems}>
          {visual.items.map((item) => (
            <figure className={styles.sequenceItem} key={`${item.label}-${item.media.src}`}>
              <a
                className={styles.sequenceScreen}
                href={item.media.src}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${item.label} screen full size`}
              >
                <Image
                  src={item.media.src}
                  alt={item.media.alt}
                  width={item.media.width}
                  height={item.media.height}
                  sizes="(max-width: 767px) 38vw, (max-width: 1199px) 20vw, 14vw"
                />
              </a>
              <figcaption>{item.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  }

  if (visual.type === "code") {
    return (
      <figure className={styles.codeArtifact}>
        {visual.label ? <figcaption className={styles.codeLabel}>{visual.label}</figcaption> : null}
        <pre>
          <code data-language={visual.language}>{visual.code}</code>
        </pre>
      </figure>
    );
  }

  return (
    <Image
      className={styles.visualMedia}
      data-fit={visual.fit ?? "contain"}
      src={visual.media.src}
      alt={visual.media.alt}
      width={visual.media.width}
      height={visual.media.height}
      sizes="(max-width: 767px) 90vw, (max-width: 1199px) 60vw, 48vw"
      priority
    />
  );
}

function ProjectFacts({ project, info }: { project: Project; info?: CaseStudyInfo }) {
  const facts = [
    ["Role", project.role.join(" + ")],
    ["Timeline", info?.timeline ?? String(project.year)],
    ["Company", info?.company],
    ["Team", info?.team],
    ["Contribution", info?.responsibilities?.join(", ")],
    ["Tools", info?.tools?.join(", ")],
    ["Platform", info?.platform],
    ["Project type", info?.projectType ?? project.category],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <dl className={styles.facts}>
      {facts.map(([label, value]) => (
        <div key={label} className={styles.fact}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CaseStudyWorkspace({ project, stages }: CaseStudyWorkspaceProps) {
  const initialId = stages[0]?.id ?? "";
  const [stageId, setStageId] = useState(initialId);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyEpoch, setStoryEpoch] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const touchStart = useRef<number | null>(null);
  const remainingMs = useRef(6000);
  const timerStartedAt = useRef(0);
  const stage = stages.find((item) => item.id === stageId) ?? stages[0];
  const story = stage?.stories[storyIndex] ?? stage?.stories[0];
  const storyCount = stage?.stories.length ?? 0;

  const chooseStage = useCallback((nextId: string, updateHistory = true) => {
    setStageId(nextId);
    setStoryIndex(0);
    setStoryEpoch((value) => value + 1);
    if (updateHistory) history.pushState({ stage: nextId }, "", `#${nextId}`);
  }, []);

  const previous = useCallback(() => setStoryIndex((value) => Math.max(0, value - 1)), []);
  const next = useCallback(
    () => setStoryIndex((value) => Math.min(Math.max(0, storyCount - 1), value + 1)),
    [storyCount],
  );

  useEffect(() => {
    remainingMs.current = (story?.durationSeconds ?? 6) * 1000;
  }, [stage?.id, story?.durationSeconds, story?.id, storyEpoch]);

  useEffect(() => {
    const media = matchMedia("(max-width: 47.99rem)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMobile(media.matches);
    const syncMotion = () => setReducedMotion(motion.matches);
    sync();
    syncMotion();
    media.addEventListener("change", sync);
    motion.addEventListener("change", syncMotion);
    const fromHash = location.hash.slice(1);
    const initialFrame = requestAnimationFrame(() => {
      if (stages.some((item) => item.id === fromHash)) chooseStage(fromHash, false);
      else if (initialId) history.replaceState({ stage: initialId }, "", `#${initialId}`);
    });
    const pop = () => {
      const id = location.hash.slice(1);
      if (stages.some((item) => item.id === id)) chooseStage(id, false);
      else if (!id && initialId) chooseStage(initialId, false);
    };
    addEventListener("popstate", pop);
    addEventListener("hashchange", pop);
    return () => {
      media.removeEventListener("change", sync);
      motion.removeEventListener("change", syncMotion);
      cancelAnimationFrame(initialFrame);
      removeEventListener("popstate", pop);
      removeEventListener("hashchange", pop);
    };
  }, [chooseStage, initialId, stages]);

  useEffect(() => {
    if (
      mobile ||
      paused ||
      documentHidden ||
      reducedMotion ||
      storyCount < 2 ||
      storyIndex >= storyCount - 1
    )
      return;
    timerStartedAt.current = performance.now();
    const timer = window.setTimeout(next, remainingMs.current);
    return () => {
      window.clearTimeout(timer);
      remainingMs.current = Math.max(
        0,
        remainingMs.current - (performance.now() - timerStartedAt.current),
      );
    };
  }, [
    documentHidden,
    mobile,
    next,
    paused,
    reducedMotion,
    story?.durationSeconds,
    storyCount,
    storyEpoch,
    storyIndex,
  ]);

  useEffect(() => {
    const visibility = () => setDocumentHidden(document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLVideoElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    addEventListener("keydown", keydown);
    return () => removeEventListener("keydown", keydown);
  }, [next, previous]);

  useEffect(() => {
    const nav = navRef.current;
    const selected = nav?.querySelector<HTMLElement>(`[data-stage-id="${stageId}"]`);
    if (!nav || !selected) return;
    const targetLeft =
      selected.offsetLeft - nav.offsetLeft - (nav.clientWidth - selected.clientWidth) / 2;
    nav.scrollTo({
      left: targetLeft,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [stageId]);

  if (!stage || !story) return null;
  const info = project.caseStudy.info;

  return (
    <article className={styles.workspace} aria-label={`${project.title} case study`}>
      <header className={styles.mobileHeader}>
        <h1>{project.title}</h1>
        <p>
          {project.role.join(" + ")} · {info?.timeline ?? project.year}
        </p>
        <details className={styles.infoDisclosure}>
          <summary>Project info</summary>
          <p>{project.shortDescription}</p>
          <ProjectFacts project={project} info={info} />
          {info?.externalUrl ? (
            <a className={styles.liveLink} href={info.externalUrl}>
              {info.externalLabel ?? "View live project"} <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </details>
      </header>

      <aside className={styles.rail} aria-label="Project information">
        <p className={styles.railLabel}>Project</p>
        <h1>{project.title}</h1>
        <p className={styles.projectDescription}>{project.shortDescription}</p>
        <ProjectFacts project={project} info={info} />
        {info?.externalUrl ? (
          <a className={styles.liveLink} href={info.externalUrl}>
            {info.externalLabel ?? "View live project"} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </aside>

      <section
        className={styles.viewer}
        aria-label={`${stage.label}: ${story.title}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
          setPaused(true);
        }}
        onTouchEnd={(event) => {
          const end = event.changedTouches[0]?.clientX;
          if (touchStart.current !== null && end !== undefined) {
            const distance = end - touchStart.current;
            if (Math.abs(distance) > 48) {
              if (distance < 0) next();
              else previous();
            }
          }
          touchStart.current = null;
          setPaused(false);
        }}
      >
        {storyCount > 1 ? (
          <div
            key={`${stage.id}-${storyEpoch}`}
            className={styles.storyProgress}
            style={{ gridTemplateColumns: `repeat(${storyCount}, minmax(0, 1fr))` }}
            aria-label={`Story ${storyIndex + 1} of ${storyCount}`}
          >
            {stage.stories.map((item, index) => (
              <span
                key={item.id}
                data-state={
                  index < storyIndex ? "past" : index === storyIndex ? "current" : "future"
                }
              >
                <span
                  style={
                    !mobile && !reducedMotion && index === storyIndex
                      ? {
                          animationDuration: `${item.durationSeconds ?? 6}s`,
                          animationPlayState: paused || documentHidden ? "paused" : "running",
                        }
                      : undefined
                  }
                />
              </span>
            ))}
          </div>
        ) : null}
        <div className={styles.visualFrame} key={`${stage.id}-${story.id}`}>
          <StoryVisualView visual={story.visual} />
          {storyCount > 1 ? (
            <>
              <button
                className={styles.previousControl}
                onClick={previous}
                disabled={storyIndex === 0}
                aria-label="Previous story"
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                className={styles.nextControl}
                onClick={next}
                disabled={storyIndex === storyCount - 1}
                aria-label="Next story"
              >
                <span aria-hidden="true">→</span>
              </button>
            </>
          ) : null}
        </div>
        {story.caption ? <p className={styles.caption}>{story.caption}</p> : null}
        {story.visual?.type === "image" && story.visual.zoomable ? (
          <a
            className={styles.zoomLink}
            href={story.visual.media.src}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open artifact full size <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </section>

      <section
        className={styles.story}
        aria-live="polite"
        key={`copy-${stage.id}-${story.id}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <p className={styles.eyebrow}>{story.eyebrow ?? stage.label}</p>
        <h2>{story.title}</h2>
        <p className={styles.storyDescription}>{story.description}</p>
        {story.supportingPoints?.length ? (
          <ul className={styles.points}>
            {story.supportingPoints.slice(0, 4).map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
        {story.decision ? (
          <p className={styles.detail}>
            <strong>Decision</strong>
            {story.decision}
          </p>
        ) : null}
        {story.constraint ? (
          <p className={styles.detail}>
            <strong>Constraint</strong>
            {story.constraint}
          </p>
        ) : null}
        {story.outcome ? (
          <p className={styles.detail}>
            <strong>Outcome</strong>
            {story.outcome}
          </p>
        ) : null}
        {story.metric ? (
          <p className={styles.metric}>
            <strong>{story.metric.value}</strong>
            {story.metric.label}
          </p>
        ) : null}
        {story.quote ? (
          <blockquote>
            {story.quote.text}
            {story.quote.attribution ? <cite>{story.quote.attribution}</cite> : null}
          </blockquote>
        ) : null}
        {story.supportingVideo ? (
          <a
            className={styles.supportingVideo}
            href={story.supportingVideo.media.src}
            target="_blank"
            rel="noopener noreferrer"
          >
            {story.supportingVideo.label} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </section>

      <nav
        ref={navRef}
        className={styles.stageNav}
        aria-label="Case study stages"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {stages.map((item) => (
          <button
            key={item.id}
            data-stage-id={item.id}
            aria-current={item.id === stage.id ? "step" : undefined}
            onClick={() => chooseStage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </article>
  );
}
