import type { CSSProperties, ReactNode } from "react";

import styles from "./SwapGlyph.module.css";

/** Which way the glyph points, and so which way it leaves. */
export type SwapDirection = "left" | "right" | "up" | "up-right";

const VECTORS: Record<SwapDirection, readonly [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  "up-right": [1, -1],
};

type SwapGlyphProps = Readonly<{
  /** The arrow itself: a text glyph such as ↗, or an ArrowGlyph. */
  children: ReactNode;
  direction: SwapDirection;
  className?: string;
}>;

/**
 * One arrow behaviour for the whole site (docs/typography-motion-system.md,
 * §5). When the link or button around it is hovered with a mouse or focused
 * from the keyboard, the arrow leaves in the direction it points and a copy
 * enters from the opposite side, inside a mask the size of the glyph. At rest
 * it is the arrow exactly as before; it is always hidden from assistive
 * technology, like the arrows it replaces.
 */
export function SwapGlyph({ children, direction, className }: SwapGlyphProps) {
  const [x, y] = VECTORS[direction];
  return (
    <span
      className={className ? `${styles.swap} ${className}` : styles.swap}
      style={{ "--swap-x": x, "--swap-y": y } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.glyph}>{children}</span>
      <span className={styles.copy}>{children}</span>
    </span>
  );
}
