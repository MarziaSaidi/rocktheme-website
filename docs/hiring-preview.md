# Reference UI reconstruction

Local review: `/preview/hiring`, with studies at
`/preview/hiring/work/quill-and-pigeon` and `/preview/hiring/work/survue`.
This replaces the initial original-design prototype following Marzia's explicit
request to reconstruct Sarah Mou's UI. The production homepage is unchanged.

## Reference and evidence

Public reference: https://www.sarahmou.com/ and `/work/solace`.
REA page evidence: `ev_5dd44009eb028e16b3be6df657f8b2b83121c2256db8858f2288a1c4ba581f6c`.
Public HTML, stylesheet, shipped JS and geometry notes are retained under
`/tmp/sarah-reference-styles`; browser captures under `/tmp/hiring-reference`.
REA observed source/DOM; separate controlled browser runs measured rendered
geometry and exercised interaction. Attach-window limitations apply to REA's
network observation; no completeness claim is made about all reference code.

Matched scaffold: white/navy (#002f9e), Switzer body, Instrument Serif headings,
sticky 23.8% desktop sidebar, collage stage, two-column gallery, expanded project
cards, responsive breakpoints, case-study hero/article/section navigation and
information panel. The generated CSS cascade matters: sm utilities override
several desktop utilities. Measurements, rather than class names alone, set the
56px sidebar padding and 48px/56px work-section horizontal padding.

At 1440×900, both pages measure sidebar width 342.71875px and padding
72px 56px 45px; work begins at x342.71875/y900; its inner wrapper begins at
x390.71875/y981 with 100px left padding. At 375px, both have 40px sidebar
horizontal padding and a two-column gallery with 16px gap. Mobile vertical
positions differ naturally because Marzia has two authored projects and different
copy, instead of Sarah's six. This is not a claim of identical page pixels.

## Content and artwork substitutions

- Marzia's identity, email, GitHub, LinkedIn and two verified projects replace
  Sarah's personal information and work.
- The main image is an original transparent software-designer illustration, without glasses and with blue denim trousers. The original site robot is unchanged.
- A cute car represents Survue; a letterbox represents Quill & Pigeon.
- The board contains only the designer illustration, car, letterbox and name card. Extra phone screenshots, ticket and receipt decorations were removed.
- Actual product screenshots remain in the gallery and studies.
- No awards, adoption metrics, résumé, team membership or extra projects are invented.
- Quill's live-beta delivery and Survue's C# settings scope follow Marzia's confirmation.
- The interactive-portfolio link retains a route to the existing cinematic entrance.

The project-list and collage selections expand the matching gallery card.
Filters narrow the project list/gallery and rearrange collage pieces. Pieces
support bounded dragging, inertia, keyboard arrows and reduced-motion handling.
Reference pointer/cursor effects are excluded under the existing locked constraint.

Fonts and the cutting-mat backdrop are public reference assets used in this local
reconstruction. Sarah's photograph, logo and project artwork are not substituted
for Marzia's work. Asset provenance and generation prompts are in
`hiring-reference-assets.md`.

## Verification and limits

Build, typecheck and changed-source ESLint are run on the final implementation.
Controlled checks cover desktop/375px geometry, filters, gallery expansion,
keyboard movement, case-study entry and return. No homepage WebGL canvas or GLB
is mounted by this direct path. All 80 protected camera, MARZIA, particle and
cabin sources/assets match the pushed baseline.

The reference uses low-contrast secondary labels. The matched colors produce
axe contrast findings, recorded in the verification results, rather than an
accessibility pass. No physical iPhone, VoiceOver or relaunch-budget certification
is claimed. Existing production study routes and homepage remain untouched;
these preview routes are noindex. The preview remains separate from the homepage. Marzia subsequently authorized committing and pushing this implementation; no production deployment is requested.

### Complete Survue restoration

The hiring preview now renders all seven canonical Survue stages and all 17 stories directly from `src/content/projects/records/survue.project.ts`. This restores the video demo, full flow, original wireframes, explicitly labelled retrospective wireframes, approaching-car alternatives, warning states, palette, typography, components, icons, spacing, final experience and delivery. Native video controls and full-size image links are available. The concise opening summary remains; it no longer replaces the original evidence.

Verified at 1440 and 375 px: all 17 stories present, no broken images, no page overflow, both video instances load the 27.3-second source, no browser runtime errors. Build, typecheck and targeted lint passed. Results: `verification/reference-ui/survue-restored.json`; corresponding screenshots alongside it. Original case-study content and frozen scene assets were not edited.

### Screen-strip sizing correction

Replaced Survue's wrapping screen boards with single-row horizontal strips. Reference measured on `/work/solace` at 1440 px: 511 px screen height, 21 px gap, 22 px vertical and 28 px horizontal padding. Applied to screen sequences and detection comparisons; portrait singles and videos share the bounded height. At 375 px screen height is 270 px. Verified all eight delivery images share one row, strip content overflows horizontally inside its container, page itself does not overflow, and all 17 stories remain present. Results: `verification/reference-ui/survue-strip-sizing.json`. Build passes.

### Responsive pass

Phone collage now uses its natural aspect ratio rather than reserving a full viewport; removed mobile piece zoom, stacked project cards, increased navigation/filter tap targets, and adjusted small-screen type and spacing. Tablet keeps a proportional board. Short desktop sidebars can scroll instead of clipping contacts. Mobile case-study name mark stays in the hero instead of overlapping article content; headings and info panels fit narrow widths. Touch devices show project labels without requiring hover.

Build passed. Checked homepage and both case studies at 320×740, 375×812, 430×932, 768×1024, 1024×768, 1440×900 and 1280×600: no horizontal page overflow in 21 checks. Phone screenshot: `verification/reference-ui/responsive-after.png`; measurements: `verification/reference-ui/responsive-check.json`. These are browser layout checks, not real-device Safari validation.

Status phrases now use a small illustrated fairy convoy: enter from left, hold for reading, push out right, then repeat with the next phrase. Text size remains unchanged; reduced-motion preference keeps a static phrase. The Huy reference URL was consulted, but its loader was not visible in the captured browser frame; this implements the user's described movement, not a verified timing clone.
