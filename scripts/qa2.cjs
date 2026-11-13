// QA etapa 2: intro (F5 / Home / Menu), hero (dissolve e recomposição), reel morph, footer, résumé, Jorak, Lenis/rAF.
//   node scripts/qa2.cjs <caminho/playwright-core> [baseURL]
const { chromium } = require(process.argv[2]);
const fs = require("fs");
const path = require("path");
const BASE = process.argv[3] || "http://localhost:5201";
const OUT = path.resolve(__dirname, "../qa");
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];
const log = (...a) => {
  const s = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  report.push(s);
  console.log(s);
};
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + ".png") });
const introDone = (p, t = 8000) => p.waitForSelector("#intro.is-done", { state: "attached", timeout: t }).then(() => true).catch(() => false);
const hscroll = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

async function mk(b, opts) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => {
    window.__raf = 0;
    const o = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => (window.__raf++, o(cb));
  });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("console", (m) => m.type() === "error" && p.errors.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => p.errors.push("pageerror: " + e.message.slice(0, 200)));
  return { ctx, p };
}

async function introSeq(p, prefix, nav) {
  const t0 = Date.now();
  await nav();
  for (const ms of [150, 700, 1500, 2300]) {
    const dt = ms - (Date.now() - t0);
    if (dt > 0) await wait(dt);
    await shot(p, `${prefix}-${String(ms).padStart(4, "0")}ms`);
  }
  const ok = await introDone(p);
  return { ok, ms: Date.now() - t0 };
}

async function scrollHero(p, frac) {
  await p.evaluate((f) => {
    const h = document.querySelector(".hero");
    window.scrollTo(0, h.offsetTop + (h.offsetHeight - innerHeight) * f);
  }, frac);
  await wait(1600);
}
async function scrollReel(p, frac) {
  await p.evaluate((f) => {
    const r = document.querySelector(".reel-slot");
    window.scrollTo(0, r.offsetTop - innerHeight + r.offsetHeight * f);
  }, frac);
  await wait(1600);
}

(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
  for (const [W, H, tag, extra] of [
    [1440, 900, "d1440", {}],
    [390, 844, "m390", { deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ]) {
    const { ctx, p } = await mk(b, { viewport: { width: W, height: H }, ...extra });
    // F5 em /, /works/, /about/
    for (const [u, n] of [["/", "home"], ["/works/", "works"], ["/about/", "about"]]) {
      const r = await introSeq(p, `intro-${tag}-f5-${n}`, () => p.goto(BASE + u, { waitUntil: "domcontentloaded" }));
      log(tag, "F5", u, "intro done", r.ok, "≈ms", r.ms);
    }
    // Menu → Works / Résumé (curta)
    for (const [label, n] of [["Works", "works"], ["Résumé", "resume"]]) {
      await p.click(".hud-menu");
      await wait(600);
      const t0 = Date.now();
      await p.click(`.menu-link:has-text("${label}")`);
      await wait(250);
      await shot(p, `intro-${tag}-menu-${n}-0250ms`);
      const ok = await introDone(p, 4000);
      log(tag, "menu →", label, "short intro done", ok, "≈ms", Date.now() - t0, "url", p.url(), "focus", await p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
    }
    await shot(p, `${tag}-resume`);
    log(tag, "resume footer?", await p.evaluate(() => !!document.querySelector(".home-footer")), "hscroll", await hscroll(p));
    // Menu → Home (completa)
    await p.click(".hud-menu");
    await wait(600);
    const r = await introSeq(p, `intro-${tag}-menu-home`, () => p.click('.menu-link:has-text("Home")'));
    log(tag, "menu → Home full intro done", r.ok, "≈ms", r.ms, "url", p.url());
    // voltar do navegador para a Home
    await p.goto(BASE + "/about/", { waitUntil: "networkidle" });
    await introDone(p);
    await p.goBack();
    await wait(200);
    await shot(p, `intro-${tag}-back-home-0200ms`);
    log(tag, "back → Home intro visible", await p.evaluate(() => document.querySelector("#intro").classList.contains("is-on")));
    await introDone(p);
    // skip pela tecla
    await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await wait(400);
    const ts = Date.now();
    await p.keyboard.press("Escape");
    log(tag, "Esc skip ok", await introDone(p, 2000), "≈ms", Date.now() - ts);
    await wait(1200);
    log(tag, "hero points", await p.evaluate(() => document.querySelector(".home")?.dataset.points));
    // hero: descer e subir (reversível)
    const fr = [0, 0.04, 0.18, 0.33, 0.41, 0.53, 0.68, 0.76, 0.9, 1];
    for (const f of fr) {
      await scrollHero(p, f);
      await shot(p, `hero-${tag}-down-${String(Math.round(f * 100)).padStart(3, "0")}`);
    }
    const ops = await p.evaluate(() => Array.from(document.querySelectorAll(".hero-phrase")).map((s) => s.style.opacity));
    for (const f of [0.41, 0.04]) {
      await scrollHero(p, f);
      await shot(p, `hero-${tag}-up-${String(Math.round(f * 100)).padStart(3, "0")}`);
    }
    log(tag, "hero DOM opacity at p=1", ops, "back at p≈0.04", await p.evaluate(() => Array.from(document.querySelectorAll(".hero-phrase")).map((s) => s.style.opacity)));
    // reel morph 0/25/50/75/100 e volta
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      await scrollReel(p, f);
      await shot(p, `reel-morph-${tag}-${String(f * 100).padStart(3, "0")}`);
    }
    log(tag, "reel video playing at 100%", await p.evaluate(() => {
      const v = Array.from(document.querySelectorAll("video")).find((x) => (x.currentSrc || x.src).includes("reel"));
      return v ? !v.paused : "no-video-el (WebGL video is detached)";
    }));
    for (const f of [0.5, 0]) {
      await scrollReel(p, f);
      await shot(p, `reel-morph-${tag}-back-${String(f * 100).padStart(3, "0")}`);
    }
    await scrollReel(p, 1);
    await p.mouse.move(W / 2 + 80, H / 2 - 40);
    await wait(500);
    await shot(p, `reel-morph-${tag}-hover`);
    await p.focus(".reel-hit");
    await p.keyboard.press("Enter");
    await wait(700);
    log(tag, "Enter on reel → player open", await p.evaluate(() => !document.querySelector(".reel-player").hidden));
    await p.keyboard.press("Escape");
    await wait(400);
    // footer só na Home
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(1500);
    await shot(p, `footer-${tag}`);
    log(tag, "home hscroll", await hscroll(p), "footer contacts", await p.evaluate(() => Array.from(document.querySelectorAll(".fc-label")).map((x) => x.textContent)));
    // rAF e Lenis
    const r0 = await p.evaluate(() => window.__raf);
    await wait(1000);
    log(tag, "rAF/s", (await p.evaluate(() => window.__raf)) - r0, "lenis instances", await p.evaluate(() => (window.__lenis || []).map((x) => x.key)));
    // Works: footer ausente; Jorak com vídeo novo; Lenis do painel
    await p.goto(BASE + "/works/jorak/", { waitUntil: "networkidle" });
    await introDone(p);
    await wait(1500);
    await shot(p, `jorak-${tag}-panel`);
    log(tag, "works footer?", await p.evaluate(() => !!document.querySelector(".home-footer")), "lenis", await p.evaluate(() => (window.__lenis || []).map((x) => x.key)));
    await p.evaluate(() => {
      const s = document.querySelector(".panel-scroll");
      s.scrollTop = s.clientHeight * 0.9;
    });
    await wait(1500);
    await shot(p, `jorak-${tag}-video`);
    log(tag, "jorak video", await p.evaluate(() => {
      const v = document.querySelector(".p-frame video");
      return { src: v.currentSrc.split("/").slice(-2).join("/"), playing: !v.paused, w: v.videoWidth, t: +v.currentTime.toFixed(2) };
    }));
    await p.goto(BASE + "/about/", { waitUntil: "networkidle" });
    await introDone(p);
    log(tag, "about footer?", await p.evaluate(() => !!document.querySelector(".home-footer")), "errors", p.errors);
    await ctx.close();
  }
  // reduced-motion e sem WebGL
  {
    const { ctx, p } = await mk(b, { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const t0 = Date.now();
    await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    log("rm intro done", await introDone(p), "≈ms", Date.now() - t0);
    for (const f of [0, 0.4, 0.8]) {
      await scrollHero(p, f);
      await shot(p, `hero-rm-${f * 100}`);
    }
    await scrollReel(p, 1);
    await shot(p, "reel-morph-rm-100");
    log("rm errors", p.errors);
    await ctx.close();
  }
  {
    const { ctx, p } = await mk(b, { viewport: { width: 1440, height: 900 } });
    await p.goto(BASE + "/?webgl=0", { waitUntil: "networkidle" });
    await introDone(p);
    await shot(p, "hero-t0");
    await p.evaluate(() => window.scrollTo(0, document.querySelector(".reel-slot").offsetTop));
    await wait(800);
    await shot(p, "reel-t0");
    log("t0 errors", p.errors);
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const p = await ctx.newPage();
    await p.goto(BASE + "/");
    await shot(p, "nojs-home");
    await p.goto(BASE + "/resume/");
    await shot(p, "nojs-resume");
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report-etapa2.txt"), report.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
