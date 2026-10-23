"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ActionContent } from "@/components/primitives/ActionContent";
import { ArrowGlyph } from "@/components/primitives/ArrowGlyph";
import { SwapGlyph } from "@/components/primitives/SwapGlyph";
import { WeightLabel } from "@/components/primitives/WeightLabel";
import { sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";
import { ScrollProgress } from "@/motion/ScrollProgress";
import type {
  CaseStudyInfo,
  CaseStudyStage,
  CaseStudyStory,
  FocusRegion,
  ImageMedia,
  Project,
  StoryVisual,
} from "@/content/projects";

import styles from "./CaseStudyWorkspace.module.css";
import { prepareStoryTitle, readingSeconds } from "./storySignature";

type CaseStudyWorkspaceProps = Readonly<{
  project: Project;
  stages: readonly CaseStudyStage[];
  /** The next case study, offered at the end of the rail. */
  next?: Readonly<{ title: string; href: string }>;
}>;

/** Seconds a story stays up when its content does not say otherwise. */
const DEFAULT_STORY_SECONDS = 6;

type MediaCallbacks = Readonly<{
  /** A video with controls started or stopped playing. */
  onPlayingChange?: (playing: boolean) => void;
  /** A looping video reported how long one pass takes. */
  onDuration?: (seconds: number) => void;
}>;

type VideoVisual = Extract<StoryVisual, { type: "video" }>;

const clock = (seconds: number) => {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * The work, playing on a lit screen. No browser controls over it: a label, a
 * timecode and a hairline above it say what it is and where it is, and the
 * screen itself (or the button) plays and pauses. On the cover it loops
 * silently; in a story it waits for the reader.
 */
function StoryVideo({
  visual,
  loop = false,
  onPlayingChange,
  onDuration,
}: { visual: VideoVisual; loop?: boolean } & MediaCallbacks) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const silent = loop || visual.playback === "silent-loop";
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!silent) return;
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
  }, [silent]);

  // Metadata can arrive before hydration attaches the handlers; read it once mounted.
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 1) setDuration(video.duration);
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  };

  // Trim letterboxing or a recorded device's backdrop; the screen shows only the work.
  const { width, height } = visual.media.poster;
  const crop = visual.crop ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const shownWidth = width - crop.left - crop.right;
  const shownHeight = height - crop.top - crop.bottom;
  const screen = {
    aspectRatio: `${shownWidth} / ${shownHeight}`,
    "--video-width": `${(width / shownWidth) * 100}%`,
    "--video-left": `${(-crop.left / shownWidth) * 100}%`,
    "--video-top": `${(-crop.top / shownWidth) * 100}%`,
    ...(visual.corner
      ? { "--corner-x": `${visual.corner[0]}%`, "--corner-y": `${visual.corner[1]}%` }
      : {}),
  } as React.CSSProperties;

  return (
    <figure className={styles.player} data-portrait={height > width ? "" : undefined}>
      <figcaption className={styles.playerBar}>
        <span>{visual.label ?? "Video"}</span>
        <button
          type="button"
          className={styles.playerToggle}
          onClick={toggle}
          aria-label={playing ? `Pause ${visual.media.title}` : `Play ${visual.media.title}`}
        >
          <span className={styles.playerGlyph} data-playing={playing ? "" : undefined} />
          <span>
            {clock(time)} / {clock(duration)}
          </span>
        </button>
      </figcaption>
      <span
        className={styles.playerTrack}
        style={{ "--played": duration ? time / duration : 0 } as React.CSSProperties}
        aria-hidden="true"
      />
      <div className={styles.screen} style={screen} data-device={visual.corner ? "" : undefined}>
        <video
          ref={videoRef}
          className={styles.screenVideo}
          muted={silent}
          loop={silent}
          playsInline
          preload={silent ? "auto" : "metadata"}
          poster={visual.media.poster.src}
          title={visual.media.title}
          src={visual.media.src}
          onClick={toggle}
          onPlay={() => {
            setPlaying(true);
            if (!silent) onPlayingChange?.(true);
          }}
          onPause={() => {
            setPlaying(false);
            if (!silent) onPlayingChange?.(false);
          }}
          onEnded={() => {
            setPlaying(false);
            if (!silent) onPlayingChange?.(false);
          }}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration);
            if (silent) onDuration?.(event.currentTarget.duration);
          }}
        />
      </div>
    </figure>
  );
}

function pieceOf(region: FocusRegion, media: ImageMedia): FocusRegion {
  const tall = region.height * media.height;
  const aspect = (region.width * media.width) / tall;
  const target = Math.min(5, Math.max(1.5, aspect));
  const width = Math.min(100 - region.x, (target * tall) / media.width);
  return { ...region, width };
}

/**
 * A screenshot as a lit plane floating over the range. The parts the copy
 * names stay lit while the rest dims; on a phone, where the whole image is too
 * small to read, those parts also come forward as larger pieces.
 */
function EvidenceImage({
  media,
  focus,
  sizes,
}: {
  media: ImageMedia;
  focus?: readonly FocusRegion[];
  sizes: string;
}) {
  const plane = {
    "--ar": `${media.width} / ${media.height}`,
    "--ar-n": media.width / media.height,
  } as React.CSSProperties;
  return (
    <span className={styles.evidence}>
      <span className={styles.plane} style={plane}>
        <Image
          className={styles.planeImage}
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          sizes={sizes}
          priority
        />
        {focus?.length ? (
          <svg
            className={styles.focus}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d={`M0 0H100V100H0Z ${focus
                .map((r) => `M${r.x} ${r.y}h${r.width}v${r.height}h${-r.width}Z`)
                .join(" ")}`}
            />
            {focus.map((r) => (
              <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={r.height} />
            ))}
          </svg>
        ) : null}
      </span>
      {focus?.length ? (
        <span className={styles.pieces} aria-hidden="true">
          {focus.map((region) => {
            // A piece reads at a glance: between 1.5:1 and 5:1, widened or trimmed from the left edge.
            const r = pieceOf(region, media);
            return (
              <span
                key={`${region.x}-${region.y}`}
                className={styles.piece}
                style={{
                  aspectRatio: `${r.width * media.width} / ${r.height * media.height}`,
                  backgroundImage: `url(${media.src})`,
                  backgroundSize: `${(100 / r.width) * 100}% auto`,
                  backgroundPosition: `${r.width >= 100 ? 0 : (r.x / (100 - r.width)) * 100}% ${
                    r.height >= 100 ? 0 : (r.y / (100 - r.height)) * 100
                  }%`,
                }}
              />
            );
          })}
        </span>
      ) : null}
    </span>
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
    <EvidenceImage
      media={visual.media}
      focus={visual.focus}
      sizes="(max-width: 767px) 92vw, (max-width: 1199px) 60vw, 58vw"
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

/** The few facts a reader needs first; the rest of the story tells the rest. */
function CoverFacts({ project, info }: { project: Project; info?: CaseStudyInfo }) {
  const facts = [
    ["Role", project.role.join(" + ")],
    [info?.timelineLabel ?? "Timeline", info?.timeline ?? String(project.year)],
    ["Platform", info?.platform],
    ["Tools", info?.tools?.join(", ")],
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

/** The cover's media: the work playing large, with any screens that stand behind it. */
function CoverMedia({
  visual,
  flanks,
  ...media
}: { visual?: StoryVisual; flanks?: readonly ImageMedia[] } & MediaCallbacks) {
  return (
    <div className={styles.coverMedia} data-flanked={flanks?.length ? "" : undefined}>
      {flanks?.slice(0, 2).map((flank, index) => (
        <span key={flank.src} className={styles.flank} data-side={index === 0 ? "start" : "end"}>
          <Image
            src={flank.src}
            alt={flank.alt}
            width={flank.width}
            height={flank.height}
            sizes="18vw"
          />
        </span>
      ))}
      {visual?.type === "video" ? (
        <StoryVideo visual={visual} loop {...media} />
      ) : visual?.type === "image" ? (
        <EvidenceImage media={visual.media} sizes="(max-width: 767px) 92vw, 50vw" />
      ) : null}
    </div>
  );
}

type HistoryMode = "push" | "replace" | "none";

export function CaseStudyWorkspace({ project, stages, next: nextStudy }: CaseStudyWorkspaceProps) {
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
  const navRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const touchStart = useRef<number | null>(null);
  const elapsedMs = useRef(0);
  const stageIndex = Math.max(
    0,
    stages.findIndex((item) => item.id === stageId),
  );
  const stage = stages[stageIndex];
  /*
   * The first stage opens on a cover: the title, what I did, a few facts and
   * the work playing large. It is that stage's first beat (null), ahead of its
   * stories, so the arrows, keys and rail treat it like any other story.
   */
  const storiesOf = useCallback(
    (index: number): readonly (CaseStudyStory | null)[] => {
      const target = stages[index];
      if (!target) return [];
      return index === 0 ? [null, ...target.stories] : target.stories;
    },
    [stages],
  );
  const stories = storiesOf(stageIndex);
  const story = storyIndex < stories.length ? stories[storyIndex] : stories[0];
  const isCover = story === null;
  const storyCount = stories.length;
  const storyKey = `${stage?.id}-${story?.id ?? "cover"}`;
  const titleSignature = project.caseStudy.titleSignature;
  const emphasis = story?.emphasis;
  const atStart = stageIndex === 0 && storyIndex === 0;
  const atEnd = stageIndex === stages.length - 1 && storyIndex >= storyCount - 1;

  const loopSeconds = mediaSeconds?.key === storyKey ? mediaSeconds.seconds : undefined;
  /*
   * An autoplaying story stays up at least as long as it takes to read
   * (docs/typography-motion-system.md, §11); a shorter authored or video
   * duration is raised to it.
   */
  const readingFloor = story
    ? readingSeconds([
        story.title,
        story.description,
        ...(story.supportingPoints ?? []),
        story.decision,
        story.constraint,
        story.outcome,
        story.metric?.label,
        story.quote?.text,
      ])
    : readingSeconds([project.shortDescription]);
  const durationMs =
    Math.max(
      readingFloor,
      story?.durationSeconds ??
        (loopSeconds ? Math.min(30, Math.max(4, loopSeconds)) : DEFAULT_STORY_SECONDS),
    ) * 1000;
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
      show(target.id, direction > 0 ? 0 : storiesOf(stageIndex + direction).length - 1, mode);
    },
    [show, stageIndex, stages, storiesOf, storyCount, storyIndex],
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
    // Then the title's signature, measured against those lines, still before paint.
    return storyRef.current
      ? prepareStoryTitle(storyRef.current, titleSignature, emphasis)
      : undefined;
  }, [storyKey, titleSignature, emphasis]);

  const releaseHold = () => setHolding(false);

  if (!stage || story === undefined) return null;
  const info = project.caseStudy.info;
  const upcoming =
    storyIndex + 1 < storyCount
      ? stories[storyIndex + 1]?.title
      : storiesOf(stageIndex + 1)[0]?.title;
  const mediaCallbacks: MediaCallbacks = {
    onPlayingChange: setVideoPlaying,
    onDuration: (seconds) => {
      if (Number.isFinite(seconds) && seconds > 0) setMediaSeconds({ key: storyKey, seconds });
    },
  };

  return (
    <article
      ref={articleRef}
      className={styles.workspace}
      data-mode={isCover ? "cover" : "story"}
      aria-label={`${project.title} case study`}
      onFocusCapture={(event) => {
        if ((event.target as Element).matches(":focus-visible")) setKeyboardFocus(true);
      }}
      onBlurCapture={() => setKeyboardFocus(false)}
    >
      <header className={styles.head}>
        <Link className={styles.back} href={`/#${sectionAnchors["selected-work"]}`}>
          <SwapGlyph direction="left" className={styles.backGlyph}>
            <ArrowGlyph direction="left" />
          </SwapGlyph>
          <WeightLabel text={siteContent.work.displayHeading} />
        </Link>
        <h1 className={styles.title}>
          <span className={styles.titleMask}>
            <span className={styles.titleInner}>{project.title}</span>
          </span>
        </h1>
      </header>

      {isCover ? (
        <>
          <p className={styles.coverLead}>{project.shortDescription}</p>
          <div className={styles.coverDetails}>
            <CoverFacts project={project} info={info} />
            {info?.externalUrl ? (
              <a
                className={styles.coverAction}
                href={info.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-action-button=""
                data-cursor="action"
              >
                <ActionContent text={info.externalLabel ?? "View live project"} arrow="↗" />
              </a>
            ) : null}
          </div>
        </>
      ) : (
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
          <ScrollProgress variant="panel" />
        </section>
      )}

      <section
        ref={viewerRef}
        className={styles.viewer}
        aria-label={isCover ? project.title : `${stage.label}: ${story.title}`}
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
        {isCover ? (
          <CoverMedia
            visual={stages[0]?.stories[0]?.visual}
            flanks={project.caseStudy.coverFlanks}
            {...mediaCallbacks}
          />
        ) : (
          <div
            className={styles.visualFrame}
            data-board={
              story.visual &&
              ["palette", "typography", "assets", "spacing"].includes(story.visual.type)
                ? "true"
                : undefined
            }
            data-ar={story.visual?.type === "image" ? "" : undefined}
            style={
              story.visual?.type === "image"
                ? ({
                    "--frame-ar": story.visual.media.width / story.visual.media.height,
                  } as React.CSSProperties)
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
            <StoryVisualView visual={story.visual} {...mediaCallbacks} />
          </div>
        )}
        {!isCover && story.caption ? (
          <p key={`caption-${storyKey}`} className={styles.caption}>
            {story.caption}
          </p>
        ) : null}
        {!isCover && story.visual?.type === "image" && story.visual.zoomable ? (
          <a
            key={`zoom-${storyKey}`}
            className={styles.zoomLink}
            href={story.visual.media.src}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WeightLabel text="Open full size" /> <SwapGlyph direction="up-right">↗</SwapGlyph>
          </a>
        ) : null}
      </section>

      <nav className={styles.rail} aria-label="Case study stages">
        <div ref={navRef} className={styles.stageNav}>
          <span
            ref={progressRef}
            className={styles.stageIndicator}
            data-autoplay={autoplay ? "on" : "off"}
            aria-label={`Story ${storyIndex + 1} of ${storyCount}`}
          >
            {stories.map((item, index) => (
              <span
                key={item?.id ?? "cover"}
                data-state={
                  index < storyIndex ? "past" : index === storyIndex ? "current" : "future"
                }
              />
            ))}
          </span>
          {stages.map((item, index) => (
            <button
              key={item.id}
              data-stage-id={item.id}
              style={{ "--i": index } as React.CSSProperties}
              aria-current={item.id === stage.id ? "step" : undefined}
              onClick={() => {
                if (item.id !== stage.id) show(item.id, 0, "push");
                // On a phone the reader may be deep in the copy; bring the new
                // stage's visual back into view.
                const viewer = viewerRef.current;
                if (mobile && viewer && viewer.getBoundingClientRect().top < 0) {
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
        </div>
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pagerPrevious}
            onClick={previous}
            disabled={atStart}
            aria-label="Previous story"
          >
            <SwapGlyph direction="left" className={styles.pagerGlyph}>
              <ArrowGlyph direction="left" />
            </SwapGlyph>
          </button>
          {!atEnd ? (
            <button
              type="button"
              className={styles.pagerNext}
              onClick={next}
              aria-label={upcoming ? `Next story: ${upcoming}` : "Next story"}
            >
              <span className={styles.pagerLabel}>Next</span>
              <span className={styles.pagerTitle}>{upcoming}</span>
              <SwapGlyph direction="right" className={styles.pagerGlyph}>
                <ArrowGlyph direction="right" />
              </SwapGlyph>
            </button>
          ) : nextStudy ? (
            <Link className={styles.pagerCase} href={nextStudy.href}>
              <span className={styles.pagerLabel}>Next case study</span>
              <span className={styles.pagerCaseTitle}>{nextStudy.title}</span>
              <SwapGlyph direction="right" className={styles.pagerGlyph}>
                <ArrowGlyph direction="right" />
              </SwapGlyph>
            </Link>
          ) : null}
        </div>
      </nav>
    </article>
  );
}
