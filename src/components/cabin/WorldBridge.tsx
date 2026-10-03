"use client";

import { useEffect, useRef } from "react";

import { bridgeSize, bridgeZoom, WORLD_CAPTURE } from "@/cabin/worldCapture";

import styles from "./WorldBridge.module.css";

type WorldBridgeProps = Readonly<{
  /** When the homepage handed over (Date.now()), shared by both pages. */
  handoffAt: number;
  /** Stop drifting: the live world has taken over at this zoom. */
  frozen?: boolean;
  /** Fade out, once the live world is fully up over it. */
  leaving?: boolean;
}>;

/**
 * The picture that carries the way in across the route change.
 *
 * It is the capture of /my-world the rift shows, laid over the
 * whole screen at exactly the cabin camera's framing, so it lines up with
 * the homepage's last frame and with the live world's first frame here.
 * Until the live world is ready it keeps drifting forward, as the camera
 * was moving.
 */
export function WorldBridge({ handoffAt, frozen = false, leaving = false }: WorldBridgeProps) {
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const node = image.current;
    if (!node) return;
    let frame = 0;
    const place = () => {
      const size = bridgeSize(window.innerWidth, window.innerHeight);
      node.style.width = `${size.width}px`;
      node.style.height = `${size.height}px`;
      node.style.transform = `translate(-50%, -50%) scale(${bridgeZoom(Date.now() - handoffAt)})`;
    };
    const tick = () => {
      place();
      frame = requestAnimationFrame(tick);
    };
    if (frozen) place();
    else tick();
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
    };
  }, [handoffAt, frozen]);

  return (
    <div className={styles.bridge} data-leaving={leaving ? "true" : "false"} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- sized by hand to the cabin camera's framing */}
      <img ref={image} className={styles.image} src={WORLD_CAPTURE.src} alt="" decoding="sync" />
    </div>
  );
}
