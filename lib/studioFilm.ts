"use client";
// 26/11 — MODO FILME do Studio (sem aceleração de hardware / WebGL por software), no mesmo princípio do site do Aizawa:
// a cena 3D real (StudioLayer + pós) é gravada com GPU por scripts/film-capture.mjs e tocada aqui em canvas 2D.
//  · órbita: 97 quadros (arrastar / paralaxe do mouse), com mistura entre vizinhos; luz "night" e "ritual" (lâmpada)
//  · intro: 85 quadros (escuridão → LEDs → ventoinhas → teclado → telas → luminária, com o recuo da câmera)
//  · ciclo RGB das ventoinhas: 7 fases por posição, recortadas com borda em alfa e misturadas no tempo
//  · hotspots: mesmas caixas da cena (raio × caixa), rótulo projetado, retângulo do monitor para o reel
//  · monitor esquerdo (digitar / Works): o mesmo desenho da cena (studioScreens) em perspectiva (matrix3d) por cima
//  · teclas que acendem ao digitar: quadriláteros projetados
// Decodificação fora da thread principal (worker) com cache LRU; nada é desenhado sob menu/reel/perfil ou aba oculta.
import { addTick } from "@/lib/loop";
import { cover as introCover, ui } from "@/lib/store";
import { HOT_LABEL, type HotId, type StudioEls } from "@/lib/world/StudioLayer";
import { drawLeftScreen } from "@/lib/world/studioScreens";

type V3 = [number, number, number];
type Manifest = {
  v: number; w: number; h: number; fov: number; R: number; el: number; azOff: number; target: V3; n: number; az: number;
  intro: { n: number; fps: number }; phases: number; phaseDur: number; patches: [number, number, number, number][];
  hots: Record<HotId, { c: V3; s: V3; top: number }>; screenL: V3[]; keys: Record<string, V3[]>;
};
const BASE = "/studio/film/";
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// ------------------------------------------------------------------ armazém (download priorizado + worker + LRU)
const WORKER = `self.onmessage=async e=>{const d=e.data;try{const bm=await createImageBitmap(d.blob,d.w>0?{resizeWidth:d.w,resizeHeight:d.h,resizeQuality:"medium"}:{});self.postMessage({id:d.id,bm},[bm])}catch(err){self.postMessage({id:d.id,err:String(err)})}}`;
/** blobs (comprimidos) sobrevivem à troca de página: voltar ao Studio não baixa de novo */
const BLOBS = new Map<string, Blob>();
let MANIFEST: Promise<Manifest> | null = null;

class Store {
  private pending = new Map<string, Promise<Blob>>();
  private queue: { k: string; go: () => void }[] = [];
  private active = 0;
  private bms = new Map<string, { bm: ImageBitmap; w: number }>();
  private decoding = new Map<string, number>();
  private waits = new Map<number, { k: string; w: number }>();
  private workers: Worker[] = [];
  private rr = 0;
  private seq = 0;
  private url = "";
  max = 14;
  onArrive: () => void = () => {};
  constructor(private v: number) {
    try {
      this.url = URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" }));
      const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 2));
      for (let i = 0; i < n; i++) {
        const w = new Worker(this.url);
        w.onmessage = (e: MessageEvent<{ id: number; bm?: ImageBitmap }>) => this.decoded(e.data.id, e.data.bm);
        this.workers.push(w);
      }
    } catch {
      /* sem worker: decodifica na thread principal */
    }
  }
  private decoded(id: number, bm?: ImageBitmap) {
    const req = this.waits.get(id);
    this.waits.delete(id);
    if (!req) return void bm?.close();
    if (this.decoding.get(req.k) === id) this.decoding.delete(req.k);
    if (!bm) return;
    this.bms.get(req.k)?.bm.close();
    this.bms.set(req.k, { bm, w: req.w });
    this.prune();
    this.onArrive();
  }
  has(k: string) {
    return BLOBS.has(k);
  }
  fetch(k: string, urgent = false): Promise<Blob> {
    const b = BLOBS.get(k);
    if (b) return Promise.resolve(b);
    const p0 = this.pending.get(k);
    if (p0) {
      if (urgent) {
        const i = this.queue.findIndex((q) => q.k === k);
        if (i > 0) this.queue.unshift(this.queue.splice(i, 1)[0]);
      }
      return p0;
    }
    const p = new Promise<Blob>((res, rej) => {
      const go = () => {
        this.active++;
        fetch(`${BASE}${k}.webp?v=${this.v}`)
          .then((r) => {
            if (!r.ok) throw new Error(`${k}: HTTP ${r.status}`);
            return r.blob();
          })
          .then(
            (bl) => {
              BLOBS.set(k, bl);
              res(bl);
              this.onArrive();
            },
            (e) => rej(e)
          )
          .finally(() => {
            this.active--;
            this.pending.delete(k);
            this.pump();
          });
      };
      if (urgent) this.queue.unshift({ k, go });
      else this.queue.push({ k, go });
    });
    p.catch(() => {});
    this.pending.set(k, p);
    this.pump();
    return p;
  }
  private pump() {
    while (this.active < 6 && this.queue.length) this.queue.shift()!.go();
  }
  /** bitmap decodificado com a largura w (0 = nativo); agenda a decodificação se faltar */
  want(k: string, w: number, h: number): ImageBitmap | null {
    const q = this.bms.get(k);
    if (q && q.w === w) {
      this.bms.delete(k);
      this.bms.set(k, q); // LRU: mais recente no fim
      return q.bm;
    }
    if (!this.decoding.has(k)) {
      const id = ++this.seq;
      this.decoding.set(k, id);
      this.waits.set(id, { k, w });
      this.fetch(k, true).then(
        (blob) => {
          if (this.decoding.get(k) !== id) return;
          if (this.workers.length) this.workers[this.rr++ % this.workers.length].postMessage({ id, blob, w, h });
          else createImageBitmap(blob, w > 0 ? { resizeWidth: w, resizeHeight: h, resizeQuality: "medium" } : {}).then((bm) => this.decoded(id, bm), () => this.decoded(id));
        },
        () => {
          this.decoding.delete(k);
          this.waits.delete(id);
        }
      );
    }
    return q?.bm ?? null; // escala antiga serve até a nova chegar
  }
  /** o decodificado mais próximo de idx no grupo (para nunca mostrar vazio) */
  near(group: string, idx: number, n: number): ImageBitmap | null {
    for (let d = 0; d < n; d++) {
      for (const i of d ? [idx - d, idx + d] : [idx]) {
        if (i < 0 || i >= n) continue;
        const q = this.bms.get(`${group}/${String(i).padStart(3, "0")}`);
        if (q) return q.bm;
      }
    }
    return null;
  }
  private prune() {
    let n = this.bms.size;
    for (const [k, q] of this.bms) {
      if (n <= this.max) break;
      q.bm.close();
      this.bms.delete(k);
      n--;
    }
  }
  flush() {
    for (const q of this.bms.values()) q.bm.close();
    this.bms.clear();
    this.decoding.clear();
    this.waits.clear();
  }
  dispose() {
    this.flush();
    this.workers.forEach((w) => w.terminate());
    if (this.url) URL.revokeObjectURL(this.url);
    this.queue = [];
  }
}

/** homografia retângulo (0,0,w,h) → 4 pontos de tela, como matrix3d do CSS */
function homography(w: number, h: number, d: [number, number][]) {
  const s: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = s[i], [X, Y] = d[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const pv = A[c][c] || 1e-12;
    for (let k = c; k < 9; k++) A[c][k] /= pv;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (f) for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const [a, b, c, dd, e, f, g, hh] = A.map((r) => r[8]);
  return `matrix3d(${a},${dd},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}

export class StudioFilm {
  els: StudioEls | null = null;
  reduced: boolean;
  ok = true;
  private cv = document.createElement("canvas");
  private g: CanvasRenderingContext2D;
  private left = document.createElement("canvas");
  private lx: CanvasRenderingContext2D;
  private grain = document.createElement("div");
  private store: Store | null = null;
  private M: Manifest | null = null;
  private untick: () => void;
  private alive = true;
  // tela
  private vw = 1;
  private vh = 1;
  private dpr = 1;
  private s = 1; // px de tela por px do quadro
  private ox = 0;
  private oy = 0;
  private decW = 0;
  private decH = 0;
  // estado (espelha o StudioLayer)
  P = { x: 0, y: 0, nx: 0.5, ny: 0.5, in: false, down: false, dx: 0, dy: 0, moved: 0, type: "mouse" };
  private az = 0;
  private pol = 0;
  private azS = 0;
  private polS = 0;
  private t = -1; // tempo da intro (-1 = ainda não começou)
  private introReady = false;
  private clock = 0; // relógio das fases RGB
  private fanBoost = 0;
  ritual = 0;
  private ritualT = 0;
  private hover: HotId | null = null;
  leftMode: "chat" | "works" | "type" = "chat";
  private typed = "";
  private worksT = 0;
  private caps: HTMLImageElement[] = [];
  private names: string[];
  private heat = new Map<string, number>();
  private dirty = true;
  private lastDraw = 0;
  private leftKey = "";
  private grainT = 0;
  private lut: Uint8ClampedArray | null = null;
  private onResize = () => this.resize();

  constructor(stage: HTMLElement, opts: { reduced: boolean; captures: string[]; names: string[] }) {
    this.reduced = opts.reduced;
    this.names = opts.names;
    this.cv.className = "st-film";
    this.g = this.cv.getContext("2d", { alpha: false })!;
    this.left.className = "st-film-left";
    this.left.width = 1024;
    this.left.height = 576;
    this.lx = this.left.getContext("2d", { willReadFrequently: true })!;
    this.grain.className = "st-film-grain";
    stage.append(this.cv, this.left, this.grain);
    opts.captures.forEach((src, i) => {
      const im = new Image();
      im.src = src;
      im.onload = () => void (this.caps[i] = im);
    });
    this.makeGrain();
    window.addEventListener("resize", this.onResize);
    this.untick = addTick((time, dt) => this.update(time, dt));
    MANIFEST ??= fetch(`${BASE}film.json`).then((r) => {
      if (!r.ok) throw new Error("film.json: HTTP " + r.status);
      return r.json() as Promise<Manifest>;
    });
    MANIFEST.then(
      (m) => this.alive && this.start(m),
      () => {
        MANIFEST = null;
        this.ok = false;
        this.els?.onStatus("The studio scene could not be loaded");
        this.els?.loader.classList.add("done");
        window.dispatchEvent(new Event("rito:ready"));
      }
    );
  }

  private key(group: string, i: number) {
    return `${group}/${String(i).padStart(3, "0")}`;
  }
  private start(m: Manifest) {
    this.M = m;
    this.store = new Store(m.v);
    this.store.onArrive = () => (this.dirty = true);
    this.resize();
    const st = this.store;
    const mid = (m.n - 1) >> 1;
    // 1º: o quadro central + a intro (a barra mostra esse progresso); depois a órbita do centro para fora, as fases
    // RGB e por último a luz "ritual"
    const first: string[] = [this.key("n", mid)];
    if (!this.reduced) for (let i = 0; i < m.intro.n; i++) first.push(this.key("i", i));
    let got = 0;
    const tick = () => {
      got++;
      const p = got / first.length;
      if (this.els) {
        this.els.bar.style.transform = `scaleX(${p})`;
        this.els.barText.textContent = `Scene · ${Math.round(p * 100)}%`;
      }
    };
    const ready = () => {
      if (!this.alive || this.introReady) return;
      this.introReady = true;
      this.els?.loader.classList.add("done");
      this.els?.onLoaded();
      window.dispatchEvent(new Event("rito:ready"));
      this.dirty = true;
    };
    Promise.all(first.map((k) => st.fetch(k).then(tick))).then(ready, ready);
    window.setTimeout(ready, 9000); // rede muito lenta: segue com o que já chegou
    const order: number[] = [mid];
    for (let d = 1; d <= mid; d++) order.push(mid - d, mid + d);
    order.forEach((i) => void st.fetch(this.key("n", i)));
    if (!this.reduced) order.forEach((i) => void st.fetch(this.key("p", i)));
    order.forEach((i) => void st.fetch(this.key("r", i)));
  }

  private resize() {
    const m = this.M;
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    if (!m) return;
    // sem GPU cada pixel custa: nunca acima da resolução dos quadros
    this.dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, m.w / this.vw), 1.5);
    this.cv.width = Math.round(this.vw * this.dpr);
    this.cv.height = Math.round(this.vh * this.dpr);
    this.s = Math.max(this.vw / m.w, this.vh / m.h) * 1.03; // 3 % de sobra para a inclinação vertical
    this.ox = (this.vw - m.w * this.s) / 2;
    this.oy = (this.vh - m.h * this.s) / 2;
    const k = this.s * this.dpr;
    const w = k >= 0.999 ? 0 : Math.round(m.w * k);
    if (w !== this.decW) this.store?.flush();
    this.decW = w;
    this.decH = k >= 0.999 ? 0 : Math.round(m.h * k);
    this.store && (this.store.max = this.vw * this.vh > 2.4e6 ? 10 : 14);
    this.dirty = true;
    this.leftKey = "";
  }

  // ---------- câmera / projeção (mesma conta do StudioLayer) ----------
  private camAz = NaN;
  private cam = { p: [0, 0, 0] as V3, f: [0, 0, 1] as V3, r: [1, 0, 0] as V3, u: [0, 1, 0] as V3, th: 1, asp: 1 };
  private camera(az: number) {
    const m = this.M!;
    if (az === this.camAz) return this.cam;
    this.camAz = az;
    const c = this.cam;
    const a = az + m.azOff;
    c.p = [m.target[0] + Math.sin(a) * Math.cos(m.el) * m.R, m.target[1] + Math.sin(m.el) * m.R, m.target[2] + Math.cos(a) * Math.cos(m.el) * m.R];
    c.f = norm(sub(m.target, c.p));
    c.r = norm(cross(c.f, [0, 1, 0]));
    c.u = cross(c.r, c.f);
    c.th = Math.tan((m.fov * Math.PI) / 360);
    c.asp = m.w / m.h;
    return c;
  }
  private tilt() {
    return this.polS * 95 * this.s;
  }
  /** mundo → px de tela */
  private project(X: V3): [number, number] | null {
    const m = this.M!;
    const c = this.camera(this.azS);
    const d = sub(X, c.p);
    const z = dot(d, c.f);
    if (z < 0.02) return null;
    const fx = ((dot(d, c.r) / (z * c.th * c.asp)) * 0.5 + 0.5) * m.w;
    const fy = ((-dot(d, c.u) / (z * c.th)) * 0.5 + 0.5) * m.h;
    return [this.ox + fx * this.s, this.oy + fy * this.s + this.tilt()];
  }
  private corners(id: HotId): V3[] {
    const h = this.M!.hots[id];
    const o: V3[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) o.push([h.c[0] + (sx * h.s[0]) / 2, h.c[1] + (sy * h.s[1]) / 2, h.c[2] + (sz * h.s[2]) / 2]);
    return o;
  }
  /** retângulo em px de um objeto (o player do reel nasce do monitor) */
  rectOf(id: HotId) {
    if (!this.M?.hots[id]) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.corners(id)) {
      const p = this.project(c);
      if (!p) continue;
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  /** raio do ponteiro × caixas dos hotspots (a mais próxima vence, como o Raycaster) */
  private pick(): HotId | null {
    const m = this.M;
    if (!m || this.t < 2.8) return null;
    const c = this.camera(this.azS);
    const fx = (this.P.x - this.ox) / this.s;
    const fy = (this.P.y - this.oy - this.tilt()) / this.s;
    const nx = (fx / m.w) * 2 - 1;
    const ny = -((fy / m.h) * 2 - 1);
    const d = norm([
      c.f[0] + c.r[0] * nx * c.th * c.asp + c.u[0] * ny * c.th,
      c.f[1] + c.r[1] * nx * c.th * c.asp + c.u[1] * ny * c.th,
      c.f[2] + c.r[2] * nx * c.th * c.asp + c.u[2] * ny * c.th,
    ]);
    let best: HotId | null = null;
    let bt = Infinity;
    for (const id of Object.keys(m.hots) as HotId[]) {
      const h = m.hots[id];
      let t0 = 0, t1 = Infinity;
      for (let a = 0; a < 3; a++) {
        const lo = h.c[a] - h.s[a] / 2, hi = h.c[a] + h.s[a] / 2;
        if (Math.abs(d[a]) < 1e-9) {
          if (c.p[a] < lo || c.p[a] > hi) t1 = -1;
          continue;
        }
        let ta = (lo - c.p[a]) / d[a], tb = (hi - c.p[a]) / d[a];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
      }
      if (t1 >= t0 && t0 < bt) {
        bt = t0;
        best = id;
      }
    }
    return best;
  }

  // ---------- ações / entrada (mesma interface do StudioLayer) ----------
  act(id: HotId) {
    if (id === "works") {
      this.leftMode = "works";
      this.worksT = 0;
    } else if (id === "keyboard") this.leftMode = "type";
    else if (id === "case") this.fanBoost = 1;
    else if (id === "lamp") {
      this.ritual = this.ritual ? 0 : 1;
      this.els?.onStatus(this.ritual ? "Lighting: ember ritual" : "Lighting: purple night");
    }
    this.dirty = true;
    this.els?.onAction(id, id === "reel" || id === "works" ? this.rectOf(id) : null);
  }
  exitType() {
    if (this.leftMode !== "chat") this.leftMode = "chat";
    this.dirty = true;
  }
  type(ch: string) {
    if (ch === "\b") this.typed = this.typed.slice(0, -1);
    else {
      this.typed = (this.typed + ch).slice(-400);
      const k = ch.toLowerCase();
      if (this.M?.keys[k]) this.heat.set(k, 1);
    }
    this.dirty = true;
  }
  pointerMove(x: number, y: number, type: string) {
    const P = this.P;
    const dx = x - P.x, dy = y - P.y;
    Object.assign(P, { x, y, nx: x / innerWidth, ny: y / innerHeight, in: true, type });
    if (P.down) {
      P.dx += dx;
      P.dy += dy;
      P.moved += Math.abs(dx) + Math.abs(dy);
    }
  }
  pointerDown(x: number, y: number, type: string) {
    Object.assign(this.P, { x, y, nx: x / innerWidth, ny: y / innerHeight, down: true, moved: 0, in: true, type });
  }
  pointerUp(type: string) {
    const P = this.P;
    P.down = false;
    let h: HotId | null = null;
    if (P.moved < 8) {
      h = this.pick();
      if (type !== "mouse") this.hover = h;
      if (h) this.act(h);
    }
    if (type !== "mouse") P.in = false;
    return h;
  }
  pointerLeave() {
    this.P.in = false;
  }
  cursor() {
    return this.hover ? "pointer" : this.P.down && this.P.moved > 8 ? "grabbing" : "grab";
  }

  // ---------- loop ----------
  private update(time: number, dt: number) {
    const m = this.M;
    const st = this.store;
    if (!m || !st || !this.alive) return;
    const u = ui.get();
    if (document.hidden || u.menu || u.reel || u.profile || introCover.on) return;
    const red = this.reduced;
    if (this.introReady) {
      if (this.t < 0) this.t = red ? 99 : 0;
      else this.t += dt;
    }
    const intro = this.t >= 0 && this.t < (m.intro.n - 1) / m.intro.fps;
    const P = this.P;
    const touch = P.type !== "mouse";
    if (P.down && P.moved > 8) {
      this.az = clamp(this.az - P.dx * 0.004, -0.38, 0.38);
      this.pol = clamp(this.pol + P.dy * 0.003, -0.12, 0.16);
    }
    P.dx = P.dy = 0;
    const par = P.in && !touch ? (P.nx - 0.5) * 0.07 : 0;
    const parY = P.in && !touch ? (P.ny - 0.5) * 0.04 : 0;
    const k = red ? 1 : 1 - Math.pow(0.93, dt * 60); // mesmo amortecimento (0,07 por quadro a 60 Hz)
    const a0 = this.azS, p0 = this.polS;
    if (intro) {
      this.azS = 0;
      this.polS = 0;
    } else {
      this.azS += (this.az + par - this.azS) * k;
      this.polS += (this.pol + parY - this.polS) * k;
    }
    const moving = Math.abs(this.azS - a0) > 1e-5 || Math.abs(this.polS - p0) > 1e-5;
    const r0 = this.ritualT;
    this.ritualT += (this.ritual - this.ritualT) * (red ? 1 : Math.min(1, dt * 3));
    if (Math.abs(this.ritual - this.ritualT) < 0.002) this.ritualT = this.ritual;
    this.fanBoost = Math.max(0, this.fanBoost - dt * 0.25);
    if (!red && !intro && this.t >= 0) this.clock += dt * (1 + this.fanBoost * 5);
    let heatOn = false;
    for (const [c, v] of this.heat) {
      const n = red ? 0 : v - dt * 2.2;
      if (n <= 0) this.heat.delete(c);
      else this.heat.set(c, n);
      heatOn = true;
    }
    if (this.leftMode === "works") this.worksT += dt;
    // hover + rótulo
    const h = P.in && !P.down ? this.pick() : touch ? this.hover : null;
    if (h !== this.hover) this.hover = h;
    const lbl = this.els?.label;
    if (lbl) {
      const hot = this.hover && m.hots[this.hover];
      const p = hot ? this.project([hot.c[0], hot.c[1] + hot.top + 0.02, hot.c[2]]) : null;
      if (hot && p) {
        lbl.textContent = HOT_LABEL[this.hover!];
        lbl.style.transform = `translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px) translate(-50%,-130%)`;
        lbl.classList.add("on");
      } else lbl.classList.remove("on");
    }
    this.syncLeft(time);
    // grão vivo (camada CSS barata): ~12 passos/s
    if (!red && time - this.grainT > 0.085) {
      this.grainT = time;
      this.grain.style.backgroundPosition = `${(Math.random() * 128) | 0}px ${(Math.random() * 128) | 0}px`;
    }
    // desenho: sempre que algo muda; parado, as fases RGB pedem ~20 quadros/s (na luz "ritual" o anel é fixo)
    const rgb = !red && !intro && this.t >= 0 && this.ritualT < 0.999;
    const changed = this.dirty || intro || moving || r0 !== this.ritualT || heatOn;
    if (!changed && !(rgb && time - this.lastDraw > 0.05)) return;
    this.lastDraw = time;
    this.dirty = false;
    this.draw(intro);
  }

  private frame(group: string, i: number, n: number) {
    const st = this.store!;
    return st.want(this.key(group, i), this.decW, this.decH) ?? st.near(group, i, n);
  }
  private blit(bm: ImageBitmap, alpha: number) {
    const m = this.M!;
    const g = this.g;
    g.globalAlpha = alpha;
    g.drawImage(bm, this.ox * this.dpr, (this.oy + this.tilt()) * this.dpr, m.w * this.s * this.dpr, m.h * this.s * this.dpr);
  }
  private draw(intro: boolean) {
    const m = this.M!;
    const st = this.store!;
    const g = this.g;
    g.globalAlpha = 1;
    g.fillStyle = "#020104";
    g.fillRect(0, 0, this.cv.width, this.cv.height);
    if (this.t < 0) return; // ainda carregando: palco escuro (como a cena antes do GLB)
    if (intro) {
      const f = this.t * m.intro.fps;
      const i = Math.min(m.intro.n - 1, Math.floor(f));
      const a = this.frame("i", i, m.intro.n);
      if (a) this.blit(a, 1);
      const b = i + 1 < m.intro.n ? st.want(this.key("i", i + 1), this.decW, this.decH) : null;
      if (a && b && f - i > 0.02) this.blit(b, f - i);
      for (let d = 2; d <= 5; d++) if (i + d < m.intro.n) st.want(this.key("i", i + d), this.decW, this.decH); // decodifica à frente
      st.want(this.key("n", (m.n - 1) >> 1), this.decW, this.decH);
      g.globalAlpha = 1;
      return;
    }
    const f = clamp((this.azS + m.az) / (2 * m.az)) * (m.n - 1);
    const i0 = Math.min(m.n - 1, Math.floor(f));
    const a = f - i0;
    const i1 = Math.min(m.n - 1, i0 + 1);
    const night = this.ritualT < 0.999;
    if (night) {
      const A = this.frame("n", i0, m.n);
      if (A) this.blit(A, 1);
      const B = a > 0.02 && i1 !== i0 ? st.want(this.key("n", i1), this.decW, this.decH) : null;
      if (A && B) this.blit(B, a);
      // fases RGB das ventoinhas (posição mais próxima), misturadas no tempo
      if (!this.reduced) {
        const j = Math.round(f);
        const strip = st.want(this.key("p", j), 0, 0);
        const rc = m.patches[j];
        if (strip && rc) {
          const ph = (this.clock / m.phaseDur) % m.phases;
          const k0 = Math.floor(ph);
          const b = ph - k0;
          const k1 = (k0 + 1) % m.phases;
          const put = (k: number, alpha: number) => {
            if (k < 1 || alpha <= 0.004) return; // a fase 0 é o próprio quadro
            g.globalAlpha = alpha;
            g.drawImage(strip, (k - 1) * rc[2], 0, rc[2], rc[3], (this.ox + rc[0] * this.s) * this.dpr, (this.oy + rc[1] * this.s + this.tilt()) * this.dpr, rc[2] * this.s * this.dpr, rc[3] * this.s * this.dpr);
          };
          if (k1 === 0) put(k0, 1 - b);
          else {
            put(k0, 1);
            put(k1, b);
          }
        }
      }
    }
    if (this.ritualT > 0.001) {
      const A = this.frame("r", i0, m.n);
      if (A) this.blit(A, night ? this.ritualT : 1);
      const B = a > 0.02 && i1 !== i0 ? st.want(this.key("r", i1), this.decW, this.decH) : null;
      if (A && B) this.blit(B, a * (night ? this.ritualT : 1));
    }
    // vizinhos já decodificados para o próximo movimento
    for (const d of [-2, -1, 2, 3]) {
      const i = i0 + d;
      if (i >= 0 && i < m.n) st.want(this.key(this.ritual ? "r" : "n", i), this.decW, this.decH);
    }
    // teclas acesas
    if (this.heat.size) {
      g.globalCompositeOperation = "lighter";
      for (const [c, v] of this.heat) {
        const q = m.keys[c]?.map((p) => this.project(p));
        if (!q || q.some((p) => !p)) continue;
        g.globalAlpha = Math.min(1, v) * 0.85;
        g.fillStyle = this.ritualT > 0.5 ? "#ffb0a8" : "#d8fff0";
        g.beginPath();
        q.forEach((p, n) => (n ? g.lineTo(p![0] * this.dpr, p![1] * this.dpr) : g.moveTo(p![0] * this.dpr, p![1] * this.dpr)));
        g.closePath();
        g.fill();
      }
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
  }

  // ---------- monitor esquerdo ao vivo (digitar / Works / texto já digitado) ----------
  /** tom da tela na cena: sRGB → linear × emissivo 0,62 × exposição 1,1 (÷0,6 do ACES do three) → ACES → sRGB.
   *  Conferido com a captura (qa/film-ref): cinza 207 → 186 medido, 187 calculado. */
  private tone() {
    if (this.lut) return this.lut;
    const l = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      const c = v / 255;
      const x = (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)) * 0.62 * (1.1 / 0.6);
      const y = clamp((x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081));
      l[v] = (y <= 0.0031308 ? y * 12.92 : 1.055 * Math.pow(y, 1 / 2.4) - 0.055) * 255;
    }
    return (this.lut = l);
  }
  private syncLeft(time: number) {
    const m = this.M!;
    const live = this.t >= 2.8 && (this.leftMode !== "chat" || this.typed !== "");
    if (!live) {
      if (this.leftKey !== "off") {
        this.left.style.opacity = "0";
        this.leftKey = "off";
      }
      return;
    }
    const blink = this.leftMode === "type" ? (performance.now() / 500) | 0 : 0;
    const key = `${this.leftMode}|${this.typed}|${blink}|${this.leftMode === "works" ? Math.round(time * 30) : 0}`;
    if (key !== this.leftKey) {
      this.leftKey = key;
      drawLeftScreen(this.lx, 1, { mode: this.leftMode, typed: this.typed, worksT: this.worksT, caps: this.caps, names: this.names });
      this.lx.setTransform(1, 0, 0, 1, 0, 0);
      try {
        const id = this.lx.getImageData(0, 0, 1024, 576);
        const d = id.data, l = this.tone();
        for (let i = 0; i < d.length; i += 4) {
          d[i] = l[d[i]];
          d[i + 1] = l[d[i + 1]];
          d[i + 2] = l[d[i + 2]];
        }
        this.lx.putImageData(id, 0, 0);
      } catch {
        /* capturas de outro domínio: sem correção de tom */
      }
      this.left.style.opacity = "1";
    }
    const q = m.screenL.map((p) => this.project(p));
    if (q.every(Boolean)) this.left.style.transform = homography(1024, 576, q as [number, number][]);
  }

  private makeGrain() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const id = x.createImageData(128, 128);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.random();
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v > 0.5 ? 255 : 0;
      id.data[i + 3] = Math.abs(v - 0.5) * 2 * 6; // ±0,011 da cena ≈ alfa até ~2 %
    }
    x.putImageData(id, 0, 0);
    this.grain.style.backgroundImage = `url(${c.toDataURL()})`;
  }

  dispose() {
    this.alive = false;
    this.untick();
    window.removeEventListener("resize", this.onResize);
    this.store?.dispose();
    this.els?.label.classList.remove("on");
    this.cv.remove();
    this.left.remove();
    this.grain.remove();
  }
}
