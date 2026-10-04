/**
 * The bridge between the homepage and /my-world.
 *
 * The two worlds run in different renderers on different pages, so the
 * homepage cannot show the cabin live. Instead it shows a capture of the
 * real cabin world, taken from the exact place the visitor arrives at: the
 * start of the arrival, a little back and above the arrival point. The
 * rift on the homepage shows it through the mountain's opening, at exactly
 * the cabin camera's framing, so when the camera has gone through the
 * capture already fills the screen. The page lays the same picture over the
 * route change, and /my-world brings its live canvas up over it from the
 * same view, so the whole thing reads as one camera move.
 *
 * Kept free of three.js so both pages can read it cheaply.
 */

/** Captured by `npm run capture:my-world` from /my-world?capture=arrival (dev only). */
export const WORLD_CAPTURE = {
  src: "/assets/cabin/sky/my-world-capture.webp",
  /** Width over height. */
  aspect: 2,
  /** Vertical field of view of the capture, degrees: wider than any screen sees. */
  fov: 90,
} as const;

/**
 * Where the arrival starts and settles from: offsets from the arrival
 * point (metres back and up; how far down it looks, radians), and how long
 * it takes. The capture is taken from this pose. It sits behind the arrival
 * point because the homepage camera was moving forward through the rift.
 */
export const ARRIVAL = { back: 1.6, rise: 0.7, pitch: 0.08, seconds: 2.6 } as const;

/**
 * Where the visitor stands on coming through the rift: by the fire pit off
 * the cabin's deck, looking out past the firs. The capture
 * the rift shows is taken from here (offset by ARRIVAL), so the view through
 * the crack is the place the visitor lands.
 */
export const RIFT_ARRIVAL = {
  position: [-5.56, 0, 24.6] as const,
  lookAt: [13.44, 4.6, 11.4] as const,
};

/** The cabin camera's vertical field of view for a screen shape. */
export function cabinFov(aspect: number) {
  return aspect < 0.8 ? 70 : 56;
}

/**
 * After the camera has gone through, the picture keeps drifting forward a
 * little, as the camera was moving, until the live world takes over. Both
 * pages compute it from the same moment, so it carries on across the route
 * change.
 */
const DRIFT = { zoom: 0.04, ms: 1600 } as const;

export function bridgeZoom(sinceHandoffMs: number) {
  const t = Math.min(1, Math.max(0, sinceHandoffMs / DRIFT.ms));
  return 1 + DRIFT.zoom * (1 - Math.pow(1 - t, 3));
}

/**
 * The capture's size on a screen, in CSS pixels, so that it shows exactly
 * what the cabin camera sees from the same pose (before any drift).
 */
export function bridgeSize(width: number, height: number) {
  const half = (deg: number) => Math.tan((deg * Math.PI) / 360);
  const imageHeight =
    (height * half(WORLD_CAPTURE.fov)) / half(cabinFov(width / Math.max(1, height)));
  return { width: imageHeight * WORLD_CAPTURE.aspect, height: imageHeight };
}

let prefetched = false;

/**
 * Warms the browser's cache with the cabin's heavier files once the visitor
 * has found the way in, so the live world is ready sooner after the crossing.
 */
export function prefetchCabin() {
  if (prefetched || typeof document === "undefined") return;
  prefetched = true;
  const hint = (href: string) => {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    document.head.appendChild(link);
  };
  hint("/assets/cabin/sky/lighting.hdr");
  hint("/assets/cabin/sky/backdrop.webp");
  void fetch("/assets/cabin/manifest.json")
    .then((response) => response.json() as Promise<{ props?: Record<string, { file: string }> }>)
    .then((manifest) => {
      Object.values(manifest.props ?? {}).forEach((prop) => hint(`/assets/cabin/${prop.file}`));
    })
    .catch(() => {
      // Only a head start; the world loads them itself regardless.
    });
}
