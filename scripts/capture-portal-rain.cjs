/** Local Phase 3 QA. Uses the existing global Playwright install; no app dependency. */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  chromium,
} = require("/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright");
const OUT = path.resolve("verification/portal-rain");
const URL = "http://localhost:3000/?rainDebug=1#about";
fs.mkdirSync(OUT, { recursive: true });
async function scroll(page, from, to, ms) {
  await page.evaluate(
    async ({ from, to, ms }) => {
      const start = performance.now();
      await new Promise((resolve) => {
        function tick(now) {
          const p = Math.min(1, (now - start) / ms);
          window.scrollTo({ top: from + (to - from) * p, behavior: "instant" });
          if (p < 1) requestAnimationFrame(tick);
          else resolve();
        }
        requestAnimationFrame(tick);
      });
    },
    { from, to, ms },
  );
}
async function setup(browser, width, height, name) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width, height } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(() => sessionStorage.setItem("marzia-saidi:entered", "true"));
  await page.goto(URL);
  await page.waitForFunction(() => window.__portalRainDebug);
  await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
  await page.waitForTimeout(8000);
  const stats = await page.evaluate(() => window.__portalRainDebug.stats());
  await page.evaluate(() => window.__portalRainDebug.setRainEnabled(false));
  await page.waitForTimeout(9000);
  return { context, page, stats, errors, name };
}
async function finish(job, start, duration) {
  const video = job.page.video();
  const raw = await video.path();
  await job.context.close();
  execFileSync(
    "/opt/homebrew/bin/ffmpeg",
    [
      "-y",
      "-ss",
      String(start),
      "-i",
      raw,
      "-t",
      String(duration),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path.join(OUT, job.name + ".mp4"),
    ],
    { stdio: "ignore" },
  );
  fs.unlinkSync(raw);
  fs.writeFileSync(path.join(OUT, job.name + "-errors.json"), JSON.stringify(job.errors, null, 2));
}
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const [name, width, height] of [
    ["desktop-story", 1440, 900],
    ["mobile-story", 390, 844],
  ]) {
    if (process.argv.includes("--water-only")) continue;
    const created = Date.now();
    const job = await setup(browser, width, height, name);
    const { page, stats } = job;
    const begin = stats.stops.about - height * 0.4;
    const peak = stats.stops.about + (stats.stops.aboutLeave - stats.stops.about) * 0.64;
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), begin);
    await page.waitForTimeout(1800);
    const start = (Date.now() - created) / 1000;
    const timelineStart = Date.now();
    await page.evaluate(() => window.__portalRainDebug.setRainEnabled(true));
    await page.waitForTimeout(2500);
    await scroll(page, begin, stats.stops.about, 3000);
    await scroll(page, stats.stops.about, peak, 14000);
    await page.screenshot({ path: path.join(OUT, name + "-peak.png") });
    console.log(
      name,
      "peak",
      JSON.stringify(await page.evaluate(() => window.__portalRainDebug.stats())),
    );
    await page.waitForTimeout(7500);
    console.log(
      name,
      "rest",
      JSON.stringify(await page.evaluate(() => window.__portalRainDebug.stats())),
    );
    await page.screenshot({ path: path.join(OUT, name + "-rest.png") });
    await scroll(page, peak, stats.stops.aboutLeave + height * 0.85, 8000);
    await page.waitForTimeout(9000);
    console.log(
      name,
      "exit",
      JSON.stringify(await page.evaluate(() => window.__portalRainDebug.stats())),
    );
    await finish(job, start, (Date.now() - timelineStart) / 1000);
  }
  const created = Date.now();
  const job = await setup(browser, 1440, 900, "water-detail");
  const { page, stats } = job;
  const peak = stats.stops.about + (stats.stops.aboutLeave - stats.stops.about) * 0.58;
  await page.addStyleTag({
    content: "[data-bio-story], [data-bio-story] * { visibility:hidden!important; }",
  });
  await page.evaluate((y) => {
    window.scrollTo({ top: y, behavior: "instant" });
    window.__portalRainDebug.setRainEnabled(true);
  }, peak);
  await page.waitForTimeout(4500);
  await page.evaluate(() => window.__portalRainDebug.closeWater());
  await page.waitForTimeout(1000);
  const start = (Date.now() - created) / 1000;
  const timelineStart = Date.now();
  await scroll(page, peak, peak + 900 * 0.16, 8000);
  await page.screenshot({ path: path.join(OUT, "water-detail.png") });
  await page.waitForTimeout(4500);
  await page.evaluate(() => window.__portalRainDebug.setRainEnabled(false));
  await page.waitForTimeout(10000);
  await finish(job, start, (Date.now() - timelineStart) / 1000);
  await browser.close();
})();
