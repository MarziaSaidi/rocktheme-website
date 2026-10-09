import type { HTMLAttributes } from "react";

import styles from "./WeightLabel.module.css";

type WeightLabelProps = Readonly<
  {
    /** The label, rendered once as real text. */
    text: string;
  } & Omit<HTMLAttributes<HTMLSpanElement>, "children">
>;

/**
 * A mono label that grows heavier when its link or button is hovered,
 * focused from the keyboard, or marks the current section
 * (docs/typography-motion-system.md, §4).
 *
 * The heavier cut is a pseudo-element drawn exactly over the label and faded
 * in by opacity. Geist Mono keeps its advance at every weight, so the two
 * line up glyph for glyph, and fading opacity repaints the label without
 * laying anything out (easing font-weight itself relaid the text every frame).
 * The copy is generated content with empty alternative text, so assistive
 * technology, selection and find in page see the label once.
 */
export function WeightLabel({ text, className, ...rest }: WeightLabelProps) {
  return (
    <span
      {...rest}
      className={className ? `${styles.label} ${className}` : styles.label}
      data-text={text}
    >
      {text}
    </span>
  );
}
