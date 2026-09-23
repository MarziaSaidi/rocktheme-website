# Landscape rock assets

The browser loads three independent, optimized Tripo models:

| Chapter       | Served asset                                 | Scene placement              |
| ------------- | -------------------------------------------- | ---------------------------- |
| Hero          | `public/assets/rocks/hero-rock.glb`          | `rockConfig.chapters.hero`   |
| Selected Work | `public/assets/rocks/selected-work-rock.glb` | `rockConfig.chapters.work`   |
| Footer        | `public/assets/rocks/footer-rock.glb`        | `rockConfig.chapters.footer` |

The source files are `hero.glb`, `selected work.glb`, and `footer.glb` supplied outside the repository. Each source is about 70 MB and two million triangles. The committed browser copies retain the original base-color, roughness/metallic, and normal imagery, but reduce geometry to about 80,000 triangles and resize the maps to 2048px. They are about 7–8 MB each. The source files are not modified.

To replace a rock, put all three named source files in one folder and run `npm run prepare:rocks -- /absolute/path/to/folder`. The script regenerates the three fixed browser paths. If replacing just one model, keep copies of the other two sources in that folder; the command intentionally refreshes all three. Verify the new model in the browser at desktop and mobile widths, then adjust only its typed placement in `src/webgl/sceneConfig.ts`. Placement uses the loaded geometry's measured bounds for normalization and ground alignment.

The footer composition uses `design/references/footer-cinematic-corrected.png` (supplied September 21, 2026). The hero uses `design/references/homepage-hero-natural-flow-v3.png`. These are direction references, not rendered backdrops.

If WebGL is unavailable or loses context, the CSS sky, horizon, and floor remain. A model load failure is reported in the browser console and by `data-rock-failed` on the canvas; the scene does not substitute a fabricated rock. No model intercepts DOM input.
