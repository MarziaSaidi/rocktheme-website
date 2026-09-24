/** Breakpoints shared by JavaScript that must make rendering decisions. */
export const SCENE_BREAKPOINTS = {
  mobileMax: 767,
  tabletMax: 1023,
} as const;

export type SceneViewport = "desktop" | "tablet" | "mobile";

export const sceneMediaQueries = {
  desktop: `(min-width: ${SCENE_BREAKPOINTS.tabletMax + 1}px)`,
  tablet: `(min-width: ${SCENE_BREAKPOINTS.mobileMax + 1}px) and (max-width: ${SCENE_BREAKPOINTS.tabletMax}px)`,
  mobile: `(max-width: ${SCENE_BREAKPOINTS.mobileMax}px)`,
} as const;

export function sceneViewportForWidth(width: number): SceneViewport {
  if (width <= SCENE_BREAKPOINTS.mobileMax) return "mobile";
  if (width <= SCENE_BREAKPOINTS.tabletMax) return "tablet";
  return "desktop";
}

export type ResponsiveOverrides<T> = Readonly<{
  desktop: T;
  tablet?: Partial<T>;
  mobile?: Partial<T>;
}>;

export function resolveResponsiveValue<T extends object>(
  value: ResponsiveOverrides<T>,
  viewport: SceneViewport,
): T {
  if (viewport === "desktop") return value.desktop;
  return { ...value.desktop, ...(value[viewport] ?? {}) };
}
