/**
 * Captures /my-world for the homepage's reality crack.
 *
 * The crack shows the cabin world through its gaps, and the way in breaks
 * through to this same picture before the live world takes over, so it has
 * to be the real world from the exact pose the arrival starts at. The page
 * renders that pose at a wide lens when opened as /my-world?capture=arrival
 * in development (see src/cabin/worldCapture.ts).
 *
 * Usage, with `npm run dev` running:
 *   npm run capture:my-world
 *   CAPTURE_URL=http://localhost:3001 npm run capture:my-world
 *
 * Needs Playwright with its Chromium, from the project or installed globally.
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

import sharp from "sharp";

const BASE = process.env.CAPTURE_URL ?? "http://localhost:3000";
const OUT = join(process.cwd(), "public/assets/cabin/sky/my-world-capture.webp");
// Twice as wide as tall, as WORLD_CAPTURE.aspect says.
const SIZE = { width: 2400, height: 1200 };

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // A global install, or the copy the Playwright CLI carries.
    const root = execSync("npm root -g").toString().trim();
    const require = createRequire(import.meta.url);
    for (const place of ["playwright", "@playwright/cli/node_modules/playwright"]) {
      try {
        return require(join(root, place));
      } catch {
        // Try the next.
      }
    }
    throw new Error("Playwright not found: install it with `npm i -g playwright`.");
  }
}

const { chromium } = await loadPlaywright();
// Installed Chrome renders the WebGL world far faster than the bundled headless shell.
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
await page.goto(`${BASE}/my-world?capture=arrival`);
// A fresh browser meets the site's entry gate first; the capture is of the world behind it.
// The dev overlay's badge would be photographed too.
await page.addStyleTag({
  content: "[data-site-entry], nextjs-portal { display: none !important; }",
});
await page.waitForSelector("canvas[data-capture-ready]", { timeout: 120_000 });
const png = await page.locator("canvas[data-capture-ready]").screenshot();
await browser.close();

await sharp(png).webp({ quality: 82 }).toFile(OUT);
console.log(`/my-world capture written to ${OUT}`);
