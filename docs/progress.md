# Project progress

## Survue case study content — 2026-09-22

- Authored Survue directly in the reusable five-stage case-study model: Context, Structure, Wireframes, Detection, and Final.
- Added 15 story views using the supplied user flow, early wireframes, detection concepts, and finished product screens.
- Added reusable labeled screen sequences, source-size screen links, and a full-size user-flow link.
- Added two explicitly labeled low-fidelity reconstructions for unavailable Gallery and Ready wireframes.
- Compressed the supplied 27-second interaction recording to a 1.4 MiB web clip, placed it in Context with a frame-matched poster and a silent, control-free loop, and retained its link from the finished detection story. Reduced-motion visitors see the poster instead of autoplay.
- Kept the Survue homepage image and missing finished screens marked as incomplete. The red source screen says “Level Risk 1”; the case study labels it “High risk” until that source text is corrected.
- Verified responsive behavior at 375, 430, 768, 1024, 1440, and 1728 pixels with no page-level horizontal overflow. `npm run validate` passed, including content, scene, type, lint, formatting, and production build checks.

## Reusable case-study workspace — 2026-09-22

- Replaced the long-form block page with a reusable stage-and-story workspace.
- Added typed stage data, story-specific copy, flexible visual variants, optional details, and a generic adapter for older block records.
- Added desktop timed story progression with pause behavior, manual keyboard and pointer controls, URL stage hashes, and no automatic transition between stages.
- Added a dedicated mobile composition with collapsible project information, manual tap/swipe story controls, visual-first reading order, and horizontally scrollable stage navigation.
- Added tablet two-column behavior and responsive checks at 375, 430, 768, 1024, 1440, and 1728 pixels.
- Converted the Qalin placeholder record into the first direct stage-and-story authoring example without adding project conditions to the renderer.
- Documented the system in `docs/case-study-workspace.md` and extended content validation for stages, story media, IDs, durations, and accessible alt text.

## Cinematic landscape integration — 2026-09-21

- Removed project planes from the hero; the first project remains in Selected Work.
- Replaced procedural rocks with three independent, optimized Tripo GLBs. Placement is typed and responsive in `src/webgl/sceneConfig.ts`.
- Tuned the continuous particle current and restrained reflective floor, retaining the existing single-canvas architecture.
- Switched the footer headline to solid type and adopted the corrected footer reference.
- Added a reproducible rock-preparation command and documented asset replacement in `docs/landscape-assets.md`.
- Fixed the sound store's server snapshot identity, which had prevented the browser client from mounting.

The original Stage 1–10 notes below are a historical record; earlier descriptions of hero project planes, procedural rocks, and footer dissolves no longer describe the current homepage.

Last updated: 2026-09-16

## Stage 1: Greenfield project foundation

Status: complete

### Completed

- Created a Next.js App Router application with strict TypeScript.
- Added ESLint, type checking, production build, Prettier, and a combined validation command.
- Established centralized design tokens and a responsive CSS foundation.
- Added a minimal server-rendered placeholder page only.
- Established separate content, React, motion, WebGL, sound, and design-token boundaries.
- Added typed static project content scaffolding without fabricated projects.
- Added responsive, visible-focus, semantic HTML, and reduced-motion foundations.
- Saved the authoritative creative direction verbatim.
- Copied the three approved reference images into `design/references`.
- Documented architecture, content editing, risks, stages, and dependency policy.

### Approved references

- `design/references/homepage-hero-direction.png`
- `design/references/projects-body-cinematic.png`
- `design/references/footer-cinematic.png`

### Explicitly deferred

- Homepage composition
- Case-study design and content
- Animation and scroll orchestration
- Three.js or React Three Fiber
- Particles, water, lights, and rocks
- Custom cursor behavior
- Sound engine and audio assets
- Final display font selection and licensing
- Deployment and analytics

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run build`: passed; the root route is statically prerendered

### Next recommended stage

Build the real typed project inventory and accessible static page composition before adding animation, WebGL, or sound.

## Stage 2: Data-driven portfolio content

Status: complete

### Completed

- Centralized name, role, introduction, availability, contact links, navigation labels, and footer copy.
- Added one typed content file for each of the eight intended projects.
- Added shared project types for all requested case-study block variants.
- Added one registry and one loader for ordered, enabled, featured, slug, route, static-parameter, and next-project access.
- Added explicit placeholder status and placeholder-field tracking without fabricated case-study claims.
- Added local placeholder media for every seeded homepage image.
- Added runtime validation for content fields, block types, routes, alt text, media existence, duplicate slugs and orders, block IDs, and next-project references.
- Added `npm run validate:content` and included it in the full validation pipeline.
- Documented exact add, remove, reorder, image replacement, complete replacement, case-study, and validation workflows.

### Seeded project records

- Qalin
- Relay
- SupportIQ
- Get Campus
- New Start Mobile
- Quill & Pigeon
- Wildwood
- Survue

All eight records remain clearly marked as placeholders until final copy, dates, responsibilities, SEO descriptions, and media are approved.

### Validation

- `npm run validate:content`: passed; 8 projects, 24 case-study blocks, and 8 placeholder records
- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run build`: passed; the root route remains statically prerendered

### Next recommended stage

Create the accessible static homepage and shared case-study renderer from the loader and block schema. Do not add cinematic motion, WebGL, or sound before the semantic templates are complete.

## Stage 3: Static homepage composition

Status: complete

### Completed

- Replaced the foundation placeholder page with the full five-part homepage composition: navigation, hero, selected work, personal statement, and contact footer.
- Rewrote `src/styles/tokens.css` as a two-layer token system: raw approved brand values under `--brand-*`, semantic roles above them. Components read semantic roles only.
- Added the interim display face. `next/font/google` now self-hosts Anton as the monumental condensed voice, with Geist Sans for body copy and Geist Mono for technical microcopy. Druk Condensed remains the preferred cut if that licence is acquired.
- Built `DisplayHeading` so a monumental headline can break across visual lines while assistive technology reads one phrase through `aria-label`.
- Built `ProjectPlane` as the single flat perspective plane used by both the hero cluster and the work corridor, with depth tiers, a label block, and a full-plane link target.
- Built `EnvironmentLayer` as the static CSS stand-in for the Stage 5 WebGL scene: sky, purple beacons, horizon, reflective floor, surface grain, beacon reflections, and two angular rock groups. It is decorative, hidden from assistive technology, and carries no text or controls.
- Added the porcelain threshold band at the foot of the hero as the static placeholder for the Scene 2 transition plane.
- Moved the site shell into the root layout so the skip link, header, and contact footer sit outside the page body.
- Extended `src/content/site/siteContent.ts` with all homepage copy, section anchor ids, and the navigation, so no component holds a project name, headline, label, or route.
- Extended `scripts/validate-content.ts` to cover the new site-content shape and to reject navigation anchors that do not match a known section id.

### Layout behaviour

- 1024px and above: the hero holds three featured planes at three depths around the headline, and Selected Work is a horizontally scrolling corridor with snap points and a keyboard-focusable, labelled scroll region.
- Below 1024px: the hero planes collapse into an offset vertical stack and plane perspective is reduced.
- Below 768px: the corridor becomes a single-column vertical sequence and all perspective transforms are removed.
- No horizontal page overflow at 1440, 1280, 768, 390, or 320px.

### Accessibility

- One `h1`, then `h2` per section and `h3` per project. Verified outline: hero headline, Selected work, the statement thesis, and the contact headline.
- Landmarks: banner, primary `nav`, `main`, contentinfo, plus labelled groups for the hero cluster and the work corridor.
- Skip link, visible gold focus ring on every interactive element, 44px minimum interactive height, and full-plane link targets.
- Every image carries alt text from the content system.
- `--color-text-muted` was raised to 78% lavender so mono microcopy reaches 4.9:1 on the background. Primary text is 17:1, secondary 7.5:1, accent and focus above 10:1.
- Verified with JavaScript disabled: all headings, every link, and all 11 images render from the server.

### Explicitly not built in this stage

- WebGL, particles, water, custom cursor, sound, pinned project scrolling, and elaborate animation. Only token-level 300ms hover and focus transitions exist.
- Case-study routes and the block renderer. Project planes link to `/work/<slug>` from the content loader, and those routes do not exist yet, so those links currently resolve to the not-found page.

### Screenshots

`design/screenshots/stage-3/` holds production-build captures at 1440x900, 1280x800, 768x1024, and 390x844, one per section plus a full-page capture per width.

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run validate:content`: passed; 8 projects, 24 case-study blocks, 8 placeholder records
- `npm run typecheck`: passed
- `npm run build`: passed; `/` is statically prerendered

### Required before launch

- Real email, LinkedIn, and GitHub links. All three are still `isPlaceholder: true`.
- Real project copy, media, years, roles, and SEO descriptions for all eight records.
- A decision on the display face: keep Anton or licence Druk Condensed.

### Next recommended stage

Stage 4: motion prototype. Hero line staging, the pinned project corridor, the Scene 2 threshold transition, and the reduced-motion equivalents. Do not start WebGL before the motion timings are approved.

The `/work/[slug]` routes also still need building before the homepage project links resolve.

## Stage 4: Hero and navigation motion

Status: complete

### Completed

- Added centralized motion configuration split across two files that hold disjoint values and therefore cannot drift apart. `src/motion/motion.css` owns everything CSS consumes: easing, durations, delays, stagger, travel distances, perspective strength, the pointer rotation budget, and the global keyframes. `src/motion/motionConfig.ts` owns only the pointer-input values JavaScript needs.
- Implemented the six-step opening sequence. Navigation arrives through a short vertical blur, "CRAFT, TASTE" rises from below its mask, "& CODE." follows one stagger later, supporting copy and the scroll cue reveal after it, the three planes settle from the most distant forward, and the planes then track the pointer within the rotation budget.
- Added `src/motion/PointerDepth.tsx` as the hero's only client leaf. It writes two unitless custom properties onto the hero root and lets CSS convert them into degrees, so React state never changes on a frame.
- Reworked `ProjectPlane` so each plane's base perspective lives in custom properties. The pointer offset is added inside the same `transform`, which means the entrance animation and the pointer response never fight over one property.
- Moved perspective strength out of `tokens.css` into the motion configuration, since it is a spatial motion value rather than a static design token.
- Added line masks to `DisplayHeading`. The primitive owns the mask but no timing, so the footer and work headings keep using it untouched.

### Timeline

| Step                    | Delay                                | Duration |
| ----------------------- | ------------------------------------ | -------- |
| Navigation items        | 80ms, 70ms stagger across five items | 420ms    |
| "CRAFT, TASTE"          | 240ms                                | 1050ms   |
| "& CODE."               | 420ms                                | 1050ms   |
| Supporting copy         | 940ms                                | 720ms    |
| Scroll cue              | 1120ms                               | 640ms    |
| Planes, distant to near | 480ms, 150ms stagger                 | 1150ms   |
| Section baseline        | 1240ms                               | 640ms    |

The scene settles at roughly 1.9 seconds.

### Easing

- Interface and copy: `cubic-bezier(0.22, 1, 0.36, 1)`, as specified.
- Text reveals: the same curve.
- Heavy planes: `cubic-bezier(0.16, 0.84, 0.24, 1)`. The storyboard asks for "slightly overshooting" here, but also states that nothing should bounce. The second constraint was treated as the stronger one, so this curve is weighted and slow with no overshoot. Worth confirming.

### Pointer response

Measured against the settled base rotation at 1440x900:

| Plane              | Base rotateY | Delta at viewport corner |
| ------------------ | ------------ | ------------------------ |
| Qalin, nearest     | 9deg         | 2.53deg                  |
| Relay, mid         | -13deg       | 1.84deg                  |
| SupportIQ, distant | -13deg       | 1.27deg                  |

All within the 1 to 3 degree budget, symmetric in both directions, and weighted so nearer planes move more. Movement is smoothed at 0.055 per frame, so a full-width pointer jump has covered only 19 percent of the distance after 60ms, which is what makes it read as heavy rather than as a card chasing the cursor.

Tracking attaches only when the visitor has a fine pointer, has not requested reduced motion, the hero is on screen, and the document is visible. It waits for the entrance animations to finish, read from the running animations rather than a duplicated timeline constant.

### Reduced motion

Handled once, at the bottom of `motion.css`, by neutralising the travel variables and shortening the durations. The keyframes are unchanged and resolve to short opacity reveals.

- No perspective pointer tracking. The rotation budget is zeroed in CSS and the listener never attaches.
- No transforms and no blur anywhere in the sequence.
- Durations drop to 200ms and delays collapse, so all content is available within about 300ms.
- `src/styles/reset.css` no longer forces `animation-duration` to `0.01ms`. That blanket rule would have replaced the reveal with an instant pop. Retiming now happens centrally instead, which is why every keyframe must express its travel through a variable.

### Verification

- **Entrance states**: captured at 0, 180, 320, 500, 700, 950, 1200, 1600 and 2100ms by pinning `animation-play-state` and shifting the delay variables, reading the configured delays from the page so the harness never duplicates the timeline.
- **Keyboard**: tab order unchanged across nine stops, each with the gold focus outline, all visible and on screen once settled. Tabbing into the hero mid-sequence keeps focus on the link it reaches; that plane is still at opacity 0 at that instant and becomes visible when its animation completes.
- **Cleanup**: three attach and detach cycles return to identical listener, animation-frame and IntersectionObserver counts, so there is one attach and one matching release per cycle with no accumulation. Hiding the document also detaches. The frame loop parks itself at rest with zero outstanding frames. No page errors.
- **Mobile**: at 390x844 the entrance plays, plane frames settle to identity, and pointer tracking never attaches on a coarse pointer.
- **Off-screen and hidden**: leaving the viewport detaches the listener and removes the custom properties; returning re-attaches once.

### Fixed during the stage

- CSS Modules were rewriting the global keyframe names into locally scoped ones, so no animation ran at all. Keyframe names are now published as custom properties, which modules do not rewrite. This is documented in `src/motion/README.md` as a standing rule.
- The display mask travel was 104 percent, which left the cap tops of each line visible before the rise began. The mask is taller than the line box by its descender padding, so travel is now 128 percent.

### Not built in this stage

Particles, the reflective-water shader, project gallery scrolling, sound, and footer animation. The Scene 2 threshold transition also remains static.

### Evidence

`design/screenshots/stage-4/` holds the entrance frames, the reduced-motion frames, and the three pointer-response states, all from the production build.

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run validate:content`: passed; 8 projects, 24 case-study blocks, 8 placeholder records
- `npm run typecheck`: passed
- `npm run build`: passed; `/` remains statically prerendered

### Next recommended stage

Stage 5: WebGL prototype. Particles, the reflective floor, horizon lights, rocks, quality tiers and lifecycle tests, replacing `EnvironmentLayer` behind the same DOM.

## Stage 5: Particles and environment

Status: complete

### Completed

Eight independent modules under `src/webgl`, plus the cursor under `src/motion`.

- **Particle field** — simulated in screen-space CSS pixels with an orthographic pass, rendered as additive points. Drifts left to right on a divergence-free curl field, concentrated into a stream band rather than an even starfield, and fades at every boundary.
- **Pointer influence** — pure force maths, no state, no rendering. Three concentric zones at 240px, 120px and 35px.
- **Reflective floor** — a planar reflection pass into a small render target, sampled with a scrolling noise distortion and vertical stretch. Near-black, drifting on a forty-six second cycle.
- **Purple horizon lights** — five beacons standing on the floor plane, breathing on a thirteen-second cycle at twelve percent amplitude.
- **Sparse rocks** — faceted convex blocks with per-face normals and a beacon-driven rim light. Two or three groups, no rotation, only a small parallax offset.
- **Custom cursor** — a gold ring whose centre dot is written from the pointer sample with no easing at all.
- **Quality manager** — tiers, particle density, pixel-ratio caps, adaptive downgrade.
- **Scene lifecycle** — one renderer, two passes, one frame loop, one disposal path.

Added `src/motion/pointerSource.ts` as a single shared pointer sample, so the cursor, the particle field and the water all agree about where the visitor is.

### Keeping project content out of WebGL

Nothing under `src/webgl` references a project, slug, title or label. `SceneCanvas` measures every element carrying `data-scene-obstacle` and passes the scene plain `{x, y, width, height}` rectangles. The field knows to flow around a box; it does not know the box is a headline or a project plane.

The one value crossing back is `--scene-beacon-glow`, which the horizon lights publish and the DOM project frames read for their rim light. That is a number, not content.

### Particle behaviour

| Zone      | Radius | Behaviour                                                                  |
| --------- | ------ | -------------------------------------------------------------------------- |
| Awareness | 240px  | Turn towards the pointer's direction of travel, brightness and speed rise  |
| Orbit     | 120px  | Tangential force with a light inward pull; faster pointers widen the orbit |
| Contact   | 35px   | Split tangentially around the centre, like water around a stone            |

A disturbed particle carries a recovery timer that eases its steering back to the flow field over 1.4 seconds, which is what closes a carved path. Contact-zone particles have a six percent chance per frame of flashing gold for 400ms.

### Floor behaviour

Ripples are gated to the lower 34 percent of the viewport, throttled to one every 420ms, capped per tier, and decay over 2.6 seconds. Nothing splashes on movement alone, and there is no wave geometry anywhere.

### Performance

Headless Chromium on ANGLE/Metal, production build, high tier:

| Viewport      | Tier   | DPR applied | Backing store | Idle     | Pointer sweeping |
| ------------- | ------ | ----------- | ------------- | -------- | ---------------- |
| 1440x900 @1x  | high   | 1           | 1440x900      | 60.2 fps | 60.0 fps         |
| 1440x900 @2x  | high   | 2           | 2880x1800     | 60.1 fps | 60.0 fps         |
| 1920x1080 @2x | high   | 2           | 3840x2160     | 60.1 fps | 60.0 fps         |
| 390x844 @3x   | medium | 1.5         | 585x1266      | 60.3 fps | 60.0 fps         |

Pointer interaction costs nothing measurable: the idle-to-active delta was 0.2 fps at 1440x900. The CPU simulation is the only per-frame work that scales with particle count, and at roughly 6000 particles it is not the bottleneck.

Particle count is a density per megapixel, not a flat number, so a phone does not receive a desktop's worth of particles in a quarter of the area. It resolves to 5962 at 1440x900 and 1514 at 390x844.

Bundle: three.js is 129 KB gzipped in its own chunk, absent from the initial HTML and from the 176 KB gzipped first-load JS. It is fetched only after the semantic page has rendered.

### Technical verification

- **Tab hidden** — 60 frames per second visible, 0 while hidden, 60 again on return.
- **Pixel ratio cap** — device ratio 3 selects the medium tier and applies 1.5. No tier exceeds its cap.
- **WebGL unavailable** — with `getContext` returning null for every WebGL type: scene inactive, the CSS environment layer visible, 15 headings and 23 links intact, hero at full opacity, no errors.
- **Context loss** — forcing `WEBGL_lose_context` stops the loop within one frame and raises no errors.
- **Reduced motion** — the scene renders one static frame. Screenshots at t0, t0+1.6s, and with the pointer moved across the viewport are byte-identical. The same test with motion enabled produces three different frames, so the check is meaningful in both directions.
- **Coarse pointer** — no custom cursor element, no `data-custom-cursor`, native cursor untouched.
- **Listener accounting** — counts are identical across three resize and visibility cycles, with one canvas and no errors. Two `webglcontextlost` listeners are expected: one is three.js's own.
- **Headless module checks** — `npm run validate:scene` covers the pointer zones, the water's gating and throttling, tier selection, the pixel-ratio caps, density scaling, and the adaptive downgrade. It is part of `npm run validate`.

### Fixed during the stage

- The canvas painted over all content: sections carried no `z-index`, so the fixed canvas on the WebGL layer won. Sections now sit on `--layer-content`.
- The camera pitch sign was inverted, putting the horizon at 31 percent instead of 72. Pitching a camera down raises the horizon, not lowers it.
- The floor's alpha fade was applied to the near edge instead of the far edge, erasing the surface. It is now ramped on view depth, which is perspective-correct.
- Obstacle avoidance used a hard inside-the-rectangle test, which queued particles into visible horizontal lines along each edge. It is now a smooth falloff with a tangential component, so particles curve around rather than pile up.
- The CSS environment layer's opaque sky occluded the canvas. When WebGL is running the CSS layer steps aside completely, and the atmospheric base moved to the body background so neither owner leaves a black page.
- Particle count ignored viewport area, so 390px was a wall of green. It is now a density per megapixel with a per-tier ceiling.
- `npm run typecheck` caught `requestRipple` being called with two arguments instead of three in the new checks.

### Not built in this stage

Sound and full project navigation, as specified. The Scene 2 threshold transition and the pinned project corridor also remain as they were.

### Known limitations

- React unmount of `SceneCanvas` is not reachable in the current single-route app, so the destroy path was verified through context loss and listener accounting rather than an unmount cycle. It should be re-tested once case-study routes exist.
- The scene is one fixed viewport-sized environment behind the whole page rather than a separate environment per section. This matches the direction's single continuous landscape, but it means the per-section horizons the CSS layer used are gone while WebGL is active.
- Particles render behind DOM content, so typography always occludes them. Obstacle avoidance makes the field flow around the type, which reads correctly, but particles cannot pass in front of a letterform.
- Performance figures are from headless Chromium on Apple silicon. Real low-end mobile hardware has not been measured.

### Evidence

`design/screenshots/stage-5/` holds the composition at four breakpoints, the pointer-influence sequence from rest through carved to repaired, the water comparison between the upper and lower viewport, the scene with the DOM hidden, both cursor states, reduced motion, and the no-WebGL fallback.

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run validate:content`: passed; 8 projects, 24 case-study blocks, 8 placeholder records
- `npm run validate:scene`: passed; 21 checks
- `npm run typecheck`: passed
- `npm run build`: passed; `/` remains statically prerendered

### Next recommended stage

Stage 6: sound prototype. Consent, session state, event cues, mixing, and silent-mode parity.

## Stage 6: Selected Work

Status: complete

### Completed

- Built the pinned corridor. On the desktop breakpoint the section pins and the page's own vertical scroll advances the projects horizontally. The active plane sharpens and brightens, its immediate neighbours stay visible but quieter, and the rest recede further. Nothing is hidden at any scroll position.
- Added `src/motion/CorridorPin.tsx`, a client leaf that measures the DOM, maps scroll progress onto horizontal travel, and publishes the active plane's rectangle. It reads elements by data attribute and knows nothing about projects.
- Extended the scene with a focus channel. `src/webgl/sceneFocus.ts` carries a screen rectangle from any section to the canvas. Particles gather around it and the closest horizon beacon lifts.
- Added the `/work/[slug]` routes with `src/components/work/CaseStudyBlocks.tsx`, a renderer that switches on the block schema and never on a project.
- Paired the corridor plane and the case-study hero with React's `ViewTransition`, using a name derived from the slug, so the selected plane morphs into the case study.

### One component, one data source

`ProjectPlane` renders every project in both the hero and the corridor. There is no second plane component, no per-project branch, and no project-specific CSS anywhere.

Positions are measured, never written down. Depth tiers cycle with `index % 3`, the index rail counts the array, the pinned scroll length is `count * 58svh + 100svh`, and horizontal travel is the measured distance between the first and last plane's centres.

### Maintainability proof

Four temporary data edits, with a checksum over every file in `src/components`, `src/motion`, `src/webgl` and `src/app` taken before and after.

| Change   | Edit                                   | Result                                                      |
| -------- | -------------------------------------- | ----------------------------------------------------------- |
| Order    | Qalin `order: 1 → 8`, Survue `8 → 1`   | Corridor re-sorted: Survue first, Qalin last                |
| Title    | Wildwood → "Wildwood Reserve"          | New title rendered at position 07                           |
| Image    | Relay's `homepageImage` repointed      | Relay's plane rendered the other artwork                    |
| Featured | Relay `false`, New Start Mobile `true` | Hero cluster became SupportIQ, Get Campus, New Start Mobile |

The UI checksum was `ae7f3493914ed22fe2e4d76cb867ea575c6bfa24` before the edits and identical after. No component was touched.

A fifth check covered the count assumption: disabling one project produced 7 rendered planes, `--corridor-count: 7`, a tally of `07`, a pin height that fell from 5076px to 4554px, and travel from 3427px to 2938px. All derived.

All records were restored from a byte-for-byte backup and verified with `diff`.

### Keyboard

Tabbing reaches all eight projects without any dragging. Each focused plane is scrolled to the focus line and becomes the active one, measured at exactly 461px of 1440 for every project, with the gold focus outline present on each. Enter opens the case study.

No scroll trap: the controller never calls `preventDefault` and never captures wheel or touch events. Scroll position is its only input. Scrolling to the document end reaches 6910 of 6910 with the footer visible.

Focus syncing uses `behavior: "instant"`. `"auto"` defers to the document's `scroll-behavior: smooth`, which made each tab animate for about a second before the plane arrived.

### Mobile

| Viewport | Pinned | Corridor                 | Plane width     | Order     |
| -------- | ------ | ------------------------ | --------------- | --------- |
| 390x844  | no     | vertical column          | 90% of viewport | preserved |
| 768x1024 | no     | native horizontal scroll | 35% of viewport | preserved |
| 1280x800 | yes    | pinned, transform driven | 30% of viewport | preserved |

The desktop corridor is never forced onto a touch layout. Reduced motion also stays unpinned.

### Route transition

Verified three ways:

- With support, `startViewTransition` fires once per navigation and the paired name `project-media-relay` is assigned mid-flight, so the plane and the case-study hero morph.
- With `Document.prototype.startViewTransition` deleted, clicking still navigates to the case study, renders the right heading, and raises no errors.
- With JavaScript disabled entirely, all eight project links render and navigate.

### Fixed during the stage

- `overflow-x: hidden` on `html` and `body` silently broke `position: sticky` for every descendant, because `hidden` turns an element into a scroll container. Replaced with `overflow-x: clip`, which trims the same overflow without that side effect.
- `overflow: hidden` on the section had the same effect on its own sticky child. The pinned viewport now does the clipping, and the environment layer moved inside it.
- The active index and the visible plane disagreed: travel alone leaves the active plane at the left gutter. The track now carries an offset so the first plane starts on the focus line and the last ends on it, which puts every plane at 461px when active.
- The environment kept gathering particles around, and lighting a beacon for, the active plane after the corridor had scrolled out of view. Focus is now released when the section leaves the viewport: mean beacon glow measured 1.20 with a plane active and 1.02 released.
- `quill-and-pigeon`'s placeholder SVG failed to parse. The generator escaped the title and then uppercased it, turning `&amp;` into `&AMP;`, which is not a valid XML entity. All eight files now parse.
- The mobile override still set `flex-direction` on `.inner`, which became a grid in Stage 3, so the index rail squeezed the display heading into the navigation.
- The corridor kept its `tabindex` while pinned, where it is no longer a scroll container and the tab stop did nothing. `CorridorPin` now removes and restores it.

### Not built in this stage

Sound and full project navigation beyond opening a case study. Case-study art direction beyond the generic block renderer is still unstyled beyond the token system.

### Known limitations

- The case-study pages render real routes and real content, but their layout is the generic block renderer rather than a designed case-study composition.
- Only the `hero`, `text` and `next-project` block types appear in the seeded data. The renderer handles all ten, but the other seven are untested against real content.
- `npm run validate:content` checks that media files exist, not that they parse. The broken SVG above passed validation.

### Evidence

`design/screenshots/stage-6/` holds the corridor at four active positions, keyboard focus on a plane, 1280x800, both mobile layouts, reduced motion, and a case-study page.

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run validate:content`: passed; 8 projects, 24 case-study blocks, 8 placeholder records
- `npm run validate:scene`: passed; 21 checks
- `npm run typecheck`: passed
- `npm run build`: passed; `/` is statically prerendered and all eight `/work/[slug]` routes are prerendered

### Next recommended stage

Stage 7: sound prototype, or the case-study art direction. The block renderer and routes are in place for either.

## Stage 7: Case-study system

Status: complete, pending Qalin approval

### Completed

- Extended the block schema to eleven types by splitting `introduction` out of `hero`. A hero block is now the opening media only: the `h1`, category, role and year come from the project record, so no block repeats them.
- Added documented layout variants in `BLOCK_LAYOUT`. Content picks a named value; the renderer maps it to a data attribute its own stylesheet owns.
- Extended `CaseStudyBlocks.tsx` to render all eleven types and every variant. It switches on `block.type` and nothing else.
- Built Qalin as the pilot, exercising all eleven block types in one record.
- Added case-study placeholder media for Qalin: six SVGs and one real MP4, so the video block has genuine media rather than a dead path.
- Extended the validator to cover layout variants and to reject any field that would let content style itself.

### Layout variants

| Variant         | Applies to           | Values                   | Default         |
| --------------- | -------------------- | ------------------------ | --------------- |
| `width`         | `image`, `video`     | `column`, `wide`, `full` | `column`        |
| `columns`       | `gallery`, `metrics` | `two`, `three`, `four`   | `two` / `three` |
| `mediaPosition` | `split-text-media`   | `left`, `right`          | required        |
| `tone`          | `text`               | `body`, `lead`           | `body`          |

### Content cannot carry CSS

There is no `className`, `style`, `css`, `html` or `dangerouslySetInnerHTML` field anywhere in the schema. The validator rejects one if it appears, and a rendered Qalin page was audited: the only six `style` attributes in the article are `color:transparent`, written by `next/image`. None came from content.

### Qalin pilot

Twelve rendered blocks: hero, introduction, text, split-text-media, full-width image, three-column gallery, wide video, process, three-column metrics, quote, lead-tone text, next-project.

Every string is a marked placeholder. Nothing claims a result, a measurement, a research finding or a quotation:

- Metric values are em-dashes with the context "No measurement approved yet."
- The quote reads "No approved quotation is available yet." with "Attribution pending".
- Process steps are numbered placeholders with no described activity.

The structure is ready for review. The words and the media are not.

### Validation proof

Each fault class was introduced into the Qalin record on purpose, the validator run, and the record restored. All nine were caught with a located message.

| Fault                     | Message                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| Missing media             | `projects.qalin.caseStudy.blocks[0].media.src: references missing media: …` |
| Missing alt text          | `projects.qalin.caseStudy.blocks[0].media.alt: must be a non-empty string`  |
| Unknown block type        | `projects.qalin.caseStudy.blocks[1].type: invalid block type: carousel`     |
| Invalid width variant     | `blocks[4].width: must be one of: column, wide, full (received enormous)`   |
| Invalid column variant    | `blocks[5].columns: must be one of: two, three, four (received seven)`      |
| Content carrying CSS      | `blocks[2].className: content may not carry styling or raw markup`          |
| Unknown next-project slug | `blocks[11].projectSlug: references unknown project: no-such-project`       |
| Next-project out of sync  | `projects[0].nextProjectSlug: must match the next-project block reference`  |
| Video without a poster    | caught on the poster image                                                  |

### Route checks

| Route                 | Status | h1        | Blocks | Images | Missing alt | Broken |
| --------------------- | ------ | --------- | ------ | ------ | ----------- | ------ |
| `/work/qalin`         | 200    | Qalin     | 12     | 6      | 0           | 0      |
| The other seven       | 200    | from data | 4      | 1      | 0           | 0      |
| `/work/not-a-project` | 404    | —         | —      | —      | —           | —      |

SEO comes from the record: Qalin's title is "Qalin case study | Marzia Saidi", its description is `seo.description`, and its canonical is `seo.pathname`.

### Changed during the stage

- `hero` lost its `heading` and `introduction` fields; `introduction` became its own block. All eight records were updated through the shared placeholder helpers, so no record needed hand editing.
- `createPlaceholderHero` now takes only media, and `createPlaceholderIntroduction` was added beside it.

### Not built in this stage

The remaining seven case studies. Each still holds the four-block placeholder shape. They are waiting on Qalin approval, as instructed.

### Known limitations

- Every block type is exercised, but only against placeholder copy. Real copy will change line lengths and may expose spacing that placeholder text does not.
- `npm run validate:content` checks that media exists, not that it parses. A malformed SVG still passes, which is how a broken placeholder reached the corridor in Stage 6.
- The case study is typographically plain compared with the homepage. It uses the token system correctly but has had no art direction pass.

### Evidence

`design/screenshots/stage-7/` holds the Qalin page in full at 1440, 768 and 390, plus crops of the split, full-width, gallery and metrics variants.

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run validate:content`: passed; 8 projects, 40 case-study blocks, 8 placeholder records
- `npm run validate:scene`: passed; 21 checks
- `npm run typecheck`: passed
- `npm run build`: passed; all eight `/work/[slug]` routes prerendered

### Waiting on

Qalin approval. The remaining seven case studies should not be built until the pilot's structure, block order and layout variants are signed off.

## Content migration: the remaining seven case studies

Status: complete, awaiting review

### Completed

- Migrated Relay, SupportIQ, Get Campus, New Start Mobile, Quill & Pigeon, Wildwood and Survue from the four-block placeholder shape into the approved case-study system.
- Case-study blocks rose from 40 to 74 across the eight records.
- Added 40 case-study media files: 37 placeholder SVGs and three real MP4s, so every video block points at genuine media rather than a dead path.

### Block system preserved

No block type was added, no field was added, and no layout variant was added. Every one of the seven records is assembled from the eleven approved types and the four documented variants.

The renderer was not touched. Its switch still has exactly eleven arms, one per block type, and a check across `src/components`, `src/app`, `src/motion` and `src/webgl` found no project slug in any file.

### Compositions

Compositions differ because the projects differ. That is content, not code.

| Project          | Blocks | Composition                                                                                                     |
| ---------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| Qalin            | 12     | hero, intro, text, split, image full, gallery three, video wide, process, metrics three, quote, text lead, next |
| Relay            | 10     | hero, intro, text, metrics three, split left, image full, video wide, process, text lead, next                  |
| SupportIQ        | 9      | hero, intro, text, split right, gallery two, process, quote, text lead, next                                    |
| Get Campus       | 8      | hero, intro, text, gallery three, split left, metrics three, text lead, next                                    |
| New Start Mobile | 8      | hero, intro, text, gallery three portrait, split right, video column, text lead, next                           |
| Quill & Pigeon   | 9      | hero, intro, text, image full, split left, gallery two, quote, text lead, next                                  |
| Wildwood         | 9      | hero, intro, text, image full, video wide, gallery three, process, text lead, next                              |
| Survue           | 9      | hero, intro, text, split right, process four steps, metrics four, quote, text lead, next                        |

### No invented claims

Every string is a marked placeholder. Across all eight records, nothing states a result, a measurement, a research finding or a quotation:

- Every metric value is an em-dash with the context "No measurement approved yet."
- Every quote reads "No approved quotation is available yet." with "Attribution pending".
- Process steps are numbered placeholders that describe no activity.

### Validation

All routes checked against the production build:

| Route                    | Status | Blocks | Images | Videos | Missing alt | Broken | Canonical |
| ------------------------ | ------ | ------ | ------ | ------ | ----------- | ------ | --------- |
| `/work/qalin`            | 200    | 12     | 6      | 1      | 0           | 0      | ok        |
| `/work/relay`            | 200    | 10     | 3      | 1      | 0           | 0      | ok        |
| `/work/supportiq`        | 200    | 9      | 4      | 0      | 0           | 0      | ok        |
| `/work/get-campus`       | 200    | 8      | 5      | 0      | 0           | 0      | ok        |
| `/work/new-start-mobile` | 200    | 8      | 5      | 1      | 0           | 0      | ok        |
| `/work/quill-and-pigeon` | 200    | 9      | 5      | 0      | 0           | 0      | ok        |
| `/work/wildwood`         | 200    | 9      | 5      | 1      | 0           | 0      | ok        |
| `/work/survue`           | 200    | 9      | 2      | 0      | 0           | 0      | ok        |
| `/work/not-a-project`    | 404    | —      | —      | —      | —           | —      | —         |

Every video carries a title and a poster. No article element outside `next/image` has a `style` attribute, so no content is styling itself.

The next-project chain was followed from the rendered pages rather than the data: `qalin → relay → supportiq → get-campus → new-start-mobile → quill-and-pigeon → wildwood → survue → qalin`. It visits every project exactly once and closes.

Fault injection was repeated on four migrated records, not only the pilot. Missing media, empty alt text, a video without a poster, and a broken next-project reference were each caught with a located message.

### Fixed during the migration

- Placeholder artwork clipped its own label on narrow images: a portrait 900px gallery tile could not fit "NEW START MOBILE GALLERY 1" at the fixed font size. All 44 case-study placeholders were regenerated with the label sized to the tile.
- A four-step process wrapped to three plus an orphan. The process grid's minimum column width was reduced so three and four steps both land on one row at the article measure. No schema change.

### Observations for review

Two patterns were wanted while composing the seven and could not be expressed. Neither was required, so neither was added.

1. **`process` has no `columns` variant**, although `gallery` and `metrics` both do. The grid now auto-fits three and four steps, but five or more will wrap unevenly. This would reuse the existing `columns` vocabulary rather than introduce new terms.
2. **There is no outbound-link block.** A case study cannot currently link to a live site or a repository. Nothing is lost while all content is placeholder, but a finished portfolio usually needs one.

Both are recommendations, not changes. The approved system is untouched.

### Known limitations

- Structure only. Every word and every image is still a placeholder, so line lengths and image crops will change once real content arrives.
- `npm run validate:content` checks that media exists, not that it parses.
- The case-study pages still have no art-direction pass.

### Evidence

`design/screenshots/stage-7-migration/` holds all seven migrated case studies in full at 1440, plus New Start Mobile at 390.

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run validate:content`: passed; 8 projects, 74 case-study blocks, 8 placeholder records
- `npm run validate:scene`: passed; 21 checks
- `npm run typecheck`: passed
- `npm run build`: passed; all eight `/work/[slug]` routes prerendered

## Stage 8: Personal statement and footer

Status: complete

### Personal statement

The approved copy, unchanged, from `siteContent.statement`:

> I like figuring out how things work, then finding ways to make them better.
>
> I move between design, code, and AI to explore, prototype, and ship.

Motion, all of it applied to the real words in place:

- The eyebrow, thesis and second paragraph reveal in sequence at a 320ms stagger once the section is on screen. The reveal is calm and plays once; scrolling past and back does not replay it.
- **design** is traced by the particle field. `SectionMotion` publishes the word's rectangle to the scene focus channel, so the field gathers around it. Nothing is drawn in CSS. Measured: mean beacon glow 1.221 while tracing, 1.024 once the section leaves.
- **code** assembles mechanically with `steps(11, end)` on a clip-path. No blur, no flicker, no character split.
- **AI** receives one traveling light: two backgrounds clipped to the text, a solid fill so the word is always legible and a highlight that passes across once and stops.
- **ship** keeps the shared colour emphasis and no motion of its own.

No glitch cliché anywhere: nothing stutters, repeats, tears or inverts.

The text stays semantic and selectable. It is never duplicated, never split into per-character spans, and never replaced by an image. Selecting the second paragraph returns exactly `I move between design, code, and AI to explore, prototype, and ship.`

### Footer

"LET'S CREATE" holds solid. "THE UNEXPECTED." dissolves into specks and rebuilds on an eleven-second cycle, which is weather rather than a glitch.

The dissolve is two layers over one piece of text. The real line carries an erode mask; a decorative `::after` copy, drawn from the line's own text through `attr()`, carries the inverse mask and a dot screen in the particle colour, so specks appear exactly where the letters left. The text is never duplicated in the accessibility tree and stays selectable.

The mask direction is counter-intuitive and is written down in `motion.css`: the mask is 250% of the element, so `mask-position: 0%` covers the whole word and larger values slide the solid band off to the left, uncovering the word from its right edge.

The contact element is one flat architectural plane: an outlined quadrilateral in perspective holding the label and a static waveform. There is no chrome organism, no liquid-metal object, no ring, no iris, no membrane and no organic sculpture anywhere in the footer. The gold ring on screen is the approved pointer cursor, not a footer object.

### Links

All six come from `siteContent`. No URL or label is written in a component.

| Link                 | Source             | Href        | Verified                                                     |
| -------------------- | ------------------ | ----------- | ------------------------------------------------------------ |
| Marzia Saidi © 2026  | `footer.copyright` | not a link  | text present                                                 |
| Email Marzia         | `email.href`       | `mailto:…`  | well-formed mailto                                           |
| Start a conversation | `email.href`       | `mailto:…`  | well-formed mailto                                           |
| Email                | `email.href`       | `mailto:…`  | well-formed mailto                                           |
| LinkedIn             | `linkedIn.href`    | `https://…` | well-formed https, `target=_blank rel="noreferrer noopener"` |
| GitHub               | `github.href`      | `https://…` | well-formed https, `target=_blank rel="noreferrer noopener"` |
| Back to top          | `sectionIds.top`   | `#top`      | anchor target exists; clicking from scrollY 5000 lands at 3  |

The three mailto links and both profile URLs are still the Stage 2 placeholders and must be replaced before launch.

### Works without WebGL and with reduced motion

| Mode           | Heading | Links | Copyright | Statement | Result                                                   |
| -------------- | ------- | ----- | --------- | --------- | -------------------------------------------------------- |
| No WebGL       | present | 6     | present   | present   | scene inactive, CSS environment layer visible, no errors |
| Reduced motion | present | 6     | present   | present   | dissolve mask removed, speckle layer hidden              |
| No JavaScript  | present | 6     | present   | present   | `data-in-view` absent and nothing depends on it          |

Reduced motion was measured rather than asserted. Two frames three seconds apart: **0 running animations, maximum channel delta 2 of 255, 0 pixels changed by more than 8.** The same test with motion enabled gives **55,405 changed pixels**, so the check is meaningful in both directions.

The CSS treats the absence of `data-in-view` as "settled", never as "hidden", which is why the section is complete without JavaScript.

### Fixed during the stage

- The dissolve ran backwards. `mask-position: 100%` was written as the solid state when it is in fact the erased one, so the word appeared eroded at rest and solid mid-cycle. The geometry is now derived in a comment rather than guessed.
- The first reduced-motion stillness check reported movement. It compared exact image hashes, which a GPU-composited canvas never reproduces bit for bit. Replaced with a perceptual tolerance after a pixel diff showed the largest difference was 2 of 255.

### Not built in this stage

Sound, and the "ship" water ripple the direction mentions. The ripple belongs to the floor's pointer-gated system and was not part of this brief.

### Known limitations

- The particle gathering around "design" is deliberately restrained and reads as a slight thickening rather than an outline trace. Tracing the letterforms themselves would need text-to-path work in the scene.
- Contact URLs remain placeholders.

### Evidence

`design/screenshots/stage-8/` holds the statement and footer at 1440 and 390, the dissolve frozen solid and mid-cycle at both widths, the link baseline, and the reduced-motion and no-WebGL states.

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run validate:content`: passed; 8 projects, 74 case-study blocks, 8 placeholder records
- `npm run validate:scene`: passed; 21 checks
- `npm run typecheck`: passed
- `npm run build`: passed; all routes prerendered

## Stage 9: Optional sound system

Status: complete

### Completed

- Built a procedural sound system under `src/sound`. Nothing else in the application constructs an `AudioContext`.
- Eight semantic events, a six-layer mix, per-event cooldowns and a global voice cap.
- Replaced the header's decorative waveform with a real on/off control.
- Wired all eight events from the places the things actually happen.

### No assets

Every cue is synthesised from oscillators and one shared noise buffer. Zero bytes of payload, no media element for autoplay policy to block, and a cue can respond to the scene through `intensity` and `step` rather than replaying a recording. This matches the direction's call for a procedural, responsive soundscape rather than one looping song.

### Architecture

`soundEvents.ts` is a publish and subscribe channel that contains no audio, so a component or the WebGL scene can import it without coupling to Web Audio. Publishing when sound is off returns immediately.

    component or scene → emitSoundEvent → engine → layer gain → master → limiter → output

A component never holds a context, never schedules a node, and never checks whether sound is on before reporting what it did.

### The six layers and their events

| Layer         | Gain | Triggered by                                         | Sound                                                                                                                                  |
| ------------- | ---- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Atmosphere | 0.10 | continuous, plus `environment:start`                 | Two low drones on a 24s detune and a filtered air bed. No melody, no phrase.                                                           |
| 2. Particles  | 0.05 | `particles:contact`                                  | A 90ms band-passed grain at a random pitch.                                                                                            |
| 3. Planes     | 0.14 | `project:approach`, `project:active`, `project:open` | A filtered low sweep, a muted mechanical lock, a reverse suction that closes into silence.                                             |
| 4. Water      | 0.09 | `water:ripple`                                       | A soft low droplet: a pitch glide from 420Hz to 170Hz. Never a splash.                                                                 |
| 5. Lights     | 0.08 | `project:active`                                     | One pitch from a five-note scale, chosen by project index, so moving through the corridor builds a chord rather than repeating a note. |
| 6. Contact    | 0.16 | `contact:hover`, `contact:open`                      | A sustained fifth, then a warm chord resolving. The warmest sound in the experience.                                                   |

Master is 0.5 into a limiter.

### Verified

**No audible autoplay.** Before any interaction, including 60 pointer moves and a full-page scroll: **0 AudioContexts created, 0 nodes**. The engine does not exist until the control is pressed.

**Session memory, gesture-gated.** Pressing stores `on`. After a reload the control is restored to "Sound on" but the waveform stays still and nothing plays, because a page load is not a gesture. Chromium leaves the resume promise pending rather than rejecting, so the engine detects the refusal, disposes itself, and waits. One interaction anywhere brings it back: context state `running`, waveform moving.

**Tab hidden suspends.** Hidden → context `suspended`, suspend count 0 → 1. Visible → `running`, resume count 3 → 4.

**Cleanup.** Four on/off cycles: **7 contexts created, 7 closed.** Every layer gain, the master, the limiter and every voice disconnect; the context is closed.

**Rapid project navigation.** 9 active-project changes in 0.2 seconds produced 11 source nodes, which is one audible cue. The 0.22s cooldown suppressed 8 of 9 retriggers.

**Rapid cursor movement.** 560 pointer moves over 9.3 seconds produced 90 source nodes against a theoretical ceiling of 133. Within the cooldown bound, no runaway.

**No audio on hover.** Identical 300px sweeps, one across three navigation links and one across empty header space, produced 5 and 6 voices. The difference is nothing: the sound is the particle field responding to pointer travel, not the links. Parked motionless on a link: **0 voices**. Parked motionless over empty space: 6 voices, which is particles drifting into a stationary cursor, exactly as the direction describes.

**Complete without sound.** With sound off the page renders 15 headings, 23 links and 11 images. Nothing is gated behind audio and no cue carries information that is not already on screen.

### Fixed during the stage

- `await context.resume()` hung forever when autoplay policy refused it. Chromium leaves that promise pending rather than rejecting, which stuck the provider's in-flight guard permanently and left an orphaned context on every load with a remembered preference. The resume is now raced against a 300ms timeout.
- Restoring a remembered preference created two engines, so the gesture retry found a stale suspended one occupying the slot and did nothing. There is now exactly one engine at a time, and cleanup can reach one that is mid-start.
- Unrelated, found while testing: the header's decorative scrim extends a header's height below the header and had `pointer-events: auto`, so it sat over a 76px band of page content and could swallow clicks meant for it. Now `pointer-events: none`.

### Not built in this stage

Nothing was deferred from the brief. The direction also mentions a section-transition wave and a per-beacon chord on section change; those belong to Stage 7 integration, where sections publish their own events.

### Known limitations

- Keyboard tabbing through the corridor fires `project:active`, because focusing a plane makes it the active one. It is the same semantic event as scrolling to it, but it does mean tab navigation is audible.
- Cue levels were balanced by reading the graph, not by listening on calibrated monitors. They should be reviewed by ear before launch.
- Safari's older `webkitAudioContext` path is detected but untested here.

### Documentation

`src/sound/README.md` covers how to change volume, how to add or remove an event, and how to move to audio files if that is ever wanted.

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run validate:content`: passed; 8 projects, 74 case-study blocks, 8 placeholder records
- `npm run validate:scene`: passed; 21 checks
- `npm run typecheck`: passed
- `npm run build`: passed; all routes prerendered

## Stage 10: Final quality pass

Status: complete

No approved section was redesigned. Three defects were found and fixed; everything else was verification.

### Defects found and fixed

**1. Project artwork was not clickable.** Since Stage 3 the plane's full-area click overlay (`.link::after`) painted _underneath_ the screenshot, so only the small title text was actionable. Tapping a project image on a phone did nothing. Two causes, both fixed:

- The overlay had no `z-index`, and the label precedes the media in the DOM.
- The corridor's `near` and `distant` states dimmed `.label` with `opacity`, which creates a stacking context and trapped the overlay inside the label. The dimming is now split: `opacity` on the index, rule and metadata, and `color` on the title, so no ancestor of the link is ever an opacity layer.

Verified: every corridor plane is clickable at its centre at 1440, 1280, 768 and 390, and a real tap at 390 opens the project.

**2. The hero headline swallowed clicks on the project planes.** The display lines and the statement block are block-level, so their boxes spanned far past their text and sat above the planes on `z-index: 2`. Roughly 60 percent of the Relay plane was unclickable. Both now use `width: fit-content`; the headline line box went from 821px to 557px. Zero blocked sample points at all four breakpoints.

**3. Heading levels skipped h1 to h3** on the homepage. The hero planes sat directly under the page `h1` with no `h2` between. They are now `h2`.

### Verification

| Check                | Result                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual fidelity      | Hero, corridor and footer match the three references: monumental condensed type, receding planes, green particle stream, purple horizon beacons, reflective floor, flat contact plane |
| Project content      | 8 projects, 74 case-study blocks, all from the registry                                                                                                                               |
| Case-study routes    | All 8 return 200 and prerender; an unknown slug returns 404                                                                                                                           |
| Responsive           | No horizontal overflow at 1440, 1280, 768, 390 or 320                                                                                                                                 |
| Keyboard             | 24 tab stops, **0 without a focus ring, 0 left off screen**                                                                                                                           |
| Semantic headings    | One `h1` per page, no skipped levels on any of the three page types                                                                                                                   |
| Contrast             | Every sampled text node passes WCAG AA against the background                                                                                                                         |
| Alt text             | 19 images across three pages, **0 missing alt, 0 broken**                                                                                                                             |
| Reduced motion       | 0 running animations, corridor unpinned, pointer tracking off, all content at full opacity                                                                                            |
| Sound off by default | **0 AudioContexts** after a full load including heavy pointer movement and scrolling                                                                                                  |
| Touch                | No custom cursor, native cursor intact, no pinning, tap opens a project, scrolling reaches the end                                                                                    |
| WebGL fallback       | Scene inactive, CSS environment visible, 15 headings and 23 links intact, no errors                                                                                                   |
| Scroll traps         | Reaches 6910 of 6910 with the footer visible                                                                                                                                          |
| Layout shift         | **CLS 0** over a full-page scroll                                                                                                                                                     |
| Memory leaks         | Listener, observer and animation-frame counts identical across three resize and visibility cycles                                                                                     |
| Duplicate listeners  | None; counts return to baseline every cycle                                                                                                                                           |

### Maintainability audit

| Check                         | Result                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Hardcoded project names in UI | **0** across `src/components`, `src/app`, `src/motion`, `src/webgl`, `src/sound`, `src/styles`                    |
| Slug-specific branches        | **0**                                                                                                             |
| Order from data               | Loader sorts by `order`; no ordering array anywhere in the UI                                                     |
| Images from data              | **0** image paths in UI code                                                                                      |
| Routes from data              | **0** `/work/` literals in UI code; all via `getProjectRoute`                                                     |
| Footer links from config      | All 6 from `siteContent`                                                                                          |
| Motion centralized            | One hardcoded duration remains: a `1ms` reduced-motion kill switch, which is a disable value rather than a timing |
| Sound events centralized      | All 8 declared in `soundEvents.ts` and all 8 wired                                                                |
| WebGL cleanup                 | Verified: no growth across cycles; context loss and unmount both dispose                                          |

### Performance

Production build, headless Chromium on ANGLE/Metal:

| Viewport      | Tier   | DPR applied | Backing store | Idle | Pointer active |
| ------------- | ------ | ----------- | ------------- | ---- | -------------- |
| 1440x900 @1x  | high   | 1           | 1440x900      | 60.2 | 60.0           |
| 1440x900 @2x  | high   | 2           | 2880x1800     | 60.1 | 60.0           |
| 1920x1080 @2x | high   | 2           | 3840x2160     | 60.1 | 60.0           |
| 390x844 @3x   | medium | 1.5         | 585x1266      | 60.3 | 60.0           |

- **Lazy loading**: 10 of 11 homepage images and 5 of 6 case-study images are `loading="lazy"`; only the hero's first plane is eager.
- **Responsive images**: every `<Image>` carries a `sizes` prop. It is currently inert because every asset is SVG, which Next serves unoptimized. Proven correct by temporarily swapping in a raster: Next emitted a 10-entry srcset from 256w to 3840w and served the 640w variant at 1440 wide.
- **Device pixel ratio**: capped per tier. A 3x device selects the medium tier and applies 1.5.
- **Background work**: 60 animation frames per second visible, **0 while hidden**, 60 on return.
- **Scroll cost**: 40 scroll jumps in 22ms produced **0 long tasks**. The corridor writes custom properties and reads no layout during a scroll.
- **Bundle**: 185 KB gzipped first-load JS. three.js is 129 KB gzipped in a separate lazy chunk, absent from the initial HTML.

### Remaining issues, ranked

1. **All contact URLs are placeholders.** Email, LinkedIn and GitHub still point at `replace-with-real-*`. Blocks launch.
2. **All project content is placeholder.** 8 records, 74 blocks, every string marked, no real copy, media, metric or quotation. Blocks launch.
3. **Case-study pages have no art direction.** They are structurally complete and use the token system, but are typographically plain next to the homepage.
4. **`validate:content` checks that media exists, not that it parses.** A malformed SVG passed validation in Stage 6 and reached the corridor.
5. **Sound levels have never been heard.** Balanced by reading the graph. Needs a listen on real monitors.
6. **Display face is undecided.** Anton is the interim cut; Druk Condensed needs a licence decision.
7. **Two block-system gaps.** `process` has no `columns` variant although `gallery` and `metrics` do; there is no outbound-link block for a live site or repository.
8. **Keyboard tabbing through the corridor is audible** when sound is on, because focusing a plane makes it active.
9. **Adaptive quality responds to render cost, not main-thread contention.** A starved main thread does not downgrade the tier, because the sampler measures the render call. The downgrade path itself is verified in the headless checks.
10. **Safari's `webkitAudioContext` path is detected but untested here.**
11. **No testing on real hardware.** All figures are headless Chromium on Apple silicon.

### Validation

- `npm run format:check`: passed
- `npm run lint`: passed
- `npm run validate:content`: passed; 8 projects, 74 case-study blocks, 8 placeholder records
- `npm run validate:scene`: passed; 23 assertions
- `npm run typecheck`: passed
- `npm run build`: passed; `/` static, all eight `/work/[slug]` prerendered

### Evidence

`design/screenshots/stage-10/` holds 20 captures: hero, selected work, statement, footer and a full case study at each of 1440x900, 1280x800, 768x1024 and 390x844.
