/** One owner for a gallery visit; native scroll never selects its next project. */
export class ProjectStepper {
  station: number | null = null;
  transition: { from: number; to: number; direction: number } | null = null;
  private availableAt = Infinity;
  private pendingDirection: number | null = null;

  constructor(
    private readonly count: number,
    private readonly displayMs: number,
  ) {}

  enter(station: number, now: number) {
    this.station = station;
    this.transition = null;
    this.pendingDirection = null;
    this.availableAt = now + this.displayMs;
  }

  input(direction: number, now: number): "native" | "hold" | "swap" | "exit" {
    if (this.station === null) return "native";
    // The remainder of a fling cannot queue another step during the swap.
    if (this.transition) return "hold";
    this.pendingDirection = direction;
    return this.advance(now);
  }

  advance(now: number): "native" | "hold" | "swap" | "exit" {
    if (this.station === null) return "native";
    if (this.transition || this.pendingDirection === null || now < this.availableAt) return "hold";
    const direction = this.pendingDirection;
    this.pendingDirection = null;
    const next = this.station + direction;
    if (next < 0 || next >= this.count) {
      this.leave();
      return "exit";
    }
    this.transition = { from: this.station, to: next, direction };
    // Count the incoming project's time on screen from the swap's start,
    // rather than adding a second full wait after the animation and camera.
    this.availableAt = now + this.displayMs;
    return "swap";
  }

  pendingDelay(now: number): number | null {
    if (this.transition || this.pendingDirection === null) return null;
    return Math.max(0, this.availableAt - now);
  }

  complete() {
    if (!this.transition) return;
    this.station = this.transition.to;
    this.transition = null;
  }

  leave() {
    this.station = null;
    this.transition = null;
    this.pendingDirection = null;
    this.availableAt = Infinity;
  }
}
