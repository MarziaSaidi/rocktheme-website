/**
 * The bio's render passes: the link between the page and the scene.
 *
 * While "Sometimes it's a prototype / a product / an entire world" is on
 * screen, the rift is shown the way it was made: drawn (its edges as lines),
 * built (its surfaces as the computer reads them), then lit. A seam sweeps
 * between two passes, and the visitor can hover a word to see its pass.
 *
 * Page → scene: which pass sits each side of the seam, where the seam is,
 * whether it runs across or down, how still the world should hold before the
 * name, and whether to start preparing the passes.
 * Scene → page: what the annotations point at and count.
 */
export type RenderPass = "sketch" | "engine" | "light";

export type PassView = Readonly<{
  /** The pass before the seam (left, or top on a phone). */
  first: RenderPass;
  /** The pass after the seam. */
  second: RenderPass;
  /** The seam, 0 to 1 across (or down) the screen. */
  split: number;
  vertical: boolean;
}>;

const LIT: PassView = { first: "light", second: "light", split: 1, vertical: false };
let view: PassView = LIT;
let stillness = 0;
let prepare = false;

export function setPassView(next: PassView | null) {
  view = next ?? LIT;
}

/** 0 to 1: the world holds its breath (dims, its drifting particles stop) before the name. */
export function setStillness(next: number) {
  stillness = Math.min(1, Math.max(0, next));
}

/** The bio is near: build the passes a little each frame so the first sweep never stalls. */
export function preparePasses(next: boolean) {
  prepare = next;
}

export function readPassInput() {
  return { view, stillness, prepare };
}

export const isLit = (pass: PassView) => pass.first === "light" && pass.second === "light";

export type PassInfo = Readonly<{
  /** The passes are built and can be drawn. */
  ready: boolean;
  /** Screen points, in CSS pixels, the annotations lead to; null while off screen. */
  riftPeak: { x: number; y: number } | null;
  portal: { x: number; y: number } | null;
  riftPoints: number;
  triangles: number;
  drawCalls: number;
  camera: { x: number; y: number; z: number; fov: number };
  /** The water's own fragment shader, as the scene is running it. */
  waterShader: string;
}>;

let info: PassInfo | null = null;

export function publishPassInfo(next: PassInfo) {
  info = next;
}

/** Null until the scene has started (or when there is no WebGL at all). */
export function readPassInfo() {
  return info;
}
