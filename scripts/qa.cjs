// QA visual/funcional (Playwright + Edge com GPU). Uso:
//   node scripts/qa.cjs <caminho/playwright-core> [baseURL]
// Gera capturas em qa/ e imprime medidas + erros de console.
const { chromium } = require(process.argv[2]);
const fs = require("fs");
const path = require("path");
const BASE = process.argv[3] || "http://localhost:5200";
const OUT = path.resolve(__dirname, "../qa");
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];
const log = (...a) => {
  const s = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  report.push(s);
  console.log(s);
};

async function page(b, opts) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => {
    window.__raf = 0;
    const o = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      window.__raf++;
      return o(cb);
    };
  });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("console", (m) => m.type() === "error" && p.errors.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => p.errors.push("pageerror: " + e.message.slice(0, 200)));
  return { ctx, p };
}
const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + ".png") });
const introDone = (p) => p.waitForSelector("#intro.is-done", { state: "attached", timeout: 8000 }).catch(() => {});
const hscroll = (p) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });

  // ---------------- desktop 1440 ----------------
  {
    const { ctx, p } = await page(b, { viewport: { width: 1440, height: 900 } });
    await p.goto(BASE + "/works/", { waitUntil: "networkidle" });
    await introDone(p);
    await wait(3500);
    await shot(p, "d1440-01-featured");
    const lab = await p.evaluate(() => {
      const a = document.querySelector(".card-label");
      const r = a.getBoundingClientRect();
      return { gl: document.documentElement.className, label0: [Math.round(r.left), Math.round(r.bottom)] };
    });
    log("1440 featured", lab, "hscroll", await hscroll(p));
    const raf0 = await p.evaluate(() => window.__raf);
    await wait(1000);
    log("rAF calls in 1 s:", (await p.evaluate(() => window.__raf)) - raf0);

    await p.mouse.move(720, 450);
    for (let i = 0; i < 6; i++) await p.mouse.wheel(0, 200);
    await wait(80);
    await shot(p, "d1440-02-wheel-bend-80ms");
    await wait(700);
    await shot(p, "d1440-03-settle");
    for (let i = 0; i < 6; i++) await p.mouse.wheel(0, -200);
    await wait(80);
    await shot(p, "d1440-04-wheel-reverse");
    await wait(900);
    // drag + flick
    await p.mouse.move(900, 450);
    await p.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await p.mouse.move(900 - i * 60, 450);
      await wait(12);
    }
    await p.mouse.up();
    await wait(150);
    await shot(p, "d1440-05-flick");
    await wait(1600);
    await shot(p, "d1440-06-after-flick");
    // hover bossa
    await p.mouse.move(700, 420);
    await wait(400);
    await p.mouse.move(760, 440);
    await wait(500);
    await shot(p, "d1440-07-hover");
    // teclado
    await p.keyboard.press("Home");
    await wait(900);
    await p.keyboard.press("ArrowRight");
    await wait(900);
    log("live region:", await p.evaluate(() => document.querySelector(".works [aria-live]")?.textContent));
    // abrir
    await p.mouse.click(720, 450);
    await wait(110);
    await shot(p, "d1440-08-open-dent");
    await wait(330);
    await shot(p, "d1440-09-open-flat");
    await wait(800);
    await shot(p, "d1440-10-panel");
    log("after open url", p.url(), "title", await p.title(), "focus", await p.evaluate(() => document.activeElement?.id));
    await p.evaluate(() => {
      const s = document.querySelector(".panel-scroll");
      s.scrollTop = s.clientHeight * 0.9;
    });
    await wait(700);
    await shot(p, "d1440-11-panel-video");
    await p.evaluate(() => {
      const s = document.querySelector(".panel-scroll");
      s.scrollTop = s.clientHeight * 2.6;
    });
    await wait(900);
    await shot(p, "d1440-12-panel-gallery");
    const imgs = await p.evaluate(() =>
      Array.from(document.querySelectorAll(".p-gallery img")).map((i) => (i.currentSrc || "").split("/").pop())
    );
    log("gallery currentSrc (DPR1):", imgs.slice(0, 4));
    await p.evaluate(() => {
      const s = document.querySelector(".panel-scroll");
      s.scrollTop = s.scrollHeight;
    });
    await wait(900);
    await shot(p, "d1440-13-panel-next");
    await p.mouse.move(720, 450);
    for (let i = 0; i < 3; i++) {
      await p.mouse.wheel(0, 60);
      await wait(30);
    }
    await wait(60);
    await shot(p, "d1440-14-ring-partial");
    for (let i = 0; i < 6; i++) {
      await p.mouse.wheel(0, 60);
      await wait(30);
    }
    await wait(1400);
    log("after overscroll url", p.url());
    await shot(p, "d1440-15-next-project");
    await p.keyboard.press("Escape");
    await wait(160);
    await shot(p, "d1440-16-close-mid");
    await wait(600);
    await shot(p, "d1440-17-closed");
    log("after close url", p.url(), "focus", await p.evaluate(() => document.activeElement?.textContent));
    // back do navegador fecha
    await p.focus(".card-label >> nth=3");
    await wait(700);
    await p.keyboard.press("Enter");
    await wait(1300);
    log("label Enter url", p.url());
    await p.goBack();
    await wait(800);
    log("after back url", p.url(), "panel?", await p.evaluate(() => !!document.querySelector(".panel:not(.is-out)")));
    // menu
    await p.click(".hud-menu");
    await wait(600);
    await shot(p, "d1440-18-menu");
    await p.keyboard.press("Escape");
    await wait(500);
    // full
    await p.click(".hud-views a >> text=Full");
    await wait(180);
    await shot(p, "d1440-19-portal-mid");
    await wait(700);
    await shot(p, "d1440-20-full");
    const fl = await p.evaluate(() => {
      const u = document.querySelector(".works-full ul").getBoundingClientRect();
      const cs = getComputedStyle(document.querySelector(".works-full ul"));
      return { w: Math.round(u.width), cy: Math.round(u.top + u.height / 2), fs: cs.fontSize, ls: cs.letterSpacing, lh: cs.lineHeight };
    });
    log("full list", fl);
    const a = await p.$$(".works-full a");
    const bb = await a[2].boundingBox();
    await p.mouse.move(bb.x + 10, bb.y + 10);
    await wait(100);
    await p.mouse.move(bb.x + 60, bb.y + 20, { steps: 6 });
    await wait(500);
    await shot(p, "d1440-21-full-hover");
    await p.mouse.click(bb.x + 60, bb.y + 20);
    await wait(1200);
    await shot(p, "d1440-22-panel-from-full");
    log("from full url", p.url());
    await p.keyboard.press("Escape");
    await wait(700);
    log("close to full url", p.url());
    await p.click(".hud-views a >> text=Featured");
    await wait(900);
    await shot(p, "d1440-23-back-featured");
    // about + home
    await p.goto(BASE + "/about/", { waitUntil: "networkidle" });
    await introDone(p);
    await wait(1800);
    await shot(p, "d1440-30-about-hero");
    for (const [k, y] of [["31", 1.1], ["32", 2.2], ["33", 4], ["34", 99]]) {
      await p.evaluate((f) => window.scrollTo(0, f > 50 ? document.body.scrollHeight : innerHeight * f), y);
      await wait(1200);
      await shot(p, `d1440-${k}-about`);
    }
    log("about hscroll", await hscroll(p));
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await introDone(p);
    await wait(1500);
    await shot(p, "d1440-40-home");
    await p.evaluate(() => window.scrollTo(0, innerHeight * 1.2));
    await wait(1500);
    await shot(p, "d1440-41-home-f2");
    await p.evaluate(() => window.scrollTo(0, document.querySelector(".reel-slot").offsetTop + innerHeight * 1.2));
    await wait(2000);
    await shot(p, "d1440-42-home-reel");
    await p.click(".reel-hit");
    await wait(700);
    await shot(p, "d1440-43-reel-player");
    log("reel src", await p.evaluate(() => document.querySelector(".reel-player video").getAttribute("src")));
    await p.keyboard.press("Escape");
    await wait(400);
    log("home hscroll", await hscroll(p), "errors", p.errors);
    await ctx.close();
  }

  // ---------------- 390 ----------------
  {
    const { ctx, p } = await page(b, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto(BASE + "/works/", { waitUntil: "networkidle" });
    await introDone(p);
    await wait(3500);
    await shot(p, "m390-01-featured");
    const cards = await p.evaluate(() =>
      Array.from(document.querySelectorAll(".card-label"))
        .slice(0, 3)
        .map((a) => {
          const r = a.getBoundingClientRect();
          return [Math.round(r.left), Math.round(r.bottom)];
        })
    );
    log("390 labels", cards, "hscroll", await hscroll(p));
    // swipe vertical via CDP touch
    const cdp = await ctx.newCDPSession(p);
    const touch = async (type, y) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: 200, y }] });
    await touch("touchStart", 600);
    for (let i = 1; i <= 8; i++) {
      await touch("touchMove", 600 - i * 40);
      await wait(16);
    }
    await touch("touchEnd", 280);
    await wait(150);
    await shot(p, "m390-02-swipe");
    await wait(1600);
    await shot(p, "m390-03-settled");
    await p.touchscreen.tap(195, 422);
    await wait(1300);
    await shot(p, "m390-04-panel");
    log("390 open url", p.url());
    await p.evaluate(() => {
      const s = document.querySelector(".panel-scroll");
      s.scrollTop = s.clientHeight * 1.2;
    });
    await wait(800);
    await shot(p, "m390-05-panel-info");
    log("390 panel hscroll", await p.evaluate(() => {
      const s = document.querySelector(".panel-scroll");
      return s.scrollWidth > s.clientWidth + 1;
    }));
    await p.tap(".panel-close");
    await wait(800);
    log("390 close url", p.url());
    await p.goto(BASE + "/works/full/", { waitUntil: "networkidle" });
    await introDone(p);
    await wait(1500);
    await shot(p, "m390-06-full");
    await p.goto(BASE + "/about/", { waitUntil: "networkidle" });
    await introDone(p);
    await wait(1800);
    await shot(p, "m390-07-about");
    await p.evaluate(() => window.scrollTo(0, innerHeight * 1.3));
    await wait(1200);
    await shot(p, "m390-08-about-cv");
    log("390 about hscroll", await hscroll(p));
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await introDone(p);
    await wait(1500);
    await shot(p, "m390-09-home");
    log("390 home hscroll", await hscroll(p), "errors", p.errors);
    await ctx.close();
  }

  // ---------------- reduced-motion + sem WebGL ----------------
  {
    const { ctx, p } = await page(b, { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await p.goto(BASE + "/works/", { waitUntil: "networkidle" });
    await introDone(p);
    await wait(2000);
    await p.keyboard.press("Enter");
    await wait(300);
    await shot(p, "rm-01-open");
    log("rm open url", p.url());
    await p.keyboard.press("Escape");
    await wait(400);
    log("rm close url", p.url(), "errors", p.errors);
    await ctx.close();
  }
  {
    const { ctx, p } = await page(b, { viewport: { width: 1440, height: 900 } });
    for (const [u, n] of [["/works/?webgl=0", "t0-01-works"], ["/works/full/?webgl=0", "t0-02-full"], ["/works/orinoco/?webgl=0", "t0-03-panel"]]) {
      await p.goto(BASE + u, { waitUntil: "networkidle" });
    await introDone(p);
      await wait(1200);
      await shot(p, n);
    }
    log("t0 errors", p.errors);
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const p = await ctx.newPage();
    for (const [u, n] of [["/works/", "nojs-01-works"], ["/works/ado/", "nojs-02-panel"], ["/", "nojs-03-home"], ["/about/", "nojs-04-about"]]) {
      await p.goto(BASE + u);
      await wait(600);
      await shot(p, n);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report.txt"), report.join("\n"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
