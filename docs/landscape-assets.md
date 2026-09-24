# Landscape rock assets

The browser loads independent, optimized Tripo models:

| Chapter       | Served asset                                | Scene placement            |
| ------------- | ------------------------------------------- | -------------------------- |
| Hero          | `public/assets/rocks/hero-rock.glb`         | `rockInstances`            |
| Selected Work | `public/assets/selected-work/monolith.glb`  | `monolithConfig.stone`     |
| Selected Work | `public/assets/selected-work/mountains.glb` | `monolithConfig.mountains` |
| Footer        | `public/assets/rocks/footer-rock.glb`       | `rockInstances`            |

The hero and footer sources are `hero.glb` and `footer.glb`, supplied outside the repository. Each source is about 70 MB and two million triangles. The committed browser copies retain the original base-color, roughness/metallic, and normal imagery, but reduce geometry to about 80,000 triangles and resize the maps to 2048px. They are about 7–8 MB each. The source files are not modified.

To replace the hero or footer rock, put both named source files in one folder and run `npm run prepare:rocks -- /absolute/path/to/folder`. The script regenerates the three fixed browser paths. If replacing just one model, keep a copy of the other source in that folder; the command intentionally refreshes both. Verify the new model in the browser at desktop and mobile widths, then adjust only its typed placement in `src/webgl/sceneConfig.ts`. Placement uses the loaded geometry's measured bounds for normalization and ground alignment.

The footer composition uses `design/references/footer-cinematic-corrected.png` (supplied September 21, 2026). The hero uses `design/references/homepage-hero-natural-flow-v3.png`. These are direction references, not rendered backdrops.

If WebGL is unavailable or loses context, the CSS sky, horizon, and floor remain. A model load failure is reported in the browser console and by `data-rock-failed` on the canvas; the scene does not substitute a fabricated rock. No model intercepts DOM input.

## Selected Work monolith

The Selected Work stone and mountain range were supplied as `rock monolith 3d model.glb` and `bg mountain for selected work .glb`. Copies of the raw sources live in `assets-src/selected-work/` as `monolith.glb` and `mountains.glb`; that folder is ignored by git because each file is about 70 MB. `npm run prepare:selected-work` reduces them into `public/assets/selected-work/` (80,000 triangles and 2048px maps for the stone; 60,000 triangles and 1024px maps for the distant range).

The two project screens are mounted on the stone's wide faces. Their placement in `monolithConfig` was measured from the reduced stone: its square section sits 36° off the model axes (`alignYaw`), the pillar axis is at `axis`, and each face leans back a few degrees (`screen.front` and `screen.back`, as depth = offset + slope × height). If the stone is replaced, re-measure these before adjusting anything else, or the screens will float off or sink into the rock.

The screen images are `public/images/projects/<slug>/monolith-screen.jpg`, built from each project's real screenshots by `npm run prepare:monolith-screens`, and referenced as each project's `homepageImage`.

The stone is fixed in the world. Changing project walks the camera half way round its pivot (the camera rig in `src/webgl/core/environment.ts`); the horizon glow and mist travel with the view like sky, while the stone, the mountains and the water stay put. So the back view is never empty, the mountain model is placed four times round the pivot at quarter turns, and the water has a second tile laid beyond the far edge of the first.
