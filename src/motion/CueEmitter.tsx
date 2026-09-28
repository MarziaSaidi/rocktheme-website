"use client";

import { useEffect } from "react";

import { emitSoundEvent, type SoundEvent } from "@/sound/soundEvents";

/**
 * Turns pointer and activation on one element into semantic events.
 *
 * This lives in the motion layer because it is input normalization, and it
 * holds no audio: it announces what the visitor did and stops there. A section
 * can therefore stay a server component and still take part in the cue system.
 *
 * Hover fires once per arrival, not continuously, and never on a coarse
 * pointer where "hover" has no meaning.
 */

type CueEmitterProps = Readonly<{
  /** Section to scope the listeners to. */
  sectionId: string;
  /** Elements within it that carry the cue. */
  selector: string;
  hoverEvent?: SoundEvent;
  activateEvent?: SoundEvent;
}>;

export function CueEmitter({ sectionId, selector, hoverEvent, activateEvent }: CueEmitterProps) {
  useEffect(() => {
    const section = document.getElementById(sectionId);
    const targets = [...(section?.querySelectorAll<HTMLElement>(selector) ?? [])];

    if (targets.length === 0) {
      return;
    }

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    const handleEnter = () => {
      if (hoverEvent && finePointer.matches) {
        emitSoundEvent(hoverEvent);
      }
    };

    const handleActivate = () => {
      if (activateEvent) {
        emitSoundEvent(activateEvent);
      }
    };

    targets.forEach((target) => {
      // `pointerenter` does not bubble, so this is one arrival per element.
      target.addEventListener("pointerenter", handleEnter);
      target.addEventListener("click", handleActivate);
      // Keyboard activation must sound the same as a click.
      target.addEventListener("focus", handleEnter);
    });

    return () => {
      targets.forEach((target) => {
        target.removeEventListener("pointerenter", handleEnter);
        target.removeEventListener("click", handleActivate);
        target.removeEventListener("focus", handleEnter);
      });
    };
  }, [sectionId, selector, hoverEvent, activateEvent]);

  return null;
}
