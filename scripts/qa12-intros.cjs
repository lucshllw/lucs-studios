// Etapa 6b: intro de aba (frames) e intro do Studio (frames) em 1440 e 390; skip por Esc; LITE (?lite=1).
const { chromium } = require(process.argv[2]);
const path = require("path");
const BASE = process.argv[3] || "http://localhost:5201";
const OUT = path.resolve(__dirname, "../qa");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  for (const mobile of [false, true]) {
    const tag = mobile ? 390 : 1440;
    const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
    // Studio em carga direta: frames da intro da cena
    await p.goto(BASE + "/studio/", { waitUntil: "load" });
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
    const t0 = Date.now();
    for (const ms of [300, 1200, 2200, 3600]) {
      await wait(Math.max(0, ms - (Date.now() - t0)));
      await p.screenshot({ path: path.join(OUT, `studio-intro-${tag}-${ms}.png`) });
    }
    // intro de aba: Studio → About, frames
    await p.click(".hud-menu");
    await wait(700);
    const c0 = Date.now();
    await p.click(`.menu-link:has(.menu-label:text-is("About"))`);
    for (const ms of [120, 450, 900, 1300]) {
      await wait(Math.max(0, ms - (Date.now() - c0)));
      await p.screenshot({ path: path.join(OUT, `intro-tab-${tag}-${ms}.png`) });
    }
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 });
    await wait(300);
    const last = await p.evaluate(() => (window.__intro || []).slice(-1)[0]);
    const url = await p.evaluate(() => location.pathname);
    console.log(`[${tag}] aba Studio→About:`, JSON.stringify(last), url);
    // skip por Esc
    await p.click(".hud-menu");
    await wait(700);
    await p.click(`.menu-link:has(.menu-label:text-is("Lab"))`);
    await wait(200);
    await p.keyboard.press("Escape");
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 });
    console.log(`[${tag}] Esc pula:`, JSON.stringify(await p.evaluate(() => (window.__intro || []).slice(-1)[0])));
    // Studio via menu (1ª montagem desta visita já ocorreu; replay)
    console.log(`[${tag}] erros:`, JSON.stringify(errs));
    await ctx.close();
  }
  // LITE
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + "/resume/?lite=1", { waitUntil: "load" });
  await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
  await wait(800);
  await p.click(".hud-menu");
  await wait(700);
  await p.click(`.menu-link:has(.menu-label:text-is("Studio"))`);
  await wait(250);
  await p.screenshot({ path: path.join(OUT, `intro-tab-lite-1440.png`) });
  await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 });
  await wait(600);
  await p.screenshot({ path: path.join(OUT, `studio-lite-1440.png`) });
  console.log("[lite] aba:", JSON.stringify(await p.evaluate(() => (window.__intro || []).slice(-1)[0])), await p.evaluate(() => document.documentElement.className));
  await p.evaluate(() => localStorage.removeItem("rito-lite"));
  await b.close();
})();
