// Modo filme do Studio (26/11) — grava com GPU os quadros da cena REAL (StudioLayer + pós) para o modo sem aceleração
// de hardware (lib/studioFilm.ts toca esses quadros em canvas 2D). Mesmo princípio do modo filme do site do Aizawa.
//
// Uso (precisa de GPU, playwright e sharp resolvíveis a partir de onde o script roda):
//   npm run build && npm run serve            # export em http://localhost:5201
//   node scripts/film-capture.mjs [saida=public/studio/film] [base=http://localhost:5201]
//
// Saída: n/000..096.webp (órbita, luz "night"), r/… (luz "ritual"), i/000..084.webp (intro), p/000..096.webp (faixas com
// 7 fases do ciclo RGB das ventoinhas, com borda em alfa) e film.json (câmera, hotspots, tela esquerda, teclas, recortes).
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.argv[2] || "public/studio/film");
const BASE = process.argv[3] || "http://localhost:5201";
const W = 2304, H = 1096; // 2,1:1 — cobre janelas de navegador comuns sem cortar na vertical
const N = 97; // posições da órbita (índice 48 = centro)
const AZ = 0.415; // ±(0,38 do arrasto + 0,035 da paralaxe do mouse)
const INTRO_N = 85, INTRO_FPS = 30; // 0 → 2,8 s
const PHASES = 8, PHASE_DUR = 0.5; // ciclo de matiz das ventoinhas: 4 s
const T0 = 1000; // tempo-base: uT inteiro → fase 0

for (const d of ["n", "r", "i", "p"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const browser = await chromium.launch({ headless: false, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
await page.goto(`${BASE}/studio/?cap=1&lite=0`);
await page.waitForFunction(() => window.__studio && window.__studio.loadedFinal, null, { timeout: 120000 });
await page.mouse.move(800, 500);
await page.mouse.move(900, 520); // 1º movimento: troca as texturas 1K → 2K
await page.waitForTimeout(7000);

const info = await page.evaluate(() => {
  const L = window.__studio, Wd = L.world, r = Wd.renderer, gl = r.getContext();
  const e = gl.getExtension("WEBGL_debug_renderer_info");
  const rn = e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : "";
  Wd.untick?.(); // só a captura desenha a partir daqui
  const V = L.cam.position.constructor;
  const cap = {
    set(az, t, rit, time, left) {
      for (let k = 0; k < 2; k++) {
        L.az = L.azS = az; L.pol = L.polS = 0; L.P.in = false; L.P.down = false; L.hover = null;
        L.ritual = L.ritualT = rit; L.fanBoost = 0; L.leftMode = left || "chat"; L.born = time - t; L.slow = -1e6; L.dirty = 3;
        if (L.finalPass) L.finalPass.uniforms.uG.value = 0;
        L.update(0, time); Wd.forceFrame = true; r.autoClear = true; L.render(r); Wd.forceFrame = false;
      }
    },
    png() { return r.domElement.toDataURL("image/png"); },
    /** retângulo (px do quadro) do gabinete projetado, com margem */
    caseRect(margin) {
      const h = L.hots.find((x) => x.id === "case"), g = h.proxy.geometry.parameters, c = h.proxy.position;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const v = new V(c.x + (sx * g.width) / 2, c.y + (sy * g.height) / 2, c.z + (sz * g.depth) / 2).project(L.cam);
        const x = (v.x * 0.5 + 0.5) * r.domElement.width, y = (-v.y * 0.5 + 0.5) * r.domElement.height;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      x0 = Math.max(0, Math.floor(x0 - margin)); y0 = Math.max(0, Math.floor(y0 - margin));
      x1 = Math.min(r.domElement.width, Math.ceil(x1 + margin)); y1 = Math.min(r.domElement.height, Math.ceil(y1 + margin));
      return [x0, y0, x1 - x0, y1 - y0];
    },
    strip: null,
    stripStart(w, h, n) { const c = document.createElement("canvas"); c.width = w * n; c.height = h; cap.strip = c; },
    /** recorta o quadro atual (logo após o render) com borda em alfa e cola na faixa */
    stripAdd(i, x, y, w, h, feather) {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d");
      g.drawImage(r.domElement, x, y, w, h, 0, 0, w, h);
      const m = document.createElement("canvas"); m.width = w; m.height = h;
      const mg = m.getContext("2d");
      mg.filter = `blur(${feather / 2.5}px)`; mg.fillStyle = "#fff"; mg.fillRect(feather, feather, w - feather * 2, h - feather * 2);
      g.globalCompositeOperation = "destination-in"; g.drawImage(m, 0, 0);
      cap.strip.getContext("2d").drawImage(c, i * w, 0);
    },
    stripPng() { return cap.strip.toDataURL("image/png"); },
  };
  window.__cap = cap;
  // metadados para o player
  const root = L.gltfRoot;
  const hots = {};
  for (const h of L.hots) { const g = h.proxy.geometry.parameters; hots[h.id] = { c: h.proxy.position.toArray(), s: [g.width, g.height, g.depth], top: h.top }; }
  const sl = root.getObjectByName("ScreenL"); sl.updateWorldMatrix(true, false);
  const pos = sl.geometry.attributes.position, uv = sl.geometry.attributes.uv;
  const corner = (u, v) => { let best = 1e9, bi = 0; for (let i = 0; i < uv.count; i++) { const d = (uv.getX(i) - u) ** 2 + (uv.getY(i) - v) ** 2; if (d < best) { best = d; bi = i; } } return new V().fromBufferAttribute(pos, bi).applyMatrix4(sl.matrixWorld).toArray(); };
  const screenL = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
  const keys = {};
  if (L.keys) {
    L.keys.updateWorldMatrix(true, false);
    const bb = L.keys.geometry.boundingBox, M = L.keys.matrixWorld.clone(), I = M.clone();
    for (const [ch, i] of L.keyIndex) {
      L.keys.getMatrixAt(i, I); I.premultiply(M);
      keys[ch] = [[bb.min.x, bb.min.z], [bb.max.x, bb.min.z], [bb.max.x, bb.max.z], [bb.min.x, bb.max.z]].map(([x, z]) => new V(x, bb.max.y, z).applyMatrix4(I).toArray().map((n) => +n.toFixed(4)));
    }
  }
  return { rn, weak: L.weak, composer: !!L.composer, size: [r.domElement.width, r.domElement.height], fov: L.cam.fov, target: L.target.toArray(), hots, screenL, keys };
});
if (/swiftshader|llvmpipe|software|basic render|warp/i.test(info.rn)) throw new Error("captura exige GPU: " + info.rn);
if (info.weak || !info.composer) throw new Error("captura exige o pós ligado (máquina não-fraca)");
if (info.size[0] !== W || info.size[1] !== H) throw new Error("tamanho inesperado do canvas: " + info.size);
console.log("renderer:", info.rn);

const buf = (d) => Buffer.from(d.split(",")[1], "base64");
const webp = (png, file, q = 82) => sharp(png).webp({ quality: q, effort: 6, smartSubsample: true }).toFile(file);
const id = (i) => String(i).padStart(3, "0");
const azOf = (i) => -AZ + (i * 2 * AZ) / (N - 1);
const jobs = [];
const patches = [];

// intro (centro, luz night): o tempo corre para as ventoinhas chegarem à fase 0 no fim
for (let k = 0; k < INTRO_N; k++) {
  const t = k / INTRO_FPS, tEnd = (INTRO_N - 1) / INTRO_FPS;
  const png = await page.evaluate(([t, time]) => { window.__cap.set(0, t, 0, time); return window.__cap.png(); }, [t, T0 - (tEnd - t)]);
  jobs.push(webp(buf(png), path.join(OUT, "i", id(k) + ".webp"), 82));
}
console.log("intro ok");
for (let i = 0; i < N; i++) {
  const az = azOf(i);
  const png = await page.evaluate(([az, time]) => { window.__cap.set(az, 99, 0, time); return window.__cap.png(); }, [az, T0]);
  jobs.push(webp(buf(png), path.join(OUT, "n", id(i) + ".webp")));
  // fases 1..7 do ciclo RGB (a fase 0 é o próprio quadro)
  const strip = await page.evaluate(([az, T0, PHASES, PHASE_DUR]) => {
    const c = window.__cap; c.set(az, 99, 0, T0);
    const rc = c.caseRect(44); c.stripStart(rc[2], rc[3], PHASES - 1);
    for (let k = 1; k < PHASES; k++) { c.set(az, 99, 0, T0 + k * PHASE_DUR); c.stripAdd(k - 1, rc[0], rc[1], rc[2], rc[3], 26); }
    return { rc, png: c.stripPng() };
  }, [az, T0, PHASES, PHASE_DUR]);
  patches.push(strip.rc);
  jobs.push(sharp(buf(strip.png)).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toFile(path.join(OUT, "p", id(i) + ".webp")));
  const rit = await page.evaluate(([az, time]) => { window.__cap.set(az, 99, 1, time); return window.__cap.png(); }, [az, T0]);
  jobs.push(webp(buf(rit), path.join(OUT, "r", id(i) + ".webp")));
  if (i % 16 === 0) console.log("órbita", i + 1, "/", N);
}
// referências de calibração (não publicadas): tela esquerda em modo digitar / works
const refDir = path.resolve(OUT, "../../../qa/film-ref");
fs.mkdirSync(refDir, { recursive: true });
for (const m of ["type", "works"]) fs.writeFileSync(path.join(refDir, `left-${m}.png`), buf(await page.evaluate(([m, T0]) => { window.__cap.set(0, 99, 0, T0, m); return window.__cap.png(); }, [m, T0])));
await Promise.all(jobs);
const r4 = (a) => a.map((n) => +n.toFixed(4));
const hots = Object.fromEntries(Object.entries(info.hots).map(([k, h]) => [k, { c: r4(h.c), s: r4(h.s), top: +h.top.toFixed(4) }]));
fs.writeFileSync(path.join(OUT, "film.json"), JSON.stringify({ v: Date.now() % 1e9 | 0, w: W, h: H, fov: info.fov, R: 3, el: 0.26, azOff: 0.12, target: r4(info.target), n: N, az: AZ, intro: { n: INTRO_N, fps: INTRO_FPS }, phases: PHASES, phaseDur: PHASE_DUR, patches, hots, screenL: info.screenL.map(r4), keys: info.keys }));
await browser.close();
const size = (d) => fs.readdirSync(path.join(OUT, d)).reduce((a, f) => a + fs.statSync(path.join(OUT, d, f)).size, 0);
console.log("ok —", ["n", "r", "i", "p"].map((d) => `${d}: ${(size(d) / 1048576).toFixed(2)} MB`).join(" · "));
