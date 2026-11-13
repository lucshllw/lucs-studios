// QA do rodapé 05 "Fusion": capturas por fase em 1440/390, reversão, ausência em /works e /about, rAF, erros.
//   node scripts/qa3-footer.cjs <caminho/playwright-core> [baseURL]
const { chromium } = require(process.argv[2]);
const path = require("path");
const fs = require("fs");
const BASE = process.argv[3] || "http://localhost:5201";
const OUT = path.resolve(__dirname, "../qa");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = [];
const log = (...a) => {
  const s = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  lines.push(s);
  console.log(s);
};
(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  for (const [W, H, tag, extra] of [
    [1440, 900, "1440", {}],
    [390, 844, "390", { deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
    [1440, 900, "rm", { reducedMotion: "reduce" }],
  ]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, ...extra });
    await ctx.addInitScript(() => {
      window.__raf = 0;
      const o = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => (window.__raf++, o(cb));
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 }).catch(() => {});
    const go = async (f) => {
      await p.evaluate((f) => {
        const t = document.querySelector(".ff-track");
        window.scrollTo(0, t.offsetTop + (t.offsetHeight - innerHeight) * f);
      }, f);
      await wait(1800);
    };
    const state = () =>
      p.evaluate(() => ({
        p: +(document.querySelector(".ff-track").__p ?? -1).toFixed(3),
        card: +(+getComputedStyle(document.querySelector(".ff-card")).opacity).toFixed(2),
        val0: document.querySelector(".ff-val").textContent,
        foot: +(+getComputedStyle(document.querySelector(".ff-foot")).opacity).toFixed(2),
      }));
    for (const f of [0.12, 0.35, 0.6, 0.9]) {
      await go(f);
      await p.mouse.move(W * 0.6, H * 0.45);
      await wait(300);
      await p.screenshot({ path: path.join(OUT, `footer-05-${f}-${tag}.png`) });
      log(tag, "f", f, await state());
    }
    // reversão: volta para 0,35 e 0,12
    for (const f of [0.35, 0.12]) {
      await go(f);
      log(tag, "back f", f, await state());
    }
    await p.screenshot({ path: path.join(OUT, `footer-05-back-0.12-${tag}.png`) });
    const r0 = await p.evaluate(() => window.__raf);
    await wait(1000);
    log(tag, "rAF/s", (await p.evaluate(() => window.__raf)) - r0, "hscroll", await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), "errors", errs);
    for (const u of ["/works/", "/about/", "/resume/"]) {
      await p.goto(BASE + u, { waitUntil: "domcontentloaded" });
      await wait(500);
      log(tag, u, "footer?", await p.evaluate(() => !!document.querySelector(".ff-track")));
    }
    await ctx.close();
  }
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(BASE + "/");
  await p.evaluate(() => 0).catch(() => {});
  await p.screenshot({ path: path.join(OUT, "footer-05-nojs.png"), fullPage: false, clip: undefined });
  await ctx.close();
  fs.writeFileSync(path.join(OUT, "report-footer.txt"), lines.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
