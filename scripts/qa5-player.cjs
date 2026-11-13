// QA do player RITO do reel: abertura a partir da tela 3D, controles, hover de capítulo, teclado, auto-ocultar, 390.
//   node scripts/qa5-player.cjs <caminho/playwright-core> [baseURL]
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
const st = (p) =>
  p.evaluate(() => {
    const v = document.querySelector(".rp-video");
    return {
      open: !document.querySelector(".rp").hidden,
      t: +(v?.currentTime ?? 0).toFixed(2),
      paused: v?.paused,
      rate: v?.playbackRate,
      idle: document.querySelector(".rp").classList.contains("is-idle"),
      ch: document.querySelector(".rp-ch")?.textContent,
      live: document.querySelector(".rp [aria-live]")?.textContent,
      focus: document.activeElement?.className || document.activeElement?.tagName,
      fs: !!document.fullscreenElement,
    };
  });
(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
  for (const [W, H, tag, extra] of [
    [1440, 900, "1440", {}],
    [390, 844, "390", { deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, ...extra });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 });
    await p.evaluate(() => {
      const r = document.querySelector(".reel-slot");
      window.scrollTo(0, r.offsetTop - innerHeight + r.offsetHeight);
    });
    await wait(2000);
    const hit = await p.$(".reel-hit");
    if (tag === "1440") await hit.click();
    else await hit.tap();
    await wait(200);
    await p.screenshot({ path: path.join(OUT, `player-open-${tag}-0200ms.png`) });
    await wait(700);
    await p.screenshot({ path: path.join(OUT, `player-open-${tag}.png`) });
    log(tag, "aberto", await st(p));
    if (tag === "1440") {
      await p.mouse.move(700, 400);
      await wait(300);
      await p.mouse.move(720, 420);
      await wait(300);
      await p.screenshot({ path: path.join(OUT, "player-controls-1440.png") });
      const bar = await p.$(".rp-bar");
      const bb = await bar.boundingBox();
      await p.mouse.move(bb.x + bb.width * (30 / 75), bb.y + bb.height / 2);
      await wait(400);
      await p.screenshot({ path: path.join(OUT, "player-chapter-hover-1440.png") });
      // teclado
      await p.focus(".rp-close");
      await p.keyboard.press("k");
      await wait(200);
      log("K", await st(p));
      await p.keyboard.press("k");
      await wait(200);
      const t0 = (await st(p)).t;
      await p.keyboard.press("ArrowRight");
      await wait(150);
      log("→ +5 de", t0, await st(p));
      await p.keyboard.press("j");
      await wait(150);
      log("J −10", await st(p));
      await p.keyboard.press("3");
      await wait(300);
      await p.screenshot({ path: path.join(OUT, "player-chapter-jump-1440.png") });
      log("3 → Rio", await st(p));
      await p.keyboard.press("m");
      await wait(150);
      log("M", (await st(p)).live);
      await p.click('.rp-group button:has-text("1.5")');
      log("1.5×", (await st(p)).rate, "4K disabled", await p.evaluate(() => document.querySelector('.rp-group button:disabled')?.textContent));
      await p.keyboard.press("f");
      await wait(500);
      log("F fullscreen", (await st(p)).fs);
      await p.evaluate(() => document.fullscreenElement && document.exitFullscreen());
      await wait(500);
      // foco preso
      for (let i = 0; i < 25; i++) await p.keyboard.press("Tab");
      log("foco após 25 Tab dentro do diálogo", await p.evaluate(() => !!document.activeElement?.closest(".rp")));
      await p.focus(".rp-close");
      await p.mouse.move(700, 450);
      await wait(2600);
      log("auto-ocultar após 2 s", (await st(p)).idle);
      await p.screenshot({ path: path.join(OUT, "player-idle-1440.png") });
      await p.keyboard.press("Escape");
      await wait(700);
      log("Esc", await st(p), "foco volta ao gatilho", await p.evaluate(() => document.activeElement?.classList.contains("reel-hit")));
    } else {
      const vw = await p.$(".rp-video-wrap");
      const vb = await vw.boundingBox();
      await p.touchscreen.tap(vb.x + vb.width / 2, vb.y + vb.height / 2);
      await wait(300);
      log("toque oculta", (await st(p)).idle);
      await p.touchscreen.tap(vb.x + vb.width / 2, vb.y + vb.height / 2);
      await wait(400);
      log("toque mostra", (await st(p)).idle);
      await p.screenshot({ path: path.join(OUT, "player-mobile-390.png") });
      const t0 = (await st(p)).t;
      await p.touchscreen.tap(vb.x + vb.width * 0.85, vb.y + vb.height / 2);
      await wait(120);
      await p.touchscreen.tap(vb.x + vb.width * 0.85, vb.y + vb.height / 2);
      await wait(300);
      log("duplo toque direita: de", t0, "para", (await st(p)).t);
      const small = await p.evaluate(() =>
        Array.from(document.querySelectorAll(".rp button, .rp-bar"))
          .filter((e) => e.offsetParent)
          .map((e) => {
            const r = e.getBoundingClientRect();
            return [e.className || e.textContent, Math.round(r.width), Math.round(r.height)];
          })
          .filter(([, w, h]) => w < 44 || h < 44)
      );
      log("alvos < 44 px", small);
      await p.setViewportSize({ width: 844, height: 390 });
      await wait(600);
      await p.screenshot({ path: path.join(OUT, "player-mobile-landscape.png") });
      log("paisagem hscroll", await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1));
    }
    log(tag, "erros", errs);
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 });
    await p.evaluate(() => {
      const r = document.querySelector(".reel-slot");
      window.scrollTo(0, r.offsetTop - innerHeight + r.offsetHeight);
    });
    await wait(800);
    await p.click(".reel-hit");
    await wait(120);
    await p.screenshot({ path: path.join(OUT, "player-open-rm-0120ms.png") });
    log("rm aberto", await st(p));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report-player.txt"), lines.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
