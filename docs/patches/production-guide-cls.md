# Production robot guide: CLS fix

This branch freezes a different camera from production. Apply the adjacent
`production-guide-cls.patch` to production baseline `9e8c2c2`; do not replace
production with this branch to deliver this fix. `git apply --check` passes on
that baseline. The patch has not been applied to the live production branch.

The patch uses `translate3d` for the guide's projected position, retaining its
measured width and height so the existing invitation, hit bounds, and focus
outline keep their dimensions. It changes no camera, robot, particles, or copy.

In the isolated production build, normal / 4× CPU hero-exit checks measured
CLS 0.000018 / 0.000141, below 0.05 (the audit baseline was about 0.12).
Sampled visible hit bounds agree with projected placement within 0.001 CSS px.
Raw checks: `/tmp/portfolio-fixes/guide-results.json`.
