Project exploration adds two entrances to the existing featured collection.
The index uses a native modal dialog with title, year, category and outlined
project actions. Hover or keyboard focus reveals artwork behind the row using
the retained banner shader and displacement texture: .7-second noisy reveal,
.45-second fade, luminance coverage and warped soft edges. The purple palette
and existing sound channel remain. A native cursor stays visible inside the
modal top layer. Escape closes it and restores focus.
The robot button follows projected scene bounds through a channel; continuous
positions update DOM styles without rendering React on every frame. Engaging
it uses the existing robot greeting and a leaf-only emissive response.
The robot first stands using an eleven-bone runtime skin, then takes alternating
steps along the existing perch. The camera follows into the existing
scroll-defined world; the whole sequence lasts about 7.1 seconds. No new model
assets or external animation clips are required. Surface raycasts ground the
figure on the rock, and interruption restores its original seated pose.
Skip, wheel, touch, Escape and explicit navigation interrupt it. Reduced
motion enters the first project immediately. Arrival focuses its case-study
link. Cleanup cancels animation frames and removes listeners.
Design direction: existing cinematic portfolio, native CSS and GSAP, with
variance 8, motion 7 and density 3. Preserve the approved hero, palette and
landscape; keep the index as a restrained project list and the world invitation discreet.

Run `node --import tsx --test scripts/check-robot-gait.ts` to check the seated
bind pose, skin weights, standing foot level, alternating gait and support-foot drift.
Steps follow actual distance traveled; two-link leg solving keeps the boots level,
with separate rock-height probes for each foot.
