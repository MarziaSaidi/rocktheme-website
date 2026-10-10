const {
  chromium,
} = require("/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: {
        dir: "/Users/marziasaidi/Projects/newsite/verification/portal-rain/bio-correction",
        size: { width, height },
      },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log("ERROR", e.message));
    page.on("console", (m) => {
      if (m.type() === "error") console.log(m.text());
    });
    await page.addInitScript(() => sessionStorage.setItem("marzia-saidi:entered", "true"));
    await page.goto("http://localhost:3000/?rainDebug=1#about");
    await page.waitForFunction(() => window.__portalRainDebug);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(8000);
    const s = await page.evaluate(() => window.__portalRainDebug.stats());
    console.log(name, "initial", s.alive);
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: "instant" }),
      s.stops.about + (s.stops.aboutLeave - s.stops.about) * 0.35,
    );
    await page.waitForTimeout(550);
    await page.screenshot({
      path: `/Users/marziasaidi/Projects/newsite/verification/portal-rain/bio-correction/${name}-release.png`,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `/Users/marziasaidi/Projects/newsite/verification/portal-rain/bio-correction/${name}-fall.png`,
    });
    console.log(name, "falling", await page.evaluate(() => window.__portalRainDebug.stats()));
    await page.waitForTimeout(5000);
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: "instant" }),
      s.stops.about + (s.stops.aboutLeave - s.stops.about) * 0.72,
    );
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: `/Users/marziasaidi/Projects/newsite/verification/portal-rain/bio-correction/${name}-second.png`,
    });
    await page.waitForTimeout(8000);
    console.log(name, "finished", await page.evaluate(() => window.__portalRainDebug.stats()));
    const video = await page.video().path();
    await context.close();
    require("node:fs").renameSync(
      video,
      `/Users/marziasaidi/Projects/newsite/verification/portal-rain/bio-correction/${name}.webm`,
    );
  }
  await browser.close();
})();
