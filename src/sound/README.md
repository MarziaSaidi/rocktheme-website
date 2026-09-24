# Sound boundary

Audio context ownership, user consent, session preference, cue mapping, mixing,
and disposal belong here. Sound must begin muted, have a visible equivalent for
every cue, and never be required for navigation or comprehension.

## Files

| File                | Owns                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `soundEvents.ts`    | The event names and the publish/subscribe channel. **Contains no audio.** |
| `soundConfig.ts`    | Every level, timing, pitch and limit in the system.                       |
| `soundEngine.ts`    | The AudioContext, looping music, synthesis, and voice pool.               |
| `SoundProvider.tsx` | The engine's lifecycle: consent, session restore, suspend, disposal.      |
| `SoundToggle.tsx`   | The on/off control and its visual equivalent.                             |
| `soundStore.ts`     | The preference, shared between the control and the host.                  |

## The one rule for everything outside this directory

**Never create audio. Announce what happened.**

```ts
import { emitSoundEvent } from "@/sound/soundEvents";

emitSoundEvent("water:ripple", { intensity: 0.6 });
```

`soundEvents.ts` holds no audio code, so importing it from a component or from
the WebGL scene couples nothing to Web Audio. Publishing when sound is off is
free: nothing is subscribed and the call returns immediately. A component must
never check whether sound is enabled before reporting what it did, and must
never hold an `AudioContext`, schedule a node, or play a media element.

`soundEventsIdle()` exists only so a hot loop can skip building an expensive
detail object. It is not a permission check.

## Changing the volume

Everything is in `soundConfig.ts`.

- `MASTER_GAIN` — the whole mix. Deliberately conservative.
- `MUSIC_GAIN` — the level of the visitor-selected background track.
- `LAYER_GAIN` — the six layers from the creative direction. Rebalance one
  layer against the others without touching a cue.
- `CUES[event].peak` — one cue's level within its layer.
- A `DynamicsCompressor` sits on the output as a limiter, so no combination of
  cues can spike past it.

## Changing the events

1. Add the name to `SOUND_EVENTS` in `soundEvents.ts`.
2. Add a cooldown to `VOICE_LIMITS.cooldownSeconds` and a shape to `CUES` in
   `soundConfig.ts`. Both are exhaustive records, so TypeScript will refuse to
   build until you do.
3. Add a `case` to the switch in `soundEngine.ts`.
4. Publish it with `emitSoundEvent` from wherever the thing happens.

Removing an event is the same in reverse. Nothing else in the app changes.

## Background track

The intro offers a sound-on and a silent choice. The supplied track at
`public/audio/sahtori-path-of-the-wind-lofi-223116.mp3` replaces the old
procedural drone and air bed. It loops only after a sound-on user gesture,
runs through the master gain, pauses when the tab is hidden, and stops with
the header toggle. Interaction cues remain procedural and restrained.

Change `BACKGROUND_TRACK` in `soundConfig.ts` to replace the file. The music
is not constructed or fetched while sound is off.

## Keeping it restrained

The interaction layer still rules out audio on every hover, loud beeps,
literal splashing, trailer impacts, and uncontrolled overlap. Two mechanisms
enforce the last one:

- **Per-event cooldowns** in `VOICE_LIMITS.cooldownSeconds`. A gesture cannot
  retrigger a cue faster than it decays.
- **A global voice cap**, `VOICE_LIMITS.maxConcurrent`. The sum of all cues
  cannot stack past it.

Both are hard limits, not fades. Cues over the limit are dropped and counted in
`engine.stats().suppressed`.

No element carries a hover cue except the contact plane. The particle texture
follows the pointer's position in the field, which is why moving the cursor
makes sound and resting it on a link does not.

## Visual equivalent

Every cue has one, because sound only ever describes something already
happening on screen: particles flashing gold, a plane locking into place, a
ripple spreading, the contact plane lighting. The toggle's waveform moves only
while the engine is genuinely running, so audio is never playing without
something visible saying so.
