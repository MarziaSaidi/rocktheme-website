/**
 * The viewport height the page is laid out in, steady while a phone's browser
 * bars slide in and out.
 *
 * `innerHeight` grows and shrinks with the bars as the visitor scrolls. Every
 * scroll-driven measurement (the work runway, the camera's rests, the scroll
 * stops) is in `svh`, so it has to be read against the same small viewport or
 * the camera jumps each time the bars move. Desktop has no bars: both agree.
 */
let probe: HTMLElement | null = null;

export function stableViewportHeight(): number {
  if (typeof document === "undefined") return 0;
  if (!probe || !probe.isConnected) {
    probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
  }
  // Without svh support the probe has no height: the live viewport stands in.
  return probe.getBoundingClientRect().height || window.innerHeight;
}
