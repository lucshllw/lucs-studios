// Etapa 6 bugs: About (lista sob o logo) em várias posições; 390 toque em monólito abre o painel; Studio hover monitor esq.
const { chromium } = require(process.argv[2]);
const path = require("path");
const BASE = process.argv[3] || "http://localhost:5201";
const TAG = process.argv[4] || "x";
const OUT = path.resolve(__dirname, "../qa");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  for (const mobile of [false, true]) {
    const tag = mobile ? 390 : 1440;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(BASE + "/about/", { waitUntil: "load" });
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
    await wait(800);
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (const f of [0.12, 0.2, 0.3, 0.5, 0.7]) {
      await p.evaluate((y) => {
        const l = (window.__lenis || []).find((e) => e.key === "document")?.lenis;
        l ? l.scrollTo(y, { immediate: true }) : scrollTo(0, y);
      }, H * f);
      await wait(700);
      const over = await p.evaluate(() => {
        const logo = document.querySelector(".hud-logo").getBoundingClientRect();
        const hits = [];
        document.querySelectorAll("main li, main h2, main h3, main p").forEach((e) => {
          const r = e.getBoundingClientRect();
          if (r.width && getComputedStyle(e).visibility !== "hidden" && r.left < logo.right && r.right > logo.left && r.top < logo.bottom && r.bottom > logo.top) hits.push((e.className || e.tagName) + ":" + (e.textContent || "").trim().slice(0, 24));
        });
        return hits;
      });
      console.log(`[${tag}] about ${f}:`, JSON.stringify(over));
      await p.screenshot({ path: path.join(OUT, `e6-${TAG}-about-${tag}-${f}.png`) });
    }
    if (mobile) {
      await p.goto(BASE + "/", { waitUntil: "load" });
      await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
      await wait(2500);
      // toca em pontos até achar um monólito (cursor pointer não existe em toque: usa o painel aberto como sinal)
      let opened = null;
      for (const [x, y] of [[195, 470], [195, 430], [195, 520], [120, 470], [270, 470], [195, 390], [195, 560]]) {
        await p.touchscreen.tap(x, y);
        await wait(1400);
        const st = await p.evaluate(() => ({ path: location.pathname, panel: !!document.querySelector(".panel:not([hidden]), [role=dialog][aria-label]:not([hidden]):not(#intro):not(#site-menu)"), reel: document.documentElement.classList.contains("overlay-open") }));
        if (st.path !== "/" || st.panel || st.reel) {
          opened = { x, y, ...st };
          break;
        }
      }
      console.log(`[390] toque em monólito:`, JSON.stringify(opened));
      await p.screenshot({ path: path.join(OUT, `e6-${TAG}-tap-390.png`) });
    }
    await ctx.close();
  }
  await b.close();
})();
