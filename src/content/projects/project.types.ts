export const PROJECT_BLOCK_TYPES = [
  "hero",
  "introduction",
  "text",
  "image",
  "video",
  "gallery",
  "split-text-media",
  "metrics",
  "quote",
  "process",
  "next-project",
] as const;

/**
 * Documented layout variants.
 *
 * Content chooses a named variant and never supplies CSS. There is no
 * `className`, `style` or raw HTML field anywhere in this schema: a record can
 * only pick from these values, the validator rejects anything else, and the
 * renderer maps each name to a data attribute its own stylesheet owns.
 *
 * Adding a variant means adding a value here, a rule in the renderer's CSS, and
 * a line in `docs/how-to-add-or-replace-project.md`. It never means letting a
 * record describe its own appearance.
 */
export const BLOCK_LAYOUT = {
  /**
   * How far a media block reaches.
   * - `column` sits inside the reading measure
   * - `wide` breaks out past the text
   * - `full` runs edge to edge
   */
  width: ["column", "wide", "full"],
  /** Which side the media takes in a split block. */
  mediaPosition: ["left", "right"],
  /** Column count for gallery and metric grids. */
  columns: ["two", "three", "four"],
  /**
   * Weight of a text block.
   * - `body` is normal running copy
   * - `lead` is a larger opening or pull passage
   */
  tone: ["body", "lead"],
} as const;

export type BlockWidth = (typeof BLOCK_LAYOUT.width)[number];
export type BlockMediaPosition = (typeof BLOCK_LAYOUT.mediaPosition)[number];
export type BlockColumns = (typeof BLOCK_LAYOUT.columns)[number];
export type BlockTone = (typeof BLOCK_LAYOUT.tone)[number];

export type ProjectBlockType = (typeof PROJECT_BLOCK_TYPES)[number];
export type ProjectContentStatus = "placeholder" | "draft" | "final";

export type ImageMedia = Readonly<{
  kind: "image";
  src: string;
  alt: string;
  width: number;
  height: number;
  isPlaceholder?: boolean;
}>;

export type VideoMedia = Readonly<{
  kind: "video";
  src: string;
  title: string;
  poster: ImageMedia;
  transcript?: string;
  isPlaceholder?: boolean;
}>;

export type ProjectMedia = ImageMedia | VideoMedia;

type BlockBase = Readonly<{
  id: string;
  isPlaceholder?: boolean;
}>;

/**
 * Opening media for the case study. The page heading, category, role and year
 * come from the project record itself, so a hero block never repeats them.
 */
export type HeroBlock = BlockBase &
  Readonly<{
    type: "hero";
    media: ImageMedia;
    caption?: string;
  }>;

/** The opening prose, set larger than running copy. */
export type IntroductionBlock = BlockBase &
  Readonly<{
    type: "introduction";
    body: readonly string[];
  }>;

export type TextBlock = BlockBase &
  Readonly<{
    type: "text";
    heading?: string;
    body: readonly string[];
    tone?: BlockTone;
  }>;

export type ImageBlock = BlockBase &
  Readonly<{
    type: "image";
    media: ImageMedia;
    caption?: string;
    width?: BlockWidth;
  }>;

export type VideoBlock = BlockBase &
  Readonly<{
    type: "video";
    media: VideoMedia;
    caption?: string;
    width?: BlockWidth;
  }>;

export type GalleryBlock = BlockBase &
  Readonly<{
    type: "gallery";
    images: readonly ImageMedia[];
    caption?: string;
    columns?: BlockColumns;
  }>;

export type SplitTextMediaBlock = BlockBase &
  Readonly<{
    type: "split-text-media";
    heading?: string;
    body: readonly string[];
    media: ProjectMedia;
    mediaPosition: BlockMediaPosition;
  }>;

export type MetricsBlock = BlockBase &
  Readonly<{
    type: "metrics";
    heading?: string;
    columns?: BlockColumns;
    metrics: readonly Readonly<{
      label: string;
      value: string;
      context?: string;
      isPlaceholder?: boolean;
    }>[];
  }>;

export type QuoteBlock = BlockBase &
  Readonly<{
    type: "quote";
    quote: string;
    attribution: Readonly<{
      name: string;
      role?: string;
    }>;
  }>;

export type ProcessBlock = BlockBase &
  Readonly<{
    type: "process";
    heading?: string;
    steps: readonly Readonly<{
      title: string;
      description: string;
      isPlaceholder?: boolean;
    }>[];
  }>;

export type NextProjectBlock = BlockBase &
  Readonly<{
    type: "next-project";
    projectSlug: string;
  }>;

export type CaseStudyBlock =
  | HeroBlock
  | IntroductionBlock
  | TextBlock
  | ImageBlock
  | VideoBlock
  | GalleryBlock
  | SplitTextMediaBlock
  | MetricsBlock
  | QuoteBlock
  | ProcessBlock
  | NextProjectBlock;

export type ProjectSeo = Readonly<{
  title: string;
  description: string;
  pathname: `/work/${string}`;
}>;

/** Project-specific facts shown in the persistent rail and mobile disclosure. */
export type CaseStudyInfo = Readonly<{
  timeline?: string;
  company?: string;
  team?: string;
  responsibilities?: readonly string[];
  tools?: readonly string[];
  platform?: string;
  projectType?: string;
  externalUrl?: string;
  externalLabel?: string;
}>;

export type StoryVisual =
  | Readonly<{
      type: "image";
      media: ImageMedia;
      fit?: "contain" | "cover";
      zoomable?: boolean;
    }>
  | Readonly<{
      type: "video";
      media: VideoMedia;
      fit?: "contain" | "cover";
      playback?: "controls" | "silent-loop";
    }>
  | Readonly<{
      type: "comparison";
      before: ImageMedia;
      after: ImageMedia;
      beforeLabel?: string;
      afterLabel?: string;
    }>
  | Readonly<{ type: "group"; images: readonly ImageMedia[]; fit?: "contain" | "cover" }>
  | Readonly<{
      type: "sequence";
      heading?: string;
      tone?: "dark" | "paper";
      layout?: "row" | "board" | "mosaic";
      items: readonly Readonly<{ label: string; media: ImageMedia }>[];
    }>
  | Readonly<{ type: "code"; code: string; language?: string; label?: string }>;

export type CaseStudyStory = Readonly<{
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  visual?: StoryVisual;
  caption?: string;
  supportingPoints?: readonly string[];
  metric?: Readonly<{ value: string; label: string }>;
  quote?: Readonly<{ text: string; attribution?: string }>;
  decision?: string;
  constraint?: string;
  outcome?: string;
  supportingVideo?: Readonly<{ media: VideoMedia; label: string }>;
  durationSeconds?: number;
}>;

export type CaseStudyStage = Readonly<{
  id: string;
  label: string;
  stories: readonly CaseStudyStory[];
}>;

export type Project = Readonly<{
  slug: string;
  title: string;
  order: number;
  year: number;
  category: string;
  role: readonly string[];
  featured: boolean;
  enabled: boolean;
  contentStatus: ProjectContentStatus;
  placeholderFields: readonly string[];
  homepageImage: ImageMedia;
  shortDescription: string;
  accentColor: `#${string}`;
  seo: ProjectSeo;
  caseStudy: Readonly<{
    /** New projects can author stages directly; legacy block records are adapted. */
    stages?: readonly CaseStudyStage[];
    blocks?: readonly CaseStudyBlock[];
    info?: CaseStudyInfo;
  }>;
  nextProjectSlug: string;
}>;
