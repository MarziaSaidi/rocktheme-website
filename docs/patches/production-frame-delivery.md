# Production frame-delivery adaptation

Apply `production-frame-delivery.patch` to production baseline `9e8c2c2`.
It is independent of the adjacent guide-positioning patch; both pass
`git apply --check` on that baseline. The isolated production snapshot also
builds successfully with both patches.

This carries the branch's delivered-frame sampling and p95/p99-based quality
step-down into production without replacing its approved camera or visuals.
The existing quality tiers are unchanged. The active loop does not let a very
long foreground stall be mistaken for a background-tab suspension; visibility
restarts already reset the frame clock.

It also carries the bit-exact curl-noise allocation correction. A 16,408-vector
reference comparison matches every double-precision component. In the isolated
200,000-call browser benchmark, sampled allocation estimates fell from
319.4 MB to 31.0 MB. The frozen branch's final three-repeat A/B scroll traces
show p99 of 16.8 ms in both windows, but occasional individual stalls remain;
these results do not certify the newer production camera or a physical iPhone.

The original cold first-switch stall was not reproduced by the targeted WebGL
call probe during this pass. Do not claim that a particular shader compile was
identified or eliminated. This patch fixes the confirmed adaptive-quality blind
spot and must still be exercised on the production path and real iPhone before
relaunch.
