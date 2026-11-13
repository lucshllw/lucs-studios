// Reel 4K: abrir player na Home, trocar 1080p→4K preservando o tempo; padrão em 1440 = 1080p.
const { chromium } = require(process.argv[2]);
const BASE = process.argv[3] || "http://localhost:5201";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(BASE + "/", { waitUntil: "load" });
  await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
  // abre o player pelo evento do store (mesmo caminho do botão do reel)
  await p.evaluate(() => document.querySelector(".reel-cta, [data-reel], .reel-open, button[aria-label*='reel' i]")?.click());
  await wait(1200);
  let open = await p.evaluate(() => !!document.querySelector(".rp video"));
  if (!open) {
    await p.goto(BASE + "/studio/", { waitUntil: "load" });
    await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
    await p.click('.st-chip:has-text("Monitor · Reel")');
    await wait(1500);
    open = await p.evaluate(() => !!document.querySelector(".rp video"));
  }
  const src0 = await p.evaluate(() => document.querySelector(".rp video")?.currentSrc);
  await p.evaluate(() => {
    const v = document.querySelector(".rp video");
    v.muted = true;
    return v.play().catch(() => {});
  });
  await wait(2500);
  const t0 = await p.evaluate(() => document.querySelector(".rp video").currentTime);
  await p.mouse.move(700, 450);
  await wait(300);
  await p.evaluate(() => [...document.querySelectorAll(".rp button")].find((x) => x.textContent.trim() === "4K")?.click());
  await wait(2500);
  const r = await p.evaluate(() => {
    const v = document.querySelector(".rp video");
    return { src: v.currentSrc, t: v.currentTime, w: v.videoWidth, h: v.videoHeight, paused: v.paused };
  });
  console.log("player aberto:", open, "· padrão:", src0, "· t antes:", t0.toFixed(2), "· depois 4K:", JSON.stringify(r), "· erros:", JSON.stringify(errs));
  await b.close();
})();
