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
  switch (hash & 15) {
    case 0:
      return x + y;
    case 1:
      return -x + y;
    case 2:
      return x - y;
    case 3:
      return -x - y;
    case 4:
      return x + z;
    case 5:
      return -x + z;
    case 6:
      return x - z;
    case 7:
      return -x - z;
    case 8:
      return y + z;
    case 9:
      return -y + z;
    case 10:
      return y - z;
    case 11:
      return -y - z;
    case 12:
      return x + y;
    case 13:
      return -y + z;
    case 14:
      return y - x;
    default:
      return -y - z;
  }
}

export type CurlField = Readonly<{
  /** Writes the curl vector at (x, y, z) into `out`. */
  sample: (x: number, y: number, z: number, out: [number, number, number]) => void;
}>;

export function createCurlField(seed = 1337): CurlField {
  const perm = buildPermutation(seed);

  const noise = (x: number, y: number, z: number): number => {
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

    return lerp(
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
      const p1y = noise(x, y + EPSILON, z);
      const m1y = noise(x, y - EPSILON, z);
      const p1z = noise(x, y, z + EPSILON);
      const m1z = noise(x, y, z - EPSILON);

      const p2x = noise(x + EPSILON + OFFSET, y, z);
      const m2x = noise(x - EPSILON + OFFSET, y, z);
      const p2z = noise(x + OFFSET, y, z + EPSILON);
      const m2z = noise(x + OFFSET, y, z - EPSILON);

      const p3x = noise(x + EPSILON + OFFSET * 2, y, z);
      const m3x = noise(x - EPSILON + OFFSET * 2, y, z);
      const p3y = noise(x + OFFSET * 2, y + EPSILON, z);
      const m3y = noise(x + OFFSET * 2, y - EPSILON, z);

      const inverse = 1 / (2 * EPSILON);
      out[0] = (p3y - m3y - (p2z - m2z)) * inverse;
      out[1] = (p1z - m1z - (p3x - m3x)) * inverse;
      out[2] = (p2x - m2x - (p1y - m1y)) * inverse;
    },
  };
}
