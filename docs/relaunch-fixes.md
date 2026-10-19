# Relaunch fixes on the frozen branch

Base: `16eeb3f` (`codex/world-remembers-about`). Production is a separate,
newer camera baseline, `9e8c2c2`. Do not deploy this branch over production as
an incidental way to ship these fixes. Production changes are supplied as
separate patches; this branch has not been deployed by this task.

## Delivery

- Bio/rift assets load during Selected Work, not on an idle hero timer.
- Footer geometry loads when About makes it the next chapter.
- Hover/focus no longer warms bulk cabin resources. That starts only at the crossing handoff; the existing rift preview is retained for the approved composition.
- A returning visitor does not mount/download the unused entrance renderer.
  Fresh visits retain the approved doorway and sound choices.
- Bio's GSAP implementation loads near its chapter. Its existing 360svh scroll
  space is reserved at initialization; camera stops are not shortened.
- Hero and terrain assets use meshopt, reduced geometry and WebP maps, with
  smaller variants on phones. Metallic/roughness maps already discarded by the
  runtime are removed from distant mountains. The rift's animated stones and
  their float `_CHUNK` geometry remain byte-identical.
- The hero's original bounding boxes and five-probe seat heights are preserved
  in generated asset metadata. Compression cannot change the robot's shader
  coordinate space or its seating. Seat metadata applies only to the exact
  original placement; a later intentional placement change falls back to the
  existing raycast. No camera or robot-animation constants were edited.

To regenerate from original prepared models rather than recompressing output:

```sh
mkdir -p /tmp/homepage-source
git archive 16eeb3f public/assets | tar -x -C /tmp/homepage-source
npm run prepare:homepage -- /tmp/homepage-source/public/assets
npm run validate:delivery
```

On the already-entered cold-browser path, before-scroll asset bodies were about
2.29 MB desktop and 1.30 MB phone layout; the exact final records are in
`/tmp/portfolio-fixes`. The full desktop asset set, including the rift preview
and opening outline, is approximately 5.75 MB gzip. These measurements exclude the separately locked entry doorway. The model-budget regression
check enforces 2.5 / 1.5 / 6 MB. These do not certify real iPhone performance.

**JavaScript remains over its approved budget.** The last measured production
bundle transferred about 431 KB gzip on an already-entered cold visit, down
from 516 KB. This is not a 350 KB pass; the 120 KB excluding three.js threshold
is not claimed either. Framework, renderer, loader and application costs must
remain in the accounting. No threshold was relaxed and no first-scroll code
was hidden from the measurement to manufacture a pass.

## Access and content

Work activated from the keyboard enters the existing Quill station and moves
focus to its case-study link without focus scrolling the camera. The existing
PageDown/ArrowDown project controller continues the journey. Keyboard-opened
case studies remember focus for their return. Direct Work hashes land at the
first or remembered project's details.

The six placeholder records remain in source but are disabled. Public lookups
and generated routes expose only Quill & Pigeon and Survue. Content validation
rejects enabled placeholder records. A short role/contribution summary is
visible before the media on phones, using the existing authored facts.
Survue explicitly limits the C# contribution to the settings section: theme,
sound toggle, user warnings and Help, as confirmed by Marzia. Other screens
remain described as design/prototype evidence. Story progress has a valid
named group role. Desktop information/story panels and scrollable artifact boards have explicit keyboard scroll targets; story-panel focus survives a story advance.

## Rendering and production stability

Adaptive quality now samples delivered frame intervals rather than CPU
submission time, so GPU-bound rendering can trigger the existing step-down.
Its existing tiers step down when a delivery window fails p95/p99, so intermittent dropped frames cannot hide behind a healthy average. Warmup counts active delivered time, excluding suspended-tab gaps. No particle
tier, camera path, motion timing or visual effect was added or retuned.

The same frame-delivery correction is prepared separately for production in
[patches/production-frame-delivery.md](patches/production-frame-delivery.md).
Production's separate robot-guide fix is in
[patches/production-guide-cls.md](patches/production-guide-cls.md). It passes
`git apply --check` on its own baseline and was built/tested in isolation.

## Verification and remaining limits

Run `npm run validate:delivery`, `npm run validate:scroll`,
`npm run validate:content`, `npm run typecheck`, and `npm run build`.
Changed-source ESLint and formatting checks pass. Repository-wide ESLint also
examines preexisting untracked screenshot harnesses that have unrelated errors.
The scene check's former quality downgrade failure is fixed; its four legacy
stone-count/station-count failures predate this work and remain open.

Evidence, before/after/diff images, browser logs, camera uniforms and traces:
`/tmp/portfolio-fixes`. Camera eye/view/projection uniforms match at the sampled
hero, Quill, Survue, bio and contact poses. Terrain pixels intentionally differ
with compression; do not describe the entire page as pixel-identical. Camera
and particle sources, MARZIA and cabin assets were not rewritten.

The audit's separately locked conflicts remain: compulsory entry versus the
3-second access target, the frozen scroll map versus the 8-second target, and
protected cabin assets versus its separate budget. No entry-policy exception,
new effects, camera retuning or cabin redesign was assumed. Real iPhone,
VoiceOver and the five-person hiring test still require external verification.

### Performance limits still open

The final delivered-frame trace pass includes the allocation fix in
`src/webgl/core/noise.ts`. Its equivalent gradient and reusable double-precision
scratch buffer preserve all 16,408 reference vectors bit-for-bit. A browser
microbenchmark of 200,000 calls reduced sampled allocations from 319.4 MB to
31.0 MB and execution time from 132.7 ms to 53.2 ms. This is an isolated
benchmark, not a whole-page allocation claim.

Across three repeats of each arrival/travel window, final A and B p99 readings
were all 16.8 ms. B passes its p95/p99 limits in these runs. A p95 spans
16.7–16.8 ms, so the literal 16.7 ms threshold is still not consistently met.
Individual travel stalls of up to 100 ms (A) and 133.3 ms (B) remain outside the
99th percentile; they are not hidden or described as eliminated. The earlier
B arrival p99 of 100 ms did not recur in this pass. Real-device certification
remains open. Raw traces are in `/tmp/portfolio-fixes/performance-noise`;
compact results are in `verification/relaunch-fixes/frame-delivery.json`.
An earlier lighting-allocation experiment did not improve the tail and was
removed. No protected particle implementation or noise trajectory was changed.

Spector measured peak main-context texture allocation of 79,416,348 bytes
at bio/contact, below the desktop 256 MB cap. This is not a whole-tab or real
phone GPU-memory certification.
