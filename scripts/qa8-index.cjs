// QA: sem barra de rolagem nativa (largura útil = viewport) e índice de seções (ativo muda ao rolar; clique leva à seção).
//   node scripts/qa8-index.cjs <caminho/playwright-core> [baseURL]
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
const state = (p, sel) =>
  p.evaluate((sel) => {
    const nav = document.querySelector(sel);
    const on = nav?.querySelector('a[aria-current="location"]');
    const sc = document.querySelector(".panel-scroll");
    return {
      visible: !!nav && getComputedStyle(nav).visibility !== "hidden" && getComputedStyle(nav).display !== "none",
      active: on ? on.textContent : null,
      scrollY: Math.round(window.scrollY),
      panelTop: sc ? Math.round(sc.scrollTop) : null,
      scrollbarW: window.innerWidth - document.documentElement.clientWidth,
      panelScrollbarW: sc ? sc.offsetWidth - sc.clientWidth : null,
      hscroll: document.documentElement.scrollWidth > innerWidth + 1,
    };
  }, sel);

(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  for (const [W, H, tag, extra] of [
    [1440, 900, "1440", {}],
    [390, 844, "390", { deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, ...extra });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
    for (const [u, n, sel] of [
      ["/", "home", ".home > .sidx"],
      ["/about/", "about", ".about > .sidx"],
      ["/resume/", "resume", ".resume > .sidx"],
      ["/works/ado/", "panel", ".sidx-panel"],
    ]) {
      await p.goto(BASE + u, { waitUntil: "networkidle" });
      await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 9000 }).catch(() => {});
      await wait(1200);
      const s0 = await state(p, sel);
      await shot(p, `idx-${n}-${tag}-a`);
      // rola um pouco e confere mudança do ativo
      if (n === "panel") await p.evaluate(() => (document.querySelector(".panel-scroll").scrollTop = document.querySelector("#p-built").offsetTop));
      else await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.45));
      await wait(1300);
      const s1 = await state(p, sel);
      // clique no último item (apenas se visível)
      let s2 = null;
      if (s1.visible) {
        const links = await p.$$(`${sel} a`);
        await links[links.length - 1].click();
        await wait(2600);
        s2 = await state(p, sel);
      }
      await shot(p, `idx-${n}-${tag}-b`);
      if (n === "about") await shot(p, `idx-about-${tag}-contact`);
      log(tag, n, { inicio: s0, rolado: s1, aposClique: s2 });
    }
    log(tag, "erros", errs);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report-index.txt"), lines.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
function shot(p, n) {
  return p.screenshot({ path: path.join(OUT, n + ".png") });
}
