// Lighthouse (perf) no Edge aberto pelo Playwright (um navegador novo por auditoria, porta própria).
//   node scripts/qa11-lh.cjs <pw> [base] [tag]   (LH_ROUTES="works/,studio/" para limitar)
const { chromium } = require(process.argv[2]);
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const BASE = process.argv[3] || "http://localhost:5201";
const TAG = process.argv[4] || "after";
const APP = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(APP, "qa/lh"), { recursive: true });
const run = (args) =>
  new Promise((res) => {
    const c = spawn("npx.cmd", args, { cwd: APP, shell: true, stdio: "ignore" });
    const t = setTimeout(() => c.kill(), 180000);
    c.on("exit", (code) => (clearTimeout(t), res(code)));
  });
(async () => {
  const rows = [];
  let port = 9400;
  for (const r of process.env.LH_ROUTES ? process.env.LH_ROUTES.split(",") : ["", "works/", "studio/", "about/"]) {
    for (const ff of ["mobile", "desktop"]) {
      const n = `${TAG}-${(r || "home/").replace("/", "")}-${ff}`;
      const rel = `qa/lh/${n}.json`;
      port++;
      const b = await chromium.launch({ channel: "msedge", args: [`--remote-debugging-port=${port}`] });
      const args = ["-y", "lighthouse@12.8.2", `${BASE}/${r}`, `--port=${port}`, "--only-categories=performance", "--max-wait-for-load=20000", "--output=json", `--output-path=${rel}`];
      if (ff === "desktop") args.push("--preset=desktop");
      await run(args);
      await b.close().catch(() => {});
      try {
        const j = JSON.parse(fs.readFileSync(path.join(APP, rel), "utf8"));
        const a = j.audits;
        const row = `${("/" + r).padEnd(9)} ${ff.padEnd(7)} Perf ${Math.round(j.categories.performance.score * 100)} · LCP ${a["largest-contentful-paint"].displayValue} · TBT ${a["total-blocking-time"].displayValue} · CLS ${a["cumulative-layout-shift"].displayValue} · peso ${a["total-byte-weight"].displayValue}`;
        rows.push(row);
        console.log(row);
      } catch (e) {
        console.log(n, "falhou", e.message.slice(0, 200));
      }
    }
  }
  fs.writeFileSync(path.join(APP, `qa/lh/summary-${TAG}.txt`), rows.join("\n"));
})();
