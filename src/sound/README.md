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
`scripts/render-sound-cues.mjs`; eight weather recordings are stored locally. Legacy recordings remain archived.

| Event               | Where it is published                                         | Sample                                          |
| ------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| `entry:passage`     | `IntroDoorway.tsx`, timed so the bloom meets the burst        | `transition`, whole                             |
| `project:active`    | `MonolithGallery.tsx`, a project settles                      | `readout`, a step higher for the second project |
| `statement:read`    | `BioStory.tsx`, a bio passage arrives                         | `readout`                                       |
| `project:open`      | `MonolithGallery.tsx`, View case study                        | `transition`, entered late                      |
| `contact:open`      | `SiteFooter.tsx`, the plane or the email link                 | `chime`                                         |
| `weather:lightning` | Main-page weather controller, once at the first visible flash | One of eight local thunder recordings           |

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

## Weather audio

The main scene publishes one `weather:lightning` event for each cloud flash. The engine plays one of eight local thunder recordings from `public/weather/thunder/`, using Opus with WebM fallback. A shuffled group avoids immediate repetition and permits two simultaneous voices. Strike strength controls volume from 0.75 to 1 and playback rate from 0.9 to 1; thunder starts with the flash event, without an added distance delay.

The thunder bus has its own calibrated output trim (0.7), compressor (ratio 20, knee 0, attack 0.003 seconds, release 0.25 seconds), and 20 kHz low-pass / 10 Hz high-pass filtering. Desktop compressor threshold is −1 dB; touch devices use −3 dB and the matching makeup stage. Interaction cues and the chosen background track retain their existing buses. Thunder does not duck the music.

Overflow releases an old voice over 60 ms; muting and cancellation release the weather group over 500 ms. Hidden tabs suspend the shared AudioContext. Navigation away from the main portfolio cancels voices and fetches; returning loads the weather recordings only when sound is enabled. Reduced motion suppresses flashes and their audio events.

Nothing creates an audio context or fetches thunder before the visitor enables sound. `?weatherAudioAudit=1` exposes development-only event diagnostics. `?weatherDebug=1` adds local development controls for sampling a cloud flash and resuming the weather clock; these controls are absent from production.

Run `node --import tsx --test scripts/check-thunder.ts scripts/check-weather.ts` to verify asset digests, waveform fixtures, group selection, event synchronization and lifecycle behavior.
