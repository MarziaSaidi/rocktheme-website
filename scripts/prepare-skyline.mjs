/**
 * Prepares the cabin world's mountain from a real photograph.
 *
 * "Himalayas, Ama Dablam, Nepal" by Vyacheslav Argenberg, CC BY 4.0
 * (https://commons.wikimedia.org/wiki/File:Himalayas,_Ama_Dablam,_Nepal.jpg,
 * https://creativecommons.org/licenses/by/4.0). Credited in the site's
 * credits; see src/cabin/skyline.ts.
 *
 * The peak and its snowy range are cut from the photo with its sky and
 * clouds, the brown valley floor below them faded out, and the edges
 * feathered so the photo melts into the clearing's own sky. A light lavender
 * grade ties it to the portfolio's palette. src/cabin/skyline.ts stands it on
 * the horizon.
 *
 * Usage: node scripts/prepare-skyline.mjs
 *   (expects assets-src/cabin/sky/ama-dablam.jpg, the original file)
 */
import { join } from "node:path";

import sharp from "sharp";

const SOURCE = join(process.cwd(), "assets-src/cabin/sky/ama-dablam.jpg");
const OUTPUT = join(process.cwd(), "public/assets/cabin/sky/skyline.webp");

/** The rows kept, as shares of the photo's height: sky to just below the snow. */
const CROP = { top: 0.0, bottom: 0.58 };
/** Where the valley floor begins to fade out, as a share of the crop. */
const FADE_FROM = 0.72;
const WIDTH = 2400;

const meta = await sharp(SOURCE).metadata();
const height = Math.round((CROP.bottom - CROP.top) * meta.height);
const { data, info } = await sharp(SOURCE)
  .extract({ left: 0, top: Math.round(CROP.top * meta.height), width: meta.width, height })
  .resize({ width: WIDTH })
  .raw()
  .toBuffer({ resolveWithObject: true });

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const out = Buffer.alloc(info.width * info.height * 4);
for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const i = (y * info.width + x) * info.channels;
    const o = (y * info.width + x) * 4;
    const u = x / (info.width - 1);
    const v = y / (info.height - 1);
    // Feathered sides and top; the valley floor fades into the clearing's haze.
    const sides = smooth(0, 0.18, u) * smooth(0, 0.18, 1 - u);
    // The photo's own sky melts away well above the peak, so only the
    // mountain and the clouds round it remain against the clearing's sky.
    const top = smooth(0.02, 0.3, v);
    const floor = 1 - smooth(FADE_FROM, 1, v);
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    // A touch of lavender in the shadows, lifted towards the portfolio's palette.
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const tint = (1 - lum) * 0.18;
    r = r + (183 - r) * tint;
    g = g + (147 - g) * tint;
    b = b + (210 - b) * tint;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = Math.round(sides * top * floor * 255);
  }
}

await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
  .webp({ quality: 84, alphaQuality: 80 })
  .toFile(OUTPUT);
console.log(`skyline ${info.width}×${info.height} → ${OUTPUT}`);
