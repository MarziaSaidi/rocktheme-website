> Superseded source direction: the corrected prototype now releases the bio’s own glyph particles into water. See [bio correction](bio-correction/README.md). The recordings and performance numbers below describe the earlier portal-source version.

# Phase 3 — Portal falling stars

Branch: `codex/portal-star-shower`. Local prototype only; no merge, push, or deployment.

The existing mountain GLBs, materials, placement, flowing portal light, camera journey, water base appearance, bio copy, CSS typography, and sound system are unchanged. The old text-directed particle renderer is replaced; the current HTML titles use their existing in-place reveal fallback.

## Recordings

- `desktop-story.mp4`: first emergence, gradual buildup, peak, resting shower, and natural exit. 1440 × 900, approximately 45 seconds.
- `mobile-story.mp4`: the same lifecycle at 390 × 844, approximately 44 seconds.
- `water-detail.mp4`: close inspection of falling light, selected splashes, rings, dissolving glow, and the tail after emission stops. Approximately 23 seconds. A development-only camera override and temporary capture-only text hiding make the water easier to inspect; they do not alter the portfolio camera or typography.

All clips play at normal speed. Capture is 25fps, independent of the browser animation cadence. Approximate story timeline: 0–5s first emergence/arrival; 5–19s buildup; 19–22s peak; 22–27s rest; 27–36s departure; 36–45s tail.

## Implementation

`portalRain.ts` owns fixed typed-array pools and a single instanced particle draw. Positions and velocities remain in world space after emission. Measured opening rows are sampled inside the triangular aperture and transformed using the existing mountain transform. Gravity, gentle air movement, variation in brightness/size, infrequent star glints, short drops, and fine trails provide variation without an independent animation loop.

The water's geometric surface is world y=0; existing waves are shading normals. Selected world-space impacts enter a separate 16-slot shader pool, disturb normals, create an expanding light ring, and fade into the existing water. Two very small ballistic splash beads reuse the particle pool. No dynamic lights or soundtrack are added. The rain mesh is excluded from planar reflections; the water shader supplies local received light directly, including when reflections are disabled.

Initial live budgets are 2,400 / 1,200 / 450 for high / medium / low. Compact layouts reduce emission and outward spread. These budgets are tunable ceilings rather than visual targets. Reduced motion retains the existing static scene and readable HTML with no dynamic shower. New births taper on exit while existing particles finish independently of the mountain's visibility.

## Verification

- Production build and TypeScript check pass.
- Four simulation/impact tests pass, including downward motion at rest, pool limits, world-space impacts, exit draining, and reduced motion.
- All ten existing scroll tests pass.
- Focused ESLint and formatting checks pass.
- Desktop/mobile browser checks: slow scroll, fast jumps, reverse scroll, re-entry, resize, resting state, complete exit drainage, and the low rain budget.
- No browser or shader errors in the captured sessions.
- The existing scene validator has five baseline failures: quality-manager warmup/downgrade test and four Selected Work count/station assertions. Running the validator with the original water module reproduces all five. They are outside this prototype's scope.

## Performance method

`performance.json` contains final samples without video capture or another browser test running. `behavior-checks.json` contains the earlier exit/reverse/re-entry/resize/reduced-motion checks. Mobile results are Chrome viewport/DPR emulation on the same Mac, not physical-phone GPU measurements.

`frameCpuMs` is CPU simulation and renderer submission time; it is not a GPU timer. `observedIntervalMs` measures actual requestAnimationFrame cadence. Draw calls include the existing reflection, main-world, and ambient-particle passes. Baseline disables new rain births and waits for all drops and impacts to expire, retaining the same scene and camera. The active prototype adds one draw call; shader impact rings add no draws.

Reproduce locally with the existing global Playwright installation and ffmpeg:

```sh
npm run dev -- --port 3000
node scripts/capture-portal-rain.cjs
node scripts/measure-portal-rain.cjs
node --import tsx --test scripts/check-portal-rain.ts
```

The diagnostic API is enabled only in development with `?rainDebug=1`; it is absent in production. The water close-up camera belongs exclusively to this diagnostic API.

## Final measured results

| Viewport | Peak live (mean / max) | Resting live (mean) | Frame cadence p50 / p95 | Total CPU mean / p95 | Rain simulation mean | Total draw calls (baseline → active) |
| --- | --- | --- | --- | --- | --- | --- |
| desktop 1440×900, DPR 1 | 1759 / 1809 | 499 | 16.7 / 16.8 ms | 4.43 / 5.10 ms | 0.20 ms | 110 → 111 |
| mobile 390×844, DPR 2 | 1093 / 1130 | 310 | 16.7 / 16.8 ms | 2.62 / 3.30 ms | 0.25 ms | 63 → 64 |

Both viewports held approximately 60fps cadence in the sampled windows. The full exit checks reached zero live particles and zero impact rings. Reduced motion emitted zero dynamic particles. Measurements describe this Mac/Chrome session; mobile viewport emulation does not establish physical-phone performance. CPU timing includes the complete existing scene, and changing atmospheric work can influence comparisons. It does not measure GPU execution time.
