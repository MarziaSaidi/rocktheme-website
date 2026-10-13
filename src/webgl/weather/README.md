# Weather

The scene uses a shared 256 × 256 animated cloud texture, a spherical sky shader, localized intra-cloud flashes, four-octave texture-driven height fog, shared water/terrain sky detail, and a scene color pass with the 32³ lookup table, four-level Gaussian bloom, vignette and grain. Weather shader strings, preset values, textures and recordings are retained in this asset pack; wrappers connect them to the portfolio renderer and audio event bus.

`core/weather.ts` owns one active-time countdown. The cloud strike emits one audio event, and its four Gaussian lobes drive the dome and reflected cloud texture. Intervals, duration, intensity and reflection amount come from `preset.json`. Muting affects audio only. Hidden/context-lost scenes suspend the clock; reduced motion cancels flashes.

`modules/distanceFog.ts` applies the height fog and noise field to landscape materials. A coordinate adapter divides the portfolio's larger world coordinates by ten. The dome keeps angular directions local while following the portfolio camera. Scene composition and geometry belong to the existing portfolio, so the complete image differs from another landscape even when the weather shaders and assets match.

`grade.ts` grades the WebGL scene; it does not recolor HTML text or controls. `bloom.ts` uses four paired Gaussian mip passes and the shared bright-pixel threshold. The existing geometry lights remain with their owning scene modules; cloud flashes propagate through the sky texture and its surface samples.

`shader-hashes.json` and `asset-hashes.json` record content digests; `flash-fixture.json` records reference waveform samples. The weather/thunder checks validate them alongside synchronization, sample selection and disposal.

Verification: 12 weather/thunder checks, TypeScript, and the production build pass. Local browser verification covered natural strikes, a sampled flash, all eight decoded thunder buffers, playback aligned to a strike, muting, desktop and phone rendering, and zero WebGL errors. The broader scene validator has five existing failures on the font-stage baseline: quality downgrade and four featured-project/station-count checks. They are outside this atmosphere change.
