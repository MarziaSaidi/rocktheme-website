import { particleConfig, pointerZones } from "../sceneConfig";

/**
 * Pointer influence on the particle field.
 *
 * Three concentric zones, taken straight from the creative direction. This
 * module owns only the force applied to one particle; it holds no particle
 * state and no rendering, so the particle field can be retimed or replaced
 * without touching the interaction rules.
 *
 * Zone behaviour:
 *   awareness (~240px)  turn towards the pointer's direction of travel
 *   orbit     (~72px)   part gently above and below the pointer
 *   contact   (~28px)   split around the pointer like water around a stone
 */

export type PointerInfluenceInput = Readonly<{
  /** Particle position and velocity, in CSS pixels. */
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Pointer position and direction of travel. */
  cx: number;
  cy: number;
  /** Normalised pointer direction. Zero-length when the pointer is at rest. */
  dirX: number;
  dirY: number;
  /** Smoothed pointer speed in px per second. */
  speed: number;
}>;

export type PointerInfluenceResult = {
  /** Acceleration to add this frame, in px per second squared. */
  ax: number;
  ay: number;
  /** 0 when untouched, 1 when fully displaced. Drives the recovery timer. */
  disturbance: number;
  /** True when this particle is eligible to flash gold. */
  contact: boolean;
};

const AWARENESS_SQ = pointerZones.awareness * pointerZones.awareness;

export function applyPointerInfluence(
  input: PointerInfluenceInput,
  out: PointerInfluenceResult,
): void {
  out.ax = 0;
  out.ay = 0;
  out.disturbance = 0;
  out.contact = false;

  const offsetX = input.px - input.cx;
  const offsetY = input.py - input.cy;
  const distanceSq = offsetX * offsetX + offsetY * offsetY;

  if (distanceSq > AWARENESS_SQ || distanceSq < 1e-6) {
    return;
  }

  const distance = Math.sqrt(distanceSq);
  const normalX = offsetX / distance;
  const normalY = offsetY / distance;

  // Outer zone: awareness. Particles lean into the pointer's travel direction
  // and accelerate slightly, so the field looks like it noticed the visitor.
  const awareness = 1 - distance / pointerZones.awareness;
  const speedFactor = Math.min(1, input.speed / 900);
  out.ax += input.dirX * awareness * particleConfig.pointer.awarenessForce * (0.35 + speedFactor);
  out.ay += input.dirY * awareness * particleConfig.pointer.awarenessForce * (0.35 + speedFactor);
  // A 10 percent nudge along the particle's own heading.
  out.ax += input.vx * awareness * 0.1;
  out.ay += input.vy * awareness * 0.1;
  out.disturbance = awareness * 0.35;

  if (distance > pointerZones.orbit) {
    return;
  }

  // Middle zone: a vertical divide, not a circular attraction or cursor halo.
  // Once past the pointer, each particle's assigned path draws it back.
  const orbit = 1 - distance / pointerZones.orbit;
  const tangentX = -normalY;
  const tangentY = normalX;
  const side = offsetY === 0 ? (input.vy >= 0 ? 1 : -1) : Math.sign(offsetY);
  out.ay += side * orbit * particleConfig.pointer.divideForce * (1 + speedFactor * 0.35);
  out.disturbance = Math.max(out.disturbance, 0.35 + orbit * 0.4);

  if (distance > pointerZones.contact) {
    return;
  }

  // Inner zone: contact. Particles avoid the exact centre and divide around it.
  // The split is along the tangent, not a radial shove, so the field opens like
  // water around a stone instead of exploding outwards.
  const contact = 1 - distance / pointerZones.contact;
  const tangentSide = tangentX * input.vx + tangentY * input.vy >= 0 ? 1 : -1;
  out.ax += tangentX * tangentSide * contact * particleConfig.pointer.splitForce;
  out.ay += tangentY * tangentSide * contact * particleConfig.pointer.splitForce;
  out.ax += normalX * contact * particleConfig.pointer.contactForce;
  out.ay += normalY * contact * particleConfig.pointer.contactForce;
  out.disturbance = 1;
  out.contact = true;
}

/** Chance that a contact-zone particle flashes gold on a given frame. */
export const goldFlashChance = particleConfig.goldChance;
