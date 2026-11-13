// QA 390 com toque real (CDP Input.dispatchTouchEvent): palavras-chave legíveis acima do emblema, lente no toque
// (toque simples, toque longo que segue o dedo, some ~1,2 s após soltar) e swipe do anel.
//   node scripts/qa7-touch.cjs <caminho/playwright-core> [baseURL]
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
// luminância média de uma região (para comparar lente ligada × desligada)
async function regionLum(p, clip) {
  const buf = await p.screenshot({ clip });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let s = 0;
  for (let i = 0; i < data.length; i += info.channels) s += relL(data[i], data[i + 1], data[i + 2]);
  return +(s / (data.length / info.channels)).toFixed(4);
}

(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 9000 });
  await wait(2800);
  await p.screenshot({ path: path.join(OUT, "e4fix-m-keywords.png") });
  // palavras-chave: caixas, sobreposição com o emblema/monólito e contraste do texto sobre o fundo efetivo
  const kws = await p.evaluate(() =>
    Array.from(document.querySelectorAll(".kw")).map((k) => {
      const r = k.getBoundingClientRect();
      return { t: k.getAttribute("aria-label"), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(k).backgroundColor, color: getComputedStyle(k).color };
    })
  );
  log("palavras-chave", kws);
  await p.addStyleTag({ content: ".kw .vp-l{color:transparent!important}" });
  await wait(300);
  let worst = 99;
  for (const k of kws) {
    const buf = await p.screenshot({ clip: { x: k.x + 2, y: k.y + 2, width: Math.max(4, k.w - 4), height: Math.max(4, k.h - 4) } });
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    let mx = 0;
    for (let i = 0; i < data.length; i += info.channels) mx = Math.max(mx, relL(data[i], data[i + 1], data[i + 2]));
    worst = Math.min(worst, 1.05 / (mx + 0.05));
  }
  log("contraste mínimo do texto branco sobre o fundo real das palavras (pior pixel):", worst.toFixed(1) + ":1");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 9000 });
  await wait(2800);
  const clip = { x: 155, y: 260, width: 80, height: 80 };
  const base = await regionLum(p, clip);
  // 1) toque simples em (195,300)
  await touch("touchStart", 195, 300);
  await wait(60);
  await touch("touchEnd", 195, 300);
  await wait(250);
  const afterTap = await regionLum(p, clip);
  await p.screenshot({ path: path.join(OUT, "e4fix-m-lens-tap.png") });
  await wait(1600);
  const afterFade = await regionLum(p, clip);
  log("toque simples: luminância na região", { antes: base, "250ms após": afterTap, "1,85s após": afterFade });
  // 2) toque longo que segue o dedo
  await touch("touchStart", 195, 300);
  await wait(400);
  for (let i = 1; i <= 6; i++) {
    await touch("touchMove", 195 + i * 8, 300 + i * 10);
    await wait(30);
  }
  await wait(150);
  await p.screenshot({ path: path.join(OUT, "e4fix-m-lens.png") });
  const lensClip = { x: 205, y: 330, width: 60, height: 60 };
  log("toque longo: luminância no ponto do dedo", await regionLum(p, lensClip), "front", await p.evaluate(() => document.querySelector(".hero-front").textContent));
  await touch("touchEnd", 243, 360);
  await wait(1700);
  log("1,7 s após soltar", await regionLum(p, lensClip));
  // 3) swipe horizontal rápido gira o anel (sem virar lente)
  const f0 = await p.evaluate(() => document.querySelector(".hero-front").textContent);
  await touch("touchStart", 320, 520);
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", 320 - i * 22, 522);
    await wait(16);
  }
  await touch("touchEnd", 144, 522);
  await wait(1600);
  log("swipe: frente", f0, "→", await p.evaluate(() => document.querySelector(".hero-front").textContent), "hscroll", await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), "erros", errs);
  fs.writeFileSync(path.join(OUT, "report-e4fix-touch.txt"), lines.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
