# Portfolio architecture

## Purpose

This is a greenfield Next.js App Router project. Stage 1 provides a small production-ready shell and clear boundaries for a later cinematic portfolio. It deliberately does not implement the homepage composition, animation, WebGL environment, cursor, or soundscape.

The approved visual direction is a near-black aubergine environment with monumental condensed typography, flat project planes in perspective, acid-green particles, a restrained reflective floor, purple horizon lights, sparse angular rocks, and gold pointer feedback. Chrome organisms, liquid-metal blobs, membranes, biological forms, tubes, tentacles, alien irises, large circular mechanisms, and bright porcelain organic landscapes are explicitly rejected.

## Architectural principles

1. Content is plain typed data and does not import rendering code.
2. React owns document structure, semantics, routing, and accessible controls.
3. Motion orchestrates states and transitions but does not own content.
4. WebGL renders atmosphere and spatial objects behind a narrow adapter boundary.
5. Sound responds to semantic experience events and never drives navigation.
6. Design tokens are the shared visual contract for DOM, WebGL, and sound-related UI.
7. Server Components are the default. Client Components are small interactive leaves.
8. Every enhanced experience has a responsive, keyboard-safe, and reduced-motion equivalent.

## Source layout

```text
src/
  app/                    App Router routes, metadata, global style entry
  components/             React presentation and layout components
    layout/               Page-level semantic shells
  content/                Typed static content
    projects/             Project schema and ordered project collection
    site/                 Site-wide labels and copy
  motion/                 Future scroll and animation orchestration
  sound/                  Future audio context, consent, cue map, and mixing
  styles/                 Design tokens and reset rules
  webgl/                  Future canvas, scenes, shaders, and quality tiers
```

The `design/` tree contains source references for people, not production assets. Browser-delivered imagery belongs in `public/images/` and must have matching content metadata and alternative text.

## System boundaries

### Project and site content

`src/content` is the only source of portfolio facts, labels, ordering, roles, years, media paths, and accessibility descriptions. `Project` is a readonly type. The ordered `projects` array is the future collection entry point.

Adding, removing, replacing, or reordering a project will mean editing the data collection and corresponding assets, not rebuilding React components. Route generation can later read the same collection for `generateStaticParams`, metadata, the homepage sequence, and project navigation.

Content must not import from components, motion, WebGL, or sound.

### React layout and presentation

`src/app` owns routes, layouts, metadata, loading states, error boundaries, and server-rendered page composition. `src/components` owns reusable semantic presentation. Components receive content through typed props and must remain unaware of how content is stored.

The DOM remains the canonical accessible experience. Headings, links, project names, controls, focus order, and case-study content must remain usable if JavaScript, WebGL, motion, or audio is unavailable.

### Motion and scroll orchestration

`src/motion` will own timelines, scroll state, transition state, and input normalization. It may publish semantic events such as `project-active`, `project-open`, and `section-entered`. It must not duplicate content or directly manage Web Audio nodes and Three.js scene objects.

Motion dependencies are deferred until a prototype proves the need. Scroll-driven work must avoid React state on every frame, isolate client code, clean up subscriptions, and collapse to static or crossfade behavior under `prefers-reduced-motion`.

### WebGL environment

`src/webgl` will own canvas lifecycle, scene composition, shaders, particles, reflective floor, lights, rocks, render loop, disposal, input sampling, and adaptive quality. A thin React client component will mount the canvas and pass serializable scene data plus semantic state.

The WebGL scene must never be the only source of text or navigation. Heavy modules should load dynamically after the semantic page is available. Three.js and React Three Fiber are not installed in Stage 1, avoiding an unused production bundle and keeping the renderer choice open.

### Sound

`src/sound` will own the audio context, consent, session preference, cue registry, mixing, and disposal. It subscribes to the same semantic events used by motion and WebGL. It must not infer state from DOM selectors or canvas pixels.

Sound begins off, starts only after user intent, uses conservative volume, exposes an unambiguous on/off control, and has a visual equivalent for every cue. The experience remains complete without audio.

### Design tokens

`src/styles/tokens.css` is the shared source for semantic colors, typography roles, spacing, layout limits, focus treatment, timing, and layer order. CSS Modules hold component-specific rules. Global CSS is limited to token imports, reset behavior, document defaults, selection, and focus.

Later WebGL and sound UI adapters should read mapped TypeScript constants generated or manually mirrored from the semantic token names. They should not scatter raw brand values throughout shaders or components.

## Data flow

```text
typed content -> Server Components -> semantic DOM
                           |
                           v
                  client experience state
                   /        |         \
              motion      WebGL      sound
```

Content flows downward. Runtime systems exchange small semantic states and events, not component instances or duplicated project records.

## Responsive foundation

- Layout gutters and type use fluid `clamp()` tokens.
- Full-height shells use `100dvh` to avoid mobile browser viewport jumps.
- The minimum supported layout width is 320px.
- Complex perspective compositions will collapse to a linear, single-column project sequence below 768px.
- Coarse pointers will receive tap-safe controls and no custom-cursor dependency.
- Canvas resolution, particle count, reflection quality, and postprocessing will scale by viewport, device pixel ratio, and measured frame budget.

## Accessibility foundation

- Server-rendered semantic content remains primary.
- Focus uses a visible gold outline token and is never removed without replacement.
- Color is not the only state indicator.
- Controls will have accessible names, keyboard operation, and minimum target sizing.
- `prefers-reduced-motion` globally removes nonessential transitions and will also select a system-level static mode.
- Sound is opt-in, remembered only for the session, and never required.
- Canvas content will be decorative or described through adjacent DOM content.
- Contrast targets are WCAG 2.2 AA at minimum, with AAA targeted for body text when compatible with the art direction.

## Performance targets

- Largest Contentful Paint below 2.5 seconds on a representative mobile connection.
- Interaction to Next Paint below 200 milliseconds.
- Cumulative Layout Shift below 0.1.
- Useful semantic DOM rendered before optional WebGL and sound boot.
- No Three.js, React Three Fiber, motion, or audio runtime in the initial bundle until used.
- Dynamic import for the canvas and other costly client-only systems.
- Stable media dimensions and optimized `next/image` delivery for production assets.
- Adaptive rendering with a 60 fps target on capable desktop hardware and a stable 30 fps minimum quality tier on supported mobile hardware.
- Pause render and audio work when the document is hidden or the canvas is outside the active experience.

## Dependency policy

Stage 1 uses only Next.js, React, TypeScript, ESLint, the Next.js ESLint configuration, and Prettier. New runtime dependencies require a documented owner, bundle impact, fallback, cleanup strategy, and reason native platform features are insufficient.

### Three.js

Added in Stage 5 for the environment scene.

- **Owner:** `src/webgl`. Nothing outside that directory imports it.
- **Bundle impact:** 129 KB gzipped, in its own chunk. It is behind a dynamic
  import inside `SceneCanvas`, so it is absent from the initial HTML and from
  the 176 KB gzipped first-load JS. It is fetched only after the semantic page
  has rendered, and only when WebGL is available.
- **Fallback:** `detectCapability` runs first. Without WebGL the module is still
  fetched but the environment is never constructed, `data-scene-active` is not
  set, and the CSS `EnvironmentLayer` remains the environment. The page is
  complete with no canvas at all.
- **Cleanup:** `createEnvironment` returns `destroy`, which disposes every
  geometry, material and render target, disposes the renderer and forces context
  loss, and removes its own listeners.
- **Why not the platform:** the scene needs a planar reflection pass, a depth
  buffer, per-face-normal meshes and custom shaders. Raw WebGL2 would mean
  writing program management, matrix maths, render-target handling and resize
  plumbing before any of it could be seen. React Three Fiber was rejected: it
  would put a second reconciler in the client bundle, and this architecture
  already specifies a thin imperative canvas leaf rather than a React scene tree.

A dedicated motion library remains unnecessary: Stage 4's hero sequence is CSS
animation driven by centralized custom properties.

## Implementation stages

1. Foundation: application shell, static content contract, tokens, docs, references, and validation.
2. Content model: real projects, route generation, metadata, case-study structure, and media inventory.
3. Static composition: accessible responsive homepage and project pages without cinematic enhancement.
4. Motion prototype: hero timing, project corridor, transitions, and reduced-motion behavior.
5. WebGL prototype: particles, floor, horizon lights, rocks, quality tiers, and lifecycle tests.
6. Sound prototype: consent, session state, event cues, mixing, and silent-mode parity.
7. Integration: connect shared semantic state across DOM, motion, WebGL, and sound.
8. Hardening: device testing, accessibility audit, performance budgets, visual regression, and production deployment.

Each stage must be independently shippable and must not require later systems for basic navigation or content access.

## Risks and controls

- **Creative scope overwhelms content:** build semantic project routes and static composition before cinematic layers.
- **Main-thread contention:** keep React out of frame-by-frame updates, measure early, and use adaptive render tiers.
- **Hydration cost:** keep Server Components as the default and isolate client leaves.
- **WebGL support and context loss:** provide a complete DOM fallback and explicit renderer disposal/recovery.
- **Scroll hijacking harms navigation:** preserve native scroll semantics, keyboard access, deep links, and a reduced-motion linear mode.
- **Sound consent and fatigue:** default off, limit repetition, use conservative gain, and provide immediate control.
- **Content and scene drift apart:** derive routes, labels, planes, and navigation from the same typed project collection.
- **Font licensing:** do not commit or ship Druk without a verified license; use an approved open-source condensed fallback if needed.
- **Reference assets leak into production:** keep `design/references` outside `public` and never import from it.
- **Rejected visual direction returns:** treat the approved and rejected lists in this document as review gates.

## Architecture decision record

- App Router and Server Components establish the route and semantic baseline.
- Native CSS plus CSS Modules keeps tokens centralized without tying the art direction to a utility framework.
- Static TypeScript content avoids a database while preserving type safety and deterministic builds.
- Advanced visual and audio dependencies remain uninstalled until their prototypes are approved.
