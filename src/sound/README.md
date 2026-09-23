# Sound boundary

Audio context ownership, user consent, session preference, cue mapping, mixing,
and disposal belong here. Sound must begin muted, have a visible equivalent for
every cue, and never be required for navigation or comprehension.

## Files

| File                | Owns                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `soundEvents.ts`    | The event names and the publish/subscribe channel. **Contains no audio.** |
| `soundConfig.ts`    | Every level, timing, pitch and limit in the system.                       |
| `soundEngine.ts`    | The AudioContext, the bus graph, the synthesis, the voice pool.           |
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

## Changing the assets

There are none, and that is a decision rather than an omission.

Every cue is synthesised from oscillators and one shared noise buffer. That
keeps the payload at zero bytes, avoids media elements that autoplay policy
blocks, and lets a cue respond to the scene through `intensity` and `step`
instead of replaying a fixed recording. It also matches the direction, which
asks for a procedural and responsive soundscape rather than one looping song.

To move to files instead, replace the body of the switch in `soundEngine.ts`
with `AudioBufferSourceNode`s fed from a decoded buffer cache, and load them
lazily inside `start()` so nothing is fetched before consent. The event
channel, the config, the limits and the lifecycle would not change.

## Keeping it restrained

The direction rules out looping music, audio on every hover, loud beeps,
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
