/** One owner for a gallery visit; native scroll never selects its next project. */
export class ProjectStepper {
  station: number | null = null;
  transition: { from: number; to: number; direction: number } | null = null;
  private readySince: number | null = null;
  private lastInput = -Infinity;

  constructor(
    private readonly count: number,
    private readonly readMs: number,
    private readonly quietMs = 220,
  ) {}

  enter(station: number, now: number) {
    this.station = station;
    this.transition = null;
    this.readySince = null;
    this.lastInput = now;
  }

  ready(ready: boolean, now: number) {
    if (!ready || this.transition) this.readySince = null;
    else if (this.readySince === null) this.readySince = now;
  }

  input(direction: number, now: number): "native" | "hold" | "swap" | "exit" {
    const quiet = now - this.lastInput >= this.quietMs;
    this.lastInput = now;
    if (this.station === null) return "native";
    if (
      this.transition ||
      !quiet ||
      this.readySince === null ||
      now - this.readySince < this.readMs
    )
      return "hold";
    const next = this.station + direction;
    if (next < 0 || next >= this.count) {
      this.leave();
      return "exit";
    }
    this.transition = { from: this.station, to: next, direction };
    this.readySince = null;
    return "swap";
  }

  complete() {
    if (!this.transition) return;
    this.station = this.transition.to;
    this.transition = null;
    this.readySince = null;
  }

  leave() {
    this.station = null;
    this.transition = null;
    this.readySince = null;
  }
}
