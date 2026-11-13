// Smoke etapa 5: /studio e /lab carregam sem erros; screenshots rápidas.
//   node scripts/qa10-smoke.cjs <playwright-core> [baseURL]
const { chromium } = require(process.argv[2]);
const path = require("path");
const BASE = process.argv[3] || "http://localhost:5200";
const OUT = path.resolve(__dirname, "../qa");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  for (const [W, H] of [[1440, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(W < 768 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    const p = await ctx.newPage();
    const errs = [];
    p.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errs.push(m.type() + ": " + m.text().slice(0, 240)));
    p.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 240)));
    for (const r of ["/studio/", "/lab/"]) {
      await p.goto(BASE + r, { waitUntil: "domcontentloaded" });
      await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 }).catch(() => {});
      await wait(r === "/studio/" ? 6000 : 2000);
      await p.screenshot({ path: path.join(OUT, `e5-smoke-${r.replace(/\//g, "")}-${W}.png`) });
    }
    console.log(W, JSON.stringify(errs, null, 1));
    await ctx.close();
  }
  await b.close();
})();
