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

Four moments make a sound, and nothing else does. Three sample files cover
them, rendered by `scripts/render-sound-cues.mjs` into `public/audio/effects/`.

| Event            | Where it is published                         | Sample                                          |
| ---------------- | --------------------------------------------- | ----------------------------------------------- |
| `project:active` | `MonolithGallery.tsx`, a project settles      | `readout`, a step higher for the second project |
| `statement:read` | `BioStory.tsx`, a bio passage arrives         | `readout`                                       |
| `project:open`   | `MonolithGallery.tsx`, View case study        | `transition`, entered late                      |
| `contact:open`   | `SiteFooter.tsx`, the plane or the email link | `chime`                                         |

The intro gate has no sound effects. Stone hover movement and the opening transition are silent.

The transition sample marks case study navigation. Shorter
scene changes start the file part way through (`lead` in `CUES`) so the bloom
arrives soon after the gesture. Each transition briefly dips the music, and
the music sits lower while a case study is open (`MUSIC_DUCK`).

To replace a sound, drop an MP3 with the same name into `public/audio/effects/`.
If the transition's bloom moves, update `TRANSITION_PEAK` to match.

## Changing the volume

Everything is in `soundConfig.ts`.

- `MASTER_GAIN` — the whole mix. Deliberately conservative.
- `MUSIC_GAIN` — the level of the visitor-selected background track.
- `CUE_GAIN` — all cues against the music.
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

No hover sounds, and nothing follows the pointer. The intro stones, particles and water
still respond to the cursor, silently. A cue marks a change of place or a
decision, never movement. Per-event cooldowns and a voice cap
(`VOICE_LIMITS`) stop rapid scrolling from stacking cues.

## Visual equivalent

Every cue describes something already happening on screen: the passage
bursting, a project's card coming in, the statement lighting, a page opening,
the contact plane answering. The toggle's waveform moves only while the engine
is genuinely running.
