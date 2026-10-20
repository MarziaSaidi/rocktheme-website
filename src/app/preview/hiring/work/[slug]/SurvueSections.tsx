import Image from "next/image";
import { survueProject } from "@/content/projects/records/survue.project";
import type {
  CaseStudyStage,
  ImageMedia,
  StoryVisual,
  VideoMedia,
} from "@/content/projects/project.types";
import study from "./study.module.css";
import styles from "./SurvueSections.module.css";

const labels: Record<string, string> = {
  context: "Video demo",
  structure: "User flow",
  wireframes: "Wireframes",
  detection: "Approaching-car explorations",
  foundations: "Interface system",
  final: "Final experience",
  delivery: "Delivery",
};
const stages: readonly CaseStudyStage[] = survueProject.caseStudy.stages;
export const survueSections = [
  { id: "overview", label: "Overview" },
  { id: "background", label: "Background" },
  ...stages.map((stage) => ({ id: stage.id, label: labels[stage.id] ?? stage.label })),
];
function Screen({ media, label }: { media: ImageMedia; label?: string }) {
  return (
    <figure>
      <a
        href={media.src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${label ?? media.alt} full size`}
      >
        <Image
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          sizes="(max-width: 639px) 80vw, 906px"
        />
      </a>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  );
}
function Video({ media }: { media: VideoMedia }) {
  return (
    <div className={styles.video}>
      <video
        controls
        playsInline
        preload="metadata"
        poster={media.poster.src}
        aria-label={media.title}
      >
        <source src={media.src} type="video/mp4" />
        <a href={media.src}>Watch {media.title}</a>
      </video>
      {media.transcript && <p>{media.transcript}</p>}
    </div>
  );
}
function Artifact({ visual: v }: { visual: StoryVisual }) {
  switch (v.type) {
    case "image":
      return (
        <div
          className={`${styles.single} ${v.media.height > v.media.width * 1.5 ? styles.phone : ""}`}
        >
          <Screen media={v.media} />
        </div>
      );
    case "video":
      return <Video media={v.media} />;
    case "comparison":
      return (
        <div
          className={styles.comparison}
          tabIndex={0}
          role="group"
          aria-label="Detection concepts"
        >
          <Screen media={v.before} label={v.beforeLabel ?? "Before"} />
          <Screen media={v.after} label={v.afterLabel ?? "After"} />
        </div>
      );
    case "sequence":
      return (
        <div>
          {v.heading && <p className={styles.artifactHeading}>{v.heading}</p>}
          <div
            className={`${styles.sequence} ${styles.row}`}
            tabIndex={0}
            role="group"
            aria-label={v.heading ?? "Screen sequence"}
          >
            {v.items.map((item) => (
              <Screen key={item.media.src} {...item} />
            ))}
          </div>
        </div>
      );
    case "group":
      return (
        <div className={`${styles.sequence} ${styles.row}`}>
          {v.images.map((media) => (
            <Screen key={media.src} media={media} />
          ))}
        </div>
      );
    case "palette":
      return (
        <div className={styles.palette}>
          {v.colors.map((color) => (
            <figure key={color.label}>
              <span style={{ background: color.value }} />
              <figcaption>
                {color.label}
                <code>{color.value}</code>
              </figcaption>
            </figure>
          ))}
        </div>
      );
    case "typography":
      return (
        <div className={styles.type} style={{ fontFamily: `"${v.family}", Helvetica, sans-serif` }}>
          <p className={styles.specimen}>Aa 0123456789</p>
          <p>{v.family}</p>
          {v.examples.map((example) => (
            <div key={example.label}>
              <span>{example.label}</span>
              <p>{example.text}</p>
            </div>
          ))}
        </div>
      );
    case "assets":
      return (
        <div
          className={`${styles.assets} ${v.layout === "icons" ? styles.icons : styles.components}`}
        >
          {v.items.map((item) => (
            <Screen key={item.label} {...item} />
          ))}
        </div>
      );
    case "spacing":
      return (
        <div className={styles.spacing}>
          {v.steps.map((step) => (
            <div key={step.value}>
              <code>{step.value} px</code>
              <span className={styles.spacingSample} style={{ gap: step.value }} aria-hidden="true">
                <i />
                <i />
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      );
    case "code":
      return (
        <pre tabIndex={0} aria-label={v.label}>
          <code>{v.code}</code>
        </pre>
      );
  }
}
export function SurvueSections() {
  return stages.map((stage) => (
    <section id={stage.id} key={stage.id} className={study.section} data-source-stage={stage.id}>
      <h2>{labels[stage.id] ?? stage.label}</h2>
      <div className={styles.stories}>
        {stage.stories.map((story) => (
          <article
            id={story.id}
            key={story.id}
            className={styles.story}
            data-source-story={story.id}
          >
            {story.eyebrow && <span className={styles.eyebrow}>{story.eyebrow}</span>}
            <h3>{story.title}</h3>
            <p>{story.description}</p>
            {story.visual && <Artifact visual={story.visual} />}
            {story.caption && <p className={styles.caption}>{story.caption}</p>}
            {story.supportingPoints && (
              <ul>
                {story.supportingPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
            {story.metric && (
              <p>
                <strong>{story.metric.value}</strong> {story.metric.label}
              </p>
            )}
            {story.quote && (
              <blockquote>
                {story.quote.text}
                {story.quote.attribution && <cite>{story.quote.attribution}</cite>}
              </blockquote>
            )}
            {(["decision", "constraint", "outcome"] as const).map(
              (key) =>
                story[key] && (
                  <p key={key}>
                    <strong>
                      {key === "decision"
                        ? "Design decision"
                        : key === "constraint"
                          ? "Constraint"
                          : "Outcome"}
                      .{" "}
                    </strong>
                    {story[key]}
                  </p>
                ),
            )}
            {story.supportingVideo && (
              <div>
                <h4>{story.supportingVideo.label}</h4>
                <Video media={story.supportingVideo.media} />
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  ));
}
