import { getSoundState } from "./soundStore";

/** Opt-in development telemetry; no controls or listeners in the production UI. */
export function thunderAudit(stage: string, detail: Record<string, unknown> = {}) {
  if (
    process.env.NODE_ENV === "production" ||
    typeof window === "undefined" ||
    !new URLSearchParams(window.location.search).has("weatherAudioAudit")
  )
    return;
  window.dispatchEvent(
    new CustomEvent("portfolio:thunder-audit", {
      detail: {
        stage,
        at: performance.now(),
        hidden: document.hidden,
        consent: getSoundState().enabled ? "on" : "off",
        muted: !getSoundState().enabled,
        ready: getSoundState().ready,
        ...detail,
      },
    }),
  );
}
