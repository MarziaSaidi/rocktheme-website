"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import type { CabinWorld } from "@/cabin/world";

import styles from "./CabinStick.module.css";

/** How far the knob travels from the middle, in SVG units (1 unit = 1 px on desktop). */
const REACH = 40;
const RING = 66;
/** The SVG's width in its own units, for turning screen pixels into them. */
const VIEW = 176;
const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Bezel ticks every 5°: long at the cardinals, medium every 30°. */
const TICKS = Array.from({ length: 72 }, (_, index) => {
  const degrees = index * 5;
  const kind = degrees % 90 === 0 ? "major" : degrees % 30 === 0 ? "mid" : "minor";
  const angle = (degrees * Math.PI) / 180;
  const outer = kind === "major" ? 82 : kind === "mid" ? 79 : 77;
  return {
    key: degrees,
    kind,
    x1: Math.sin(angle) * 74,
    y1: -Math.cos(angle) * 74,
    x2: Math.sin(angle) * outer,
    y2: -Math.cos(angle) * outer,
  };
});

const LETTERS = (["N", "E", "S", "W"] as const).map((letter, index) => ({
  letter,
  x: Math.sin((index * Math.PI) / 2) * 60,
  y: -Math.cos((index * Math.PI) / 2) * 60 + 3.5,
}));

/**
 * The navigation stick, in the bottom-right corner (under the right thumb on a phone): a compass bezel
 * that turns with the visitor's heading, a knob to push (up or down walks,
 * left or right turns, further is faster), a moonlit arc where it is pushed,
 * and a speed and heading readout. It sits beside the mouse, scroll and keys
 * rather than replacing them (or touch's drag to look and tap to walk);
 * keyboard users already walk with W A S D.
 */
export function CabinStick({ world }: { world: () => CabinWorld | null }) {
  const svg = useRef<SVGSVGElement>(null);
  const bezel = useRef<SVGGElement>(null);
  const knob = useRef<SVGGElement>(null);
  const beam = useRef<SVGLineElement>(null);
  const arc = useRef<SVGPathElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  const heading = useRef<HTMLSpanElement>(null);
  const cardinal = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const knobAt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let frame = 0;
    let shownSpeed = "";
    let shownHeading = "";
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const at = knobAt.current;
      // Let go, the knob springs home.
      if (!drag.current && (at.x !== 0 || at.y !== 0)) {
        at.x *= 0.72;
        at.y *= 0.72;
        if (Math.hypot(at.x, at.y) < 0.3) at.x = at.y = 0;
      }
      knob.current?.setAttribute("transform", `translate(${at.x} ${at.y})`);
      const push = Math.min(1, Math.hypot(at.x, at.y) / REACH);
      beam.current?.setAttribute("x2", String(at.x));
      beam.current?.setAttribute("y2", String(at.y));
      beam.current?.setAttribute("opacity", push > 0.1 ? "0.9" : "0");
      if (arc.current) {
        if (push > 0.1) {
          const angle = Math.atan2(at.x, -at.y);
          const spread = 0.35 + push * 0.5;
          const [a, b] = [angle - spread, angle + spread];
          arc.current.setAttribute(
            "d",
            `M${Math.sin(a) * RING} ${-Math.cos(a) * RING} A${RING} ${RING} 0 0 1 ${Math.sin(b) * RING} ${-Math.cos(b) * RING}`,
          );
          arc.current.setAttribute("opacity", String(0.5 + push * 0.5));
        } else {
          arc.current.setAttribute("opacity", "0");
        }
      }

      const pose = world()?.pose();
      if (!pose) return;
      bezel.current?.setAttribute("transform", `rotate(${-pose.heading})`);
      const nextSpeed = pose.speed.toFixed(1);
      if (nextSpeed !== shownSpeed && speed.current) {
        shownSpeed = nextSpeed;
        speed.current.textContent = nextSpeed;
      }
      const degrees = Math.round(pose.heading) % 360;
      const nextHeading = String(degrees).padStart(3, "0");
      if (nextHeading !== shownHeading && heading.current && cardinal.current) {
        shownHeading = nextHeading;
        heading.current.textContent = nextHeading;
        cardinal.current.textContent = CARDINALS[Math.round(degrees / 45) % 8]!;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      world()?.stick(0, 0);
    };
  }, [world]);

  const aim = (event: ReactPointerEvent) => {
    const bounds = svg.current!.getBoundingClientRect();
    // The dial is smaller on phones; work in the SVG's own units either way.
    const unit = VIEW / bounds.width;
    let x = (event.clientX - (bounds.left + bounds.width / 2)) * unit;
    let y = (event.clientY - (bounds.top + bounds.height / 2)) * unit;
    const distance = Math.hypot(x, y);
    if (distance > REACH) {
      x *= REACH / distance;
      y *= REACH / distance;
    }
    knobAt.current = { x, y };
    world()?.stick(x / REACH, -y / REACH);
  };

  const release = (event: ReactPointerEvent) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    delete root.current?.dataset.active;
    world()?.stick(0, 0);
  };

  return (
    <div ref={root} className={styles.stick} aria-hidden="true">
      <div className={styles.readout}>
        <span>
          <span className={styles.label}>SPD</span> <span ref={speed}>0.0</span> m/s
        </span>
        <span>
          <span className={styles.label}>HDG</span> <span ref={heading}>000</span>°{" "}
          <span ref={cardinal}>N</span>
        </span>
      </div>
      <div className={styles.dial}>
        <div className={styles.glass} />
        <svg
          ref={svg}
          className={styles.svg}
          viewBox="-88 -88 176 176"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            svg.current!.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            root.current!.dataset.active = "true";
            aim(event);
          }}
          onPointerMove={(event) => {
            if (drag.current?.id === event.pointerId) aim(event);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
        >
          <g ref={bezel}>
            {TICKS.map((tick) => (
              <line
                key={tick.key}
                className={styles[tick.kind]}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
              />
            ))}
            {LETTERS.map(({ letter, x, y }) => (
              <text
                key={letter}
                className={letter === "N" ? styles.north : styles.letter}
                x={x}
                y={y}
                textAnchor="middle"
              >
                {letter}
              </text>
            ))}
          </g>
          <circle className={styles.ring} r={RING} />
          <circle className={styles.reach} r={44} />
          <path ref={arc} className={styles.arc} opacity="0" />
          <line ref={beam} className={styles.beam} x1="0" y1="0" x2="0" y2="0" opacity="0" />
          <line className={styles.cross} x1="-4" y1="0" x2="4" y2="0" />
          <line className={styles.cross} x1="0" y1="-4" x2="0" y2="4" />
          <g ref={knob} className={styles.knob}>
            <circle className={styles.knobRing} r="15" />
            <circle className={styles.knobDot} r="3" />
          </g>
        </svg>
      </div>
    </div>
  );
}
