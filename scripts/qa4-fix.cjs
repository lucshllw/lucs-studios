// QA das correções de Asta: centro da intro (1440/1920/390), tempos medidos pela própria timeline (window.__intro),
// emblema inteiro no trecho do Reel, contraste do texto do hero sobre o fundo efetivo.
//   node scripts/qa4-fix.cjs <caminho/playwright-core> [baseURL]
const { chromium } = require(process.argv[2]);
const sharp = require("sharp");
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
const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const relL = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);

(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
  for (const [W, H, tag, extra] of [
    [1920, 1080, "1920", {}],
    [1440, 900, "d1440", {}],
    [390, 844, "m390", { deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, ...extra });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
    await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => document.querySelector(".intro-word .in")?.style.transform?.includes("0%"), null, { timeout: 6000 }).catch(() => {});
    await wait(500);
    const center = await p.evaluate(() => {
      const c = (s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];
      };
      return { vw: innerWidth, vh: innerHeight, dial: c(".intro-dial"), emblem: c(".intro-emblem"), word: c(".intro-word") };
    });
    await p.screenshot({ path: path.join(OUT, `intro-${tag}-f5-home-center.png`) });
    log(tag, "intro centro", center);
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 });
    // transições curtas pelo Menu e volta à Home
    for (const label of ["Works", "About", "Résumé", "Home"]) {
      await p.click(".hud-menu");
      await wait(600);
      await p.click(`.menu-link:has-text("${label}")`);
      await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 });
      await wait(300);
    }
    log(tag, "tempos (timeline, ms)", await p.evaluate(() => window.__intro));
    await wait(1500);
    // contraste do hero: fundo efetivo dentro da caixa da F1 (pixels que não são texto)
    await p.evaluate(() => window.scrollTo(0, 0));
    await wait(1500);
    const box = await p.evaluate(() => {
      const r = document.querySelector(".hero-phrase").getBoundingClientRect();
      return { x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)), width: Math.round(Math.min(r.width, innerWidth - Math.max(0, r.left))), height: Math.round(r.height) };
    });
    // esconde as frases só para medir o fundo atrás delas
    await p.addStyleTag({ content: ".hero-phrases{visibility:hidden!important}" });
    await wait(400);
    const buf = await p.screenshot({ clip: box });
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    const Ls = [];
    for (let i = 0; i < data.length; i += info.channels) Ls.push(relL(data[i], data[i + 1], data[i + 2]));
    Ls.sort((a, c) => a - c);
    const p99 = Ls[Math.floor(Ls.length * 0.99)];
    const max = Ls[Ls.length - 1];
    log(tag, "fundo atrás da F1: L p99", p99.toFixed(3), "máx", max.toFixed(3), "contraste branco p99", (1.05 / (p99 + 0.05)).toFixed(1), "pior", (1.05 / (max + 0.05)).toFixed(1));
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 });
    await wait(1500);
    await p.screenshot({ path: path.join(OUT, `hero-${tag}-f1-dim.png`) });
    await p.evaluate(() => {
      const h = document.querySelector(".hero");
      window.scrollTo(0, h.offsetTop + (h.offsetHeight - innerHeight) * 0.41);
    });
    await wait(1800);
    await p.screenshot({ path: path.join(OUT, `hero-${tag}-f2-dim.png`) });
    await p.evaluate(() => {
      const h = document.querySelector(".hero");
      window.scrollTo(0, h.offsetTop + h.offsetHeight - innerHeight);
    });
    await wait(1800);
    await p.screenshot({ path: path.join(OUT, `hero-${tag}-p100.png`) });
    // reel: emblema inteiro em todo o trecho
    for (const f of [0, 0.15, 0.25, 0.5, 0.75, 1]) {
      await p.evaluate((f) => {
        const r = document.querySelector(".reel-slot");
        window.scrollTo(0, r.offsetTop - innerHeight + r.offsetHeight * f);
      }, f);
      await wait(1700);
      await p.screenshot({ path: path.join(OUT, `reel-morph-${tag}-${String(Math.round(f * 100)).padStart(3, "0")}.png`) });
    }
    log(tag, "erros", errs);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report-fix.txt"), lines.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
