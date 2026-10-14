# Sound boundary

`SoundProvider` owns one AudioContext after a sound-on gesture. The preference,
entry choices, toggle, hidden-tab suspension and disposal stay with that host.
`sceneAudio.ts` owns decoded local background and interface recordings;
`soundEngine.ts` supplies their calibrated output and retains the separate
weather bus. Components announce semantic events through `soundEvents.ts`.

## Background and interactions

The background recording loops as an AudioBufferSourceNode, without an edited
crossfade seam. Sound-on entry plays its dedicated recording immediately;
music starts after 2.8 seconds and fades in over 2 seconds. The header's sound-on
choice plays its own recording and uses a 1-second music fade. Sound-off plays
its recording and fades the output over 0.5 seconds.

Opening a case study lowers music to 0.4, low-pass filters it at 1400 Hz and
high-pass filters it at 250 Hz over 0.25 seconds. Returning restores volume 1,
20 kHz low-pass and 10 Hz high-pass over 0.4 seconds. The interface output uses
trim 0.7 and a compressor with ratio 20, knee 0, attack 0.003 and release 0.25.
Desktop threshold is −1 dB; touch threshold is −3 dB with the matching makeup.

| Interaction                  | Local sound groups                                            |
| ---------------------------- | ------------------------------------------------------------- |
| Navigation                   | Main hover and click variations                               |
| Buttons and project controls | Alternate hover/click variations                              |
| View case study              | Dedicated project hover plus held animation layer; main click |
| Return to overview           | Return hover/click variations                                 |
| Email                        | Held email-hover recording; social click                      |
| Social links                 | Social hover/click, varying ±4 semitones                      |
| Project becomes active       | Activation and prespawn variations, portal loop at 0.5        |
| Project closes               | Deactivation variations; portal loop fades over 0.4 seconds   |
| Bio passage                  | Tagline appearance variations                                 |
| Bio render pass              | Quieter tagline variation, one voice                          |

Each group uses a shuffled bag with no consecutive repeat across its boundary.
Hover voices have the captured group limits. Overflow releases over 60 ms;
held hover leaves release over 100 ms. Touch does not trigger hover sound.
Keyboard focus provides the same cue for keyboard users. Existing semantic
click events are excluded from delegated click playback to avoid doubled cues.
Late decoded hover recordings cannot start after the pointer has left.

`scene-audio.json` lists neutral local paths with Opus and WebM fallback.
`scene-audio-hashes.json` records the unchanged asset digests. Assets are fetched
only after enabling sound; silent entry creates no AudioContext. The old audio
files remain unused. Development DOM diagnostics expose the latest interaction
and active music recording through `data-scene-audio` and `data-scene-music`.

## Weather

The main scene publishes one `weather:lightning` event per flash. Eight local
thunder recordings use their existing shuffled selection, calibrated independent
bus and two-voice limit. This interface change does not alter weather timing,
shaders, thunder shaping or the world. Hidden tabs cancel pending weather audio;
case-study navigation turns off the main scene's weather recordings.

## Validation

Run `node --import tsx --test scripts/check-scene-audio.ts scripts/check-thunder.ts scripts/check-weather.ts`.
The checks cover asset digests, shuffled groups, weather pulse synchronization,
voice selection and weather lifecycle. Browser verification covers sound-on,
project actions, music playback and mute controls.
