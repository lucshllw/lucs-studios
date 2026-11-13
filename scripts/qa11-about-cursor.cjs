// Bug: "no About o cursor não funciona na foto" — 1440, mouse real: 1ª visita e após Menu → Works → About.
const { chromium } = require(process.argv[2]);
const path = require("path");
const BASE = process.argv[3] || "http://localhost:5201";
const TAG = process.argv[4] || "x";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ channel: "msedge", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  const rev = () => p.evaluate(() => (document.querySelector(".about")?.textContent.match(/REVEALED\s*(\d+)%/) || [])[1]);
  const sweep = async (label) => {
    await wait(800);
    const r0 = await rev();
    const st0 = await p.evaluate(() => [document.documentElement.className, document.elementFromPoint(560, 450)?.className]);
    for (let k = 0; k < 4; k++) for (let i = 0; i <= 30; i++) await p.mouse.move(380 + i * 14, 260 + k * 110 + (i % 2) * 20, { steps: 2 });
    await wait(500);
    const r1 = await rev();
    const cz = await p.evaluate(() => [document.documentElement.classList.contains("cur-cede"), getComputedStyle(document.querySelector(".cz")).visibility + "/" + document.querySelector(".cz").dataset.st + "/" + document.querySelector(".cz-lab").textContent + "/" + getComputedStyle(document.querySelector(".cz-dial")).width]);
    console.log(`[${label}] REVEALED ${r0}% → ${r1}% · cursor cede=${cz[0]} anel=${cz[1]} · alvo=${st0[1]} · html=${st0[0]}`);
    await p.screenshot({ path: path.resolve(__dirname, `../qa/e6-${TAG}-aboutcursor-${label}.png`) });
  };
  await p.goto(BASE + "/about/", { waitUntil: "load" });
  await p.waitForSelector("#intro.is-done", { state: "attached", timeout: 15000 });
  await sweep("1a-visita");
  for (const to of ["Works", "About"]) {
    await p.click(".hud-menu");
    await wait(700);
    await p.click(`.menu-link:has(.menu-label:text-is("${to}"))`);
    await p.waitForFunction(() => document.querySelector("#intro")?.classList.contains("is-done") && !document.querySelector(".genie"), null, { timeout: 8000 }).catch(() => {});
    await wait(900);
  }
  await sweep("apos-menu");
  for (const to of ["Studio", "About"]) {
    await p.click(".hud-menu");
    await wait(700);
    await p.click(`.menu-link:has(.menu-label:text-is("${to}"))`);
    await p.waitForFunction(() => document.querySelector("#intro")?.classList.contains("is-done") && !document.querySelector(".genie"), null, { timeout: 8000 }).catch(() => {});
    await wait(to === "Studio" ? 3500 : 900);
  }
  await sweep("apos-studio");
  await p.mouse.wheel(0, 600);
  await wait(1200);
  await p.mouse.wheel(0, -600);
  await wait(1200);
  await sweep("apos-rolagem");
  await p.click(".hud-menu");
  await wait(700);
  await p.click(`.menu-link:has(.menu-label:text-is("Home"))`);
  await wait(1500);
  await p.mouse.move(700, 420, { steps: 5 });
  await wait(500);
  console.log("[hero] cursor:", await p.evaluate(() => [getComputedStyle(document.querySelector(".cz")).visibility, document.querySelector(".cz").dataset.st, document.querySelector(".cz-lab").textContent, getComputedStyle(document.querySelector(".cz-dial")).width]));
  await p.screenshot({ path: path.resolve(__dirname, `../qa/e6-${TAG}-herocursor.png`) });
  console.log("erros:", JSON.stringify(errs));
  await b.close();
})();
