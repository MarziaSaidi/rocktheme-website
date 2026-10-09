# Sound boundary

Audio context ownership, user consent, session preference, cue mapping, mixing,
and disposal belong here. Sound must begin muted, have a visible equivalent for
every cue, and never be required for navigation or comprehension.

## Files

| File                | Owns                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `soundEvents.ts`    | The event names and the publish/subscribe channel. **Contains no audio.** |
| `soundConfig.ts`    | Every level, timing, pitch and limit in the system.                       |
| `soundEngine.ts`    | The AudioContext, looping music, cue samples, ducking, and voice pool.    |
| `SoundProvider.tsx` | The engine's lifecycle: consent, session restore, suspend, disposal.      |
| `SoundToggle.tsx`   | The on/off control and its visual equivalent.                             |
| `soundStore.ts`     | The preference, shared between the control and the host.                  |

## The one rule for everything outside this directory

**Never create audio. Announce what happened.**

```ts
import { emitSoundEvent } from "@/sound/soundEvents";

emitSoundEvent("project:open");
```

`soundEvents.ts` holds no audio code, so importing it from a component or from
the WebGL scene couples nothing to Web Audio. Publishing when sound is off is
free: nothing is subscribed and the call returns immediately. A component must
never check whether sound is enabled before reporting what it did, and must
never hold an `AudioContext`, schedule a node, or play a media element.

`soundEventsIdle()` exists only so a hot loop can skip building an expensive
detail object. It is not a permission check.

## The cues

Six approved cue types make a sound. Three interaction samples are rendered by
`scripts/render-sound-cues.mjs`; six CC0 thunder field recordings are prepared
separately by `scripts/render-thunder.mjs` from verified source files. No Overworld
Audio files are used.

| Event               | Where it is published                                         | Sample                                          |
| ------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| `entry:passage`     | `IntroDoorway.tsx`, timed so the bloom meets the burst        | `transition`, whole                             |
| `project:active`    | `MonolithGallery.tsx`, a project settles                      | `readout`, a step higher for the second project |
| `statement:read`    | `BioStory.tsx`, a bio passage arrives                         | `readout`                                       |
| `project:open`      | `MonolithGallery.tsx`, View case study                        | `transition`, entered late                      |
| `contact:open`      | `SiteFooter.tsx`, the plane or the email link                 | `chime`                                         |
| `weather:lightning` | Main-page weather controller, once at the first visible flash | One of six CC0 thunder field recordings         |

The transition is the signature: one sound for every change of place. Shorter
scene changes start the file part way through (`lead` in `CUES`) so the bloom
arrives soon after the gesture. Each transition briefly dips the music, and
the music sits lower while a case study is open (`MUSIC_DUCK`).

To replace a sound, drop an MP3 with the same name into `public/audio/effects/`.
If the transition's bloom moves, update `TRANSITION_PEAK` to match.

## Changing the volume

Interaction and master levels are in `soundConfig.ts`. Thunder shaping and
limits are in `thunder.ts`.

- `MASTER_GAIN` — the whole mix. Deliberately conservative.
- `MUSIC_GAIN` — the level of the visitor-selected background track.
- `CUE_GAIN` — interaction cues against the music.
- `CUES[event].peak` — one cue's level.
- `MUSIC_DUCK` — how far the music gives way, and for how long.
- A `DynamicsCompressor` sits on the output as a limiter, so no combination of
  cues can spike past it.

## Changing the events

1. Add the name to `SOUND_EVENTS` in `soundEvents.ts`.
2. Add a cooldown to `VOICE_LIMITS.cooldownSeconds` and a shape to `CUES` in
   `soundConfig.ts`. Both are exhaustive records, so TypeScript will refuse to
   build until you do.
3. Publish it with `emitSoundEvent` from wherever the thing happens.

## Background track

"Dark Ambient Soundscape Dreamscape" by SolarFLEX, from Pixabay. Chosen for
long listening: no beat, no melody, and a level that barely moves.

`public/audio/night-bed-solarflex-loop.mp3` is prepared from the original
(kept, untracked, in `assets-src/audio/`): the fade-in and fade-out are cut,
the last 8 seconds are crossfaded into the opening so the end runs straight
back into the start, and the level is set to -16 LUFS.

A media element set to loop leaves a small gap at the seam, which a pad makes
audible. The engine therefore plays the track on two players that take turns,
crossfading for `MUSIC_CROSSFADE_SECONDS` just before each one ends.

The intro offers a sound-on and a silent choice. The music starts only after a
sound-on gesture, runs through the master gain, pauses when the tab is hidden,
and stops with the header toggle. Neither the music nor the cue samples are
fetched while sound is off. Change `BACKGROUND_TRACK` in `soundConfig.ts` to
replace it.

## Keeping it restrained

No hover sounds, and nothing follows the pointer. The particles and the water
still respond to the cursor, silently. A cue marks a change of place or a
decision, never movement. Per-event cooldowns and a voice cap
(`VOICE_LIMITS`) stop rapid scrolling from stacking cues.

## Visual equivalent

Every cue describes something already happening on screen: the passage
bursting, a project's card coming in, the statement lighting, a page opening,
the contact plane answering, or the already-visible lightning flash. The toggle's waveform moves only while the engine
is genuinely running.

## Approved weather cue: thunder

`weather:lightning` is published once per strike by `core/weather.ts` at its first
nonzero visible flash. It uses the existing event bus; there is no independent
weather timer. The engine schedules one buffer source on its existing audio
clock, with a delay derived from the strike’s simulated distance at 343 m/s.
Strong strikes (intensity ≥ 0.88) use 7–37 m, approximately 20–108 ms;
weaker strikes use 274–858 m, approximately 0.8–2.5 seconds. There is no
independent random delay. Distance
jointly shapes gain and a gentle 5–12 kHz low-pass filter; the controller's
strike intensity shapes gain as well. Playback stays at the recording's original
rate. Separate shuffled close and distant pools each contain three recordings
and avoid immediate repeats, including at bag boundaries. Selection uses only
successfully decoded buffers, falling back to any ready recording if necessary.
Incomplete asset loads retry on the next real strike without introducing a timer. The original cues/music remain
unchanged. Thunder adds a separate music-only duck stage; interaction cues and
the existing reading/transition automation retain their own gain paths.

The weather controller gently eases an **audio-only** storm character over five
seconds between Hero (0.55), Selected Work (0.45), About (0.48), and Footer (0.60).
It does not alter any approved flash envelope, light gain, mist, cloud, reflection,
camera, geometry, or weather frequency. New natural strikes remain deferred
while the camera is traveling, using the existing Stage 3 rule.

Thunder is a separate bus inside the same engine and passes through the existing
master and output limiter. Two weather voices are the soft target for sustained tails; weather has its own
voice pool so interaction cues cannot silently reject a strike. A new strike
always gets a fresh buffer source. When tails overlap beyond the target, the
oldest tail fades over 1.2 seconds after protecting its initial 3.2 seconds,
measured from its scheduled start. Pending strikes therefore retain their onset.
Retiring voices remain tracked for mute and cleanup. The weather bus eases its
gain to 1 / sqrt(live voice count), then recovers as voices end.
Sources use a 3 ms anti-click entry and the recording's natural rolling decay;
no synthetic layers, added reverb, echo taps, or pitch shifts are used. Sound-off
cancels all pending/playing thunder through a 15 ms anti-click release; the
existing music still follows its original master fade. A hidden tab cancels
weather audio before suspension; resume cannot replay a pending source/tail.
Reduced motion cancels thunder and blocks future weather cues.

`weather:stop` is a **silent lifecycle signal**, never an audible cue. The scene
publishes it on suspension, disposal, or reduced-motion suppression. The engine
also independently guards main pathname, visibility, motion preference, and
running state. `SoundProvider` enables weather only at `/`; leaving the main page
cancels sources, aborts weather fetches, and releases decoded thunder buffers.
Case-study components, layouts, animations, and reading/music behavior are
unchanged. Returning loads weather assets only if sound is still enabled.

No audio context, music, interaction sample, or thunder asset is created/fetched
before the existing explicit sound-on gesture. Weather events that happen while
muted or before any buffer is ready are discarded, never replayed when the visitor enables sound.
Assets are real field recordings published under CC0 1.0, which permits
commercial website use and redistribution. Credits, source pages, license links,
exact excerpt edits, and source/output SHA-256 hashes are in
`public/audio/effects/thunder/PROVENANCE.md` and `PROVENANCE.json`. The proposed source set uses longer contiguous rolls. Source preparation uses
a 22 Hz high-pass, gentle 2:1 RMS compression without makeup, sustained-body
level matching constrained by a −9 dBFS pre-encode peak ceiling, and smooth
entry/tail fades. Close recordings ease from −4 dB to unity over 1.8 seconds
to keep the initial crack below the rolling body. Exact processing and provenance
are in the manifests; listening approval remains pending.

Weather cue configuration is separate from `CUES`, whose exhaustive record
continues to cover interaction events. The two weather bus messages are handled
explicitly by the engine. Tests: `node --import tsx --test scripts/check-thunder.ts
scripts/check-weather.ts`.

## Development audit

`?weatherAudioAudit=1` enables development-only `portfolio:thunder-audit` events.
The trace covers bus emission, stable strike ID/first flash timestamp, consent,
mute/visibility/context state, scheduling decisions, buffer errors, source creation,
start, completion, cancellation reason, and voice counts. Duplicate strike IDs
are suppressed; flickers within a strike do not publish new weather events.
There is no production debug UI. Browser acceptance recordings additionally
measure actual rendered audio energy for each source, rather than treating a
scheduled start as evidence of playback.

## Stage 4 timing and mix proposal (approval pending)

The single main-page weather controller is armed from the entry gesture,
independently of either sound choice. Its first countdown is 8–14 seconds;
subsequent gaps are irregular 20–40 seconds. Camera travel can defer a due
strike until a safe rest. Section changes only ease the existing audio character;
they do not re-arm the clock. Enabling sound neither advances the clock nor
replays a silent event. The entry channel retains the gesture timestamp for a
late-loading main scene. Hidden/reduced-motion cancellation still prevents replay.

`THUNDER.gainDb` adds 3.5 dB without changing recordings, filters, rate, distance,
source envelopes or the output compressor. At the same source start time
(including the distance delay), a separate music-path gain falls by 5 dB over
180 ms. It holds through 60% of the recording, bounded to 8–18 seconds, then
returns smoothly to unity over five seconds. The original long thunder tail
continues playing. Overlaps extend one duck envelope rather than multiplying
depths. Interaction cues bypass this stage entirely. Reading and transition
ducking remain on the original music gain.

Mute, weather cancellation, reduced motion and navigation cancel pending duck
automation and restore the weather music stage to unity over 200 ms. Visibility
resume restores unity before playback, and destruction disconnects the stage.
No JavaScript timer is needed for duck recovery: it is scheduled on the same
AudioContext timeline as the thunder source. Development audit includes
`music:thunder-duck` and `music:thunder-reset`.

The live browser mix comparison, output/stem measurements, natural-entry
recording and scope checks are in `design/screenshots/stage-24-mix/README.md`.
Measured output headroom is not a subjective listening approval or a physical
laptop-speaker test. Stage 5 remains unstarted.
