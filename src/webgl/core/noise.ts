/**
 * Curl noise for the particle flow field.
 *
 * A small deterministic value-noise implementation with a smooth gradient,
 * differentiated to produce a divergence-free curl field. Divergence-free is
 * what keeps the particles from bunching into clumps or draining into sinks,
 * which is the difference between a flow field and drifting smoke.
 */

const PERMUTATION_SIZE = 256;

function buildPermutation(seed: number): Uint8Array {
  const table = new Uint8Array(PERMUTATION_SIZE * 2);
  const source = new Uint8Array(PERMUTATION_SIZE);

  for (let index = 0; index < PERMUTATION_SIZE; index += 1) {
    source[index] = index;
  }

  // Deterministic shuffle so the field is identical between reloads.
  let state = seed >>> 0;
  for (let index = PERMUTATION_SIZE - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swap = state % (index + 1);
    const held = source[index]!;
    source[index] = source[swap]!;
    source[swap] = held;
  }

  for (let index = 0; index < PERMUTATION_SIZE * 2; index += 1) {
    table[index] = source[index % PERMUTATION_SIZE]!;
  }

  return table;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function gradient(hash: number, x: number, y: number, z: number): number {
  // The same 16 signed gradients, small enough for the hot noise loop to
  // inline. The switch version boxed numeric intermediates in V8 profiles.
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}

export type CurlField = Readonly<{
  /** Writes the curl vector at (x, y, z) into `out`. */
  sample: (x: number, y: number, z: number, out: [number, number, number]) => void;
}>;

export function createCurlField(seed = 1337): CurlField {
  const perm = buildPermutation(seed);
  // Reuse double-precision scratch so noise results do not cross a boxed
  // numeric return boundary for every finite-difference sample.
  const samples = new Float64Array(12);

  const noise = (x: number, y: number, z: number, slot: number): void => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const zi = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const a = perm[xi]! + yi;
    const aa = perm[a & 511]! + zi;
    const ab = perm[(a + 1) & 511]! + zi;
    const b = perm[(xi + 1) & 255]! + yi;
    const ba = perm[b & 511]! + zi;
    const bb = perm[(b + 1) & 511]! + zi;

    samples[slot] = lerp(
      lerp(
        lerp(gradient(perm[aa & 511]!, xf, yf, zf), gradient(perm[ba & 511]!, xf - 1, yf, zf), u),
        lerp(
          gradient(perm[ab & 511]!, xf, yf - 1, zf),
          gradient(perm[bb & 511]!, xf - 1, yf - 1, zf),
          u,
        ),
        v,
      ),
      lerp(
        lerp(
          gradient(perm[(aa + 1) & 511]!, xf, yf, zf - 1),
          gradient(perm[(ba + 1) & 511]!, xf - 1, yf, zf - 1),
          u,
        ),
        lerp(
          gradient(perm[(ab + 1) & 511]!, xf, yf - 1, zf - 1),
          gradient(perm[(bb + 1) & 511]!, xf - 1, yf - 1, zf - 1),
          u,
        ),
        v,
      ),
      w,
    );
  };

  // Offsets keep the three potential-field components decorrelated.
  const OFFSET = 137.31;
  const EPSILON = 0.0001;

  return {
    sample: (x, y, z, out) => {
      noise(x, y + EPSILON, z, 0);
      noise(x, y - EPSILON, z, 1);
      noise(x, y, z + EPSILON, 2);
      noise(x, y, z - EPSILON, 3);
      noise(x + EPSILON + OFFSET, y, z, 4);
      noise(x - EPSILON + OFFSET, y, z, 5);
      noise(x + OFFSET, y, z + EPSILON, 6);
      noise(x + OFFSET, y, z - EPSILON, 7);
      noise(x + EPSILON + OFFSET * 2, y, z, 8);
      noise(x - EPSILON + OFFSET * 2, y, z, 9);
      noise(x + OFFSET * 2, y + EPSILON, z, 10);
      noise(x + OFFSET * 2, y - EPSILON, z, 11);

      const inverse = 1 / (2 * EPSILON);
      // Finish all components before writing out, including for an accessor-
      // backed output that could invoke another sample during assignment.
      const cx = (samples[10]! - samples[11]! - (samples[6]! - samples[7]!)) * inverse;
      const cy = (samples[2]! - samples[3]! - (samples[8]! - samples[9]!)) * inverse;
      const cz = (samples[4]! - samples[5]! - (samples[0]! - samples[1]!)) * inverse;
      out[0] = cx;
      out[1] = cy;
      out[2] = cz;
    },
  };
}
