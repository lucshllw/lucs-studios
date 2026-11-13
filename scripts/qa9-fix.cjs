// QA fix9: (1) cobertura do campo ASCII da intro (Menu → Home e F5) em 1920×1000, 1440×900 e 390×844 DPR 2;
// (2) sessão longa do About (visitas repetidas, estações para cima/baixo, aba oculta, parado 60 s);
// (3) clique/arrasto/pulso no hero; (4) erros de console (inclui hidratação).
//   node scripts/qa9-fix.cjs <playwright-core> <rótulo before|after> [baseURL] [--long]
const { chromium } = require(process.argv[2]);
const path = require("path");
const fs = require("fs");
const TAG = process.argv[3] || "after";
const BASE = process.argv[4] || "http://localhost:5201";
const LONG = process.argv.includes("--long");
const OUT = path.resolve(__dirname, "../qa");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = [];
const log = (...a) => {
  const s = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  lines.push(s);
  console.log(s);
};
const shot = (p, n) => p.screenshot({ path: path.join(OUT, `fix9-${TAG}-${n}.png`) });
const done = (p) => p.waitForSelector("#intro.is-done", { state: "attached", timeout: 9000 }).catch(() => {});
const ascii = (p) =>
  p.evaluate(() => {
    const pre = document.querySelector(".intro-ascii");
    if (!pre) return null;
    const r = pre.getBoundingClientRect();
    const lines = (pre.textContent || "").split("\n").filter(Boolean);
    const cs = getComputedStyle(pre);
    // largura real de uma linha de glifos
    const probe = document.createElement("span");
    probe.style.font = cs.font;
    probe.style.whiteSpace = "pre";
    probe.textContent = lines[0] || "";
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return {
      vw: innerWidth,
      vh: innerHeight,
      box: [Math.round(r.width), Math.round(r.height)],
      textW: Math.round(w),
      textH: Math.round(lines.length * parseFloat(cs.lineHeight)),
      clip: cs.clipPath,
      opacity: cs.opacity,
    };
  });

async function introCheck(b, W, H, dpr, name) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, ...(W < 768 ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  await p.goto(BASE + "/about/", { waitUntil: "domcontentloaded" });
  await wait(350);
  log(name, "F5 ascii", await ascii(p));
  await shot(p, `intro-f5-${name}`);
  await done(p);
  await wait(500);
  await p.click(".hud-menu");
  await wait(650);
  await p.click('.menu-link:has-text("Home")');
  for (const ms of [300, 700, 1100]) {
    await wait(ms === 300 ? 300 : 400);
    log(name, `menu→Home ${ms}ms ascii`, await ascii(p));
    await shot(p, `intro-menuhome-${name}-${ms}`);
  }
  await done(p);
  log(name, "erros", errs);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  await introCheck(b, 1920, 1000, 1, "1920");
  await introCheck(b, 1440, 900, 1, "1440");
  await introCheck(b, 1440, 900, 2, "1440dpr2");
  await introCheck(b, 390, 844, 2, "390");

  // ---- sessão longa do About ----
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
    await p.goto(BASE + "/about/", { waitUntil: "networkidle" });
    await done(p);
    const toDark = async (f) => {
      await p.evaluate((f) => {
        const d = document.querySelector(".dark");
        window.scrollTo(0, d.offsetTop + (d.offsetHeight - innerHeight) * f);
      }, f);
      await wait(1300);
    };
    const snap = async (label) => {
      const s = await p.evaluate(() => ({
        hud: document.querySelector(".dark-hud.tl")?.innerText.replace(/\n/g, " "),
        station: document.querySelector(".station.on b")?.textContent ?? "-",
        unlocked: document.querySelector(".resume-cta")?.classList.contains("unlocked"),
        canvasOpacity: document.getElementById("world")?.style.opacity,
        canvasY: document.getElementById("world")?.style.transform,
      }));
      log("about", label, s);
      return s;
    };
    for (let visit = 1; visit <= (LONG ? 5 : 3); visit++) {
      await wait(2200);
      await shot(p, `about-visit${visit}-0`);
      await snap(`visita ${visit} início`);
      if (visit === 1) {
        // revela ~40% passando o mouse
        for (let y = 250; y < 600; y += 40) {
          await p.mouse.move(600, y, { steps: 2 });
          await p.mouse.move(860, y, { steps: 10 });
        }
        await snap("visita 1 após revelar parcialmente");
      }
      for (const f of [0.3, 0.6, 0.95, 0.6, 0.3, 0.05]) await toDark(f);
      await toDark(0.2);
      await shot(p, `about-visit${visit}-p20`);
      await snap(`visita ${visit} p=.2`);
      await toDark(1);
      await p.evaluate(() => window.scrollBy(0, innerHeight * 0.45));
      await wait(1200);
      await shot(p, `about-visit${visit}-cv`);
      await snap(`visita ${visit} saída do palco`);
      await p.evaluate(() => window.scrollTo(0, 0));
      await wait(800);
      await p.click(".hud-menu");
      await wait(650);
      await p.click('.menu-link:has-text("Works")');
      await done(p);
      await wait(1500);
      await p.click(".hud-menu");
      await wait(650);
      await p.click('.menu-link:has-text("About")');
      await done(p);
    }
    // aba oculta e volta
    const other = await ctx.newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    await wait(3000);
    await p.bringToFront();
    await wait(1500);
    log("about após aba oculta: visibilidade", await p.evaluate(() => document.visibilityState));
    await shot(p, "about-after-hidden");
    await snap("após aba oculta");
    if (LONG) {
      await wait(60000);
      await shot(p, "about-after-60s");
      await snap("parado 60 s");
    }
    log("about erros", errs);
    await ctx.close();
  }

  // ---- hero: clique em monólito, em área vazia, arrasto curto, palavras-chave, cursor ----
  for (const [W, H] of [
    [1920, 1000],
    [1440, 900],
  ]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H } });
    const p = await ctx.newPage();
    const errs = [];
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await done(p);
    await wait(2800);
    const tip = () => p.evaluate(() => (getComputedStyle(document.querySelector(".dial-tip")).opacity !== "0" ? document.querySelector(".dial-tip").textContent : null));
    let mon = null;
    for (let y = Math.round(H * 0.55); y < H - 60 && !mon; y += 40)
      for (let x = 80; x < W - 80; x += 40) {
        await p.mouse.move(x, y);
        await wait(35);
        const t = await tip();
        if (t) {
          mon = [x, y, t];
          break;
        }
      }
    // área vazia: acima-esquerda
    await p.mouse.move(W * 0.15, H * 0.3);
    await wait(250);
    const cursorEmpty = await p.evaluate(() => getComputedStyle(document.querySelector(".hero-sticky")).cursor);
    await p.mouse.down();
    await p.mouse.move(W * 0.15 + 3, H * 0.3 + 1);
    await p.mouse.up();
    await wait(120);
    await shot(p, `hero-pulse-${W}`);
    const afterEmpty = p.url();
    // arrasto curto (4 px) não gira
    const f0 = await p.evaluate(() => document.querySelector(".hero-front").textContent);
    await p.mouse.move(W * 0.5, H * 0.35);
    await p.mouse.down();
    await p.mouse.move(W * 0.5 - 4, H * 0.35);
    await wait(250);
    await p.mouse.up();
    await wait(900);
    const f1 = await p.evaluate(() => document.querySelector(".hero-front").textContent);
    let cursorMon = null;
    let afterMon = null;
    if (mon) {
      await p.mouse.move(mon[0], mon[1]);
      await wait(300);
      cursorMon = await p.evaluate(() => getComputedStyle(document.querySelector(".hero-sticky")).cursor);
      await shot(p, `hero-hover-${W}`);
      await p.mouse.down();
      await p.mouse.move(mon[0] + 2, mon[1] + 1);
      await p.mouse.up();
      await wait(1800);
      afterMon = p.url();
    }
    log(`hero ${W}`, { monólito: mon, cursorVazio: cursorEmpty, cursorMonólito: cursorMon, cliqueVazioURL: afterEmpty, arrastoCurto: [f0, f1], cliqueMonólitoURL: afterMon, erros: errs });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, `report-fix9-${TAG}.txt`), lines.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
