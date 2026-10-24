"use client";

import { useEffect, useRef, useState } from "react";

import type { LogoDustScene, Wordmark } from "./logoDustScene";
import styles from "./WorkIndex.module.css";

type LogoDustProps = Readonly<{
  marks: readonly (Wordmark | null)[];
  current: number;
  className?: string;
}>;

/**
 * The Work index's wordmarks in particles (logoDustScene.ts). Without WebGL the
 * shown wordmark is the image itself, in the same place.
 */
export function LogoDust({ marks, current, className }: LogoDustProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<LogoDustScene | null>(null);
  const currentRef = useRef(current);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      sceneRef.current?.pointer(event.clientX, event.clientY, true);
    };
    const onLeave = () => sceneRef.current?.pointer(0, 0, false);
    const onVisibility = () => sceneRef.current?.setRunning(!document.hidden);

    void (async () => {
      const { createLogoDust } = await import("./logoDustScene");
      if (disposed) return;
      const scene = await createLogoDust(canvas, marks, reducedMotion);
      if (disposed) {
        scene?.destroy();
        return;
      }
      if (!scene) {
        setFailed(true);
        return;
      }
      sceneRef.current = scene;
      scene.show(currentRef.current, true);
      scene.resize(canvas.clientWidth, canvas.clientHeight);
      void scene.intro();
      resizeObserver = new ResizeObserver(([entry]) => {
        if (entry) scene.resize(entry.contentRect.width, entry.contentRect.height);
      });
      resizeObserver.observe(canvas);
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      document.addEventListener("visibilitychange", onVisibility);
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [marks]);

  useEffect(() => {
    currentRef.current = current;
    sceneRef.current?.show(current);
  }, [current]);

  const mark = marks[current];
  if (failed) {
    return mark ? (
      // eslint-disable-next-line @next/next/no-img-element -- a light mask, drawn at its own size
      <img className={styles.markImage} src={mark.src} alt="" width={mark.width} />
    ) : null;
  }
  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
