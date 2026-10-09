/** Prepare contiguous, licensed field recordings; never synthesize or layer thunder. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
const source = process.argv[2];
if (!source) throw new Error("Supply the source HQ MP3 directory; see thunder/SOURCES.json.");
const out = join(process.cwd(), "public/audio/effects/thunder");
mkdirSync(out, { recursive: true });
const recipes = JSON.parse(readFileSync(join(out, "SOURCES.json"), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const records = [];
for (const recipe of recipes) {
  const path = join(source, `${recipe.id}-hq.mp3`);
  if (hash(readFileSync(path)) !== recipe.sourceSha256)
    throw new Error(`Unverified source bytes for ${recipe.id}`);
  // Gentle RMS compression reduces isolated peaks without adding makeup gain.
  const shaping =
    "highpass=f=22,acompressor=threshold=0.0794328:ratio=2:attack=8:release=500:knee=2.828:makeup=1:detection=rms";
  const decoded = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-ss",
      String(recipe.start),
      "-i",
      path,
      "-t",
      String(recipe.length),
      "-af",
      shaping,
      "-ar",
      "48000",
      "-ac",
      "2",
      "-f",
      "f32le",
      "-",
    ],
    { maxBuffer: 40e6 },
  );
  const data = new Float32Array(decoded.buffer, decoded.byteOffset, decoded.byteLength / 4);
  const frames = data.length / 2;
  // Preserve the natural crack, but keep it subordinate to the longer rolling body.
  for (let i = 0; i < frames; i++) {
    const t = i / 48000;
    const attack = Math.min(1, t / recipe.fadeIn);
    const tail = Math.min(1, Math.max(0, (recipe.length - t) / recipe.fadeOut));
    const intro = recipe.character === "close" ? 0.63 + 0.37 * Math.min(1, t / 1.8) : 1;
    const gain = attack * tail * intro;
    data[i * 2] *= gain;
    data[i * 2 + 1] *= gain;
  }
  // Match sustained body, not a single transient. Never exceed the quieter peak ceiling.
  const window = 12000 * 2; // 250 ms stereo windows
  const rms = [];
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  for (let i = 0; i + window <= data.length; i += window) {
    let energy = 0;
    for (let j = i; j < i + window; j++) energy += data[j] * data[j];
    rms.push(Math.sqrt(energy / window));
  }
  rms.sort((a, b) => a - b);
  const body = rms[Math.floor(rms.length * 0.8)];
  const gain = Math.min(
    10 ** (recipe.bodyTargetDb / 20) / body,
    10 ** (recipe.peakCeilingDb / 20) / peak,
  );
  for (let i = 0; i < data.length; i++) data[i] *= gain;
  const output = join(out, `${recipe.name}.mp3`);
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-f",
      "f32le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-i",
      "pipe:0",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "160k",
      output,
    ],
    { input: Buffer.from(data.buffer, data.byteOffset, data.byteLength), maxBuffer: 40e6 },
  );
  records.push({
    ...recipe,
    gain,
    gainDb: 20 * Math.log10(gain),
    processing: {
      ffmpegFilter: shaping,
      bodyMeasure: "80th percentile of 250 ms stereo RMS windows",
      entryFade: "linear",
      tailFade: "linear",
      closeIntro: recipe.character === "close" ? "0.63 to 1.0 linearly over 1.8 s" : "none",
      rate: 1,
      channels: 2,
      sampleRate: 48000,
      bitrate: "160k",
      layering: "none",
    },
    outputSha256: hash(readFileSync(output)),
  });
  console.log(
    `${recipe.name}: ${recipe.length}s, ${recipe.character}, ${20 * Math.log10(gain)} dB gain`,
  );
}
writeFileSync(join(out, "PROVENANCE.json"), JSON.stringify(records, null, 2) + "\n");
writeFileSync(join(out, "edits.json"), JSON.stringify(records, null, 2) + "\n");
