// QA etapa 4: hero DIAL+SINAL (0/25/50/75/100% + reversão, drag/hover/clique/lente, palavras-chave), header só logo,
// intros de seção, About câmara escura (revelação ≥70% → PDF), footer em Home/About, 1 rAF, erros, rolagem lateral.
//   node scripts/qa6-etapa4.cjs <caminho/playwright-core> [baseURL]
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
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + ".png") });
const done = (p) => p.waitForSelector("#intro.is-done", { state: "attached", timeout: 9000 }).catch(() => {});
const hs = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const toHero = (p, f) =>
  p.evaluate((f) => {
    const h = document.querySelector(".hero");
    window.scrollTo(0, h.offsetTop + (h.offsetHeight - innerHeight) * f);
  }, f);

(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
  for (const [W, H, tag, extra] of [
    [1440, 900, "1440", {}],
    [390, 844, "390", { deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, ...extra });
    await ctx.addInitScript(() => {
      window.__raf = 0;
      const o = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => (window.__raf++, o(cb));
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 180)));
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 180)));
    await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await wait(450);
    await shot(p, `e4-intro-ascii-${tag}`);
    await done(p);
    await wait(2600);
    log(tag, "header", await p.evaluate(() => ({ logo: document.querySelector(".hud-logo")?.getAttribute("aria-label"), text: document.querySelector(".hud").innerText.includes("Lucas Melo") })));
    await shot(p, `hero-dial-${tag}-000`);
    // lente + hover de monólito: varre uma linha horizontal procurando o tooltip
    let hoverHit = null;
    if (tag === "1440") {
      for (let x = 120; x < W - 120 && !hoverHit; x += 60)
        for (const y of [H * 0.52, H * 0.62]) {
          await p.mouse.move(x, y);
          await wait(140);
          const t = await p.evaluate(() => {
            const el = document.querySelector(".dial-tip");
            return el && getComputedStyle(el).opacity !== "0" ? el.textContent : null;
          });
          if (t) {
            hoverHit = { x, y, t };
            break;
          }
        }
      await wait(250);
      await shot(p, `hero-dial-${tag}-hover-lens`);
      log(tag, "hover monólito", hoverHit);
      // arrasto
      const f0 = await p.evaluate(() => document.querySelector(".hero-front").textContent);
      await p.mouse.move(1000, 600);
      await p.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await p.mouse.move(1000 - i * 40, 600);
        await wait(16);
      }
      await p.mouse.up();
      await wait(1600);
      log(tag, "arrasto: frente", f0, "→", await p.evaluate(() => document.querySelector(".hero-front").textContent));
      // palavra-chave: hover e foco
      const kw = await p.$$(".kw");
      const bb = await kw[0].boundingBox();
      await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await wait(500);
      await shot(p, `hero-dial-${tag}-keyword-hover`);
      await kw[1].focus();
      await p.keyboard.press("Enter");
      await wait(400);
      log(tag, "palavra-chave foco+Enter", await p.evaluate(() => ({ pressed: document.querySelectorAll('.kw[aria-pressed="true"]').length, label: document.activeElement?.getAttribute("aria-label") })));
      await shot(p, `hero-dial-${tag}-keyword-focus`);
      // clique vazio = pulso
      await p.mouse.click(160, 200);
      await wait(150);
      await shot(p, `hero-dial-${tag}-pulse`);
    }
    for (const f of [0.25, 0.5, 0.75, 1]) {
      await toHero(p, f);
      await wait(1700);
      await shot(p, `hero-dial-${tag}-${String(f * 100).padStart(3, "0")}`);
    }
    await p.evaluate(() => {
      const r = document.querySelector(".reel-slot");
      window.scrollTo(0, r.offsetTop - innerHeight + r.offsetHeight * 0.5);
    });
    await wait(1700);
    await shot(p, `hero-dial-${tag}-reel-050`);
    for (const f of [0.5, 0]) {
      await toHero(p, f);
      await wait(1700);
      await shot(p, `hero-dial-${tag}-back-${String(f * 100).padStart(3, "0")}`);
    }
    log(tag, "keywords opacity em p=0", await p.evaluate(() => document.querySelector(".hero-keys").style.opacity));
    // clique no monólito abre o painel
    if (hoverHit) {
      await p.mouse.move(hoverHit.x, hoverHit.y);
      await wait(300);
      await p.mouse.click(hoverHit.x, hoverHit.y);
      await wait(2500);
      log(tag, "clique monólito →", p.url());
    }
    const r0 = await p.evaluate(() => window.__raf);
    await wait(1000);
    log(tag, "rAF/s", (await p.evaluate(() => window.__raf)) - r0);
    // Works: intro de seção no painel
    await p.goto(BASE + "/works/ado/", { waitUntil: "networkidle" });
    await done(p);
    await wait(800);
    await p.evaluate(() => {
      const s = document.querySelector(".panel-scroll");
      const t = document.querySelector(".p-sx");
      s.scrollTop = t.offsetTop - s.clientHeight * 0.75;
    });
    await wait(1200);
    await shot(p, `e4-sx-panel-${tag}`);
    log(tag, "painel --in", await p.evaluate(() => document.querySelector(".p-sx").style.getPropertyValue("--in")));
    // About
    await p.goto(BASE + "/about/", { waitUntil: "networkidle" });
    await done(p);
    await wait(1800);
    await shot(p, `about-dark-${tag}-000`);
    const rect = await p.evaluate(() => {
      const o = document.querySelector(".ov-frame");
      return { x: parseFloat(o.style.left), y: parseFloat(o.style.top), w: parseFloat(o.style.width), h: parseFloat(o.style.height) };
    });
    // revelar: varre a foto em zigue-zague
    if (tag === "1440") {
      for (let yy = rect.y + 10; yy < rect.y + rect.h; yy += 30) {
        await p.mouse.move(rect.x + 5, yy, { steps: 2 });
        await p.mouse.move(rect.x + rect.w - 5, yy, { steps: 14 });
      }
    } else {
      for (let yy = rect.y + 10; yy < rect.y + rect.h; yy += 50) {
        await p.touchscreen.tap(rect.x + rect.w * 0.2, yy);
        await p.touchscreen.tap(rect.x + rect.w * 0.5, yy);
        await p.touchscreen.tap(rect.x + rect.w * 0.8, yy);
      }
    }
    await wait(400);
    await shot(p, `about-dark-${tag}-reveal`);
    log(tag, "revelação", await p.evaluate(() => ({ hud: document.querySelector(".dark-hud.tl").innerText.replace(/\n/g, " "), unlocked: document.querySelector(".resume-cta").classList.contains("unlocked"), href: document.querySelector(".resume-cta").getAttribute("href") })));
    for (const f of [0.25, 0.55, 0.85, 1]) {
      await p.evaluate((f) => {
        const d = document.querySelector(".dark");
        window.scrollTo(0, d.offsetTop + (d.offsetHeight - innerHeight) * f);
      }, f);
      await wait(1500);
      await shot(p, `about-dark-${tag}-${String(f * 100).padStart(3, "0")}`);
    }
    await p.evaluate(() => {
      const s = document.querySelector(".cv-sec-a");
      window.scrollTo(0, s.offsetTop - innerHeight * 0.75);
    });
    await wait(1200);
    await shot(p, `e4-sx-about-${tag}`);
    log(tag, "about footer", await p.evaluate(() => !!document.querySelector(".ff-track")), "hscroll", await hs(p));
    // Résumé
    await p.goto(BASE + "/resume/", { waitUntil: "networkidle" });
    await done(p);
    await p.evaluate(() => window.scrollTo(0, innerHeight * 0.55));
    await wait(1300);
    await shot(p, `e4-sx-resume-${tag}`);
    log(tag, "resume footer", await p.evaluate(() => !!document.querySelector(".ff-track")), "hscroll", await hs(p), "erros", errs);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report-etapa4.txt"), lines.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
