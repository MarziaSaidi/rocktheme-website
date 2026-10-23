"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ActionContent } from "@/components/primitives/ActionContent";
import { ArrowGlyph } from "@/components/primitives/ArrowGlyph";
import { SwapGlyph } from "@/components/primitives/SwapGlyph";
import { WeightLabel } from "@/components/primitives/WeightLabel";
import { sectionAnchors } from "@/config/sections";
import { siteContent } from "@/content/site/siteContent";
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
import { prepareStoryTitle } from "./storySignature";

type CaseStudyWorkspaceProps = Readonly<{
  project: Project;
  stages: readonly CaseStudyStage[];
  /** The next case study, offered at the end of the page. */
  next?: Readonly<{ title: string; href: string }>;
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
function StoryVideo({ visual, loop = false }: { visual: VideoVisual; loop?: boolean }) {
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
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
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
  priority = false,
}: {
  media: ImageMedia;
  focus?: readonly FocusRegion[];
  sizes: string;
  priority?: boolean;
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
          priority={priority}
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
function CoverMedia({ visual, flanks }: { visual?: StoryVisual; flanks?: readonly ImageMedia[] }) {
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
        <StoryVideo visual={visual} loop />
      ) : visual?.type === "image" ? (
        <EvidenceImage media={visual.media} sizes="(max-width: 767px) 92vw, 50vw" priority />
      ) : null}
    </div>
  );
}

/**
 * How a story is composed, from the shape of its evidence:
 * - `wide`: the claim and its reasoning read across, then the evidence spans the page;
 * - `tall`: phone screens and portrait evidence run on the right while the copy holds on the left;
 * - `pair`: one of two states of a step, side by side (an authored stage layout).
 */
type BeatLayout = "wide" | "tall" | "pair";

const layoutOf = (visual: StoryVisual | undefined): BeatLayout => {
  if (!visual) return "wide";
  if (visual.type === "sequence" || visual.type === "comparison") return "tall";
  if (visual.type === "image") return visual.media.height > visual.media.width ? "tall" : "wide";
  if (visual.type === "video") {
    return visual.media.poster.height > visual.media.poster.width ? "tall" : "wide";
  }
  return "wide";
};

const twoDigits = (value: number) => String(value).padStart(2, "0");

/** Decision, constraint and outcome, side by side under one rule: annotations, not a form. */
function Notes({ story }: { story: CaseStudyStory }) {
  const notes = [
    ["Decision", story.decision],
    ["Constraint", story.constraint],
    ["Outcome", story.outcome],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (!notes.length) return null;
  return (
    <dl className={styles.notes} style={{ "--notes": notes.length } as React.CSSProperties}>
      {notes.map(([label, text]) => (
        <div key={label}>
          <dt>
            <Lines text={label} />
          </dt>
          <dd>
            <Lines text={text} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The reasoning: what happened, any supporting points and figures, and the notes. */
function Reasoning({ story }: { story: CaseStudyStory }) {
  return (
    <div className={styles.why}>
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
      <Notes story={story} />
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
    </div>
  );
}

/** The evidence in its frame, with its caption and full-size link on one ruled line beneath. */
function Evidence({ story }: { story: CaseStudyStory }) {
  const visual = story.visual;
  if (!visual) return null;
  const zoom = visual?.type === "image" && visual.zoomable ? visual.media.src : undefined;
  const ratio =
    visual?.type === "image"
      ? visual.media.width / visual.media.height
      : visual?.type === "video"
        ? visual.media.poster.width / visual.media.poster.height
        : undefined;
  return (
    <figure className={styles.fig}>
      <div
        className={styles.visualFrame}
        data-board={
          visual && ["palette", "typography", "assets", "spacing"].includes(visual.type)
            ? "true"
            : undefined
        }
        data-kind={visual?.type}
        style={ratio ? ({ "--ar": ratio } as React.CSSProperties) : undefined}
      >
        <StoryVisualView visual={visual} />
      </div>
      {story.caption || zoom ? (
        <figcaption className={styles.figCaption}>
          <span className={styles.caption}>{story.caption}</span>
          {zoom ? (
            <a className={styles.zoomLink} href={zoom} target="_blank" rel="noopener noreferrer">
              <WeightLabel text="Open full size" /> <SwapGlyph direction="up-right">↗</SwapGlyph>
            </a>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * One story, composed for its evidence. The copy waits unseen until the story
 * scrolls in, then arrives line by line.
 */
function StoryBeat({
  story,
  stage,
  signature,
  layout,
  first,
  onCover = false,
}: {
  story: CaseStudyStory;
  stage: CaseStudyStage;
  signature?: Project["caseStudy"]["titleSignature"];
  layout: BeatLayout;
  first: boolean;
  /** Its evidence already plays on the cover, so the story is told in words alone. */
  onCover?: boolean;
}) {
  const beatRef = useRef<HTMLElement>(null);
  const emphasis = story.emphasis;

  /*
   * Numbers the wrapped lines of the copy so they rise one after another.
   * Runs before paint, so no word is ever seen before its line's turn. The
   * step shrinks for long copy so the last line never trails far behind.
   */
  useLayoutEffect(() => {
    const beat = beatRef.current;
    const words = beat?.querySelectorAll<HTMLElement>("[data-word]");
    if (!beat || !words?.length) return;
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
    beat.style.setProperty("--line-step", `${Math.min(70, 900 / Math.max(1, line))}ms`);
    // Then the title's signature, measured against those lines, still before paint.
    return prepareStoryTitle(beat, signature, emphasis);
  }, [signature, emphasis]);

  const claim = (
    <div className={styles.claim}>
      <p className={styles.eyebrow}>
        <Lines text={story.eyebrow ?? stage.label} />
      </p>
      <h3 className={styles.storyTitle} data-story-title="">
        <Lines text={story.title} />
      </h3>
    </div>
  );

  return (
    <article
      ref={beatRef}
      id={`${stage.id}-${story.id}`}
      className={styles.beat}
      data-beat=""
      data-first={first ? "" : undefined}
      data-layout={layout}
      aria-label={`${stage.label}: ${story.title}`}
    >
      {layout === "pair" && !onCover ? <Evidence story={story} /> : null}
      <div className={styles.copy}>
        {claim}
        <Reasoning story={story} />
      </div>
      {layout === "pair" || onCover ? null : <Evidence story={story} />}
    </article>
  );
}

/** A place in the case study: the cover, or one story of one stage. */
type Place = Readonly<{ stageIndex: number }>;

/** Where on screen a story counts as the one being read. */
const READING_LINE = 0.45;

export function CaseStudyWorkspace({ project, stages, next: nextStudy }: CaseStudyWorkspaceProps) {
  const [current, setCurrent] = useState(0);
  /** Set once a link's own stage has been honoured, so the address is not overwritten first. */
  const [arrived, setArrived] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const titleSignature = project.caseStudy.titleSignature;

  /*
   * The whole case study as one run of places, top to bottom: the cover, then
   * every story of every stage. Scrolling moves the reader along it; the
   * address follows, and the arrow keys step one story back or on.
   */
  const places = useMemo<readonly Place[]>(
    () => [
      { stageIndex: 0 },
      ...stages.flatMap((stage, stageIndex) => stage.stories.map(() => ({ stageIndex }))),
    ],
    [stages],
  );
  const place = places[Math.min(current, places.length - 1)];
  const stage = stages[place?.stageIndex ?? 0];
  const stageId = stage?.id ?? "";

  /*
   * The cover and each story, in reading order. A stage's first story is
   * reached at its chapter opener, so the address changes as the chapter begins.
   */
  const placeElements = useCallback(
    () =>
      [
        ...(articleRef.current?.querySelectorAll<HTMLElement>("[data-cover], [data-beat]") ?? []),
      ].map((element) =>
        element.hasAttribute("data-first")
          ? (element.closest<HTMLElement>("[data-chapter]") ?? element)
          : element,
      ),
    [],
  );

  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scrollToPlace = useCallback(
    (index: number) => {
      const target = placeElements()[index];
      if (!target) return;
      const behavior: ScrollBehavior = reduced() ? "auto" : "smooth";
      if (index === 0) scrollTo({ top: 0, behavior });
      else target.scrollIntoView({ block: "start", behavior });
    },
    [placeElements],
  );

  /** The first place of a stage. */
  const placeOfStage = useCallback(
    (id: string) => {
      const index = stages.findIndex((item) => item.id === id);
      return index < 0 ? 0 : places.findIndex((item, at) => at > 0 && item.stageIndex === index);
    },
    [places, stages],
  );

  // Follows the reader: the story crossing the reading line is the current one.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const elements = placeElements();
      const line = innerHeight * READING_LINE;
      let index = 0;
      elements.forEach((element, at) => {
        if (element.getBoundingClientRect().top <= line) index = at;
      });
      // At the very bottom the last story is current, however short it is.
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) {
        index = elements.length - 1;
      }
      setCurrent(index);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    };
  }, [placeElements]);

  // Chapter openers and stories arrive the first time they scroll into view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.seen = "";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    articleRef.current
      ?.querySelectorAll("[data-opener], [data-beat], [data-end]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  // The address names the stage being read, without adding history as it scrolls.
  useEffect(() => {
    if (arrived && stageId && location.hash.slice(1) !== stageId) {
      history.replaceState({ stage: stageId }, "", `#${stageId}`);
    }
  }, [arrived, stageId]);

  // A link to a stage opens on it; back and forward return to theirs.
  useEffect(() => {
    const go = (smooth: boolean) => {
      const id = location.hash.slice(1);
      if (!stages.some((item) => item.id === id)) return;
      const index = id === stages[0]?.id ? 0 : placeOfStage(id);
      const target = placeElements()[index];
      if (!smooth || reduced()) {
        if (index === 0) scrollTo({ top: 0 });
        else target?.scrollIntoView({ block: "start" });
      } else scrollToPlace(index);
    };
    // At once, and again once the first frame has laid out, in case anything moved the page meanwhile.
    go(false);
    const initialFrame = requestAnimationFrame(() => {
      go(false);
      setArrived(true);
    });
    const pop = () => go(true);
    addEventListener("popstate", pop);
    addEventListener("hashchange", pop);
    return () => {
      cancelAnimationFrame(initialFrame);
      removeEventListener("popstate", pop);
      removeEventListener("hashchange", pop);
    };
  }, [placeElements, placeOfStage, scrollToPlace, stages]);

  const previous = useCallback(() => scrollToPlace(current - 1), [current, scrollToPlace]);
  const next = useCallback(() => scrollToPlace(current + 1), [current, scrollToPlace]);

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

  if (!stage || !place) return null;
  const info = project.caseStudy.info;
  const total = twoDigits(stages.length);

  return (
    <article
      ref={articleRef}
      className={styles.workspace}
      aria-label={`${project.title} case study`}
    >
      <section className={styles.cover} data-cover="" aria-label={project.title}>
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
        <div className={styles.viewer}>
          <CoverMedia
            visual={stages[0]?.stories[0]?.visual}
            flanks={project.caseStudy.coverFlanks}
          />
        </div>
      </section>

      {stages.map((item, stageIndex) => (
        <section
          key={item.id}
          id={item.id}
          className={styles.chapter}
          data-chapter=""
          aria-labelledby={`${item.id}-title`}
        >
          <header className={styles.opener} data-opener="">
            <p className={styles.chapterNumber}>
              <b>
                {twoDigits(stageIndex + 1)} / {total}
              </b>
              <span>
                {item.stories.length} {item.stories.length === 1 ? "story" : "stories"}
              </span>
            </p>
            <h2 id={`${item.id}-title`} className={styles.chapterTitle}>
              <span className={styles.titleMask}>
                <span className={styles.titleInner}>{item.label}</span>
              </span>
            </h2>
          </header>
          <div
            className={styles.chapterStories}
            data-layout={item.layout === "pair" && item.stories.length === 2 ? "pair" : undefined}
          >
            {item.stories.map((story, index) => (
              <StoryBeat
                key={story.id}
                story={story}
                stage={item}
                signature={titleSignature}
                layout={
                  item.layout === "pair" && item.stories.length === 2
                    ? "pair"
                    : stageIndex === 0 &&
                        index === 0 &&
                        (story.visual?.type === "video" || story.visual?.type === "image")
                      ? "wide"
                      : layoutOf(story.visual)
                }
                first={index === 0}
                onCover={
                  stageIndex === 0 &&
                  index === 0 &&
                  (story.visual?.type === "video" || story.visual?.type === "image")
                }
              />
            ))}
          </div>
        </section>
      ))}

      {nextStudy ? (
        <Link className={styles.end} href={nextStudy.href} data-end="">
          <span className={styles.endLabel}>Next case study</span>
          <span className={styles.endTitle}>
            <span className={styles.titleMask}>
              <span className={styles.titleInner}>{nextStudy.title}</span>
            </span>
          </span>
          <SwapGlyph direction="right" className={styles.endGlyph}>
            <ArrowGlyph direction="right" />
          </SwapGlyph>
        </Link>
      ) : null}
    </article>
  );
}
