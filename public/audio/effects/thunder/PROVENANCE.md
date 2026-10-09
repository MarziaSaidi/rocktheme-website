# Proposed rolling-thunder field recordings

Listening approval is pending. These are six new contiguous field-recording excerpts; no Overworld assets are included. Each source page explicitly licenses the sound under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), permitting commercial website use and redistribution. The published HQ stereo MP3 preview is the source.

| Site file          | Character | Original source / author                                                                                                            | Source excerpt | Final length |
| ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------ |
| distant-valley.mp3 | distant   | [Thunder, single long rolling, distant, light rain, TORONTO, 2011.wav by TRP](https://freesound.org/people/TRP/sounds/577315/)      | 0.85–31.85 s   | 31 s         |
| soft-roll.mp3      | distant   | [Thunder, dry distant rolling, field, NOTL, 2011.wav by TRP](https://freesound.org/people/TRP/sounds/577317/)                       | 2.05–22.05 s   | 20 s         |
| deep-front.mp3     | close     | [thunder long tail by elmoustachio](https://freesound.org/people/elmoustachio/sounds/476738/)                                       | 1.17–29.02 s   | 27.85 s      |
| mountain-echo.mp3  | close     | [thunder 5 dry.wav by elmoustachio](https://freesound.org/people/elmoustachio/sounds/476739/)                                       | 5.80–29.55 s   | 23.75 s      |
| low-canopy.mp3     | distant   | [230405 Thunder DRY rolling distant low rumbles, roof, EM272s, Toronto 7am by TRP](https://freesound.org/people/TRP/sounds/717845/) | 1.30–20.30 s   | 19 s         |
| rolling-strike.mp3 | close     | [thunder 3 by elmoustachio](https://freesound.org/people/elmoustachio/sounds/476735/)                                               | 2.90–22.90 s   | 20 s         |

Exact processing: 22 Hz high-pass for subsonic energy; gentle RMS compression at −22 dBFS threshold, 2:1 ratio, 8 ms attack, 500 ms release, soft knee 2.828, unity makeup. Distant entry fades are 240 ms; close entry fades are 6 ms. Close recordings begin at 0.63 gain (−4 dB), easing to unity over 1.8 s so the initial crack stays subordinate to the rolling body. Distant tails fade over the final 3.5 s, close tails over 4 s. Stereo is retained.

Constant level is selected from the 80th percentile of 250 ms stereo RMS windows: target −24 dBFS for distant, −23 dBFS for close, constrained by a −9 dBFS pre-encode peak ceiling. This replaces the former −6 dBFS transient-peak normalization. Exact gains, source/output SHA-256, source URLs and complete filter strings are in `PROVENANCE.json`; reproducible input recipes are in `SOURCES.json`. MP3 output is 48 kHz stereo / 160 kbps.

No pitch or speed changes, synthesized rumble, added echo, reverb, or stacking. Each cue plays one recording with its original internal rolling waves. Runtime gain/filter/delay/voice handling is unchanged. Three distant sounds serve the more common weaker strikes; three close sounds serve the existing strong-strike threshold.

These processing choices and source descriptions support a proposal; they are not evidence of a human listening approval.
