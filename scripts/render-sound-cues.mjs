/**
 * Renders the three interaction cues to public/audio/effects/.
 *
 *   node scripts/render-sound-cues.mjs
 *
 * The cues are synthesised offline so they can be layered, reverberated and
 * mastered like recorded samples, then shipped as small MP3s the engine plays
 * back. To replace one with a recorded sound, drop an MP3 with the same name
 * into public/audio/effects/ and do not re-run this script.
 *
 *   transition.mp3  the signature: a long inward pull that blooms at 2.5 s.
 *                   The engine plays it whole for the entry and enters it
 *                   part way through for shorter scene changes.
 *   readout.mp3     a soft tock and a faint sparkle while a project card's text comes in.
 *   chime.mp3       a warm two-note bell, for the contact plane.
 *
 * Requires ffmpeg on the PATH.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RATE = 48000;
const OUT = join(process.cwd(), "public/audio/effects");

/** Where the transition's bloom lands, in seconds. soundConfig.ts must agree. */
const TRANSITION_PEAK = 2.5;

// ------------------------------------------------------------------ helpers

let seed = 7;
/** Seeded, so a re-render produces the same files. */
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE));
const smooth = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** RBJ biquad whose cutoff may change every sample. */
function biquad(input, type, frequencyAt, q) {
  const output = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const w = (2 * Math.PI * Math.min(frequencyAt(i / RATE), RATE * 0.45)) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    let b0;
    let b1;
    let b2;
    if (type === "lowpass") {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (type === "highpass") {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    const a1 = -2 * cos;
    const a2 = 1 - alpha;
    const x = input[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    output[i] = y;
  }
  return output;
}

function pinkNoise(length) {
  const out = new Float32Array(length);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i += 1) {
    const white = random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    out[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
  }
  return out;
}

/** A sine whose frequency and level follow functions of time. */
function tone(length, frequencyAt, levelAt, phase = 0) {
  const out = new Float32Array(length);
  let p = phase;
  for (let i = 0; i < length; i += 1) {
    const t = i / RATE;
    p += (2 * Math.PI * frequencyAt(t)) / RATE;
    out[i] = Math.sin(p) * levelAt(t);
  }
  return out;
}

function mixInto(target, source, gain = 1, at = 0) {
  const start = Math.round(at * RATE);
  for (let i = 0; i < source.length && start + i < target.length; i += 1) {
    target[start + i] += source[i] * gain;
  }
}

/**
 * A small Schroeder reverb. `spread` shifts the delay lengths so the left and
 * right channels decorrelate into a wide, soft room.
 */
function reverb(input, seconds, spread) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => d + spread);
  const allpasses = [556, 441, 341].map((d) => d + Math.round(spread / 2));
  const feedback = Math.pow(0.001, 1400 / RATE / seconds);
  const out = new Float32Array(input.length);

  for (const delay of combs) {
    const line = new Float32Array(delay);
    let index = 0;
    let damp = 0;
    for (let i = 0; i < input.length; i += 1) {
      const delayed = line[index];
      damp = delayed * 0.7 + damp * 0.3;
      line[index] = input[i] + damp * feedback;
      out[i] += delayed / combs.length;
      index = (index + 1) % delay;
    }
  }

  for (const delay of allpasses) {
    const line = new Float32Array(delay);
    let index = 0;
    for (let i = 0; i < out.length; i += 1) {
      const delayed = line[index];
      const value = out[i];
      line[index] = value + delayed * 0.5;
      out[i] = delayed - value * 0.5;
      index = (index + 1) % delay;
    }
  }
  return out;
}

/** Dry + wet stereo, a gentle fade at the tail, peak-normalised. */
function master(dry, { wet, room, peakDb, stereoDry = [dry, dry] }) {
  const left = reverb(dry, room, 0);
  const right = reverb(dry, room, 23);
  const channels = [new Float32Array(dry.length), new Float32Array(dry.length)];
  const fade = Math.round(0.08 * RATE);
  for (let i = 0; i < dry.length; i += 1) {
    const tail = i > dry.length - fade ? (dry.length - i) / fade : 1;
    channels[0][i] = (stereoDry[0][i] + left[i] * wet) * tail;
    channels[1][i] = (stereoDry[1][i] + right[i] * wet) * tail;
  }
  let peak = 0;
  channels.forEach((c) => c.forEach((v) => (peak = Math.max(peak, Math.abs(v)))));
  const scale = Math.pow(10, peakDb / 20) / (peak || 1);
  channels.forEach((c) => c.forEach((v, i) => (c[i] = v * scale)));
  return channels;
}

function writeMp3(name, [left, right]) {
  const frames = left.length;
  const data = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i += 1) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  const wav = join(tmpdir(), `${name}.wav`);
  writeFileSync(wav, Buffer.concat([header, data]));
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    wav,
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "160k",
    join(OUT, `${name}.mp3`),
  ]);
  rmSync(wav);
  console.log(`  ${name}.mp3  ${(frames / RATE).toFixed(2)} s`);
}

// --------------------------------------------------------------- the cues

/**
 * The inward pull. Air rises through a narrowing band towards the peak, a sub
 * swell climbs underneath it, and at the peak a soft low bloom and a faint
 * shimmer open out and ring into the room. No impact, no riser cliché.
 */
function transition() {
  const length = 4.4;
  const out = buffer(length);
  const peak = TRANSITION_PEAK;

  const air = pinkNoise(out.length);
  const swell = (t) =>
    Math.pow(smooth(0, peak, t), 2.6) * (t < peak ? 1 : Math.exp(-(t - peak) * 5));
  const band = biquad(air, "bandpass", (t) => 180 + 2600 * Math.pow(smooth(0, peak, t), 2), 1.6);
  const body = biquad(air, "lowpass", (t) => 120 + 500 * smooth(0, peak, t), 0.8);
  const airLeft = new Float32Array(out.length);
  const airRight = new Float32Array(out.length);
  for (let i = 0; i < out.length; i += 1) {
    const t = i / RATE;
    const level = swell(t);
    // A slow pan that closes to the centre as it arrives: the pull inward.
    const pan = Math.sin(t * 2.1) * 0.5 * (1 - smooth(0, peak, t));
    const mono = (band[i] * 1.2 + body[i] * 0.9) * level;
    airLeft[i] = mono * (1 - pan);
    airRight[i] = mono * (1 + pan);
  }

  const sub = tone(
    out.length,
    (t) => 38 + 26 * smooth(0, peak, t),
    (t) => Math.pow(smooth(0.4, peak, t), 2) * (t < peak ? 0.55 : Math.exp(-(t - peak) * 3) * 0.55),
  );

  const bloom = buffer(length - peak);
  mixInto(
    bloom,
    tone(
      bloom.length,
      (t) => 72 * Math.exp(-t * 1.4) + 40,
      (t) => Math.exp(-t * 3.2) * 0.9,
    ),
  );
  const burst = biquad(
    pinkNoise(bloom.length),
    "lowpass",
    (t) => 900 * Math.exp(-t * 2.5) + 120,
    0.7,
  );
  mixInto(
    bloom,
    burst.map((v, i) => v * Math.exp((-i / RATE) * 4) * 1.4),
  );
  // The shimmer: an open fifth, far back, so it reads as light, not melody.
  [
    [220, 0.12],
    [329.63, 0.08],
    [440, 0.05],
  ].forEach(([f, level]) =>
    mixInto(
      bloom,
      tone(
        bloom.length,
        () => f,
        (t) => smooth(0, 0.05, t) * Math.exp(-t * 1.6) * level,
      ),
    ),
  );

  mixInto(out, sub);
  mixInto(out, bloom, 1, peak - 0.02);
  const left = new Float32Array(out);
  const right = new Float32Array(out);
  mixInto(left, airLeft);
  mixInto(right, airRight);
  const mono = left.map((v, i) => (v + right[i]) / 2);
  return master(mono, { wet: 0.5, room: 2.6, peakDb: -3, stereoDry: [left, right] });
}

/**
 * A project card's text coming in: a soft low "tock" to open, then a faint,
 * airy chatter above it for as long as the text takes to arrive. The body sits
 * under 1 kHz and the chatter far above 8 kHz, leaving the 2–5 kHz band the ear
 * finds harsh almost empty. That split is what keeps it soft rather than sharp.
 */
function readout() {
  // Its own seed, so this cue renders the same whatever order the cues run in.
  seed = 7;
  const length = 0.95;
  const out = buffer(length + 0.3);

  // The tock: a rounded knock whose pitch settles, and a small swell after it.
  mixInto(
    out,
    tone(
      Math.round(0.16 * RATE),
      (t) => 640 * (0.85 + 0.15 * Math.exp(-t * 40)),
      (t) => smooth(0, 0.004, t) * Math.exp(-t * 38) * 0.9,
    ),
  );
  mixInto(
    out,
    tone(
      Math.round(0.14 * RATE),
      () => 360,
      (t) => smooth(0, 0.006, t) * Math.exp(-t * 45) * 0.45,
    ),
  );
  mixInto(
    out,
    tone(
      Math.round(0.12 * RATE),
      () => 820,
      (t) => smooth(0, 0.02, t) * Math.exp(-t * 30) * 0.25,
    ),
    1,
    0.03,
  );

  // The chatter: soft-edged, very high, quiet. It thins as the card settles.
  const every = 0.055;
  const beep = 0.018;
  for (let index = 0; index * every < length - beep; index += 1) {
    const at = 0.01 + index * every;
    const level = 0.32 * (0.85 + random() * 0.15) * (1 - 0.7 * smooth(0.5, length, at));
    const gate = (t) => smooth(0, 0.005, t) * (1 - smooth(beep - 0.006, beep, t)) * level;
    [
      [12400, 0.75],
      [8900, 0.25],
    ].forEach(([f, gain]) =>
      mixInto(
        out,
        tone(
          Math.round(beep * RATE),
          () => f,
          (t) => gate(t) * gain,
        ),
        1,
        at,
      ),
    );
  }
  return master(out, { wet: 0.12, room: 0.5, peakDb: -4 });
}

/** A soft glass bell, then its fifth: the invitation, answered. */
function chime() {
  const out = buffer(3.2);
  const bell = (f, at, level) => {
    // Inharmonic partials give the bell its glassiness.
    [
      [1, 1, 1.6],
      [2.01, 0.35, 2.8],
      [2.76, 0.16, 4.2],
      [5.4, 0.05, 7],
    ].forEach(([ratio, gain, decay]) =>
      mixInto(
        out,
        tone(
          out.length,
          () => f * ratio,
          (t) => smooth(0, 0.006, t) * Math.exp(-t * decay) * gain * level,
          random() * 6,
        ),
        1,
        at,
      ),
    );
  };
  bell(523.25, 0, 0.8);
  bell(783.99, 0.11, 0.5);
  bell(261.63, 0, 0.3);
  const soft = biquad(out, "lowpass", () => 5000, 0.7);
  return master(soft, { wet: 0.45, room: 2.2, peakDb: -4 });
}

mkdirSync(OUT, { recursive: true });
console.log("Rendering cues to public/audio/effects/");
writeMp3("transition", transition());
writeMp3("readout", readout());
writeMp3("chime", chime());
