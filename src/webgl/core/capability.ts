/**
 * WebGL capability detection.
 *
 * Runs before any renderer is constructed so an unsupported or blocked context
 * never throws into React. When this returns `null`, the CSS environment layer
 * stays on screen and the page is complete without the scene.
 */
export type SceneCapability = Readonly<{
  webgl2: boolean;
  maxTextureSize: number;
  /** Logical cores, where the browser exposes them. */
  cores: number;
  /** Device memory in GB, where the browser exposes it. */
  memory: number;
  devicePixelRatio: number;
}>;

export function detectCapability(): SceneCapability | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const probe = document.createElement("canvas");
  const context =
    probe.getContext("webgl2") ??
    probe.getContext("webgl") ??
    probe.getContext("experimental-webgl");

  if (!context || !(context instanceof WebGLRenderingContext || "drawArrays" in context)) {
    return null;
  }

  const gl = context as WebGLRenderingContext;
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const webgl2 =
    typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;

  // Release the probe immediately; the real renderer creates its own context.
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  const navigatorWithHints = navigator as Navigator & {
    hardwareConcurrency?: number;
    deviceMemory?: number;
  };

  return {
    webgl2,
    maxTextureSize,
    cores: navigatorWithHints.hardwareConcurrency ?? 4,
    memory: navigatorWithHints.deviceMemory ?? 4,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}
