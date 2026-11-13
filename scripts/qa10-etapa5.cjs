// QA etapa 5 (Edge, 1440 e 390): rotas novas, cliques do Studio (3D real + botões), relíquias do Lab, cursor ritual,
// genie entre rotas, erros de console (incl. hidratação), rolagem lateral, rAF/s e peso transmitido do /studio.
//   node scripts/qa10-etapa5.cjs <playwright-core> [baseURL]
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
const shot = (p, n) => p.screenshot({ path: path.join(OUT, `e5-${n}.png`) });
const done = (p) => p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 }).catch(() => log("  !! intro não terminou"));
const hscroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const INIT = () => {
  // rAF/s e microfone: contadores sem alterar comportamento
  window.__raf = 0;
  const r = window.requestAnimationFrame;
  window.requestAnimationFrame = (f) => {
    window.__raf++;
    return r.call(window, f);
  };
  window.__mic = 0;
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async () => {
      window.__mic++;
      throw new DOMException("denied in QA", "NotAllowedError");
    };
  }
};
const rafRate = async (p, ms = 2000) => {
  const a = await p.evaluate(() => window.__raf);
  await wait(ms);
  const b = await p.evaluate(() => window.__raf);
  return Math.round(((b - a) * 1000) / ms);
};

async function studio(b, W, H, mobile) {
  const tag = mobile ? "390" : "1440";
  const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  const bytes = { total: 0, files: {} };
  p.on("response", async (r) => {
    try {
      const len = Number(r.headers()["content-length"] || 0);
      bytes.total += len;
      const u = new URL(r.url()).pathname;
      if (u.startsWith("/studio/")) bytes.files[u] = len;
    } catch {}
  });
  await p.goto(BASE + "/studio/", { waitUntil: "domcontentloaded" });
  await done(p);
  await p.waitForSelector(".st-load.done", { timeout: 30000 }).catch(() => log("  !! cena final não carregou"));
  await wait(3500);
  const mb = (n) => (n / 1048576).toFixed(2) + " MB";
  log(`[${tag}] /studio transferido (página inteira): ${mb(bytes.total)}; assets /studio/:`, Object.fromEntries(Object.entries(bytes.files).map(([k, v]) => [k.replace("/studio/", ""), mb(v)])));
  log(`[${tag}] hscroll`, await hscroll(p), "rAF/s parado", await rafRate(p));
  await shot(p, `studio-${tag}`);
  // varredura de hover para achar cada objeto 3D (o rótulo mostra o nome)
  const found = {};
  if (!mobile) {
    for (let y = 150; y < H - 140; y += 32)
      for (let x = 30; x < W - 30; x += 40) {
        await p.mouse.move(x, y);
        await wait(25);
        const t = await p.evaluate(() => {
          const l = document.querySelector(".st-label");
          return l && l.classList.contains("on") ? l.textContent : "";
        });
        if (t && !found[t]) found[t] = [x, y];
      }
    log(`[${tag}] objetos 3D achados por hover:`, Object.keys(found));
    await p.mouse.move(found["Monitor · Reel ▶"]?.[0] ?? 900, found["Monitor · Reel ▶"]?.[1] ?? 320);
    await wait(300);
    log(`[${tag}] cursor sobre objeto 3D:`, await p.evaluate(() => [document.querySelector(".cz")?.dataset.st, document.querySelector(".cz-lab")?.textContent]));
    await shot(p, `studio-hover-${tag}`);
  }
  const click3d = async (label) => {
    const pt = found[label];
    if (!pt) return false;
    await p.mouse.click(pt[0], pt[1]);
    return true;
  };
  const viaButton = (label) => p.click(`.st-chip:has-text("${label}")`);
  const act = async (label, check, name) => {
    const real = !mobile && (await click3d(label));
    if (!real) await viaButton(label);
    await wait(700);
    const r = await p.evaluate(check);
    log(`[${tag}] ${name} (${real ? "clique 3D" : "botão"}):`, r);
    return r;
  };
  await act("Monitor · Reel ▶", () => !!document.querySelector(".rp:not([hidden])") && getComputedStyle(document.querySelector(".rp")).display !== "none", "reel → player");
  await shot(p, `studio-reel-${tag}`);
  await p.keyboard.press("Escape");
  await wait(900);
  await act("Keyboard · Type", () => document.activeElement?.className, "teclado → foco no digitador");
  await p.keyboard.type("hello rito");
  await wait(300);
  await shot(p, `studio-typing-${tag}`);
  await p.keyboard.press("Escape");
  await wait(300);
  await act("Case · Stack", () => !document.getElementById("st-stack")?.hidden, "gabinete → stack");
  await shot(p, `studio-stack-${tag}`);
  await p.keyboard.press("Escape");
  await wait(300);
  await act("Folder · Résumé", () => [!document.getElementById("st-cv")?.hidden, document.querySelector("#st-cv .st-cta")?.getAttribute("href")], "pasta → résumé PDF");
  await p.keyboard.press("Escape");
  await wait(300);
  await act("Phone · WhatsApp", () => [!document.getElementById("st-wa")?.hidden, document.querySelector("#st-wa .st-cta")?.getAttribute("href")], "celular → wa.me");
  await p.keyboard.press("Escape");
  await wait(300);
  await act("Lamp · Night ↔ Ritual", () => document.querySelector(".studio .sr-only[aria-live]")?.textContent, "luminária → luz");
  await wait(1200);
  await shot(p, `studio-ritual-${tag}`);
  await act("Monitor · Works", () => location.pathname, "monitor esq. → (iniciou)");
  await wait(2200);
  log(`[${tag}] monitor esq. → rota final:`, await p.evaluate(() => location.pathname), "intro:", await p.evaluate(() => (window.__intro || []).slice(-1)));
  log(`[${tag}] studio erros:`, errs);
  await ctx.close();
}

async function lab(b, W, H, mobile) {
  const tag = mobile ? "390" : "1440";
  const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  await p.goto(BASE + "/lab/", { waitUntil: "domcontentloaded" });
  await done(p);
  await wait(1200);
  log(`[${tag}] lab hscroll`, await hscroll(p), "rAF/s", await rafRate(p));
  await shot(p, `lab-corr-${tag}`);
  // corredor: setas
  if (!mobile) {
    await p.keyboard.press("ArrowRight");
    await wait(900);
    log(`[${tag}] → seleciona:`, await p.evaluate(() => document.querySelector(".lab-now b")?.textContent));
    await p.keyboard.press("ArrowLeft");
    await wait(600);
  }
  const mode = () => p.evaluate(() => document.querySelector(".lab")?.getAttribute("data-mode"));
  for (const name of ["Orb", "Cloth", "Ember", "Fluid"]) {
    await p.click(`.lab-row .chip:has-text("${name}")`);
    await wait(700);
    const m = await mode();
    if (name === "Orb") {
      log(`[${tag}] mic antes do clique:`, await p.evaluate(() => window.__mic));
      if (!mobile) await p.mouse.move(W * 0.6, H * 0.4, { steps: 8 });
      await wait(500);
      await p.click('.lab-exp .chip:has-text("Enable microphone")');
      await wait(400);
      log(`[${tag}] mic depois do clique:`, await p.evaluate(() => window.__mic), await p.evaluate(() => document.querySelector(".lab-hint")?.textContent));
    }
    if (name === "Cloth") {
      if (mobile) {
        await p.touchscreen.tap(W / 2, H * 0.55);
      } else {
        await p.mouse.move(W / 2, H * 0.6);
        await p.mouse.down();
        await p.mouse.move(W * 0.7, H * 0.8, { steps: 12 });
        await wait(300);
        await p.mouse.up();
      }
      await wait(600);
    }
    if (name === "Ember") {
      await p.fill(".lab-word input", "RITO");
      await wait(1500);
    }
    if (name === "Fluid") {
      if (!mobile) for (let i = 0; i < 30; i++) await p.mouse.move(W * 0.3 + i * 18, H * 0.5 + Math.sin(i / 3) * 80);
      await wait(400);
    }
    log(`[${tag}] relíquia ${name}: data-mode=${m}, foco=`, await p.evaluate(() => document.activeElement?.className || document.activeElement?.tagName), "rAF/s", await rafRate(p, 1000));
    await shot(p, `lab-${name.toLowerCase()}-${tag}`);
    await p.keyboard.press("Escape");
    await wait(500);
    log(`[${tag}]   Esc → data-mode=${await mode()}`);
  }
  log(`[${tag}] lab erros:`, errs);
  await ctx.close();
}

async function cursor(b) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  const st = () => p.evaluate(() => [document.documentElement.classList.contains("cur"), document.documentElement.classList.contains("cur-cede"), document.querySelector(".cz")?.dataset.st || "", document.querySelector(".cz-lab")?.textContent]);
  await p.goto(BASE + "/resume/", { waitUntil: "domcontentloaded" });
  await done(p);
  await wait(600);
  const at = async (sel) => {
    const r = await p.evaluate((s) => {
      const e = [...document.querySelectorAll(s)].find((x) => {
        const b = x.getBoundingClientRect();
        return b.width > 0 && b.bottom > 80 && b.top < innerHeight - 60;
      });
      if (!e) return null;
      const b = e.getBoundingClientRect();
      const top = Math.max(b.top, 80), bot = Math.min(b.bottom, innerHeight - 60);
      return [b.left + Math.min(20, b.width / 2), (top + bot) / 2];
    }, sel);
    if (!r) return null;
    await p.mouse.move(r[0], r[1], { steps: 6 });
    await wait(450);
    return st();
  };
  log("[cursor] link:", await at("main a"));
  await shot(p, "cursor-link");
  log("[cursor] texto:", await at("main p"));
  await shot(p, "cursor-text");
  await p.goto(BASE + "/about/", { waitUntil: "domcontentloaded" });
  await done(p);
  await wait(800);
  await p.mouse.move(700, 400, { steps: 4 });
  await wait(300);
  log("[cursor] darkroom About (cede):", await st());
  await p.goto(BASE + "/works/orinoco/", { waitUntil: "domcontentloaded" });
  await done(p);
  await wait(1800);
  await p.evaluate(() => {
    const im = [...document.querySelectorAll("img")].find((x) => x.getBoundingClientRect().width > 200 && x.naturalWidth);
    im && im.scrollIntoView({ block: "center" });
  });
  await wait(900);
  log("[cursor] imagem:", await at("img"));
  await shot(p, "cursor-img");
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await done(p);
  await wait(800);
  await p.mouse.move(720, 450, { steps: 4 });
  await wait(300);
  log("[cursor] hero Home (cede):", await st());
  await p.mouse.down();
  await p.mouse.up();
  log("[cursor] erros:", errs);
  await ctx.close();
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const q = await m.newPage();
  await q.goto(BASE + "/resume/", { waitUntil: "domcontentloaded" });
  await wait(1500);
  log("[cursor] 390 toque: html.cur =", await q.evaluate(() => document.documentElement.classList.contains("cur")));
  await m.close();
  const r = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const q2 = await r.newPage();
  await q2.goto(BASE + "/resume/", { waitUntil: "domcontentloaded" });
  await wait(1500);
  log("[cursor] reduced-motion: html.cur =", await q2.evaluate(() => document.documentElement.classList.contains("cur")));
  await r.close();
}

async function genie(b, W, H, mobile) {
  const tag = mobile ? "390" : "1440";
  const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  await p.goto(BASE + "/works/", { waitUntil: "domcontentloaded" });
  await done(p);
  await wait(1500);
  const viaMenu = async (label, n) => {
    await p.click(".hud-menu");
    await wait(600);
    await p.click(`.menu-link:has(.menu-label:text-is("${label}"))`);
    await wait(260);
    await shot(p, `genie-${n}-mid-${tag}`);
    await done(p);
    await p.waitForFunction(() => document.querySelector("#intro")?.classList.contains("is-done") && !document.querySelector(".genie"), null, { timeout: 6000 }).catch(() => {});
    await wait(400);
    const last = await p.evaluate(() => (window.__intro || []).slice(-1)[0]);
    log(`[${tag}] genie Menu → ${label}:`, last, "rota:", await p.evaluate(() => location.pathname));
  };
  await viaMenu("Studio", "works-studio");
  await wait(2500);
  await viaMenu("Lab", "studio-lab");
  await wait(800);
  await viaMenu("About", "lab-about");
  // link interno (fora do Menu): About → Works (lista de projetos)
  await p.mouse.wheel(0, 99999);
  await wait(1500);
  const href = await p.evaluate(() => {
    const a = [...document.querySelectorAll('main a[href^="/works/"]')].find((x) => x.getBoundingClientRect().width > 0);
    if (!a) return null;
    const ls = (window.__lenis || []).find((e) => e.key === "document")?.lenis;
    const y = a.getBoundingClientRect().top + scrollY - innerHeight / 2;
    if (ls && ls.scrollTo) ls.scrollTo(y, { immediate: true });
    else scrollTo(0, y);
    return a.getAttribute("href");
  });
  if (href) {
    await wait(300);
    await p.click(`main a[href="${href}"]`);
    await wait(260);
    await shot(p, `genie-link-mid-${tag}`);
    await done(p);
    await wait(900);
    log(`[${tag}] genie link interno ${href}:`, await p.evaluate(() => (window.__intro || []).slice(-1)[0]), "rota:", await p.evaluate(() => location.pathname));
  } else log(`[${tag}] (sem link interno visível no About)`);
  // volta à Home pelo logo: intro completa
  await p.keyboard.press("Escape");
  await wait(400);
  await p.click(".hud-menu");
  await wait(600);
  await p.click(`.menu-link:has(.menu-label:text-is("Home"))`);
  await wait(500);
  await done(p);
  await wait(600);
  log(`[${tag}] Menu → Home:`, await p.evaluate(() => (window.__intro || []).slice(-1)[0]), await p.evaluate(() => location.pathname));
  log(`[${tag}] genie erros:`, errs);
  await ctx.close();
  // reduced-motion: fade
  if (!mobile) {
    const r = await b.newContext({ viewport: { width: W, height: H }, reducedMotion: "reduce" });
    const q = await r.newPage();
    await q.goto(BASE + "/works/", { waitUntil: "domcontentloaded" });
    await done(q);
    await wait(800);
    await q.click(".hud-menu");
    await wait(500);
    await q.click(`.menu-link:has(.menu-label:text-is("Lab"))`);
    await wait(1500);
    log(`[reduced] Menu → Lab:`, await q.evaluate(() => (window.__intro || []).slice(-1)[0]), await q.evaluate(() => location.pathname));
    await r.close();
  }
}

async function menuAndRoutes(b, W, H, mobile) {
  const tag = mobile ? "390" : "1440";
  const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  await p.goto(BASE + "/resume/", { waitUntil: "domcontentloaded" });
  await done(p);
  await p.click(".hud-menu");
  await wait(700);
  log(`[${tag}] menu:`, await p.evaluate(() => [...document.querySelectorAll(".menu-link")].map((a) => a.textContent.trim() + "→" + a.getAttribute("href"))), "menu cabe:", await p.evaluate(() => document.querySelector(".menu").scrollHeight <= innerHeight + 1));
  await shot(p, `menu-${tag}`);
  for (const r of ["/", "/works/", "/studio/", "/lab/", "/about/", "/resume/"]) {
    await p.goto(BASE + r, { waitUntil: "domcontentloaded" });
    await done(p);
    await wait(900);
    log(`[${tag}] ${r} hscroll=${await hscroll(p)} h1="${await p.evaluate(() => document.querySelector("h1")?.textContent?.trim().slice(0, 30))}"`);
  }
  log(`[${tag}] rotas erros:`, errs);
  await ctx.close();
}

async function noGL(b) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  for (const r of ["/studio/?webgl=0", "/lab/?webgl=0"]) {
    await p.goto(BASE + r, { waitUntil: "domcontentloaded" });
    await done(p);
    await wait(900);
    log(`[sem WebGL] ${r}:`, await p.evaluate(() => ({ h1: document.querySelector("h1")?.textContent, botoes: document.querySelectorAll("main button").length, foto: !!document.querySelector(".st-fallback") && getComputedStyle(document.querySelector(".st-fallback")).display })));
    await shot(p, `nogl-${r.split("/")[1]}`);
  }
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  const only = process.argv[4];
  try {
    if (!only || only === "routes") {
      await menuAndRoutes(b, 1440, 900, false);
      await menuAndRoutes(b, 390, 844, true);
    }
    if (!only || only === "studio") {
      await studio(b, 1440, 900, false);
      await studio(b, 390, 844, true);
    }
    if (!only || only === "lab") {
      await lab(b, 1440, 900, false);
      await lab(b, 390, 844, true);
    }
    if (!only || only === "cursor") await cursor(b);
    if (!only || only === "genie") {
      await genie(b, 1440, 900, false);
      await genie(b, 390, 844, true);
    }
    if (!only || only === "nogl") await noGL(b);
  } catch (e) {
    log("FALHA:", e.message);
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, `report-etapa5${only ? "-" + only : ""}.txt`), lines.join("\n"));
})();
