export type GuideRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type GuidePhase = "idle" | "traveling";
let rect: GuideRect | null = null;
let engaged = false,
  greeting = 0;
let phase: GuidePhase = "idle";
const rectangles = new Set<(value: GuideRect | null) => void>();
const phases = new Set<(value: GuidePhase) => void>();
export function publishGuideRect(next: GuideRect | null) {
  if (
    rect &&
    next &&
    Object.keys(next).every(
      (key) => Math.abs(rect![key as keyof GuideRect] - next[key as keyof GuideRect]) < 0.5,
    )
  )
    return;
  if (!rect && !next) return;
  rect = next;
  rectangles.forEach((listener) => listener(next));
}
export function subscribeGuideRect(listener: (value: GuideRect | null) => void) {
  rectangles.add(listener);
  listener(rect);
  return () => {
    rectangles.delete(listener);
  };
}
export function engageGuide(value: boolean) {
  if (value && !engaged) greeting++;
  engaged = value;
}
export function readGuideInput() {
  return { engaged, greeting };
}
export function publishGuidePhase(value: GuidePhase) {
  phase = value;
  phases.forEach((listener) => listener(value));
}
export function subscribeGuidePhase(listener: (value: GuidePhase) => void) {
  phases.add(listener);
  listener(phase);
  return () => {
    phases.delete(listener);
  };
}
export function beginGuidedJourney() {
  window.dispatchEvent(new Event("portfolio:guided-work"));
}
export function skipGuidedJourney() {
  window.dispatchEvent(new Event("portfolio:skip-guided-work"));
}
