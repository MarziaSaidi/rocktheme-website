/**
 * Holds /my-world to its loading budget.
 *
 * Opens the cabin world the way a visitor arrives (already past the entry
 * gate) several times, reads the phase marks src/cabin/world.ts leaves, and
 * fails if the world takes too long to appear or the page freezes for too
 * long while it is being built.
 *
 * Measure a production build; development is far slower and mounts twice:
 *   npm run build && npm start
 *   npm run check:my-world
 *   CHECK_URL=http://localhost:3001 RUNS=5 npm run check:my-world
 *
 * Needs Playwright with its Chromium, from the project or installed globally.
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const BASE = process.env.CHECK_URL ?? "http://localhost:3000";
const RUNS = Number(process.env.RUNS ?? 3);

/** Milliseconds, medians over the runs, on a local production server. */
const BUDGET = {
  /** From navigation until the world is on screen. */
  visible: 3500,
  /** The longest the main thread is held at once while the world is built. */
  longestFreeze: 800,
};

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
// Installed Chrome draws on the real GPU; the bundled headless shell does not.
const browser = await chromium
  .launch({ channel: "chrome", args: ["--use-angle=metal", "--enable-gpu"] })
  .catch(() => chromium.launch());

async function measure() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("marzia-saidi:entered", "true");
    } catch {
      // Without storage the gate shows, and the numbers include it.
    }
    window.__freezes = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__freezes.push(entry.startTime, entry.duration);
    }).observe({ type: "longtask", buffered: true });
  });
  await page.goto(`${BASE}/my-world`);
  await page.waitForFunction(() => performance.getEntriesByName("cabin:frame").length > 0, null, {
    timeout: 60_000,
  });
  const result = await page.evaluate(() => {
    const at = (name) =>
      Math.round(performance.getEntriesByName(`cabin:${name}`)[0]?.startTime ?? NaN);
    const visible = at("frame");
    let longestFreeze = 0;
    for (let i = 0; i < window.__freezes.length; i += 2) {
      if (window.__freezes[i] < visible)
        longestFreeze = Math.max(longestFreeze, window.__freezes[i + 1]);
    }
    return {
      code: at("module"),
      assets: at("assets") - at("renderer"),
      sky: at("sky") - at("assets"),
      warmUp: at("warm") - at("sky"),
      visible,
      longestFreeze: Math.round(longestFreeze),
    };
  });
  await page.close();
  return result;
}

const runs = [];
for (let i = 0; i < RUNS; i++) runs.push(await measure());
await browser.close();

const median = (key) => {
  const values = runs.map((run) => run[key]).sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};
console.table(runs);

let failed = false;
for (const [key, limit] of Object.entries(BUDGET)) {
  const value = median(key);
  const ok = value <= limit;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${key}: ${value} ms (budget ${limit} ms)`);
}
process.exit(failed ? 1 : 0);
