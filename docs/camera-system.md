# Homepage camera system — frozen

Status: **frozen** (approved 2026-09-25). Hero → Quill & Pigeon → Survue.

Do not retune anything in this document unless a clear visual bug is found.
"It could feel a bit better" is not a bug. Any change must be re-verified with
stills at the keyframes listed below (1440×900, camera stopped), and the frames
compared against `design/screenshots/stage-13-occlusion-reveal/`,
`stage-14-screen-reflection/` and `stage-16-survue-refinement/`.

The How I Work and Contact legs after Survue are **not** part of this freeze.
They are described under "The bio's shots" below.

## Where the values live

| What                                                              | File                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| Keyframes, settles, hero origin, stone positions, range recession | `src/webgl/sceneConfig.ts`                                |
| Timeline maths (speeds, settle curve, aim lead)                   | `src/webgl/core/cameraJourney.ts`                         |
| Scroll spring, idle drift, stone reveal wiring                    | `src/webgl/core/environment.ts`                           |
| Scroll lengths of hold and travel; details windows                | `src/webgl/workJourney.ts`                                |
| Stone emergence distances, reflected-screen treatment             | `src/webgl/modules/monolith.ts`                           |
| Hero runway, hero copy exit                                       | `src/components/sections/Hero.module.css`                 |
| Chapter title window, UI gating, card side                        | `src/components/work/MonolithGallery.module.css` / `.tsx` |

## Global

| Value            | Setting                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lens             | 34° vertical FOV, fixed for the whole desktop journey (stacked layouts keep 46°)                                                                                                     |
| Roll             | 0 always                                                                                                                                                                             |
| Scroll → camera  | critically damped spring, `SCROLL_SPRING = 6.5` (≈ 0.7 s settle, no overshoot)                                                                                                       |
| Aim lead         | `AIM_LEAD = 0.02` of the timeline, zero at both ends of each shot                                                                                                                    |
| Hero idle drift  | `IDLE_DRIFT = 0.035`, gone by 160 px of scroll                                                                                                                                       |
| Camera far plane | 420                                                                                                                                                                                  |
| Timeline easing  | per keyframe `speed`; segments into a rest use a quartic settle (zero velocity and zero acceleration), out of a rest the mirrored curve, between moving keyframes a monotone Hermite |

## World placement

| Object                    | Value                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Hero chapter frame origin | `(-24.7, 0, 28.2)`, yaw 0 — chosen so camera → perch crest → Quill & Pigeon line up at Frame 02                               |
| Hero range, flank, moon   | pushed back ×`RANGE_RECESSION = 2.1` from the desktop hero eye `(0.4, 0.8, 11)`; unchanged as seen from the hero, never faded |
| Perch                     | hero frame `(4.4, -0.53, 1.2)`, 14 % into the water (grounding commit 2a9564e)                                                |
| Quill & Pigeon stone      | `(2.7, -0.3, -6.4)`, yaw -0.1, height 18                                                                                      |
| Survue stone              | `(-30, -0.3, -14)`, yaw -0.2, height 17 — ~33 units in front of the range                                                     |

## Scroll map (desktop, 1440×900)

The page scroll drives a spring; these are the page offsets the spring aims at.

| Stretch                       | Screens            | px @ 900    |
| ----------------------------- | ------------------ | ----------- |
| Hero runway (pinned copy)     | 0 – 2.3            | 0 – 2070    |
| Arrival (hero → Quill settle) | 0 – 4.0            | 0 – 3600    |
| Selected Work stage pins      | from 2.3           | 2070        |
| Quill hold                    | 1.25 screens       | 3600 – 4725 |
| Quill details on screen       | hold +0.08 → +0.87 | 3672 – 4383 |
| Quill → Survue travel         | 3.0 screens        | 4725 – 7425 |
| Survue hold                   | 1.25 screens       | 7425 – 8550 |
| Survue details on screen      | hold +0.08 → +0.87 | 7497 – 8208 |

`WORK_STRETCHES = { approach: 1.7, hold: 1.25, travel: 3 }`. The hero runway is
`100dvh + 130svh`. Changing either moves every offset above.

## Arrival — Frames 01 to 05

`at` is the share of the arrival (0 → 3600 px). Frames 01–05 are authored in
the hero frame (the helper `heroArrival` converts them); Frame 05 is world space.

| #   | at   | speed | eye                       | target                   | Reads as                                          |
| --- | ---- | ----- | ------------------------- | ------------------------ | ------------------------------------------------- |
| 01  | 0    | 0     | hero `(0.4, 0.8, 11)`     | hero `(0.4, 2.05, -2)`   | establishing; stone out of frame behind the crest |
| 02  | 0.26 | 10    | hero `(2, 0.6, 8.5)`      | hero `(4.7, 1.85, -4.2)` | truck right; only the crown tip clears the crest  |
| 03  | 0.50 | 8     | hero `(3.2, 0.65, 8.7)`   | hero `(8.7, 1.9, -3.1)`  | discovery; screen half out from behind the crest  |
| —   | 0.62 | 70    | hero `(9.8, 1.2, 7.9)`    | hero `(14.2, 2.6, -4.3)` | passing behind the perch                          |
| —   | 0.67 | 90    | hero `(12.5, 1.8, 3.5)`   | hero `(16.7, 3.2, -8.8)` | clear of the perch                                |
| 04  | 0.72 | 90    | hero `(14.5, 2.8, -1)`    | hero `(25, 6.2, -35.4)`  | approach, peak speed                              |
| 05  | 1.0  | 0     | world `(-5.1, 3.6, 21.9)` | world `(4.8, 6.2, -1.6)` | Quill settle                                      |

Speed profile: nearly still to 10 %, slow drift to 50 %, accelerate 52 – 60 %,
peak 60 – 76 %, long deceleration 76 – 100 %.

## Departure — Quill → Survue (Frames 06 and 07)

`at` is the share of the travel (4725 → 7425 px).

| at   | speed | eye                    | target                   | Reads as                                       |
| ---- | ----- | ---------------------- | ------------------------ | ---------------------------------------------- |
| 0    | 0     | `(-5.1, 3.6, 21.9)`    | `(4.8, 6.2, -1.6)`       | Quill settle (card already gone)               |
| 0.10 | 20    | `(-8, 3.9, 22.2)`      | `(2.21, 6.51, -5.88)`    | first move                                     |
| 0.26 | 70    | `(-17, 6.5, 29)`       | `(-9.24, 7.02, 0.03)`    | Quill passing, exits right; Survue enters left |
| 0.45 | 95    | `(-22, 10.5, 47)`      | `(-23.57, 9.45, 17.06)`  | landscape opening                              |
| 0.52 | 80    | `(-26.86, 12.5, 45.9)` | `(-29.99, 10.67, 16.12)` | Survue discovery, ~46 % of height              |
| 0.70 | 60    | `(-31.64, 10, 32.97)`  | `(-30.59, 9.21, 3)`      | halfway, Survue centred, ~59 %                 |
| 0.85 | 40    | `(-35.57, 8, 25.61)`   | `(-34, 8.26, -4.35)`     | 75 %, easing right, ~69 %                      |
| 1.0  | 0     | `(-38.5, 6.6, 21)`     | `(-35.89, 7.65, -8.87)`  | Survue settle, right third, ~77 %              |

The hand-over is intentional: from out here Quill and Survue are 35 – 45° apart
in a 52°-wide frame, so Survue enters on the left as Quill leaves on the right.
Do not add a look-away pan, move Survue, or try to empty the frame between them.

## Stone visibility

- No stone is ever faded in on screen. Partly visible stones render translucent.
- `STONE_EMERGENCE.desktop`: Quill `[58, 60]`, Survue `[90, 95]` — both solid
  whenever drawn. Stacked: `[36, 48]`.
- Survue is held back (`setRevealed`) until the departure starts, at which
  moment it is out of frame.
- Reflected screens: the water's mirror camera draws a blurred, darkened,
  feathered glow instead of the screen (`cameraPosition.y < 0` branch in the
  screen shader). The real screen is untouched. Frozen.

## Interface timing tied to the camera

| Element                       | Window                                                      |
| ----------------------------- | ----------------------------------------------------------- |
| Hero copy exit                | arrival 0.03 → 0.22 (lifts 7vh, fades)                      |
| "SELECTED WORK" chapter title | in 0.64 → 0.72, out 0.88 → 0.96 of the arrival              |
| Stage UI (label, controls)    | hidden until `data-arrived` (arrival ≥ 0.97)                |
| Quill details                 | right side; hold +0.08 → +0.87 screens                      |
| Survue details                | left side (`data-side="start"`); hold +0.08 → +0.87 screens |

The camera stands still for 0.38 screens (342 px) after the details leave and
before the departure starts.

### Scroll stops

A fast scroll can't fly past a project or the bio (`src/motion/scrollCatch.ts`).
When the visitor's own wheel, touch or key scrolling is about to cross a
project's details point (`detailsPoint`) or the bio rest, the page is placed
on it and held until the moment has been on screen for its reading time
(projects 1.7 s after the card shows, bio 3.2 s after the dust starts forming;
never less than 0.6 s, never more than 6.5 s), and input has paused 180 ms.
A stop whose moment has already been on screen that long is not caught, so a
slow reader never feels it. The nav, Home/End and the scrollbar are never
caught. No camera value changes. A stop caught from touch freezes the page's
scroll (`overflow: hidden` on the root) for the hold, since a touch scroll in
progress, and its momentum, can't be cancelled from events.

### Phones

- Every scroll-driven measurement (work runway progress, the camera's rests,
  the scroll stops, the bio dust) reads `stableViewportHeight()`
  (`src/config/viewport.ts`, the `svh` height), and the hero is laid out in
  `svh`. A phone's browser bars sliding in and out no longer move the page or
  the camera.
- The bio on tablet and phone uses `narrowBioCamera` (`sceneConfig.ts`): the
  same eye, aimed 1.5 right and pitched up 13°, so the snow doorway stands in
  the lower right under the sentence instead of off the right edge.
- Below the desktop layout (< 1024 px) the journey is cut to what each shot
  has to show: `NARROW_WORK_STRETCHES` = approach 1.3, hold 1.1, travel 1.8
  screens (desktop 1.7 / 1.25 / 3, unchanged), and the bio's runways are
  85svh before and 70svh after (desktop 150 / 110). The turn into the bio runs
  at about 0.18° per scroll pixel on an iPhone 14. A phone page is about three
  screens shorter.
- The bio's scroll stop lets go once every word reads whole (`dust.whole()`)
  plus 1.2 s to read it, rather than on a fixed timer. Its backstop is 12 s
  (`maxHold`), well past the ~4.5 s the sentence takes to stream out, so the
  hold never lets go mid-sentence. This applies on desktop too.

## The bio's shots (not frozen)

Both are built by `bioShots()` in `src/webgl/sceneConfig.ts` from the poses
they join, and run on the same keyframe timeline as the arrival: 11 keys at
even spacing along the path, a sine ease out of one rest and into the next,
and the view turning in step with distance travelled.

| Shot          | Scroll (desktop)            | Shape                                                                                                   | Peak turn        |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------- |
| Survue → bio  | 2.3 screens (150svh runway) | wide right-hand turn over the water, 185°, a 1.4 rise midway                                            | ~13° per 100 px  |
| bio dwell     | 0.55 screens (`BIO_DWELL`)  | camera still while the sentence goes back into the doorway                                              | 0                |
| bio → Contact | 1.24 screens                | straight on, rising 1.5 and drifting 2.4 left; the doorway slides out of frame on the right by parallax | ~1.5° per 100 px |

The snow doorway is solid whenever it is in frame: it comes in while the
camera is still turned away from it and goes once the camera has passed it.
It can only be stepped through while the camera is at rest before it.
`scripts/check-scene.ts` holds these shots to 0.2° of turn per scroll pixel.
