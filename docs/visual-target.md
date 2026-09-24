# The Living Digital Landscape — visual target

Date: 2026-09-23

## Authority and reference inventory

This document is the visual contract for the homepage. It does not authorize a new aesthetic.

Approved reference paths named for this pass:

1. `docs/references/homepage-hero-natural-flow-v3.png` — 1586 × 992; SHA-256 `b4e34d3c2335b9f41ef6b3952ab4f2d6bbfb2d24bff09e70a662c92e0b6ad068`.
2. `docs/references/projects-body-cinematic-with-cliff-v3.png` — 1586 × 992; SHA-256 `d43711facce7fc8fc7abb8278a0c41b8fbf3d1aff44968461a62ecb0fb787951`.
3. `docs/references/footer-cinematic-with-end-rock-v3.png` — 1586 × 992; SHA-256 `532e708cb9535f732621275a1641b3cb798f4d989c72a4013a56d5a9dd8c5f24`.

These are byte-for-byte copies of the three supplied approved images. They were opened successfully from the repository paths on 2026-09-23. Do not silently substitute a different composition.

## Core proposition

The site is one continuous, physically coherent nocturnal landscape. Typography, project imagery, rocks, water, particles, light, and interaction occupy the same world. DOM content remains the accessible source of truth, but it must feel embedded in the environment rather than arranged as conventional cards over a moving backdrop.

The environment is cinematic and restrained:

- Near-black aubergine sky and water.
- Realistic black-violet rock with wet, irregular, non-repeating silhouettes.
- Low lavender-purple horizon fog and a few distant beacon lights.
- One narrow yellow-green particle current that changes course instead of becoming a full-screen cloud.
- Porcelain typography, quiet technical labels, and gold only for focus/cursor/contact feedback.

## Non-goals

- No holographic rings, cyberpunk grids, glassmorphism, chrome organisms, liquid-metal forms, alien anatomy, generic sci-fi HUDs, random geometric shapes, or extra neon colors.
- No particle-density increase as a substitute for fixing path shape, lighting, occlusion, scale, or composition.
- No repeated use of one obvious rock model or one silhouette mirrored across the page.
- No ocean spectacle: no large waves, whitecaps, foam, or game-engine water.
- No project cards floating independently of the waterline and terrain.
- No project-specific homepage layout branches. A project may supply content and media, not bespoke layout code.

## Global composition rules

### Spatial continuity

- The horizon and waterline persist coherently through Hero, Selected Work, About, and Footer, while each chapter may alter crop, light, and terrain.
- Content establishes a readable foreground/midground/background hierarchy. Empty darkness is intentional only when it creates scale; it must not separate the text from the landscape.
- Project planes meet the environment through occlusion, reflection, atmospheric depth, and nearby terrain. Their labels stay in semantic DOM.

### Typography

- Condensed display type is monumental, left-weighted, and close to the scale in the approved references.
- Desktop Hero, Selected Work, and Footer headings are primary landscape masses, not ordinary section headings.
- Body copy stays neutral, short, and highly legible. Mono labels remain supporting information.
- Mobile retains authority with deliberate line breaks and a meaningful share of the viewport; it is not a uniformly scaled-down desktop composition.

### Rocks

- Show 2–3 distinct rock groups in a desktop viewport and no more than 2 on a narrow mobile viewport.
- Hero target: a low cropped shelf at the left/near edge, a larger asymmetrical outcrop at the right/foreground edge, and at most one quiet mid-distance fragment.
- Selected Work target: terrain may partially occlude a project edge, support depth transitions, and form a clear foreground cliff or shelf without covering project names or links.
- Footer target: one dominant end rock anchors the right side, with an optional low fragment at the opposite edge.
- Each group needs a distinct silhouette, scale, rotation, and depth. Materials remain near-black with rough wet highlights and narrow purple rim light. Rocks stay mostly still.

### Water

- Water is a near-still reflective computational floor, not a literal ocean.
- Motion is slow and mostly horizontal. Surface relief stays shallow.
- Reflections are vertically stretched, softly broken, and source-aligned: rocks, project planes, beacons, and occasional particles should have restrained contact with the surface.
- Pointer ripples are local, brief, and limited to the water region. No whole-surface reaction.
- The water must remain legible on low-quality and no-WebGL fallbacks.

### Horizon and purple light

- Fog stays low and lateral at the horizon. Purple is an atmospheric depth cue, not a series of vertical neon columns.
- Use 3–4 restrained beacon sources on desktop, fewer when mobile cropping requires it.
- Sources and their reflections align. Brightness may respond to the active chapter or project, but constant pulsing is not allowed.
- Rocks and project edges receive narrow lavender rim light; the sky remains predominantly near-black.

### Particle current

- Render one continuous, narrow, legible current from left to right with a clear entry, bend, and exit.
- Use width, depth, speed, brightness, branching, and occlusion—not raw count—to make the current feel alive.
- The current bends around display type, project planes, and rocks. It may divide briefly at terrain, then rejoin the same stream.
- Stray wisps stay sparse. Particles do not fill the entire sky or become background glitter.
- Gold appears only on brief close pointer contact. Yellow-green remains the primary current color.

### Cursor and pointer response

- Fine pointers receive a precise gold dot and a restrained ring. The dot follows the actual pointer; the ring may ease slightly but cannot feel inaccurate.
- Particle response has three readable zones: awareness, orbit/division, and contact. The path repairs gradually after fast movement.
- Water responds only in its visible lower region. Rocks receive lighting/particle response but do not rotate toward the cursor.
- Coarse pointers use native touch behavior with no custom cursor dependency.

## Section composition

### Hero

- The headline dominates the left half while leaving a navigable visual corridor through the scene.
- Supporting copy sits close enough to belong to the headline but clear of terrain and the particle core.
- Rocks frame the composition from both lower edges. Water and the horizon establish scale immediately.
- The particle current curves behind and around the words; it does not wash uniformly across them.
- The transition to work should feel like moving deeper into the same place, not reaching a new card section.

### Selected Work

- The heading and introduction occupy the upper-left at entry, matching the approved reference's strong early read rather than appearing after a large empty band.
- Projects form one spatial sequence at varied depths. Active work is sharp and readable; neighbors remain visible enough to establish direction.
- Project screenshots remain flat rectangular artifacts, but terrain, water contact, atmosphere, and perspective integrate them into the world.
- Project number, title, role, category, year, and route remain data-driven. Any project can replace another without section reconstruction.
- Two featured projects must still produce a resolved composition; the layout must also scale to a longer registry without special cases.
- Mobile uses a deliberate vertical sequence with readable media, metadata, and case-study links. It does not require a drag gesture.

### About

- This is a calm narrative chapter, not a spacer between Work and Contact.
- Keep the “How I work” thesis, then provide enough approved supporting copy to explain the relationship between design judgment, production code, experimentation, and shipped outcomes.
- The landscape quiets here: wider dark space, a thinner current, and less active terrain, while retaining the same waterline and atmosphere.
- The section must occupy enough space on mobile to read as its own chapter before the Footer begins.

### Footer

- The contact headline returns to monumental scale and anchors the left side.
- The conversation link is a thin spatial plane, not a glass card. Its waveform remains a restrained sound/contact motif.
- A dominant end rock holds the right edge and meets the water with a believable reflection.
- The particle current completes a final arc through the composition without turning into a dense cloud.
- Contact links and Back to Top remain readable, keyboard accessible, and visually separated from the water texture.

## Responsive and accessibility rules

- Validate at 390 × 844, 768 × 1024, 1280 × 800, and 1440 × 900, plus 320px minimum width.
- The fixed header must never clip the wordmark, availability, sound state, or navigation; safe-area insets are included where applicable.
- Keyboard focus follows a logical order and remains visible above the fixed header. Focusing a project reveals it without trapping or unexpected animation.
- Drag/scroll exploration always has click/tap and keyboard alternatives.
- `prefers-reduced-motion` removes pinned scroll choreography, cursor easing, looping ambient movement, water drift, and particle animation. The resulting still composition must remain intentional.
- Provide an explicit way to pause continuous decorative motion if it runs beside content for more than five seconds.
- Sound remains opt-in, independently controllable, and never required to understand a state.

## Performance and fallback rules

- Semantic content and navigation render before optional Three.js, rock models, reflections, or audio.
- Load only the rock assets needed for the visible/next chapter. Do not download every chapter's high-resolution model at initial scene creation.
- Compress geometry and textures and set a measured transfer budget before asset approval. The current multi-megabyte-per-rock files are not the target.
- Adaptive quality may reduce DPR, particle count, reflection resolution, and ripple count, but must preserve composition and material identity.
- Stop rendering and audio when hidden; stop or reduce work when the scene is outside the active chapter.
- No-WebGL and context-loss fallbacks retain the same horizon, water, rock framing, content order, and contrast.
