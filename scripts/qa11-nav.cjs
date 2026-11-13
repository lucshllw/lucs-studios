// Etapa 6: navegação pelo Menu — clique → cortina sai (is-done) e → interativo (fim da última long task ≤ 3 s depois).
//   node scripts/qa11-nav.cjs <playwright-core> [baseURL] [rótulo]
const { chromium } = require(process.argv[2]);
const fs = require("fs");
const path = require("path");
const BASE = process.argv[3] || "http://localhost:5201";
const TAG = process.argv[4] || "after";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SEQ = ["Works", "Studio", "Lab", "About", "Résumé", "Works", "Home"];
const out = [];
(async () => {
  const ARGS = process.env.NAV_ARGS ? process.env.NAV_ARGS.split(" ") : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
  const b = await chromium.launch({ channel: "msedge", args: ARGS, headless: process.env.HEADFUL ? false : true });
  const lite = await (async () => {
    const pg = await b.newPage();
    await pg.goto(BASE + "/resume/");
    const v = await pg.evaluate(() => [document.documentElement.className, (() => { try { const g = document.createElement("canvas").getContext("webgl2"); const d = g && g.getExtension("WEBGL_debug_renderer_info"); return g ? (d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : "webgl2") : "sem WebGL"; } catch (e) { return "erro"; } })()]);
    await pg.close();
    return v;
  })();
  out.push("ambiente: " + JSON.stringify(lite));
  console.log("ambiente:", JSON.stringify(lite));
  for (const mobile of process.env.NAV_DESKTOP_ONLY ? [false] : [false, true]) {
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => {
      window.__raf = 0;
      const rq = window.requestAnimationFrame;
      window.requestAnimationFrame = (f) => (window.__raf++, rq.call(window, f));
      window.__lt = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))).observe({ type: "longtask", buffered: true });
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
    await p.goto(BASE + "/", { waitUntil: "load" });
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
    await wait(1500);
    let from = "Home";
    for (const to of SEQ) {
      await p.click(".hud-menu");
      await wait(700);
      const t0 = await p.evaluate(() => performance.now());
      const want = { Home: "/", Works: "/works/", Studio: "/studio/", Lab: "/lab/", About: "/about/", "Résumé": "/resume/" }[to];
      await p.click(`.menu-link:has(.menu-label:text-is("${to}"))`);
      await p.waitForFunction((w) => location.pathname === w, want, { timeout: 5000, polling: 5 }).catch(() => {});
      const tUrl = await p.evaluate((t0) => Math.round(performance.now() - t0), t0);
      const menuClosed = await p.evaluate(async (t0) => {
        for (let i = 0; i < 100; i++) {
          const m = document.getElementById("site-menu");
          if (!m || m.hidden || document.documentElement.classList.contains("overlay-open") === false) return Math.round(performance.now() - t0);
          await new Promise((r) => setTimeout(r, 10));
        }
        return -1;
      }, t0);
      await p.waitForFunction(() => document.querySelector("#intro")?.classList.contains("is-done") && !document.querySelector(".genie"), null, { timeout: 12000 }).catch(() => {});
      const tDone = await p.evaluate(() => performance.now());
      const f0 = await p.evaluate(() => window.__raf);
      await wait(1000);
      const fps = (await p.evaluate(() => window.__raf)) - f0;
      await wait(2000);
      const r = await p.evaluate(
        ({ t0, tDone }) => {
          const lt = window.__lt.filter((x) => x[0] > t0 && x[0] < tDone + 3000);
          const end = lt.reduce((m, x) => Math.max(m, x[0] + x[1]), tDone);
          return { done: Math.round(tDone - t0), interactive: Math.round(end - t0), longest: Math.round(lt.reduce((m, x) => Math.max(m, x[1]), 0)), path: location.pathname };
        },
        { t0, tDone }
      );
      const line = `[${mobile ? 390 : 1440}${process.env.NAV_TAG || ""}] ${from}→${to}: URL ${tUrl} ms · menu fecha ${menuClosed} ms · cortina sai ${r.done} ms · interativo ${r.interactive} ms · maior long task ${r.longest} ms · ~${fps} fps (${r.path})`;
      out.push(line);
      console.log(line);
      from = to;
      await wait(500);
    }
    if (errs.length) out.push("erros: " + JSON.stringify(errs));
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.resolve(__dirname, `../qa/report-nav-${TAG}.txt`), out.join("\n"));
})();
