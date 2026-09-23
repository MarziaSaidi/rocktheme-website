# Motion boundary

Scroll orchestration and timeline adapters belong here. Motion code must consume
semantic events and content identifiers, remain isolated in client-only leaf
components, clean up every subscription, and provide a no-motion path.

## Files

| File               | Owns                                                                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `motion.css`       | Every value CSS consumes: easing, durations, delays, stagger, travel distances, perspective strength, the pointer rotation budget, and the global keyframes. Also the single reduced-motion override. |
| `motionConfig.ts`  | Only the pointer-input values JavaScript needs: smoothing, rest threshold, media queries, and the attribute and custom-property names it writes.                                                      |
| `PointerDepth.tsx` | The hero's pointer-depth runtime.                                                                                                                                                                     |

`motion.css` and `motionConfig.ts` hold disjoint sets of values. Nothing is
duplicated between them, so they cannot drift apart.

## Rules

**Never name a keyframe directly from a CSS Module.** CSS Modules rewrite a
literal `animation-name` into a locally scoped identifier, which will not match a
keyframe declared in a global stylesheet, and the animation silently does not
run. Reference the published name instead:

```css
.thing {
  animation-name: var(--motion-keyframes-copy);
  animation-duration: var(--motion-copy-duration);
}
```

**Express every travel distance through a variable.** Reduced motion is handled
once, at the bottom of `motion.css`, by neutralising the travel variables and
shortening the durations. A keyframe with a hard-coded `translate` or `blur`
will ignore that contract and keep moving for visitors who asked it not to.

**No duration or delay in a component.** Components select a named step of the
timeline; they do not invent timings.

**Do not animate `transform` on an element that the pointer loop drives.** The
plane frames compose a base rotation with a live pointer offset inside a single
`transform`. Entrance animations use `opacity`, `translate`, `scale` and
`filter`, which compose rather than overwrite.

## Reduced motion

`src/styles/reset.css` deliberately does not force `animation-duration` to zero.
Doing so would replace the entrance with an instant pop rather than the short
opacity reveal the direction calls for. Animations are retimed centrally here
instead, which is why the rule above about travel variables matters.
