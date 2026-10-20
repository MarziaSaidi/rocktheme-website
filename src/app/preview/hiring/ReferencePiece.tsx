"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import styles from "./page.module.css";

type Point = { x: number; y: number };
type Bounds = { maxX: number; maxY: number };
type Sample = Point & { t: number };
type Drag = { pointerId: number; start: Point; grab: Point; moved: boolean; samples: Sample[] };

function bounds(element: HTMLDivElement): Bounds | null {
  const parent = element.offsetParent as HTMLElement | null;
  return parent
    ? {
        maxX: Math.max(0, 100 - (element.offsetWidth / parent.clientWidth) * 100),
        maxY: Math.max(0, 100 - (element.offsetHeight / parent.clientHeight) * 100),
      }
    : null;
}
function clamp(point: Point, edge: Bounds): Point {
  return {
    x: Math.min(Math.max(point.x, 0), edge.maxX),
    y: Math.min(Math.max(point.y, 0), edge.maxY),
  };
}
function soften(point: Point, edge: Bounds, radius: number): Point {
  const axis = (value: number, max: number) => {
    if (value < 0) return (-radius * -value) / (-value + radius);
    if (value > max) return max + (radius * (value - max)) / (value - max + radius);
    return value;
  };
  return { x: axis(point.x, edge.maxX), y: axis(point.y, edge.maxY) };
}

export default function ReferencePiece({
  className = "",
  x,
  y,
  rotate,
  label,
  onSelect,
  dimmed,
  children,
  dragDisabled = false,
}: Readonly<{
  className?: string;
  x: number;
  y: number;
  rotate: number;
  label: string;
  onSelect?: () => void;
  dimmed?: boolean;
  children: ReactNode;
  dragDisabled?: boolean;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const position = useRef<Point>({ x, y });
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number | null>(null);
  const write = useCallback((point: Point) => {
    position.current = point;
    if (ref.current) {
      ref.current.style.left = `${point.x}%`;
      ref.current.style.top = `${point.y}%`;
    }
  }, []);
  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (ref.current) delete ref.current.dataset.coasting;
  }, []);
  const settle = useCallback(() => {
    const edge = ref.current && bounds(ref.current);
    if (edge) write(clamp(position.current, edge));
  }, [write]);
  const coast = useCallback(
    (velocity: Point) => {
      stop();
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        Math.hypot(velocity.x, velocity.y) < 0.02
      ) {
        settle();
        return;
      }
      if (ref.current) ref.current.dataset.coasting = "true";
      const tick = () => {
        const edge = ref.current && bounds(ref.current);
        if (!edge) {
          stop();
          return;
        }
        velocity.x *= 0.86;
        velocity.y *= 0.86;
        const target = { x: position.current.x + velocity.x, y: position.current.y + velocity.y };
        const next = soften(target, edge, 4.05);
        if (next.x !== target.x) velocity.x *= 0.55;
        if (next.y !== target.y) velocity.y *= 0.55;
        write(next);
        if (Math.hypot(velocity.x, velocity.y) < 0.02) {
          settle();
          stop();
        } else frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [settle, stop, write],
  );

  useEffect(() => {
    stop();
    drag.current = null;
    if (ref.current) delete ref.current.dataset.dragging;
    write({ x, y });
    return stop;
  }, [x, y, stop, write]);

  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) {
      settle();
      return;
    }
    if (!active.moved && onSelect) {
      settle();
      onSelect();
      return;
    }
    if (dragDisabled) return;
    let velocity = { x: 0, y: 0 };
    const samples = active.samples;
    if (samples.length >= 2) {
      const last = samples[samples.length - 1]!;
      let first = samples[0]!;
      for (let i = samples.length - 2; i >= 0; i--) {
        first = samples[i]!;
        if (last.t - first.t >= 32) break;
      }
      const elapsed = Math.max(last.t - first.t, 1);
      velocity = { x: ((last.x - first.x) / elapsed) * 11, y: ((last.y - first.y) / elapsed) * 11 };
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed > 1.35)
        velocity = { x: (velocity.x * 1.35) / speed, y: (velocity.y * 1.35) / speed };
    }
    coast(velocity);
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={label}
      className={`${styles.piece} ${className}`}
      data-dimmed={dimmed || undefined}
      data-drag-disabled={dragDisabled || undefined}
      style={{ left: `${x}%`, top: `${y}%`, "--rotation": `${rotate}deg` } as CSSProperties}
      onPointerDown={(event) => {
        if (event.button !== 0 || drag.current) return;
        const parent = event.currentTarget.offsetParent;
        if (!parent) return;
        event.preventDefault();
        stop();
        const rect = parent.getBoundingClientRect();
        drag.current = {
          pointerId: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
          grab: {
            x: ((event.clientX - rect.left) / rect.width) * 100 - position.current.x,
            y: ((event.clientY - rect.top) / rect.height) * 100 - position.current.y,
          },
          moved: false,
          samples: [{ ...position.current, t: performance.now() }],
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.style.zIndex = "20";
        if (!dragDisabled) event.currentTarget.dataset.dragging = "true";
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - active.start.x, event.clientY - active.start.y) > 6)
          active.moved = true;
        if (dragDisabled) return;
        const parent = event.currentTarget.offsetParent;
        const edge = bounds(event.currentTarget);
        if (!parent || !edge) return;
        const rect = parent.getBoundingClientRect();
        const next = soften(
          {
            x: ((event.clientX - rect.left) / rect.width) * 100 - active.grab.x,
            y: ((event.clientY - rect.top) / rect.height) * 100 - active.grab.y,
          },
          edge,
          9,
        );
        write(next);
        active.samples.push({ ...next, t: performance.now() });
        if (active.samples.length > 6) active.samples.shift();
      }}
      onPointerUp={(event) => finish(event)}
      onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => {
        if (drag.current?.pointerId === event.pointerId) finish(event, true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          stop();
          onSelect?.();
          return;
        }
        if (dragDisabled) return;
        const amount = event.shiftKey ? 4 : 1.5;
        const next = { ...position.current };
        if (event.key === "ArrowLeft") next.x -= amount;
        else if (event.key === "ArrowRight") next.x += amount;
        else if (event.key === "ArrowUp") next.y -= amount;
        else if (event.key === "ArrowDown") next.y += amount;
        else return;
        event.preventDefault();
        stop();
        const edge = bounds(event.currentTarget);
        if (edge) write(clamp(next, edge));
      }}
    >
      {children}
    </div>
  );
}
