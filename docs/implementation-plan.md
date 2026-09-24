# The Living Digital Landscape — implementation plan

Date: 2026-09-23

Status: planning only. No implementation is authorized by this document.

## Milestone 0 — lock references and baselines

Status: complete for the user-requested 1440 × 900, 1280 × 800, and 390 × 844 captures on 2026-09-23. The broader performance, reduced-motion, no-WebGL, keyboard-focus, and 768 × 1024 baselines remain release-gate work and were not added to this visual-only milestone.

Scope:

- Use the three canonical approved references under `docs/references/`.
- Capture the current local homepage at 390 × 844, 1280 × 800, and 1440 × 900 before visual changes.
- Record first-load transfer, LCP, CLS, INP, sustained frame cost, WebGL tier, and no-WebGL behavior on representative desktop and mobile devices.

Acceptance criteria:

- All three approved references exist at stable repository paths.
- Baselines include Hero, Selected Work, About, Footer, keyboard focus, reduced motion, and no-WebGL states.
- Performance numbers are recorded before visual tuning begins.

Validation:

- File/path inventory and image dimensions.
- Automated viewport screenshots plus manual comparison at each target width.
- Browser performance trace on one capable desktop and one mid-range mobile device.

## Milestone 1 — composition contract and data boundaries

Scope:

- Convert scene chapter configuration from one rock per chapter to typed arrays of distinct placements/assets.
- Keep project order, labels, routes, roles, years, and media sourced only from project records.
- Define section/chapter state and scene inputs without importing project facts into WebGL.

Acceptance criteria:

- Adding, removing, reordering, or replacing a featured project changes data only.
- Two projects and eight projects both produce a complete Selected Work sequence.
- No renderer branch checks a project slug.
- Scene configuration can place 2–3 distinct rock groups without duplicating one obvious model.

Validation:

- Run content and scene validators.
- Temporarily test 2-, 3-, and 8-project registries without committing fabricated content.
- Search for slug-specific component/CSS branches.

## Milestone 2 — asset and render-budget pass

Scope:

- Audit all GLB mesh/texture sizes and material channels.
- Produce or source distinct optimized silhouettes for Hero, Work, and Footer.
- Lazy-load the active and next chapter's assets instead of all chapter rocks at startup.
- Preserve the CSS fallback while Three.js and models load.

Acceptance criteria:

- Initial scene creation does not request every homepage rock.
- No single rock asset ships at the current 6.8–7.7 MiB scale without a documented measured reason.
- Asset transitions never reveal an empty or flashing background.
- Context loss restores the fallback and then the active chapter cleanly.

Validation:

- Network waterfall with cache disabled on desktop and mobile emulation.
- GLB inspection for geometry, texture dimensions, compression, and duplicate data.
- Visual capture before, during, and after chapter asset loading.
- WebGL context-loss and no-WebGL checks.

## Milestone 3 — Hero spatial match

Scope:

- Retune the Hero type scale, line breaks, vertical placement, and supporting-copy relationship.
- Compose distinct left and right rock groups with a restrained optional mid-distance fragment.
- Tune the waterline, horizon fog, beacons, and the particle path around the headline.

Acceptance criteria:

- At 1440 × 900 and 1280 × 800, the headline has the approved monumental weight and the landscape frames both lower edges.
- Rocks are materially dark, wet, asymmetrical, and clearly different in silhouette.
- The particle current is continuous and narrow with a readable bend; the result is not achieved by increasing particle density.
- Water, lights, rocks, and text read as one scene at first settled frame.
- At 390px and 320px, the title retains authority and no header/content text clips.

Validation:

- Overlay/difference review against `docs/references/homepage-hero-natural-flow-v3.png` at matched aspect ratio.
- Settled, pointer-left, pointer-center, pointer-right, reduced-motion, and no-WebGL captures.
- Manual cursor path test through typography, particles, rocks, and lower water region.

## Milestone 4 — material behavior and interaction

Scope:

- Refine water grain, planar reflection, shallow drift, source-aligned beacon reflections, and local ripples.
- Refine low horizon haze so it reads as atmosphere rather than vertical neon bars.
- Tune particle awareness/orbit/contact behavior, obstacle flow, rock division, project-edge gathering, and repair timing.
- Add a discoverable pause/static control for continuous decorative motion while preserving the sound control separately.

Acceptance criteria:

- Water never resembles an ocean or a mirror; reflections remain soft and vertically broken.
- Purple light is restrained and stays near the horizon.
- Pointer interaction is precise, interruptible, and local; the cursor dot remains exact.
- Particles visibly route around obstacles and return to one stream after interaction.
- Paused and reduced-motion modes stop continuous decorative animation without hiding content.

Validation:

- Motion recordings at normal and low quality tiers.
- Pointer-path test at slow, fast, and stationary speeds.
- Reduced-motion and explicit-pause checks after reload and section navigation.
- Sustained frame-time test with reflection enabled and disabled.

## Milestone 5 — Selected Work as landscape

Scope:

- Remove the large dead band at section entry and establish the heading immediately.
- Recompose project planes, terrain, water contact, labels, and active/near/distant states as one spatial sequence.
- Retain native scrolling/focus fallbacks and the linear mobile layout.

Acceptance criteria:

- The section entry matches the approved upper-left heading hierarchy.
- The active project is readable without neighbors disappearing; screenshots feel situated, not card-like.
- Every plane remains a real link with project title, role, category, year, and image alt text from data.
- Tab focus activates/reveals the matching project without being covered by the fixed header.
- Mobile exposes every project in document order with no drag-only action and no horizontal page overflow.

Validation:

- Keyboard-only pass: Skip Link, header, corridor projects, About, Footer, Back to Top.
- Trackpad, wheel, touch, Page Down, Shift+Tab, and direct-anchor checks.
- Test 2-, 3-, and 8-project data sets.
- Screenshot comparison with the approved Selected Work reference at desktop and with the mobile baseline.

## Milestone 6 — About narrative and chapter pacing

Scope:

- Get copy approval for a fuller account of how design, code, AI, prototyping, and shipping connect.
- Give About a distinct calm composition and sufficient vertical duration on desktop and mobile.

Acceptance criteria:

- About reads as a complete narrative chapter, not a heading followed immediately by Contact.
- Copy remains centralized in site content and selectable semantic text.
- Motion accents never carry meaning unavailable in the text.
- Mobile shows a clear chapter boundary before the Footer.

Validation:

- Editorial review for accuracy and first-person voice.
- 320px, 390px, tablet, and desktop captures.
- JavaScript-disabled and reduced-motion reading-order checks.

## Milestone 7 — Footer culmination

Scope:

- Restore the approved monumental headline scale and particle arc.
- Integrate the conversation plane and a distinct end rock with believable water contact/reflection.
- Keep contact/social URLs, Back to Top, and sound controls unchanged.

Acceptance criteria:

- Desktop composition clearly matches the approved left headline/right end-rock structure.
- The conversation link reads as a spatial plane rather than glassmorphism.
- Mobile headline, plane, end rock, legal text, social links, and Back to Top do not overlap or clip.
- Focus and hover treatments remain visible against the moving and fallback backgrounds.

Validation:

- Desktop overlay comparison and mobile full-section capture.
- Keyboard and screen-reader landmark/link pass.
- Sound-on, sound-off, sound-unavailable, reduced-motion, and no-WebGL states.

## Milestone 8 — accessibility, performance, and release gate

Scope:

- Close remaining guideline findings and run regression checks.
- Tune quality thresholds from real measurements rather than adding visual density.
- Document final budgets and content-replacement workflow.

Acceptance criteria:

- No clipping or horizontal page overflow from 320px upward.
- Visible focus for every interactive element; logical tab order; no keyboard traps.
- Continuous decorative motion can be paused and honors `prefers-reduced-motion`.
- LCP ≤ 2.5s, INP ≤ 200ms, and CLS ≤ 0.1 on the agreed representative mobile profile.
- Capable desktop targets 60 fps; supported mobile/low tier remains stable at or above 30 fps during normal navigation.
- `npm run validate` passes and visual baselines are approved.

Validation:

- Automated validation/build, accessibility scan, and manual keyboard/screen-reader pass.
- Performance traces with cold and warm cache.
- Cross-browser checks in current Safari, Chrome, and Firefox, including iOS Safari.
- Final reference overlay review at all four target viewports.

## Expected file surface

Likely homepage implementation files:

- `src/styles/tokens.css`
- `src/styles/type.module.css`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/layout/SiteHeader.module.css`
- `src/components/layout/SiteFooter.tsx`
- `src/components/layout/SiteFooter.module.css`
- `src/components/sections/Hero.tsx`
- `src/components/sections/Hero.module.css`
- `src/components/sections/SelectedWork.tsx`
- `src/components/sections/SelectedWork.module.css`
- `src/components/sections/Statement.tsx`
- `src/components/sections/Statement.module.css`
- `src/components/work/ProjectPlane.tsx`
- `src/components/work/ProjectPlane.module.css`
- `src/components/environment/EnvironmentLayer.tsx`
- `src/components/environment/EnvironmentLayer.module.css`
- `src/content/site/siteContent.ts`
- `src/motion/CorridorPin.tsx`
- `src/motion/CustomCursor.tsx`
- `src/motion/cursor.css`
- `src/motion/motion.css`
- `src/webgl/SceneCanvas.tsx`
- `src/webgl/core/environment.ts`
- `src/webgl/core/quality.ts`
- `src/webgl/modules/horizonAtmosphere.ts`
- `src/webgl/modules/horizonLights.ts`
- `src/webgl/modules/particleField.ts`
- `src/webgl/modules/pointerInfluence.ts`
- `src/webgl/modules/reflectiveFloor.ts`
- `src/webgl/modules/rocks.ts`
- `src/webgl/sceneConfig.ts`
- `scripts/check-scene.ts`
- `scripts/prepare-rocks.mjs`
- `public/assets/rocks/*.glb` plus any approved new distinct rock assets

Likely content records and validators, only if the featured set or copy is approved to change:

- `src/content/projects/records/*.project.ts`
- `src/content/projects/project.types.ts`
- `src/content/projects/projectRegistry.ts`
- `src/content/projects/projectLoader.ts`
- `scripts/validate-content.ts`

Files that should not need project-specific layout changes:

- `src/app/work/[slug]/page.tsx`
- `src/components/work/CaseStudyWorkspace.tsx`
- `src/components/work/CaseStudyBlocks.tsx`

Documentation and baselines:

- `docs/visual-target.md`
- `docs/implementation-plan.md`
- `docs/progress.md`
- `docs/landscape-assets.md`
- `docs/how-to-add-or-replace-project.md`
- `docs/references/homepage-hero-natural-flow-v3.png`
- `docs/references/projects-body-cinematic-with-cliff-v3.png`
- `docs/references/footer-cinematic-with-end-rock-v3.png`
- `docs/baselines/current/*`
- `design/screenshots/*` (historical captures only)
