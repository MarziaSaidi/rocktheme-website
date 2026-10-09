# Typography and interaction system

Status: **approved for staged integration** (2026-10-08, second review).
Nothing here is in production except the hero role-line fix. §13 is the final
quality review of the prototype; §14 is the integration plan, one stage at a
time, each approved before the next.

Related: `homepage-creative-direction.md` (the world), `camera-system.md`
(frozen camera values), `src/motion/README.md` (motion token contract).

## Decisions (review of 2026-10-08)

| #   | Decision                                                                                                                                                                                             | Where it changes this document |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | Keep the Stone, Dust, Light and Signal language                                                                                                                                                      | §1                             |
| 2   | Hero: **Breath** is the direction. Compare it with a subtler version capped at **3 px** of letter movement before integration                                                                        | §5 Hero                        |
| 3   | Selected Work may get new typography interactions. Camera, project layout and the entrance/exit sequences stay exactly as they are. The active project's **title, link and visual respond together** | §5 Selected Work               |
| 4   | **Keep Anton** for now. Make visual comparisons with Archivo before any font recommendation                                                                                                          | §10                            |
| 5   | Quill **ink** and Survue **approach** approved as concepts for isolated prototypes, judged against the actual case-study content                                                                     | §5 case studies                |
| 6   | The faster decode only on a short list of important actions. Ordinary navigation uses weight, colour or underline                                                                                    | §4                             |
| 7   | Scroll typography is welcome where it means something, driven by existing camera state, with no new scroll system                                                                                    | §1 rule 1, §5, §7              |
| 8   | Review autoplay and reading time; never move visitors on before they can finish reading                                                                                                              | §5 case studies, new §11       |

### Second review (2026-10-08)

| #   | Decision                                                                                     | Where                |
| --- | -------------------------------------------------------------------------------------------- | -------------------- |
| 9   | Hero uses the **3 px cap** (+20 weight, +1.5 width; 2.9 px measured)                         | §5 Hero, §14 stage 7 |
| 10  | Selected Work **title, link and screens respond together**: approved                         | §5, §14 stage 6      |
| 11  | Quill **ink** and Survue **approach** approved as directions, subject to final visual review | §14 stage 5          |
| 12  | **Anton and Archivo both stay available for comparison**; no font change in production       | §10                  |
| 13  | The **reading-time rule** applies to any future autoplay                                     | §11, §14 stage 4     |

---

## 1. The idea: text is made of the world's materials

The site already has a physical vocabulary: black stone, dust that comes out of
the rift and goes back, moonlight, and an instrument voice (the decode labels
and the readout sound). This system gives every piece of text one of those
materials, and the material decides how the text moves.

| Material   | What it is on the site                                       | How it behaves                                                                                               |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Stone**  | Monumental display type: hero, chapter title, footer, titles | Has mass. Rises out of the water and sinks back. Under the pointer it gains weight slowly and lets go slowly |
| **Dust**   | The bio titles                                               | Forms from the rift and returns to it. Already built and approved; nothing changes                           |
| **Light**  | Body copy, leads, descriptions                               | Never pushed around. It is lit: it fades in, and emphasis arrives as light and weight, not movement          |
| **Signal** | Mono labels, nav, CTAs, counters, controls                   | The instrument. Answers immediately. Decodes when something new is said, shifts weight when touched          |

Three rules follow from that, and they are the creative direction:

1. **Scroll moves the camera; text that lives in the camera's world reads the
   camera's state. The pointer moves the type. Time handles arrivals.** There
   is one scroll system, the camera's spring, and text never gets a second one.
   Scroll typography is welcome wherever it says what the camera is doing:
   that the visitor has left the hero, that a project is in the light, that the
   bio is being read. It reads only values the scene already publishes
   (`--arrival`, `data-arrived`, `data-camera-settled`, the card's
   `data-shown`, the bio's `data-on` passage, the footer's `data-ripple`).
   It is never tied to raw page position, and it never measures the page during
   scroll. The scroll moments are listed in §7.
2. **Each role moves once, in its own way.** Display type is expressive, section
   headings are controlled, body copy is calm, labels respond at once. No
   effect is shared by two roles, so the visitor learns the language without
   noticing it.
3. **Every response has a reason.** Weight means attention. Moonlight means
   reading. A decode means new information. Gold means the visitor. If an
   effect can't say which of these it means, it doesn't ship.

This is why the result stays distinctly yours. The reference makes its work
list feel alive with variable weight. Here the same craft follows from the
world you already built: the doorway stones lift when the pointer comes near
(commit 49c19d7), and the headline would answer the same way.

---

## 2. Audit

### What already exists and should be kept

| Where           | Motion                                                                                                     | Status              | Keep because                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------- |
| Doorway         | Arch, shatter, stones lift under the pointer                                                               | Approved            | Sets up the pointer-as-touch idea this system builds on          |
| Header          | Items arrive through a short vertical blur, staggered                                                      | Approved (entrance) | Calm, once                                                       |
| Hero headline   | WebGL ripple reveal (lavender + botanical fringes, moonlit edge)                                           | Approved            | The site's signature entrance                                    |
| Hero copy       | Role decodes, lead and cue rise; on scroll, exit in reverse hierarchy into masks                           | Exit frozen         | Exit is tied to `--arrival`; the role fix is in the working tree |
| Mono labels     | Decode wave (34 ms stagger, 190 ms scramble, moonlit accent)                                               | Approved values     | It's the Signal voice, keep it rare                              |
| "SELECTED WORK" | Words rise out of masks on the water, paced by the camera                                                  | Frozen              | Chapter break                                                    |
| Project cards   | Glass, then index, title, role, body, meta, action in sequence; reverse exit; pieces in pointer parallax   | Frozen              | Approved as stills and sequences                                 |
| Bio             | Dust titles, reading light, signatures (snap / print / sweep), rift breath                                 | Approved            | The calm scene; already the most considered text motion          |
| Footer          | Headline ripple on each view, copy follows, waveform wipes in                                              | Approved            | Ends where the hero began                                        |
| Case study      | Title mask rise, rail in reading order, stage indicator slides, story progress bars, hover pauses autoplay | Built, not frozen   | The structure is good; only the story-change motion is generic   |
| Sound           | Readout on project settle and decode, chime on contact                                                     | Approved            | Text and sound already share events                              |

### Where text is static, disconnected or generic

| Where              | Finding                                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero headline      | Inert after the ripple. The largest object on the page never answers the visitor                                                                                                                                                                    |
| Navigation         | Doesn't know where you are (`aria-current` appears nowhere). Hover is a gold underline only. Nothing changes when a project becomes active                                                                                                          |
| Cursor             | One generic grow (48 → 72 px) that covers the label it's over; sized with `width`/`height` (layout every frame); 60 ms hit-test timer                                                                                                               |
| CTAs               | Each link behaves differently: colour only, colour plus underline, an arrow nudge, a plane rotation snap. Decode plays on entrance but never again                                                                                                  |
| Arrows             | `→` nudges 0.25 rem in the gallery; `↗` and `↑` are static; `ArrowGlyph` exists but has no behaviour                                                                                                                                                |
| Footer             | After its ripple the headline is inert; the contact plane snaps between two angles                                                                                                                                                                  |
| Case-study stories | Every story change re-keys the copy, and eyebrow, title, description, points and details all play the same `line-in` (opacity + 0.45 em rise, 60 ms per line). This is the one generic fade-up on the site, and it repeats every 6 s under autoplay |
| Case-study rail    | Facts, links and description share the copy reveal; nothing reacts to input                                                                                                                                                                         |
| Mobile             | Only the phone menu links have a pressed state. Touch gets almost no feedback                                                                                                                                                                       |
| Type system        | Four faces, not the three the direction describes: Archivo (hero, chapter title), Anton (footer, card titles, case-study titles, metrics), Geist, Geist Mono. `layout.tsx` calls Anton "interim"                                                    |

### Technical facts that shape the design

- **Archivo** is variable: weight 100–900, width 62–125. **Geist** and **Geist
  Mono** are variable in weight (100–900). **Anton** has one weight and no
  axes, so nothing set in Anton can respond through the font.
- **Geist Mono keeps its advance width at every weight.** A weight change on a
  mono label causes no reflow, so Signal feedback by weight costs a style
  recalculation and no layout. This is the cheapest expressive tool on the site.
- Splitting text into letters breaks the browser's kerning between them. The
  headline prototype measures kerning once and writes it back as margins (pairs
  "Ta" −0.061 em and "t," −0.050 em would otherwise jump about 7 px). Any
  letter-level effect must reuse that technique.
- The camera loop already publishes scroll state (`--arrival`, `data-arrived`,
  details windows, the bio rest). Scroll-linked text must read those, never
  measure the page during scroll and never add smoothing.

---

## 3. Roles

| Role                         | Face (today)            | Material                      | Entrance                         | Scroll                          | Pointer / focus                                           | Exit                |
| ---------------------------- | ----------------------- | ----------------------------- | -------------------------------- | ------------------------------- | --------------------------------------------------------- | ------------------- |
| Monumental display           | Archivo / Anton         | Stone                         | Ripple, or rise out of a mask    | Leaves with the camera (frozen) | **Mass field**: weight and width gather under the pointer | Sinks into its mask |
| Chapter title                | Archivo                 | Stone                         | Words rise, paced by camera      | Frozen window                   | None (it passes too quickly to touch)                     | Words sink          |
| Project / case title         | Anton                   | Stone                         | Rises as one block               | —                               | Moonlight only (no axes)                                  | Sinks               |
| Story heading (case study)   | Geist 500               | Light → per-project signature | Project signature (§5)           | —                               | None                                                      | Cross-fade          |
| Bio title                    | Geist                   | Dust                          | Approved                         | Approved                        | None                                                      | Approved            |
| Body, lead, description      | Geist 400               | Light                         | Opacity only for new work        | Reading light in the bio only   | None. Never moves under the pointer                       | Opacity             |
| Emphasis inside body         | Geist                   | Light                         | Lights after the sentence lands  | Bio reading light               | None                                                      | —                   |
| Nav, labels, meta, counters  | Geist Mono              | Signal                        | Decode (approved list) or appear | State changes (lit item)        | **Weight lift** 400 → 560, no reflow                      | Opacity             |
| CTAs (outbound actions)      | Geist Mono              | Signal                        | Decode                           | —                               | Weight lift + **decode replay** + arrow swap + ring       | —                   |
| Controls (prev/next, stages) | Geist Mono + ArrowGlyph | Signal                        | Appear                           | —                               | Weight lift + arrow swap; press compresses                | —                   |

---

## 4. Shared motion rules

### Tempos

Four tempos. Every new token in `motion.css` names its tempo.

| Tempo         | Duration     | Used for                                               | Curve                                                 |
| ------------- | ------------ | ------------------------------------------------------ | ----------------------------------------------------- |
| **Touch**     | 90–140 ms    | Press, weight lift on, focus ring                      | `--motion-ease-interface` in; out at 1.6× the in time |
| **Interface** | 200–320 ms   | Hover states, arrow swap, indicator slide, cursor size | `--motion-ease-interface`                             |
| **Reveal**    | 480–900 ms   | Text arrivals, story changes, decodes                  | `--motion-ease-reveal` in, `--motion-ease-exit` out   |
| **Weather**   | 1.2 s and up | Mass field release, moonlight fade, dust, ripple       | Critically damped springs (no overshoot)              |

### Easing and physics

- **Time-driven** motion uses the existing curves. Nothing bounces (direction:
  "nothing should bounce").
- **Pointer-driven** motion uses critically damped springs: quick to take
  (ω ≈ 11), slow to let go (ω ≈ 5). Weight arrives fast enough to feel
  caused, and leaves like a material relaxing.
- **Scroll-driven** motion reads camera state only (`--arrival`, `data-arrived`,
  the details windows, the bio rest). No second smoothing, no Lenis, no
  `scroll` listeners that read layout.

### Hover, focus and press

- **Focus gets everything hover gets.** Keyboard focus triggers the same weight
  lift, decode replay and arrow swap. The gold focus outline stays as is.
- **Hover never hides text.** The ring tightens around CTAs and never sits over
  a label at full size.
- **Press** compresses the label to 0.97 and contracts the ring toward the dot
  (Touch tempo). On touch devices this is the main feedback.
- **The fast decode is reserved for important actions** (decision 6): the
  actions that take the visitor somewhere they chose to go. The list is closed:

  | Action                                           | Where                     |
  | ------------------------------------------------ | ------------------------- |
  | View case study                                  | Selected Work card        |
  | Start a conversation (primary)                   | Footer                    |
  | Contact plane label                              | Footer                    |
  | Watch the complete workflow / live product links | Case-study story and rail |

  It plays once per hover or focus (22 ms stagger, 120 ms scramble), never
  restarts mid-play, and is silent. Everything else is **ordinary navigation**:
  header links, phone menu, back link, socials, back to top, stage nav,
  previous/next, zoom. These answer with weight (Geist Mono 400 → 560, no
  reflow), colour, or the existing underline. Nothing scrambles on them.

### Pointer

- One pointer stream (`pointerSource.ts`) for the cursor, the mass field and the
  contact plane. No component adds its own `pointermove` listener.
- Pointer effects run only with `(hover: hover) and (pointer: fine)`, only when
  their element is on screen and at rest (for the hero, `--arrival` = 0), and
  their loops park when settled.

### Mobile and touch

- No pointer-field effects. Touch gets press states, lit states and decodes.
- Lit states (current section, active stage, active project) are equally
  visible on touch, since they're driven by state, not hover.

### Reduced motion

- The existing contract holds: travel variables go to zero, durations shorten.
- Mass field, moonlight, decode replay, arrow swap and ring easing are off. Lit
  states and weight changes switch instantly. Content is never hidden waiting
  for an animation.

### Performance budget

| Rule                                                                                                   |
| ------------------------------------------------------------------------------------------------------ |
| Animate `transform`, `opacity`, colour and `font-variation-settings` only. No `width`, `height`, `top` |
| No layout reads during scroll; measure on resize and `document.fonts.load`                             |
| No `will-change` on text (it re-rasterises glyphs; measured in the prototype)                          |
| Letter-level variation on at most about 20 glyphs at once, snapped to 40 levels                        |
| Every rAF loop parks when settled; nothing runs while the visitor is still                             |
| Budget per frame for all text effects together: ≤ 0.6 ms normal CPU, ≤ 2 ms at 4× CPU throttle         |
| Never touch the Three.js loop. Text reads camera state; it never writes to the scene                   |

---

## 5. Section by section

Each section gets one signature typographic moment, and no two are the same.

### Doorway (first touch)

- **Keep** everything, including the buttons' current hover. The doorway is
  approved, and "Enter with sound" isn't on the decode list.
- Add press states only.

### Navigation — "the instrument panel"

- **Signature: the lit line.** One gold hairline rests under the current
  section and slides when the section changes (Interface tempo, `transform`
  only). It follows camera state, not page position: Index → Work when the
  chapter title rises (`--arrival` 0.64), Work → About when the bio's first
  title starts forming from the rift, gone when the footer's ripple starts.
- **Project counter**: while Selected Work is active, a mono counter `01 / 02`
  sits after "Work" and decodes to the new number when the card for the next
  project appears (`data-shown`), together with the existing readout sound.
  This is a label decode (new information), not the action decode.
- Hover (ordinary navigation): weight 400 → 560 and the lit line previews under
  the hovered item, then returns. No decode.
- `aria-current="location"` on the lit item.
- Phone menu: the current item carries a moonlit dot; press states on every link.

### Hero — "stone that answers"

- **Signature: the mass field.** Letters near the pointer gain weight and width;
  the line opens around the pointer; moonlight gathers where the pointer rests.
  Active only after the ripple and while the camera is at the hero.
- **Breath is the direction** (decision 2). Two strengths go to review side by
  side with the static headline:

  | Version          | Weight | Width | Max letter travel |
  | ---------------- | -----: | ----: | ----------------: |
  | Breath           |    +36 |    +5 |            8.6 px |
  | Breath, 3 px cap |    +20 |  +1.5 |            2.9 px |

  Travel is the largest distance any letter moves from where it sits today,
  measured on the real headline across 21 pointer positions (the earlier
  6.5 px for Breath came from a single position; the end of "CRAFT," is the
  worst case).

- **Scroll moment:** as the camera starts to move (`--arrival` 0 → 0.03), the
  field lets go over the Weather tempo, so the type has returned to rest before
  the frozen exit drops it into its masks. No hard cut; nothing in the exit
  changes.
- The cursor ring compresses slightly (scale 0.9) over the headline, as if
  pressing on stone.
- Role (Signal): decodes in (fixed). Lead (Light): unchanged.
- Scroll cue: after 4 s at rest, the dot sinks once inside its ring; stops for
  good on the first scroll.

### Selected Work — "the project wakes together"

Camera, project layout and the entrance/exit sequences stay exactly as they are
(decision 3). Everything below happens between the card's entrance and its exit,
on properties those sequences don't use (`scale`, `translate`, `filter`, colour,
background) so the two never fight.

- **Signature: title, link and visual answer as one.** Pointing at any of the
  three (the title, "View case study", or the floating screens), or focusing
  the link, wakes all three together in the Interface tempo:
  - **Title** (Anton, Stone): moonlight rises into the letters from below, to
    62% of their height, with a soft edge; the caps stay porcelain.
  - **Link** (important action): fast decode, `→` swaps, border brightens.
  - **Visual**: the composition opens around its main screen. Supporting pieces
    drift 4 px outward and the main screen lifts by 1.5% and brightens 4%, the
    same "opening around the point of attention" as the hero line.
  - Leaving releases all three together, slower than they arrived.
- **Scroll moment: the title is lit by the camera.** While the camera stands at
  the project (`data-camera-settled`), a little moonlight (20% of the height)
  rests in the title; it drains as the camera starts to leave, before the
  frozen exit. The first plan used `--scene-beacon-glow`, but the prototype
  showed the horizon beacons are switched off in Selected Work (it reads 0).
- **Connected moment:** when a card appears, the readout sound (exists), the
  header counter decode (new) and the lit line on Work happen in the same beat.
- Description (Light): unchanged.

### About / bio — "dust and light" (preserve)

- **No new motion.** It's the calm scene and already the most considered text
  motion on the site, and its reading light is already the site's best scroll
  typography.
- Only shared pieces arrive: the lit line moves to About as the first title forms.

### Contact and footer — "the invitation answers back"

- Headline: ripple on view (approved). Afterwards, moonlight follows the pointer
  across the letters (works in Anton).
- **Signature: the contact plane listens.** It tilts toward the pointer within
  1–3° instead of snapping between two angles, and the waveform brightens in a
  moonlit band at the pointer's x position, like a level meter. On click, the
  existing chime.
- "Start a conversation" and the plane label: fast decode, `↗` swaps.
- Socials, back to top: ordinary navigation (weight, underline); `↑` swaps.

### Quill & Pigeon case study — "ink"

The product moves a list through import, review, validation and save. Its story
titles are short imperative decisions: "Make the expected file structure
visible.", "Count the issues. Point to the correction.", "Close the loop with
what was actually saved."

- **Signature: story titles are written in.** Each title line is revealed by a
  feathered wipe left to right, like a quill drawing the line (≈ 520 ms per
  line, the next line starting 90 ms before the last ends). The glyphs never
  move. It fits the content: every story is a step in turning a file into
  records, and writing a line is the most literal record there is.
- **Validation stories:** the phrase that names the correction gets a thin
  botanical rule drawn under it after the title lands ("the correction",
  "a state"). It is the one green moment on the page; green already means a
  resolved state.
- **Content check:** titles are 5–9 words, one or two lines at the story column
  width, so a wipe is 0.5–1.1 s, shorter than the time it takes to start
  reading the description. Long titles never wipe slower; they simply take one
  more line.

### Survue case study — "approach"

The product helps a cyclist read urgency in traffic approaching from behind.
Its titles are decisions about legibility and urgency: "Make approaching traffic
easier to interpret.", "Bring the vehicle back into the road view.", "Change
the warning. Keep the structure."

- **Signature: story titles close in.** Each title arrives at weight 380 with
  +0.04 em tracking and settles to weight 500 at its normal tracking over
  600 ms. It goes from distant and light to near and solid; nothing moves
  sideways, the letters tighten in place. It mirrors the product's subject:
  something approaching becomes readable.
- **Detection stories:** the title's key word (for example "warning") steps
  through weight 500 → 600 → 700 in three beats, one per risk level, then rests
  at 600. It's used once per story, only where the content is about changing
  urgency.
- **Content check:** Survue's copy is longer (34–109 words per story), so the
  signature must finish before the visitor reaches the description. At 600 ms
  it does.

### Case-study page (shared by both)

- **Story change, by role** (replaces the shared `line-in`):
  1. Eyebrow (Signal): the new label slides up out of a one-line mask, 160 ms.
     No decode.
  2. Story title: the project's signature (ink or approach).
  3. Description, points, details (Light): opacity only, 320 ms, starting
     280 ms after the title. Body copy never travels.
  4. Visual: unchanged (`visual-in`).
- **Stage nav**: the existing indicator becomes the same gold lit line as the
  header. The active stage label sits at weight 560.
- Previous/next, zoom, back link: ordinary navigation, arrow swap and press.
  Live product and workflow links: important actions (fast decode).
- **Reading time** (decision 8): see §11.
- **Arrival from Selected Work** (proposed, separate decision): the card title
  and the case-study `h1` share a view-transition name, so the title travels
  into the page. Text only, so this doesn't involve the unapproved WebGL route
  hand-over.

### Shared components

| Component            | Change                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DecodeText`         | Add `replay="hover"` for CTAs: shorter wave (22 ms stagger, 120 ms scramble), once per hover/focus           |
| `DisplayHeading`     | Optional `field` mode (mass + moonlight). Splits letters only after the ripple, with the kerning fix         |
| `ArrowGlyph`         | Mask swap: the glyph leaves in its own direction and a copy enters from the opposite side, 240 ms            |
| `CustomCursor`       | `transform: scale`; states rest / CTA (tighten, brighter) / display (0.9) / press; `pointerover` hit-testing |
| New `LitLine`        | The shared indicator for header, phone menu and case-study stage nav                                         |
| `Lines` (case study) | Split by role so title, eyebrow and body each get their own motion                                           |
| Mono label base      | `font-variation-settings` transition on weight for every Signal element                                      |

---

## 6. How it connects

**One attention model.** Whatever the site considers "current" is marked the
same way everywhere: the gold lit line, Geist Mono at weight 560, and moonlight.
The current section in the header, the active project, the active case-study
stage and a hovered CTA all speak this one dialect, so the visitor learns it once.

**One cause per signal.** A decode always means new information. Weight always
means attention. Moonlight always means reading. Gold always means the visitor
(cursor, lit line, focus). Green appears only for a resolved state (the Quill
validation rule).

**Events, not animations.** Typography reacts to events the site already
emits: the ripple finishing, the camera settling (`data-arrived`, project
active), the bio rest, story changes, contact open. Text, camera and sound
answer the same events, which makes them feel connected and not merely
synchronised.

**Continuity across pages.** Selected Work's "View case study" → the case-study
title (view transition) → "Selected work" back link (returns to the same
station, which already works via `workReturn`). The lit line in the stage nav
is the same object as in the header.

---

## 7. Storyboard

Desktop, 1440 × 900. Scroll offsets from `camera-system.md`. **New** marks
proposed beats; everything else exists.

### Scroll moments (all driven by camera state)

| Moment                 | Reads                                    | Text response                                                                        | Status   |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Leaving the hero       | `--arrival` 0 → 0.03                     | **New:** the mass field lets go, so the headline is at rest when the exit begins     | Proposed |
| Hero copy exit         | `--arrival` 0.03 → 0.22                  | Lines sink into their masks in reverse hierarchy                                     | Frozen   |
| Entering Selected Work | `--arrival` ≥ 0.64                       | Chapter title rises (frozen). **New:** lit line slides to Work                       | Mixed    |
| A project in the light | `data-camera-settled`, card `data-shown` | **New:** moonlight rests in the title while the camera stands there; counter decodes | Proposed |
| Leaving a project      | card `data-shown` removed                | Card exits (frozen). **New:** the title's light goes with it                         | Mixed    |
| Reaching the bio       | first title's dust forming               | Dust and reading light (approved). **New:** lit line slides to About                 | Mixed    |
| Reaching contact       | footer `data-ripple`                     | Ripple (approved). **New:** lit line leaves the header                               | Mixed    |

### Home

| Beat                 | Trigger                                      | What the visitor sees                                                                                                                |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Doorway              | Load                                         | Arch; stones lift under the pointer. **New:** press states only                                                                      |
| Through the doorway  | Click                                        | Shatter, header arrives (blur stagger)                                                                                               |
| Hero +0 ms           | Page not inert                               | Headline ripple                                                                                                                      |
| Hero +820 ms         | Timeline                                     | Role decodes (fixed)                                                                                                                 |
| Hero +940 / +1120 ms | Timeline                                     | Lead rises, scroll cue decodes                                                                                                       |
| Hero, ripple done    | `data-ripple="done"`                         | **New:** headline accepts the pointer (Breath, or the 3 px version). Ring compresses over it. Lit line under Index                   |
| Hero idle 4 s        | No input                                     | **New:** cue dot sinks once                                                                                                          |
| First scroll         | `--arrival` 0 → 0.03                         | **New:** the field lets go                                                                                                           |
| 0 → 2070 px          | `--arrival` 0.03 → 0.22                      | Copy leaves into masks in reverse hierarchy (frozen)                                                                                 |
| Chapter title        | arrival 0.64 → 0.96                          | "SELECTED WORK" words rise and sink (frozen). **New:** lit line slides to Work                                                       |
| Quill settles        | card `data-shown`                            | Card details compose (frozen), readout sound. **New:** counter decodes `01 / 02`; title takes the beacon's light                     |
| Point at the project | Pointer on title, link or visual; link focus | **New:** title lit from below, link decodes and `→` swaps, the composition opens around its main screen, all in one beat             |
| Quill → Survue       | 4725 → 7425 px                               | Camera travel (frozen)                                                                                                               |
| Survue settles       | card `data-shown`                            | Card details (frozen), readout. **New:** counter decodes `02 / 02`                                                                   |
| Turn to the bio      | Bio shot                                     | Camera turn (not frozen, unchanged)                                                                                                  |
| Bio                  | Dust forming                                 | Dust titles, reading light, signatures (approved). **New:** lit line slides to About                                                 |
| Contact              | Footer ripple                                | Ripple, then lead, actions, plane, waveform (approved). **New:** lit line leaves                                                     |
| Contact, at rest     | Pointer                                      | **New:** moonlight on the headline; the plane tilts toward the pointer; the waveform's moonlit band follows the pointer's x position |
| Important actions    | Pointer / focus                              | **New:** "Start a conversation" and the plane label decode; `↗` swaps                                                                |
| Ordinary links       | Pointer / focus                              | **New:** socials and back to top shift weight; `↑` swaps                                                                             |

### Case study

| Beat              | Trigger            | What the visitor sees                                                                                         |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Arrive            | Navigation         | Title rises out of its mask (exists). _Proposed:_ title arrives from the card via view transition             |
| +80 → +980 ms     | Timeline           | Rail, facts, stage nav, back link in reading order (exists). **New:** lit line settles under the active stage |
| Story change +0   | Autoplay / control | **New:** eyebrow slides out of its mask (160 ms)                                                              |
| Story change +60  |                    | **New:** title signature: Quill **ink** wipe / Survue **approach** settle                                     |
| Story change +280 |                    | **New:** description, points, details fade in (opacity only)                                                  |
| Quill, Validation | Title landed       | **New:** botanical rule draws under the correction phrase                                                     |
| Survue, Detection | Title landed       | **New:** urgency word steps through three weights                                                             |
| Hover story       | Pointer            | Autoplay pauses (exists)                                                                                      |
| Stage change      | Click / key        | **New:** lit line slides (transform); active label at weight 560                                              |
| Prev / next, back | Pointer / focus    | **New:** arrow swap, press                                                                                    |

### Phone differences

- No mass field, no moonlight following, no plane tilt, no cursor.
- Lit line, counter, decodes, story signatures and press states all run.
- Case-study story change keeps its order; the ink wipe and approach settle run,
  because they are timed rather than pointer-driven.
- Reduced motion: lit states instant, signatures become a 200 ms opacity change,
  no decodes.

---

## 8. Ranking

Scores 1–5. **Perf** is 5 when it costs nothing; **Ease** is 5 when simple.

| #   | Change                                                       | Impact | Usability | Perf | Ease | Conflicts                                          |
| --- | ------------------------------------------------------------ | -----: | --------: | ---: | ---: | -------------------------------------------------- |
| 1   | Navigation lit line + `aria-current` + weight hover          |      4 |         5 |    5 |    4 | None                                               |
| 2   | Important-action decode + ordinary weight/underline + arrows |      4 |         4 |    5 |    4 | Decode list is closed (§4)                         |
| 3   | Case-study story change by role (replace `line-in`)          |      4 |         5 |    5 |    3 | None                                               |
| 4   | Cursor states (transform-only, CTA tighten, press)           |      4 |         4 |    5 |    3 | None                                               |
| 5   | Hero mass field + moonlight                                  |      5 |         3 |    3 |    2 | Ripple and hero exit: gating rules                 |
| 6   | Case-study signatures (ink / approach)                       |      4 |         3 |    5 |    3 | None                                               |
| 7   | Header project counter tied to project settle                |      3 |         4 |    5 |    4 | None (header only)                                 |
| 8   | Mono weight feedback on every Signal element                 |      3 |         4 |    5 |    5 | None                                               |
| 9   | Contact plane listens (tilt + waveform band)                 |      3 |         3 |    4 |    3 | None                                               |
| 10  | Footer headline moonlight                                    |      3 |         3 |    4 |    4 | Ripple replay must unsplit first                   |
| 11  | Touch press states everywhere                                |      2 |         5 |    5 |    5 | None                                               |
| 12  | Card → case-study title view transition                      |      4 |         4 |    4 |    2 | Route hand-over not approved                       |
| 13  | Project wakes together (title + link + DOM visual)           |      5 |         4 |    4 |    3 | Allowed: no camera, layout or entrance/exit change |
| 14  | Display face (Anton → Archivo)                               |      5 |         3 |    5 |    3 | Anton kept; comparison only                        |
| 15  | Scroll cue idle hint                                         |      2 |         3 |    5 |    5 | None                                               |
| 16  | Beacon-lit project titles (scroll typography)                |      4 |         3 |    4 |    4 | None (colour only)                                 |
| 17  | Reading-time story durations (§11)                           |      2 |         5 |    5 |    5 | None                                               |

---

## 9. Conflicts with frozen and approved work

| Area                               | Status                       | What this system does                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage camera                    | Frozen                       | Untouched. Text reads camera state and never writes to the scene                                                                                                                                                     |
| Selected Work interface motion     | Frozen; interactions allowed | Camera, layout, entrance and exit untouched. New responses use `scale`, `translate`, `filter`, colour and background, never `transform` or `opacity`, which the sequences own; they only run while the card is shown |
| Hero exit                          | Frozen                       | The mass field turns off before `--arrival` leaves 0, and never animates `transform` on `[data-line-inner]` (it uses an inner row)                                                                                   |
| Hero and footer ripple             | Approved                     | Letter splitting happens only after `data-ripple="done"`. The footer replays its ripple on each view, so the heading is unsplit before each replay                                                                   |
| Decode values                      | Approved                     | Entrance decodes unchanged. The faster variant runs only on the closed list of important actions                                                                                                                     |
| Reading light, bio choreography    | Approved                     | No changes                                                                                                                                                                                                           |
| Doorway                            | Approved                     | Press states only                                                                                                                                                                                                    |
| WebGL → case-study route hand-over | Not approved                 | Item 12 is a separate, text-only option                                                                                                                                                                              |
| Snow leopard (future)              | Planned                      | Its attention must not compete with the headline field. The field acts on type only; the leopard is never driven by the pointer                                                                                      |
| MARZIA particles / cabin           | Untouchable / out of scope   | Not part of this system                                                                                                                                                                                              |

---

## 10. Display face: Anton stays

Anton is kept (decision 4). The prototype layer can switch every Anton heading
to Archivo (weight 860, width 62, the hero's cut) so both can be compared in
place: footer headline, project card titles, case-study titles and metrics.
A recommendation only follows that comparison. Until then, Anton headings get
the parts of the system that need no axes: moonlight, rising light, the ripple
and the mask rises.

**What the comparison shows** (prototype stills, same pages, same sizes):

- Line widths barely change. "THE UNEXPECTED." and the project titles end
  within a few pixels of where Anton ends; nothing rewraps.
- Archivo is wider per letter and shorter in the cap, so the headings read
  heavier and less vertical. Anton's tall, poster-like column is the main
  thing lost, most visibly on the footer.
- The ampersand changes the most. In Archivo, "Quill & Pigeon" uses the hero's
  own `&`, so the hero and the rest of the site start to read as one voice.

**Recommendation:** move all Stone headings to Archivo together, in one change.
Today the hero and the footer are set in two different faces, and only one of
them can carry the mass field. Archivo makes the opening and closing statements
a matched pair and lets the footer, project titles and case-study titles take
part in the pointer response. The cost is Anton's verticality. If that matters
more than the match, keep Anton for all of them: mixing the two would keep the
four-voice problem.

## 11. Reading time and autoplay

Measured against the content records at 230 words a minute, plus 1.5 s to look
at the visual:

| Case study     | Playback | Stories | Words per story | Reading time | Default autoplay |
| -------------- | -------- | ------: | --------------: | -----------: | ---------------: |
| Quill & Pigeon | manual   |       8 |         54 – 94 |    16 – 26 s |              6 s |
| Survue         | manual   |      17 |        34 – 109 |    10 – 30 s |              6 s |

- **Neither featured case study autoplays** (`storyPlayback: "manual"`), so no
  visitor is moved on today. That stays.
- The 6 s default would be 2–5× too short for every story, and it still applies
  to any project left on `auto`. Proposed rule: an autoplaying story lasts at
  least its reading time (words ÷ 230 × 60 + 1.5 s, never under 6 s), and a
  `durationSeconds` shorter than that is raised to it.
- Autoplay already pauses for reading (pointer over the copy), holding,
  keyboard use and video, and never runs on phones or with reduced motion.
  Keep all of that.
- The story change motion (§5) finishes in under 0.9 s, so it never takes time
  from reading.

## 12. The prototype

A layer over the real dev site, outside the repo. A small proxy serves
`localhost:3000` with one script and one stylesheet injected; production code is
untouched, and a panel switches the layer off to show production exactly.

- What it covers: lit line and counter, ordinary and important actions, arrow
  swaps, press states, cursor states, the hero mass field (Breath / 3 px /
  static), Selected Work waking together and its camera-settled light, the
  footer's moonlight and listening plane, both case-study signatures and
  story roles, and an Anton/Archivo switch.
- What it proves: hydration stays clean (the layer only edits elements React
  already owns), no console errors across the home page and both case studies,
  approved motion runs unmodified underneath.
- What it learned: the beacons are off in Selected Work (so the title light
  reads `data-camera-settled`); the bio's "on" passage and the footer ripple's
  own state are the right signals for the lit line; a `will-change` or a
  rewritten `transition` would have touched frozen work, so the layer uses the
  Web Animations API and individual transform properties instead.

## 13. Final quality review (prototype, 2026-10-08)

Measured on the real site with the prototype layer, Chrome at 1440 × 900
(desktop) and iPhone 13 emulation, the 3D scene running. Fixes below were
applied to the prototype and re-measured; the numbers are after the fixes.

### Does it feel like one experience?

Mostly yes, and the review made it more so. Every response now traces back to
one of four causes (the camera arriving, the pointer arriving, something new
being said, the visitor pressing), and each cause looks the same wherever it
happens:

| Cause                 | What answers, everywhere                                          |
| --------------------- | ----------------------------------------------------------------- |
| The camera arrives    | Lit line moves, counter decodes, light rests in the project title |
| The pointer arrives   | Stone gains weight or light; Signal gains weight                  |
| Something new is said | A decode (entrances, the counter, important actions once)         |
| The visitor presses   | Compress to 0.97; the cursor ring contracts                       |

Two things broke that unity and are fixed: the nav's lit line used to slide
under every hovered item (now it moves only for the camera; hover is weight
only), and the hero field was still swollen while the frozen exit sank the
headline (now it lets go first). One inconsistency remains, see "Open" below.

### Timing against the camera and the projects

| Moment                         | Measured                                                       |
| ------------------------------ | -------------------------------------------------------------- |
| Hero field vs frozen exit      | Field at 3% when the exit begins (arrival 0.03); was 58%       |
| Lit line vs chapter title      | Work at arrival 0.623, chapter title rises at 0.626: same beat |
| Card appears → counter decodes | 16 ms                                                          |
| Card appears → title risen     | 283 ms (frozen entrance)                                       |
| Card appears → resting light   | full at 400 ms, inside the entrance                            |
| Camera leaves → light drained  | within 420 ms, before the card swaps                           |

### 1. Responsive immediately

Every pointer interaction answers within 2–3 frames (25–49 ms): nav weight,
hero letters, press, decode start, title light, screens, contact plane. A
story change shows its new title at 171 ms and makes the description readable
at 424 ms; most of the title delay is the prototype waiting a frame to measure,
which production does synchronously (target: title under 100 ms).

### 2. Never interrupting reading

- Story text never moves while visible: 0.0 px for description and title, both
  case studies.
- Hero lead, role and the card description never move.
- Important-action labels were scrambled for 460–614 ms and decoded on every
  hover (five passes, five decodes). Now: always readable within 320 ms, once
  per 4 s per action, mouse or keyboard only.
- On phones, story signatures used to play below the fold; they now start when
  the title is on screen.

### 3. Sharp and readable

- The hero with the field active keeps the same edge sharpness as production
  (edge energy 3.39 vs 3.41); text is never scaled or blurred.
- At rest everything returns to the shipped markup: the hero unsplits as soon
  as the field settles, Survue's settled titles are pixel-identical to
  production (0 differing values), Survue's urgency word settles with 0.04 px
  of movement.
- The woken main screen no longer scales (it lifts 3 px and brightens), so the
  screenshots stay one pixel to one pixel.
- Designed differences only: the botanical rule on Quill's corrections and the
  heavier urgency word on Survue's detection stories.

### 4. Consistent across home and case studies

The same weight lift, press, arrow swap, gold lit line and important-action
decode run on both. Footer moonlight now eases on time, not per frame, so it
matches the hero at any refresh rate.

### 5. Excessive or repetitive

| Found                                          | Now                                       |
| ---------------------------------------------- | ----------------------------------------- |
| Decode replayed on every hover                 | Once per 4 s per action                   |
| Screens woke whenever the pointer crossed them | Wake after 140 ms of attention            |
| Lit line slid under every hovered nav item     | Moves only for the camera                 |
| Waveform lit up whenever the pointer came near | Only with the pointer on the contact card |
| Hero still swollen during the exit             | Lets go before it                         |

The footer is the busiest place (headline light, plane lean, waveform band,
decode). With the band limited to the card it reads as one invitation; worth a
last look at stage 8.

### 6. Mobile

What was wrong: a finger that started a scroll on a link or title woke the
project and started the decode (fixed: touch never hovers); the phone header
shows none of the camera state, because the desktop nav is hidden; signatures
played off screen (fixed). What phones get today is the timed half of the
system (story roles, signatures on view, press states, stage line). What they
should also get, for visual approval in stage 10:

- **Header:** the phone bar shows the current place as a small mono label next
  to the wordmark (`Work · 01 / 02`), decoding when the camera arrives; the menu
  marks the current section.
- **Hero:** once, as the ripple settles, a single slow Breath wave crosses the
  headline at the 3 px cap; then it is still. No input needed.
- **Selected Work:** the project wakes once when the camera arrives (title light
  rises, screens open), since a phone has no hover; press-and-hold on the link
  shows the wake before navigating.

### Performance

At normal CPU the layer costs nothing measurable (no dropped frames, hero or
Selected Work). At a quarter of the CPU, with the 3D scene running, the hero's
weight/width response dropped about a third of frames (31–36%; background
noise ~8%). Moonlight is nearly free; the font axes are the cost. Fewer font
instances, every-other-frame axis updates and containment cut it to 20%; the
remedy that works is gating:

- weight/width run only on the scene's own `high` tier (`data-scene-tier`);
- a frame guard turns them off for the visit if frames slip while the field is
  active (moonlight stays). Measured: never trips at normal CPU; trips within
  seconds at a quarter, after which drops return to near the no-effect level.
- The 3D scene kept its `high` tier in every run.

### Open

- The project title answers on the home page but the same title on its case
  study (`h1`, Anton) does not. Proposal: as the case study opens, the light
  rests in its title the way it does when the camera stands at the project.
- Real devices: everything above is Chrome. Safari (registered custom
  properties, mask images, individual transform properties) and an actual
  iPhone are checked at each stage.

## 14. Integration plan

Principles:

- A branch for the whole system; one stage per commit; each stage reviewed and
  approved before the next.
- Only the files a stage names are staged and committed. The other session's
  uncommitted WebGL work (`src/webgl/**`, cursor wake, aerial terrain) is never
  touched, staged or committed.
- No stage changes the camera, the doorway, the ripples, the bio or the project
  layout, or rewrites any frozen `transform`/`opacity` transition.
- The prototype's checks become scripts in `scripts/` so every stage runs the
  same measurements.

Every stage passes before review:

| Check          | Pass                                                                                   |
| -------------- | -------------------------------------------------------------------------------------- |
| Repo           | `npm run validate`                                                                     |
| Parity at rest | Every route pixel-identical to `main` at rest, except the stage's designed differences |
| Frozen work    | Stills at the camera keyframes match `design/screenshots/stage-13/14/16`               |
| Response       | Pointer, keyboard and press answer within 3 frames                                     |
| Performance    | 0 dropped frames at normal CPU; at 4× within 3 points of `main`                        |
| Access         | Keyboard parity, `prefers-reduced-motion`, touch emulation; text selectable and named  |
| Review         | Video at real speed and stills for the stage, approved by you                          |

| Stage | What                                                                                                                                            | Files                                                                       | Extra checks                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 0     | Foundation, nothing visible: tempo and release tokens; camera-state reader; hover gating; decode core; kerning-safe letter split; check scripts | `motion.css`, `src/motion/*` (new helpers), `scripts/`                      | Zero pixel difference on every route                             |
| 1     | Signal basics: ordinary weight, press, arrow swap, focus parity                                                                                 | `SiteHeader`, `MobileMenu`, `SiteFooter`, case-study controls, `ArrowGlyph` | Geist Mono reflow: 0 px                                          |
| 2     | Lit line, `aria-current`, project counter; case-study stage line in gold, moved by transform                                                    | `SiteHeader`, `CaseStudyWorkspace`                                          | State table: hero, work, bio, contact, `/#about`, Home/End, back |
| 3     | Important-action decode: closed list, 320 ms, 4 s cooldown                                                                                      | `DecodeText`, gallery link, footer, case-study links                        | Replays and readable time                                        |
| 4     | Story roles (eyebrow mask, body opacity only), signatures on view, reading-time rule                                                            | `CaseStudyWorkspace`                                                        | 0 px shift; manual projects unchanged                            |
| 5     | Ink and approach, after a final review of every story; emphasis words move into the project records                                             | `CaseStudyWorkspace`, project records, `validate-content`                   | Safari masks; settled parity                                     |
| 6     | Selected Work wakes together; camera-settled title light                                                                                        | `MonolithGallery.tsx` / `.module.css`                                       | Entrance/exit timings identical to `main`                        |
| 7     | Hero 3 px field: after the ripple, released before the exit, unsplit at rest, tier gate and frame guard                                         | new hero field component, `Hero.tsx`                                        | Travel ≤ 3 px; ripple recorded unchanged; 4× guard               |
| 8     | Footer: headline moonlight after its ripple, plane listens, waveform on the card                                                                | `SiteFooter`                                                                | Ripple replays on each view unchanged                            |
| 9     | Cursor states: scale instead of width/height; action, link, stone, press                                                                        | `CustomCursor`, `cursor.css`                                                | Ring never covers a label                                        |
| 10    | Phone design pass, after visual approval of §13's proposals                                                                                     | header, hero field, gallery                                                 | Real iPhone Safari                                               |

After stage 10: a full-site recording at real speed on desktop and phone, a
real-device pass (Safari and Chrome on a Mac, iPhone Safari, Android Chrome),
and the prototype's temporary launch entries removed.

### Milestone 2, as built

Stages 6, 7 and 8, plus the keyboard fix in §15. What differs from the plan:

- **Hero field (`src/motion/HeroField.tsx`).** The 3 px cap, as approved.
  The letters are split only while the field is active; at rest the original
  server nodes are put back (not a copy), so the markup is identical. Springs
  count as settled once no visible weight is left to change (half a step of
  40), which unsplits within about a second instead of waiting on the springs'
  invisible tail. While the camera is leaving, weight rounds down, so the last
  step is gone before the exit at `--arrival` 0.03. The cursor's stone state
  (0.9) is `data-cursor-stone` on the root, applied only while the field
  answers.
- **Selected Work (`src/components/work/projectWake.ts`).** As approved, with
  one correction to the prototype: the screens already drift on `translate`
  (an ambient CSS animation), so the wake's offset is added to it
  (`composite: "add"`) rather than replacing it, and the release reverses
  with a negative rate (the prototype's positive rate replayed it forward).
  The main screen brightens through its image's `filter`, because the piece's
  own `filter` belongs to the frozen assembly.
- **Contact (`src/motion/ContactListen.tsx`).** The plane's lean replaces the
  hover snap only for a mouse at desktop widths; keyboard focus keeps the
  -6° pose. The band uses a gradient defined in the footer's SVG, so nothing
  is injected.

Measured in the running scene (1440 × 900, Chrome):

| Check                                     | Result                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Hero letter travel (21 pointer positions) | 2.44 px at most                                                                          |
| Hero markup at rest                       | Identical to the server's                                                                |
| Hero weight at `--arrival` 0.03           | 860 (rest)                                                                               |
| Selected Work frozen timings              | Transitions, transforms and opacity identical (M1's press `scale` aside)                 |
| Contact plane after the pointer leaves    | Shipped pose, matrix difference 6e-10                                                    |
| Browser checks                            | 162 pass (keyboard 78, M1 28, crossfade 13, hero 13, wake 17, contact 13)                |
| Main thread, pointer sweeps, 1× CPU       | Hero 33.1 → 36.7%, work 34.6 → 31.1%, contact 31.0 → 32.9%; 0 slow frames                |
| Same, 4× CPU                              | Saturated before and after (97–100%); slow frames rise most on the hero (3 → 24 of ~200) |

At 4× the hero's guard watches for 9 of 45 frames over 22 ms, which this
machine stays just under for much of the sweep; at 6× it trips as designed
and the light carries on alone. Whether to tighten it is an open decision.

The work figures compare unequal sweeps: the build before has none of the
wake's markers, so its sweep covered the title only. They show the wake adds
no measurable cost, not that it saves any.

### Milestone 2, quality pass (after review)

- **Guard.** It now follows the scene's quality manager: a bucket on a
  20 ms budget, plus a stutter check (4 frames over 25 ms within 60),
  both measured against the display's cadence, after a 12-frame warm-up.
  On a trip the whole field rests for the visit (the moonlight alone still
  cost frames). It never tripped at 1× or 2× CPU, paced at 30 Hz or
  uncapped; with frames uncapped it trips at 4×. At 60 Hz the logic is the
  version that tripped in about 0.19 s at 4×; that still needs re-measuring
  with the display awake.
- **Fixes.** The Selected Work title light now drains instead of cutting to 0. A pointer leaving the window over the screens releases the wake. The
  hero's letter room no longer shifts layout (0.0013 → 0). The keyboard
  controls' names no longer have a stray space.
- **Contact.** Quieter, as asked: the lean is at most 2°, and the band is
  at most 55% moonlit and narrower; the headline stays the strongest light.

### Milestone 3, as built

- **Content.** `caseStudy.titleSignature` ("ink" | "approach") and
  `story.emphasis` (whole words of the title, checked by validate-content).
- **Story roles** (`CaseStudyWorkspace`): eyebrow out of a one-line mask
  (160 ms); body opacity only (320 ms, from 280 ms), measured 0 px of
  travel; the title by signature (`storySignature.ts`), or rising line by
  line as before for projects without one.
- **Ink and approach.** As the prototype the user reviewed, with its values:
  the approach emphasis steps 560 → 640 → 720 and rests at 620. A title
  below the fold waits until it's on screen. Approach words keep their
  resting width meanwhile and return to plain layout once settled (layout
  shift 0).
- **Reading time.** An autoplaying story stays up at least words ÷ 230 × 60
  - 1.5 s, never under 6 s. Both featured case studies stay manual.
- **Stage nav.** The gold lit line, and the current label at the signal
  weight by WeightLabel's crossfade.
- **Case-study title.** Rests at the Selected Work resting light (0.2) once
  risen.
- **Phones.** A place label beside the wordmark ("Work · 01 / 02"), the
  menu's gold marker with `aria-current`, and the arrival wake (once per
  arrival, 1.4 s). There is no automatic headline wave.

## 15. Keyboard access to Selected Work (found in Milestone 1)

Measured with the keyboard only (no mouse, no wheel), on `main` and on this
branch alike. This is existing behaviour; Milestone 1 does not change it.

| Path                                      | What happens                                                                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab from the top                          | Header → Scroll to enter → **Email Marzia** (footer). Selected Work is never reached                                                                                              |
| Tab to Work, Enter, then Tab              | The page lands at the top of the gallery (y ≈ 2000), before the first project's details, so the card is still inert; Tab continues to About, then the footer                      |
| Page Down until a project shows, then Tab | The card is shown and its link is focusable, but Tab first reaches the hero's Scroll to enter, the browser scrolls it into view, the camera leaves, and the card goes inert again |
| Arrow / Page keys                         | Step through both projects (the gallery's own stepper), but never put focus on a case-study link                                                                                  |

Causes: the cards are `inert` until the camera stands at them (correct for
the visual sequence), nothing focusable stands in for them while they are
not shown, and the Work link lands before the first project rather than on it.

### Proposal for Milestone 2

Keep the camera and the cards exactly as they are; give the keyboard its own
way in, made of things the gallery already does.

1. **The Work link lands on the first project.** Arriving at `#selected-work`
   with no project to return to places the page on the first project's
   details point (the same `stationOffset` the case-study back link already
   uses), so the card is shown on arrival. When the link was activated from the
   keyboard, focus moves to that card's View case study once it is shown.
2. **A way in from the hero.** Right after Scroll to enter in the tab order, a
   link that is visually hidden until focused: "Selected work, 2 projects".
   Focused, it shows as a mono label where the scroll cue is; nothing moves.
   Enter does what the Work link does (1). Focus alone never moves the camera.
3. **Between projects.** Inside each card, after View case study, a "Next
   project" button (and "Previous project" on the second), visually hidden
   until focused. Enter steps the gallery with its existing stepper, so the
   camera travels on its approved path, and focus moves to the next card's
   View case study when it is shown. After the last project, Tab continues to
   the bio and the footer as today.
4. **Nothing scrolls under focus.** Focus is placed with `preventScroll` and
   only once the target card is shown, so the browser never scrolls the page
   back and undoes the camera.
5. **Screen readers.** The gallery already announces "Quill & Pigeon, 1 of 2";
   the hidden controls carry plain names, and the order is linear.

Checks: from a fresh load, keyboard only, both case-study links are reached
(Tab and Enter only, and Arrow keys too); mouse and touch see no change; no
frame of the camera or card sequence differs; axe and the accessibility tree
are compared against `main`.

### As built (Milestone 2)

The proposal shipped with these differences:

- **Work, for every input.** The header's Work (and the phone menu's) lands on
  the first project's details whether it is clicked, tapped or pressed; only a
  keyboard press moves focus. The URL still gets `#selected-work`. Already in
  the gallery, Work leaves the camera where it is.
- **Scroll to enter keeps its pointer behaviour.** A click still lands at the
  top of the gallery. Pressed from the keyboard, it lands on the first
  project, as Work does.
- **The way in is a button, "Enter selected work".** It is fixed to the
  viewport's lower left while focused, so focusing it cannot scroll, and it
  unmounts while a project is shown. Its accessible name adds the count:
  "Enter selected work, 2 projects".
- **Focus follows every step.** Next / Previous project, the arrow and Page
  keys, and Space all step through the stepper; if focus was in the gallery,
  it lands on the next card's View case study when the swap completes.
- **Back from a case study.** The back link and Work, pressed from the
  keyboard on a case study, return to the project that was opened with its
  link focused (`watchWorkLinks` in `src/motion/workChannel.ts`).

Measured: 78 keyboard checks across desktop, reduced motion and a phone
(Tab and Shift+Tab, Enter, Space, the arrow keys, both case studies and back),
with the page position at each project identical to the wheel path (4028 and
7853 at 1440 × 900) and the card layer pixel-identical to the build before.

## 16. Open decisions

1. **Phones (§13):** approve the header label, the hero's single Breath wave
   and the arrival wake for stage 10, or keep phones to the timed half.
2. **Case-study title light (§13, Open):** the project title's resting light on
   its case study `h1`.
3. **Ink and approach:** final visual review at stage 5.
4. **Display face:** Anton in production; Archivo stays in the prototype for
   comparison.
