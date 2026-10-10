/* eslint-disable @typescript-eslint/no-require-imports -- Local browser verification harness. */
const {
  chromium,
} = require("/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright");
const fs = require("node:fs");
const out = require("node:path").resolve("verification/world-remembers");
const summarize = (rows) =>
  Object.fromEntries(
    [
      "alive",
      "mountainGrains",
      "frameCpuMs",
      "frameIntervalMs",
      "drawCalls",
      "activeImpacts",
      "updateMs",
    ].map((key) => {
      const a = rows.map((r) => r[key]).sort((a, b) => a - b);
      return [
        key,
        {
          p50: a[Math.floor(a.length * 0.5)],
          p95: a[Math.floor(a.length * 0.95)],
          max: a.at(-1),
        },
      ];
    }),
  );
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const report = {
    environment: {
      browser: await browser.version(),
      mode: "Local next dev, headless Chrome; mobile is viewport/DPR emulation on Mac, not physical phone. CPU timing is scene update and draw submission, not GPU time.",
    },
    runs: [],
  };
  for (const [name, width, height, dpr] of [
    ["desktop", 1440, 900, 1],
    ["mobile", 390, 844, 2],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => sessionStorage.setItem("marzia-saidi:entered", "true"));
    await page.goto("http://localhost:3000/?rainDebug=1#about");
    await page.waitForFunction(() => window.__portalRainDebug);
    await page.waitForTimeout(7000);
    const box = await page
      .locator("[data-bio-story]")
      .evaluate((e) => ({ top: e.getBoundingClientRect().top + scrollY, height: e.offsetHeight }));
    const jump = async (p) =>
      page.evaluate(
        ({ box, p }) =>
          scrollTo({ top: box.top + (box.height - innerHeight) * p, behavior: "instant" }),
        { box, p },
      );
    await jump(0.1);
    await page.waitForTimeout(1000);
    const observations = [];
    for (const p of [0.43, 0.79]) {
      await jump(p);
      await page.waitForTimeout(350);
      observations.push(
        await page.evaluate(() => {
          const e = document.querySelector("[data-bio-passage][data-active]");
          return {
            moment: e?.dataset.moment,
            titleOpacity: getComputedStyle(e.querySelector("h2,h3")).opacity,
            copyOpacity: getComputedStyle(e.querySelector("[data-bio-copy]")).opacity,
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          };
        }),
      );
    }
    await jump(0.1);
    await page.waitForTimeout(8000);
    const frames = await page.evaluate(async (box) => {
      const rows = [];
      const start = performance.now();
      let switched = false;
      await new Promise((resolve) => {
        function frame(t) {
          const elapsed = t - start;
          if (!switched && elapsed > 500) {
            scrollTo({ top: box.top + (box.height - innerHeight) * 0.43, behavior: "instant" });
            switched = true;
          }
          rows.push(window.__portalRainDebug.stats());
          if (elapsed < 7000) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
      return rows;
    }, box);
    // Fast forward/reverse scroll must not resurrect an older passage.
    await jump(0.1);
    await page.waitForTimeout(30);
    await jump(0.79);
    await page.waitForTimeout(30);
    await jump(0.43);
    await page.waitForTimeout(1200);
    const rapid = await page.evaluate(() =>
      [...document.querySelectorAll("[data-bio-passage][data-on]")].map((e) => e.dataset.moment),
    );
    if (rapid.length !== 1 || rapid[0] !== "possibilities")
      throw Error("Stale transition after fast scroll");
    await jump(1.2);
    await page.waitForTimeout(13000);
    const drained = await page.evaluate(() => window.__portalRainDebug.stats());
    if (drained.alive !== 0 || drained.activeImpacts !== 0 || drained.mountainGrains !== 0)
      throw Error("Released matter did not drain");
    console.log(name, JSON.stringify(observations));
    for (const o of observations)
      if (Number(o.titleOpacity) < 0.99 || Number(o.copyOpacity) < 0.99 || o.horizontalOverflow)
        throw Error("Reading/layout gate failed");
    report.runs.push({
      name,
      width,
      height,
      dpr,
      frames: frames.length,
      quality: frames.at(-1).tier,
      budget: frames.at(-1).budget,
      reflectionSize: frames.at(-1).reflectionSize,
      peak: summarize(frames),
      observations,
      rapid,
      drained,
      errors,
    });
    await context.close();
    // Record independently: video encoder is excluded from the measurement above.
    const recorded = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      recordVideo: { dir: out, size: { width, height } },
    });
    const film = await recorded.newPage();
    await film.addInitScript(() => sessionStorage.setItem("marzia-saidi:entered", "true"));
    await film.goto("http://localhost:3000/?rainDebug=1#about");
    await film.waitForFunction(() => window.__portalRainDebug);
    await film.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await film.waitForTimeout(7000);
    const story = await film
      .locator("[data-bio-story]")
      .evaluate((e) => ({ top: e.getBoundingClientRect().top + scrollY, height: e.offsetHeight }));
    const move = async (p, ms) =>
      film.evaluate(
        async ({ story, p, ms }) => {
          const start = performance.now(),
            from = scrollY,
            to = story.top + (story.height - innerHeight) * p;
          await new Promise((resolve) => {
            function frame(t) {
              const f = Math.min(1, (t - start) / ms);
              scrollTo({ top: from + (to - from) * f, behavior: "instant" });
              if (f < 1) requestAnimationFrame(frame);
              else resolve();
            }
            requestAnimationFrame(frame);
          });
        },
        { story, p, ms },
      );
    await move(-0.25, 400);
    await film.waitForTimeout(1200);
    const trim = await film.evaluate(() => performance.now() / 1000);
    await move(0.08, 450);
    await film.waitForTimeout(2200);
    await film.screenshot({ path: `${out}/${name}-1.png` });
    await move(0.43, 2000);
    await film.waitForTimeout(1300);
    await film.screenshot({ path: `${out}/${name}-2.png` });
    await film.waitForTimeout(5200);
    await move(0.79, 2000);
    await film.waitForTimeout(1300);
    await film.screenshot({ path: `${out}/${name}-3.png` });
    await film.waitForTimeout(6500);
    await move(1.16, 2500);
    await film.waitForTimeout(7500);
    const video = await film.video().path();
    await recorded.close();
    fs.renameSync(video, `${out}/${name}.webm`);
    report.runs.at(-1).videoTrimSeconds = trim;
  }
  for (const [name, width, height, reducedMotion] of [
    ["reduced-mobile", 390, 844, "reduce"],
    ["short-landscape", 844, 390, "no-preference"],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
    await page.addInitScript(() => sessionStorage.setItem("marzia-saidi:entered", "true"));
    await page.goto("http://localhost:3000/?rainDebug=1#about");
    await page.waitForFunction(() => window.__portalRainDebug);
    await page.waitForTimeout(5000);
    const fallback = await page.evaluate(() => ({
      animated: document.querySelector("[data-bio-story]").hasAttribute("data-motion"),
      passages: [...document.querySelectorAll("[data-bio-passage]")].map((e) => ({
        text: e.innerText,
        visible: getComputedStyle(e).visibility,
      })),
      stats: window.__portalRainDebug.stats(),
    }));
    if (fallback.animated || fallback.passages.some((p) => p.visible !== "visible"))
      throw Error("Fallback hides biography");
    if (reducedMotion === "reduce" && fallback.stats.alive !== 0)
      throw Error("Reduced motion emitted particles");
    report[name] = fallback;
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.close();
  }
  fs.writeFileSync(`${out}/performance.json`, JSON.stringify(report, null, 2));
  await browser.close();
})();
