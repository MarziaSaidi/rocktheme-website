# Corrected prototype: bio → falling stars → water

The bio’s outgoing heading is sampled from its actual glyph pixels. Each sampled grain releases as the corresponding part of the letter dissolves. Screen coordinates are converted once to world coordinates using the current camera and portal depth. Gravity then owns the motion; no particle travels to the portal, no independent portal shower is emitted, and scrolling backward does not reverse gravity.

The current copy and typography remain unchanged. Incoming titles use the existing in-place reveal. The mountain, portal light, approved camera journey, and sound are preserved. Falling particles reuse the pooled simulation, thin trails/star glints, selected world-space water rings, splash beads, and dissolving glow from the first prototype.

Recordings `desktop.mp4` and `mobile.mp4` show two heading transitions and the particles finishing after scrolling stops, at normal speed. The source budgets per heading are approximately 1,700 on desktop and 850 on mobile, subject to glyph sampling and the shared live-particle budget. Both captured sessions start with zero automatic rain and finish with zero particles and zero impact rings. Earlier performance tables elsewhere in this directory apply to the superseded portal-source version.

Validation: production build, TypeScript, focused lint, and five behavior tests. The new test verifies alignment with a real screen-space glyph position and independence from subsequent camera movement. Mobile verification uses Chrome viewport emulation on the same Mac.

No merge, push, or deployment. Remains on `codex/portal-star-shower` for visual review.

Captured transition snapshots: desktop 1,705 live particles, 16.6ms frame interval, 3.8ms total scene CPU submission, 111 draw calls; source idle begins and ends at zero. See `verification.txt` for both viewports. These are recording snapshots, not a repeat of the earlier percentile benchmark.
