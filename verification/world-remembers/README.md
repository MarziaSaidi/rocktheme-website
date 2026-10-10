# The World Remembers — About prototype

Branch: `codex/world-remembers-about`. This is a local visual-review prototype. Nothing was merged, pushed, or deployed.

The existing mountain-crack plume, glitter and motes remain intact. The existing bio-to-water particle pool, falling motion, trails, selected splashes, impact rings, depth testing and reflection exclusions remain intact. Mountain assets, portal lighting/materials, water appearance and camera poses were not changed.

The About section now uses the supplied copy verbatim (with editorial line breaks), three distinct compositions, locally hosted Source Serif 4 display type and the existing Manrope reading type. Supporting copy no longer depends on scroll-based word lighting. Full HTML arrives in 300ms, or 120ms during rapid transitions. A sparse 240ms glyph sketch hints at the words in the HTML layer; the outgoing glyph samples still enter the existing world-space falling simulation. Only desktop hovering at the About rest adds a restrained local air current; gravity is unchanged.

All text remains selectable HTML. Reduced motion and short viewports use normal document flow with all three passages visible. Fast forward/reverse scrolling cancels pending transitions and suppresses unnecessary intermediate emissions. Released world grains continue independently and finish in the water.

## Recordings

- `desktop.mp4`: normal-speed desktop journey, 1440×900.
- `mobile.mp4`: normal-speed mobile viewport journey, 390×844, DPR 2.
- `water-detail.mp4`: a normal-speed enlarged crop from the desktop recording; the approved camera was not moved.

Approximate sequence in the full recordings: opening/crack effect and first statement (0–4s), richer falling particles and Moment 2 (4–12s), personal introduction and remaining water contacts (12–23s), departure and natural tail (23–32s). There are deliberate scroll pauses between transitions. No playback-speed changes were applied.

## Performance

Measured independently from recording, with local `next dev`, headless Chrome 155 on this Mac. Mobile is viewport/DPR emulation, not a physical phone. Each run sampled approximately 7 seconds spanning a real first-to-second transition. Scene CPU timing covers world update/render submission, not GPU completion. Draw calls cover the full Three.js frame including its reflection pass.

| Viewport | Peak falling grains | Frame interval p50 / p95 | Scene CPU p50 / p95 | Peak WebGL draw calls |
|---|---:|---:|---:|---:|
| Desktop 1440×900, DPR 1 | 1,742 | 16.7 / 16.7ms | 3.9 / 5.3ms | 111 |
| Mobile 390×844, DPR 2 | 849 | 16.7 / 16.7ms | 2.8 / 3.5ms | 64 |

The falling pool has a 3,000-slot allocation and live quality budgets of 2,400 / 1,200 / 450. Glyph sampling targets 1,700 desktop or 850 compact grains, with sampling variance; these are initial visual budgets. Brief recognition sketches target 220 desktop / 110 mobile points and are drawn in 2D, not included in the falling-pool count. The preserved crack system separately allocates 460 wisps + 320 glitter + 260 motes on desktop, or 180 + 110 + 90 compact, plus its existing mist, shafts and ribbons. Both performance runs remained at high quality with 512px reflections.

`performance.json` contains raw summary fields, readable-copy checks, fast-scroll checks, departure completion, reduced-motion results and the short-screen fallback. Both departures drained to zero falling grains and zero active water impacts. `responsive.json` adds tablet/small-desktop/small-phone layout checks. Earlier `layout-check.json` is preliminary audit evidence; final screenshots use the local font.

## Validation

Production build, TypeScript, content validation, changed-file lint and formatting passed. Six particle/water tests plus ten existing scroll tests passed. Browser checks verified full title/copy opacity at 350ms, no horizontal overflow, no stale passage after fast direction changes, and natural particle completion. Reduced-motion and short-screen checks preserve all three passages as visible HTML.

Repository-wide lint still reports existing CommonJS/import errors in unrelated screenshot harnesses and older capture scripts. These were not changed as part of this About-only task. Physical-phone performance remains unverified.

## Reproduce

Run `npm run dev`, then `node verification/world-remembers/verify.cjs`. The local harness uses the existing machine's Playwright CLI installation and records WebM files; MP4 exports preserve normal speed. No runtime dependency was added to the application.

The 76KB font is sourced from [Adobe's Source Serif repository](https://github.com/adobe-fonts/source-serif), with the original SIL Open Font License included beside the font asset.
