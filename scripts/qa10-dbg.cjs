// Diagnóstico: tarefas longas durante Menu → Studio em 390 (e 1440).
const { chromium } = require(process.argv[2]);
const BASE = process.argv[3] || "http://localhost:5201";
const FROM = process.argv[4] || "/works/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  for (const mobile of [true, false]) {
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => {
      window.__lt = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true });
    });
    const p = await ctx.newPage();
    p.on("console", (m) => m.type() === "error" && console.log("err", m.text().slice(0, 200)));
    await p.goto(BASE + FROM, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
    await wait(1500);
    await p.click(".hud-menu");
    await wait(600);
    const t0 = await p.evaluate(() => performance.now());
    await p.click(`.menu-link:has(.menu-label:text-is("Studio"))`);
    await wait(9000);
    const r = await p.evaluate((t0) => ({ lt: window.__lt.filter((x) => x[0] > t0).map((x) => [x[0] - Math.round(t0), x[1]]), intro: (window.__intro || []).slice(-1) }), t0);
    console.log(mobile ? "390" : "1440", JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
})();
