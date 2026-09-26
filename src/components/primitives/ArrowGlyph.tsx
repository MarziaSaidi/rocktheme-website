type ArrowGlyphProps = Readonly<{
  direction: "left" | "right";
  className?: string;
}>;

/**
 * The one arrow the case study uses: a hairline shaft with an open head.
 * Drawn in currentColor, so whatever sets the text colour sets the arrow.
 */
export function ArrowGlyph({ direction, className }: ArrowGlyphProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 12"
      width="24"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={direction === "left" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M1 6h22M17.5 1 23 6l-5.5 5" />
    </svg>
  );
}
