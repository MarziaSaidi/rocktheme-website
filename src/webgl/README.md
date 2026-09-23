# WebGL boundary

Canvas lifecycle, scene objects, shaders, render-loop policy, quality tiers, and
input normalization belong here. The WebGL layer must receive serializable scene
data and semantic interaction events rather than importing React layout
components.

## The content rule

Nothing under `src/webgl` may reference a project, a slug, a title, a label or
any other portfolio fact. The scene is told about the DOM only as a list of
plain rectangles:

```ts
type ObstacleRect = { x: number; y: number; width: number; height: number };
```

`SceneCanvas` measures every element carrying `data-scene-obstacle` and passes
the rectangles down. The particle field knows it should flow around a box; it
does not know the box is a headline or a project plane. Adding, removing or
reordering a project changes nothing in this directory.

## Modules

| File                          | Owns                                                           |
| ----------------------------- | -------------------------------------------------------------- |
| `sceneConfig.ts`              | Every tunable value, mirroring the design tokens by name.      |
| `core/capability.ts`          | WebGL detection before any renderer exists.                    |
| `core/quality.ts`             | Tiers, particle density, pixel-ratio caps, adaptive downgrade. |
| `core/noise.ts`               | Divergence-free curl field for the particle flow.              |
| `core/environment.ts`         | Renderer, both passes, the frame loop, and disposal.           |
| `modules/particleField.ts`    | Screen-space simulation and point rendering.                   |
| `modules/pointerInfluence.ts` | The three pointer zones, as pure force maths.                  |
| `modules/reflectiveFloor.ts`  | Planar reflection pass, surface drift, ripples.                |
| `modules/horizonLights.ts`    | Beacons and the intensity the floor and DOM read.              |
| `modules/rocks.ts`            | Faceted anchors and their parallax.                            |
| `SceneCanvas.tsx`             | The only React leaf: measures, mounts, tears down.             |

## Two passes, one renderer

1. **Perspective** — floor, beacons, rocks. Camera pitch is derived from
   `floorConfig.horizon` so the world horizon lands on the same line the CSS
   fallback uses.
2. **Orthographic** — particles, simulated in CSS pixels. Screen space is
   deliberate: every distance in the creative direction is a pixel distance, and
   obstacle rectangles arrive in the same units, so nothing is unprojected.

## Rules

**Screen-space distances stay in screen space.** The pointer zones are 240, 120
and 35 CSS pixels. Converting them to world units would make them depend on the
camera, and the direction specifies them in pixels.

**Ramp the floor on view depth, not on UV.** Perspective compresses the entire
visible floor into the last sixth of the UV range, so a UV ramp lands almost
entirely in one band and a UV alpha fade erases the surface.

**Never leave the environment running.** `createEnvironment` returns `destroy`,
and it is the only place that disposes geometries, materials, render targets and
the renderer. Anything a module allocates, that module disposes.

## Fallback

`detectCapability` runs before the renderer is constructed. When it returns
`null`, or when the context is lost, `data-scene-active` is absent and
`EnvironmentLayer`'s CSS environment stays on screen. The page is complete
either way: the canvas carries no text, no controls and no navigation.
