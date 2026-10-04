"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ArrowGlyph } from "@/components/primitives/ArrowGlyph";
import type { CaseStudyInfo, CaseStudyStage, Project, StoryVisual } from "@/content/projects";

import styles from "./CaseStudyWorkspace.module.css";

type CaseStudyWorkspaceProps = Readonly<{
  project: Project;
  stages: readonly CaseStudyStage[];
}>;

/** Seconds a story stays up when its content does not say otherwise. */
const DEFAULT_STORY_SECONDS = 6;

type MediaCallbacks = Readonly<{
  /** A video with controls started or stopped playing. */
  onPlayingChange?: (playing: boolean) => void;
  /** A looping video reported how long one pass takes. */
  onDuration?: (seconds: number) => void;
}>;

function StoryVideo({
  visual,
  onPlayingChange,
  onDuration,
}: { visual: Extract<StoryVisual, { type: "video" }> } & MediaCallbacks) {
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
      onPlay={silentLoop ? undefined : () => onPlayingChange?.(true)}
      onPause={silentLoop ? undefined : () => onPlayingChange?.(false)}
      onEnded={silentLoop ? undefined : () => onPlayingChange?.(false)}
      onLoadedMetadata={
        silentLoop ? (event) => onDuration?.(event.currentTarget.duration) : undefined
      }
    />
  );
}

function StoryVisualView({ visual, ...media }: { visual?: StoryVisual } & MediaCallbacks) {
  if (!visual) {
    return (
      <p className={styles.textOnly}>This stage is told through its decisions and outcomes.</p>
    );
  }

  if (visual.type === "video") {
    return <StoryVideo visual={visual} {...media} />;
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

  if (visual.type === "palette") {
    return (
      <div className={styles.palette}>
        {visual.colors.map((color) => (
          <figure key={color.label} className={styles.colorSample}>
            <span
              className={styles.swatch}
              style={{ backgroundColor: color.value }}
              aria-hidden="true"
            />
            <figcaption>
              <strong>{color.label}</strong>
              <span>{color.value}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }

  if (visual.type === "typography") {
    return (
      <div className={styles.typeSpecimen}>
        <p className={styles.specimenLabel}>{visual.family}</p>
        <p className={styles.typeAlphabet}>
          Aa<span>0123456789</span>
        </p>
        {visual.examples.map((example) => (
          <div className={styles.typeExample} key={example.label}>
            <span className={styles.specimenLabel}>{example.label}</span>
            <p>{example.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (visual.type === "assets") {
    return (
      <div className={styles.assetBoard} data-layout={visual.layout}>
        {visual.items.map((item) => (
          <figure className={styles.assetSample} key={item.media.src}>
            <a
              href={item.media.src}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${item.label} asset full size`}
            >
              <Image
                src={item.media.src}
                alt={item.media.alt}
                width={item.media.width}
                height={item.media.height}
                unoptimized
              />
            </a>
            <figcaption>{item.label}</figcaption>
          </figure>
        ))}
      </div>
    );
  }

  if (visual.type === "spacing") {
    return (
      <div className={styles.spacingScale}>
        {visual.steps.map((step) => (
          <div className={styles.spacingStep} key={step.value}>
            <strong>
              {step.value}
              <span> px</span>
            </strong>
            <span className={styles.spacingMark} style={{ gap: step.value }} aria-hidden="true">
              <span />
              <span />
            </span>
            <span>{step.label}</span>
          </div>
        ))}
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

/**
 * Text that arrives line by line. Each word is its own box so the lines can
 * be found once the text has wrapped; the story then numbers them. Assistive
 * technology reads the plain string, never the pieces.
 */
function Lines({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      <span className={styles.srOnly}>{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <Fragment key={index}>
            <span className={styles.word} data-word="">
              {word}
            </span>
            {index < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </span>
    </>
  );
}

function ProjectFacts({ project, info }: { project: Project; info?: CaseStudyInfo }) {
  const facts = [
    ["Role", project.role.join(" + ")],
    [info?.timelineLabel ?? "Timeline", info?.timeline ?? String(project.year)],
    ["Company", info?.company],
    ["Team", info?.team],
    ["Contribution", info?.responsibilities?.join(", ")],
    ["Tools", info?.tools?.join(", ")],
    ["Platform", info?.platform],
    ["Project type", info?.projectType ?? project.category],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <dl className={styles.facts}>
      {facts.map(([label, value], index) => (
        <div key={label} className={styles.fact} style={{ "--i": index } as React.CSSProperties}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type HistoryMode = "push" | "replace" | "none";

export function CaseStudyWorkspace({ project, stages }: CaseStudyWorkspaceProps) {
  const initialId = stages[0]?.id ?? "";
  const [stageId, setStageId] = useState(initialId);
  const [storyIndex, setStoryIndex] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  /*
   * Autoplay holds only for deliberate reasons: reading the copy, pressing
   * and holding the visual, moving through by keyboard, or watching a video.
   * Resting the mouse over the visual (where the arrows are) does not.
   */
  const [reading, setReading] = useState(false);
  const [holding, setHolding] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [mediaSeconds, setMediaSeconds] = useState<{ key: string; seconds: number } | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const touchStart = useRef<number | null>(null);
  const elapsedMs = useRef(0);
  const stageIndex = Math.max(
    0,
    stages.findIndex((item) => item.id === stageId),
  );
  const stage = stages[stageIndex];
  const story = stage?.stories[storyIndex] ?? stage?.stories[0];
  const storyCount = stage?.stories.length ?? 0;
  const storyKey = `${stage?.id}-${story?.id}`;
  const atStart = stageIndex === 0 && storyIndex === 0;
  const atEnd = stageIndex === stages.length - 1 && storyIndex >= storyCount - 1;

  const loopSeconds = mediaSeconds?.key === storyKey ? mediaSeconds.seconds : undefined;
  const durationMs =
    (story?.durationSeconds ??
      (loopSeconds ? Math.min(30, Math.max(4, loopSeconds)) : DEFAULT_STORY_SECONDS)) * 1000;
  const autoplay =
    project.caseStudy.storyPlayback !== "manual" && !mobile && !reducedMotion && !atEnd;
  const running =
    autoplay && !documentHidden && !reading && !holding && !keyboardFocus && !videoPlaying;

  const show = useCallback((nextId: string, nextIndex: number, mode: HistoryMode) => {
    setStageId(nextId);
    setStoryIndex(nextIndex);
    setVideoPlaying(false);
    if (mode === "push") history.pushState({ stage: nextId }, "", `#${nextId}`);
    if (mode === "replace") history.replaceState({ stage: nextId }, "", `#${nextId}`);
  }, []);

  /**
   * One story on or back. At either end of a stage it carries into the
   * neighbouring stage, so the arrows, keys and autoplay run the whole case
   * study rather than stopping at every stage boundary.
   */
  const step = useCallback(
    (direction: 1 | -1, mode: HistoryMode) => {
      const within = storyIndex + direction;
      if (within >= 0 && within < storyCount) {
        setStoryIndex(within);
        setVideoPlaying(false);
        return;
      }
      const target = stages[stageIndex + direction];
      if (!target) return;
      show(target.id, direction > 0 ? 0 : target.stories.length - 1, mode);
    },
    [show, stageIndex, stages, storyCount, storyIndex],
  );
  const previous = useCallback(() => step(-1, "push"), [step]);
  const next = useCallback(() => step(1, "push"), [step]);
  const advanceRef = useRef(() => {});
  useEffect(() => {
    advanceRef.current = () => step(1, "replace");
  }, [step]);

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
      if (stages.some((item) => item.id === fromHash)) show(fromHash, 0, "none");
      else if (initialId) history.replaceState({ stage: initialId }, "", `#${initialId}`);
    });
    const pop = () => {
      const id = location.hash.slice(1);
      if (stages.some((item) => item.id === id)) show(id, 0, "none");
      else if (!id && initialId) show(initialId, 0, "none");
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
  }, [show, initialId, stages]);

  // A new story starts its clock from zero.
  useEffect(() => {
    elapsedMs.current = 0;
  }, [storyKey]);

  /*
   * The autoplay clock. The same frame loop that counts the time paints the
   * progress segment, so the bar and the advance can never disagree, and a
   * pause keeps exactly the time already spent.
   */
  useEffect(() => {
    const bar = progressRef.current;
    const paint = () =>
      bar?.style.setProperty(
        "--story-progress",
        String(Math.min(1, elapsedMs.current / durationMs)),
      );
    paint();
    if (!running) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      // Behind the entry doorway the page is inert; the clock waits for it.
      if (!articleRef.current?.closest("[inert]")) elapsedMs.current += now - last;
      last = now;
      paint();
      if (elapsedMs.current >= durationMs) advanceRef.current();
      else frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [durationMs, running, storyKey]);

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

  // Keeps the selected stage centred when the stage list scrolls sideways.
  useEffect(() => {
    const nav = navRef.current;
    const selected = nav?.querySelector<HTMLElement>(`[data-stage-id="${stageId}"]`);
    if (!nav || !selected) return;
    nav.scrollTo({
      left: selected.offsetLeft - (nav.clientWidth - selected.clientWidth) / 2,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [stageId, mobile]);

  // Moves the stage indicator onto the selected stage, and follows resizes.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const selected = nav?.querySelector<HTMLElement>(`[data-stage-id="${stageId}"]`);
    if (!nav || !selected) return;
    const place = () => {
      nav.style.setProperty("--indicator-x", `${selected.offsetLeft}px`);
      nav.style.setProperty("--indicator-width", `${selected.offsetWidth}px`);
    };
    place();
    const frame = requestAnimationFrame(() => nav.setAttribute("data-indicator", "ready"));
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [stageId]);

  /*
   * Numbers the wrapped lines of the copy so they rise one after another.
   * Runs before paint, so no word is ever seen before its line's turn. The
   * step shrinks for long copy so the last line never trails far behind.
   */
  useLayoutEffect(() => {
    const words = storyRef.current?.querySelectorAll<HTMLElement>("[data-word]");
    if (!words?.length) return;
    let line = -1;
    let lineTop = -Infinity;
    for (const word of words) {
      const top = word.getBoundingClientRect().top;
      if (top > lineTop + 2) {
        line += 1;
        lineTop = top;
      }
      word.style.setProperty("--line", String(line));
    }
    const step = Math.min(70, 900 / Math.max(1, line));
    storyRef.current?.style.setProperty("--line-step", `${step}ms`);
  }, [storyKey]);

  const releaseHold = () => setHolding(false);

  if (!stage || !story) return null;
  const info = project.caseStudy.info;

  return (
    <article
      ref={articleRef}
      className={styles.workspace}
      aria-label={`${project.title} case study`}
      onFocusCapture={(event) => {
        if ((event.target as Element).matches(":focus-visible")) setKeyboardFocus(true);
      }}
      onBlurCapture={() => setKeyboardFocus(false)}
    >
      <header className={styles.mobileHeader}>
        <h1>
          <span className={styles.titleMask}>
            <span className={styles.titleInner}>{project.title}</span>
          </span>
        </h1>
        <p>
          {project.role.join(" + ")} · {info?.timelineLabel ? `${info.timelineLabel}: ` : ""}
          {info?.timeline ?? project.year}
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
        <h1>
          <span className={styles.titleMask}>
            <span className={styles.titleInner}>{project.title}</span>
          </span>
        </h1>
        <p className={styles.projectDescription}>{project.shortDescription}</p>
        <ProjectFacts project={project} info={info} />
        {info?.externalUrl ? (
          <a className={styles.liveLink} href={info.externalUrl}>
            {info.externalLabel ?? "View live project"} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </aside>

      <section
        ref={viewerRef}
        className={styles.viewer}
        aria-label={`${stage.label}: ${story.title}`}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
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
        }}
      >
        <div
          key={stage.id}
          ref={progressRef}
          className={styles.storyProgress}
          data-autoplay={autoplay ? "on" : "off"}
          style={{ gridTemplateColumns: `repeat(${storyCount}, minmax(0, 1fr))` }}
          aria-label={`Story ${storyIndex + 1} of ${storyCount}`}
        >
          {stage.stories.map((item, index) => (
            <span
              key={item.id}
              data-state={index < storyIndex ? "past" : index === storyIndex ? "current" : "future"}
            >
              <span />
            </span>
          ))}
        </div>
        <div
          className={styles.visualFrame}
          data-board={
            story.visual &&
            ["palette", "typography", "assets", "spacing"].includes(story.visual.type)
              ? "true"
              : undefined
          }
          data-controlled-video={
            story.visual?.type === "video" && story.visual.playback === "controls"
              ? "true"
              : undefined
          }
          key={storyKey}
          onPointerDown={(event) => {
            if (!(event.target as Element).closest("button, a, video")) setHolding(true);
          }}
          onPointerUp={releaseHold}
          onPointerCancel={releaseHold}
          onPointerLeave={releaseHold}
        >
          <StoryVisualView
            visual={story.visual}
            onPlayingChange={setVideoPlaying}
            onDuration={(seconds) => {
              if (Number.isFinite(seconds) && seconds > 0) {
                setMediaSeconds({ key: storyKey, seconds });
              }
            }}
          />
          <button
            className={styles.previousControl}
            onClick={previous}
            hidden={atStart}
            aria-label="Previous story"
          >
            <ArrowGlyph direction="left" className={styles.controlGlyph} />
          </button>
          <button
            className={styles.nextControl}
            onClick={next}
            hidden={atEnd}
            aria-label="Next story"
          >
            <ArrowGlyph direction="right" className={styles.controlGlyph} />
          </button>
        </div>
        {story.caption ? (
          <p key={`caption-${storyKey}`} className={styles.caption}>
            {story.caption}
          </p>
        ) : null}
        {story.visual?.type === "image" && story.visual.zoomable ? (
          <a
            key={`zoom-${storyKey}`}
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
        ref={storyRef}
        className={styles.story}
        aria-live="polite"
        key={`copy-${storyKey}`}
        onMouseEnter={() => setReading(true)}
        onMouseLeave={() => setReading(false)}
      >
        <p className={styles.eyebrow}>
          <Lines text={story.eyebrow ?? stage.label} />
        </p>
        <h2>
          <Lines text={story.title} />
        </h2>
        <p className={styles.storyDescription}>
          <Lines text={story.description} />
        </p>
        {story.supportingPoints?.length ? (
          <ul className={styles.points}>
            {story.supportingPoints.slice(0, 4).map((point) => (
              <li key={point}>
                <Lines text={point} />
              </li>
            ))}
          </ul>
        ) : null}
        {(
          [
            ["Decision", story.decision],
            ["Constraint", story.constraint],
            ["Outcome", story.outcome],
          ] as const
        ).map(([label, text]) =>
          text ? (
            <p key={label} className={styles.detail}>
              <strong>
                <Lines text={label} />
              </strong>
              <Lines text={text} />
            </p>
          ) : null,
        )}
        {story.metric ? (
          <p className={styles.metric}>
            <strong>
              <Lines text={story.metric.value} />
            </strong>
            <Lines text={story.metric.label} />
          </p>
        ) : null}
        {story.quote ? (
          <blockquote>
            <Lines text={story.quote.text} />
            {story.quote.attribution ? (
              <cite>
                <Lines text={story.quote.attribution} />
              </cite>
            ) : null}
          </blockquote>
        ) : null}
        {story.supportingVideo ? (
          <a
            className={styles.supportingVideo}
            href={story.supportingVideo.media.src}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Lines text={story.supportingVideo.label} /> <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </section>

      <nav ref={navRef} className={styles.stageNav} aria-label="Case study stages">
        <span className={styles.stageIndicator} aria-hidden="true" />
        {stages.map((item, index) => (
          <button
            key={item.id}
            data-stage-id={item.id}
            style={{ "--i": index } as React.CSSProperties}
            aria-current={item.id === stage.id ? "step" : undefined}
            onClick={() => {
              if (item.id !== stage.id) show(item.id, 0, "push");
              // On a phone the reader may be deep in the copy; bring the new
              // stage's visual back into view under the sticky stage list.
              const viewer = viewerRef.current;
              const below = navRef.current?.getBoundingClientRect().bottom ?? 0;
              if (mobile && viewer && viewer.getBoundingClientRect().top < below) {
                viewer.scrollIntoView({
                  block: "start",
                  behavior: reducedMotion ? "auto" : "smooth",
                });
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </article>
  );
}
