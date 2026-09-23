import type { ElementType, ReactNode } from "react";

import styles from "./DisplayHeading.module.css";

type DisplayHeadingProps = Readonly<{
  /** Visual lines. Each renders on its own baseline inside its own mask. */
  lines: readonly string[];
  /** How assistive technology should read the same words as one phrase. */
  accessibleText: string;
  as?: Extract<ElementType, "h1" | "h2" | "p">;
  size?: "xl" | "l";
  id?: string;
  className?: string;
  /** Marks the heading so the particle field flows around it. */
  sceneObstacle?: boolean;
  children?: ReactNode;
}>;

/**
 * Monumental condensed heading.
 *
 * Every line renders inside an overflow mask so a section can animate the line
 * rising into view without the primitive owning any timing itself. The mask is
 * visually neutral when nothing animates it, which is why the footer and the
 * work heading can share it untouched.
 */
export function DisplayHeading({
  lines,
  accessibleText,
  as: Tag = "h2",
  size = "xl",
  id,
  className,
  sceneObstacle = false,
  children,
}: DisplayHeadingProps) {
  return (
    <Tag
      id={id}
      aria-label={accessibleText}
      className={[styles.heading, styles[size], className].filter(Boolean).join(" ")}
      data-scene-obstacle={sceneObstacle ? "" : undefined}
    >
      {lines.map((line, index) => (
        <span
          key={line}
          className={styles.line}
          data-line-index={index}
          /* Lets a section decorate the line without duplicating its text. */
          data-line-text={line}
        >
          <span className={styles.lineInner} data-line-inner="">
            {line}
            {index < lines.length - 1 ? " " : null}
          </span>
        </span>
      ))}
      {children}
    </Tag>
  );
}
