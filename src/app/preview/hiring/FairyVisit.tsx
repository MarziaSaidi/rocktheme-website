"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import styles from "./FairyVisit.module.css";

type Flight = { x: number; y: number; startY: number; phase: "enter" | "stay" | "leave" };
export function FairyVisit({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const visit = () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !host.current) return;
    if (timer.current) clearTimeout(timer.current);
    const r = host.current.getBoundingClientRect();
    const target = {
      x: Math.min(innerWidth - 110, r.left + r.width * 0.66),
      y: Math.max(12, r.top - 70),
      startY: Math.max(50, r.top),
    };
    setFlight((previous) => ({ ...target, phase: previous ? "stay" : "enter" }));
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() =>
        setFlight((previous) => previous && { ...previous, phase: "stay" }),
      );
    });
  };
  const leave = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    setFlight((previous) => previous && { ...previous, phase: "leave" });
    timer.current = setTimeout(() => {
      setFlight(null);
      timer.current = null;
    }, 1400);
  }, []);
  useEffect(() => {
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      if (host.current?.contains(event.target as Node)) {
        touchStart.current = { x: event.clientX, y: event.clientY };
      } else {
        touchStart.current = null;
        if (flight && flight.phase !== "leave") leave();
      }
    };
    const up = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const start = touchStart.current;
      touchStart.current = null;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10) visit();
    };
    const cancel = () => {
      touchStart.current = null;
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
    };
  });
  useEffect(() => {
    if (flight?.phase !== "stay") return;
    const dismiss = () => leave();
    const mobile = matchMedia("(hover: none)").matches;
    const expiry = mobile ? setTimeout(dismiss, 8000) : undefined;
    window.addEventListener("scroll", dismiss, { passive: true, capture: true, once: true });
    window.addEventListener("resize", dismiss, { once: true });
    return () => {
      if (expiry) clearTimeout(expiry);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [flight?.phase, leave]);
  return (
    <div
      ref={host}
      onMouseEnter={() => {
        if (matchMedia("(hover: hover)").matches) visit();
      }}
      onMouseLeave={() => {
        if (matchMedia("(hover: hover)").matches) leave();
      }}
    >
      {children}
      {flight &&
        createPortal(
          <div
            aria-hidden="true"
            className={styles.layer}
            style={
              {
                "--end-x": `${flight.x}px`,
                "--end-y": `${flight.y}px`,
                "--start-y": `${flight.startY}px`,
              } as CSSProperties
            }
          >
            <div className={styles.flight} data-phase={flight.phase}>
              <Image
                className={styles.fairy}
                src="/preview/hiring/fairy.webp"
                alt=""
                width={110}
                height={118}
                unoptimized
              />
              <div className={styles.shower}>
                {Array.from({ length: 48 }, (_, i) => (
                  <span
                    key={i}
                    className={styles.sparkle}
                    style={
                      {
                        "--x": `${((i * 43) % 210) - 150}px`,
                        "--drift": `${((i * 17) % 70) - 35}px`,
                        "--delay": `${-(i * 0.137)}s`,
                        "--duration": `${1.1 + (i % 7) * 0.13}s`,
                        "--size": `${10 + (i % 4) * 4}px`,
                      } as CSSProperties
                    }
                  >
                    {i % 3 === 0 ? "✧" : "✦"}
                  </span>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
