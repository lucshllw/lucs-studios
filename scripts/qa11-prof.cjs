// Perfil de CPU (CDP) de uma navegação pelo Menu: node scripts/qa11-prof.cjs <pw> <base> <fromPath> <toLabel> [mobile]
const { chromium } = require(process.argv[2]);
const BASE = process.argv[3];
const FROM = process.argv[4];
const TO = process.argv[5];
const MOBILE = process.argv[6] === "mobile";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  const ctx = await b.newContext(MOBILE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + "/" + FROM, { waitUntil: "load" });
  await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
  await wait(4000);
  await p.click(".hud-menu");
  await wait(700);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  await cdp.send("Profiler.start");
  await p.click(`.menu-link:has(.menu-label:text-is("${TO}"))`);
  await wait(Number(process.env.PW_WAIT || 2500));
  const { profile } = await cdp.send("Profiler.stop");
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    const f = n.callFrame;
    const k = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber}`;
    self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000);
  });
  const parent = new Map();
  profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
  const chains = new Map();
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    if (n.callFrame.functionName !== "getProgramInfoLog") return;
    const ch = [];
    let q = parent.get(id);
    for (let k = 0; k < 9 && q; k++) {
      const f = byId.get(q).callFrame;
      ch.push(`${f.functionName || "anon"}@${f.url.split("/").pop()}:${f.columnNumber}`);
      q = parent.get(q);
    }
    const key = ch.join(" < ");
    chains.set(key, (chains.get(key) || 0) + (dt[i] || 0) / 1000);
  });
  [...chains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, v]) => console.log("PIL", v.toFixed(0), k));
  const top = [...self.entries()].filter(([k]) => !/^\(idle\)|^\(program\)|^\(root\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 18);
  top.forEach(([k, v]) => console.log(v.toFixed(0).padStart(6), "ms", k));
  console.log("program", (self.get("(program) :-1") || 0).toFixed(0), "gc", (self.get("(garbage collector) :-1") || 0).toFixed(0));
  await b.close();
})();
