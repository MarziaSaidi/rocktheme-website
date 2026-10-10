const fs = require("node:fs");
const path = require("node:path");
const {
  chromium,
} = require("/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright");
const OUT = path.resolve("verification/portal-rain");
async function sample(page, seconds, moving = false) {
  return page.evaluate(
    async ({ seconds, moving }) => {
      const data = [];
      const begin = performance.now();
      let prev = begin;
      const s = window.__portalRainDebug.stats();
      await new Promise((resolve) => {
        function tick(t) {
          if (moving)
            window.scrollTo({
              top:
                s.stops.about +
                (s.stops.aboutLeave - s.stops.about) *
                  (0.55 + 0.12 * ((t - begin) / (seconds * 1000))),
              behavior: "instant",
            });
          const stats = window.__portalRainDebug.stats();
          data.push({ ...stats, observedIntervalMs: t - prev });
          prev = t;
          if (t - begin < seconds * 1000) requestAnimationFrame(tick);
          else resolve();
        }
        requestAnimationFrame(tick);
      });
      return data;
    },
    { seconds, moving },
  );
}
function summarize(data) {
  const names = [
    "alive",
    "frameCpuMs",
    "observedIntervalMs",
    "drawCalls",
    "activeImpacts",
    "updateMs",
    "emissionPerSecond",
  ];
  const result = {
    samples: data.length,
    tier: data.at(-1).tier,
    budget: data.at(-1).budget,
    reflectionSize: data.at(-1).reflectionSize,
    pixelRatio: data.at(-1).pixelRatio,
  };
  for (const name of names) {
    const a = data.map((s) => s[name]).sort((a, b) => a - b);
    result[name] = {
      mean: a.reduce((a, b) => a + b, 0) / a.length,
      p50: a[Math.floor(a.length * 0.5)],
      p95: a[Math.floor(a.length * 0.95)],
      max: a.at(-1),
    };
  }
  return result;
}
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const report = {
    environment: {
      browser: await browser.version(),
      platform: process.platform,
      arch: process.arch,
      mode: "headless Chrome; mobile viewport emulation, not physical phone; no video recording",
    },
    runs: [],
  };
  for (const [name, width, height, dpr] of [
    ["desktop", 1440, 900, 1],
    ["mobile", 390, 844, 2],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript(() => sessionStorage.setItem("marzia-saidi:entered", "true"));
    await page.goto("http://localhost:3000/?rainDebug=1#about");
    await page.waitForFunction(() => window.__portalRainDebug);
    await page.waitForTimeout(7000);
    const stops = (await page.evaluate(() => window.__portalRainDebug.stats())).stops;
    await page.evaluate((s) => {
      window.__portalRainDebug.setRainEnabled(false);
      window.scrollTo({ top: s.about + (s.aboutLeave - s.about) * 0.55, behavior: "instant" });
    }, stops);
    await page.waitForTimeout(10000);
    const baseline = summarize(await sample(page, 5));
    await page.evaluate(() => window.__portalRainDebug.setRainEnabled(true));
    await sample(page, 5, true);
    const peak = summarize(await sample(page, 7, true));
    await page.waitForTimeout(5000);
    const rest = summarize(await sample(page, 5));
    if (process.argv.includes("--performance-only")) {
      report.runs.push({ name, width, height, dpr, baseline, peak, rest, errors });
      await page.close();
      continue;
    }
    // Reverse scrolling and a rapid exit/reentry exercise the same real scroll channel.
    const reverse = await page.evaluate(async (s) => {
      const start = performance.now();
      const from = scrollY;
      await new Promise((resolve) => {
        function tick(t) {
          const p = Math.min(1, (t - start) / 1800);
          window.scrollTo({ top: from + (s.about + 100 - from) * p, behavior: "instant" });
          if (p < 1) requestAnimationFrame(tick);
          else resolve();
        }
        requestAnimationFrame(tick);
      });
      return window.__portalRainDebug.stats();
    }, stops);
    await page.evaluate(
      (s) => window.scrollTo({ top: s.aboutLeave + 1200, behavior: "instant" }),
      stops,
    );
    await page.waitForTimeout(11000);
    const exit = await page.evaluate(() => window.__portalRainDebug.stats());
    if (exit.alive !== 0 || exit.activeImpacts !== 0) throw new Error("Exit did not drain");
    await page.evaluate(
      (s) =>
        window.scrollTo({ top: s.about + (s.aboutLeave - s.about) * 0.6, behavior: "instant" }),
      stops,
    );
    await page.waitForTimeout(3500);
    const reentry = await page.evaluate(() => window.__portalRainDebug.stats());
    // Exercise low rain budget, without changing approved environment quality.
    await page.evaluate(() => window.__portalRainDebug.setRainTier("low"));
    await page.waitForTimeout(9000);
    const low = summarize(await sample(page, 4, true));
    await page.setViewportSize({
      width: name === "desktop" ? 1280 : 430,
      height: name === "desktop" ? 800 : 932,
    });
    await page.waitForTimeout(1000);
    const resized = await page.evaluate(() => window.__portalRainDebug.stats());
    report.runs.push({
      name,
      width,
      height,
      dpr,
      baseline,
      peak,
      rest,
      reverse,
      exit,
      reentry,
      low,
      resized,
      errors,
    });
    console.log(name, JSON.stringify({ baseline, peak, rest, low, exitAlive: exit.alive }));
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await page.addInitScript(() => sessionStorage.setItem("marzia-saidi:entered", "true"));
  await page.goto("http://localhost:3000/?rainDebug=1#about");
  await page.waitForFunction(() => window.__portalRainDebug);
  await page.waitForTimeout(7000);
  report.reducedMotion = await page.evaluate(() => ({
    stats: window.__portalRainDebug.stats(),
    text: document.querySelector("[data-bio-story]").innerText,
  }));
  if (report.reducedMotion.stats.alive !== 0) throw new Error("Reduced motion animated rain");
  await page.screenshot({ path: path.join(OUT, "reduced-motion-mobile.png") });
  fs.writeFileSync(path.join(OUT, "performance.json"), JSON.stringify(report, null, 2));
  await browser.close();
})();
