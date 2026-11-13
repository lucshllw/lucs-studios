"use client";
// TRANSIÇÃO GENIE (proposals/finale/genie.html + nota de viabilidade): a página atual é "sugada" para o anel da intro.
// Snapshot = repintura rápida em canvas 2D do que está na viewport — o quadro atual do canvas WebGL do mundo (lido no
// mesmo quadro do render) + imagens/vídeos + texto (palavra a palavra, posição real via Range, estilo computado).
// Não é captura genérica de DOM (html2canvas/foreignObject custam 100–600 ms e falham com vídeo/WebGL).
// A malha do genie é desenhada em faixas num canvas 2D (sem segundo contexto WebGL).
import { addTick } from "@/lib/loop";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function visible(el: Element) {
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0.02;
}

/** repinta a viewport; null se algo impedir (o chamador usa o fallback) */
export function snapshot(): HTMLCanvasElement | null {
  const W = innerWidth;
  const H = innerHeight;
  const d = Math.min(devicePixelRatio || 1, 1.5);
  const c = document.createElement("canvas");
  c.width = Math.round(W * d);
  c.height = Math.round(H * d);
  const x = c.getContext("2d");
  if (!x) return null;
  x.setTransform(d, 0, 0, d, 0, 0);
  x.fillStyle = "#000";
  x.fillRect(0, 0, W, H);
  // com o Menu aberto, a "página atual" visível é o próprio Menu
  const menu = document.getElementById("site-menu");
  const menuOpen = !!menu && !menu.hidden;
  // etapa 6: só DOM, síncrono — a rota nova é pedida no mesmo quadro do clique (o quadro WebGL exigia esperar o
  // próximo render). O fundo 3D vira preto no lençol, que some em ~0,25 s.
  const main = menuOpen ? menu : document.getElementById("main");
  if (!main) return c;
  // 2) imagens e vídeos visíveis
  main.querySelectorAll<HTMLImageElement | HTMLVideoElement>("img, video").forEach((m) => {
    const r = m.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W || r.width < 4 || !visible(m)) return;
    const ready = m instanceof HTMLImageElement ? m.complete && m.naturalWidth > 0 : m.readyState >= 2;
    if (!ready) return;
    const iw = m instanceof HTMLImageElement ? m.naturalWidth : m.videoWidth;
    const ih = m instanceof HTMLImageElement ? m.naturalHeight : m.videoHeight;
    const cs = getComputedStyle(m);
    // object-fit: cover (o padrão do site) — recorte central
    const ir = iw / ih;
    const rr = r.width / r.height;
    let sw = iw;
    let sh = ih;
    if (cs.objectFit === "cover") {
      if (ir > rr) sw = ih * rr;
      else sh = iw / rr;
    }
    x.save();
    x.globalAlpha = parseFloat(cs.opacity) || 1;
    const rad = parseFloat(cs.borderTopLeftRadius) || 0;
    x.beginPath();
    x.roundRect(r.left, r.top, r.width, r.height, rad);
    x.clip();
    try {
      x.drawImage(m, (iw - sw) / 2, (ih - sh) / 2, sw, sh, r.left, r.top, r.width, r.height);
    } catch {
      /* cross-origin */
    }
    x.restore();
  });
  // 3) texto, palavra a palavra (limite para manter o custo em poucos ms)
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const tEnd = performance.now() + 14; // orçamento: a repintura nunca segura o quadro do clique

  const range = document.createRange();
  let words = 0;
  const styleCache = new Map<Element, CSSStyleDeclaration | null>();
  for (let n = walker.nextNode() as Text | null; n && words < 2500 && performance.now() < tEnd; n = walker.nextNode() as Text | null) {
    const txt = n.data;
    if (!txt.trim()) continue;
    const p = n.parentElement;
    if (!p) continue;
    let cs = styleCache.get(p);
    if (cs === undefined) {
      const pr = p.getBoundingClientRect();
      cs = pr.bottom < 0 || pr.top > H || pr.width === 0 || !visible(p) || p.closest(".sr-only") ? null : getComputedStyle(p);
      styleCache.set(p, cs);
    }
    if (!cs) continue;
    x.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    x.fillStyle = cs.color;
    x.globalAlpha = Math.min(1, parseFloat(cs.opacity) || 1);
    try {
      (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    } catch {
      /* navegador sem letterSpacing */
    }
    const up = cs.textTransform === "uppercase";
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt)) && words < 2500) {
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.bottom < 0 || r.top > H) continue;
      const word = up ? m[0].toUpperCase() : m[0];
      const mt = x.measureText(word);
      const asc = mt.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
      const desc = mt.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.2;
      x.fillText(word, r.left, r.top + (r.height - (asc + desc)) / 2 + asc);
      words++;
    }
  }
  x.globalAlpha = 1;
  return c;
}

/** suga o snapshot para (cx, cy) em `dur` ms; resolve ao terminar */
export function runGenie(snap: HTMLCanvasElement, cx: number, cy: number, dur = 520): Promise<void> {
  const W = innerWidth;
  const H = innerHeight;
  const cv = document.createElement("canvas");
  const d = snap.width / W;
  cv.width = snap.width;
  cv.height = snap.height;
  cv.className = "genie";
  cv.setAttribute("aria-hidden", "true");
  document.body.appendChild(cv);
  const x = cv.getContext("2d")!;
  x.setTransform(d, 0, 0, d, 0, 0);
  x.imageSmoothingEnabled = true;
  const N = 64;
  const rowH = H / N;
  return new Promise((res) => {
    const t0 = performance.now();
    let stop: () => void = () => {};
    const frame = () => {
      const now = performance.now();
      const k = Math.min(1, (now - t0) / dur);
      const p = k * k * (3 - 2 * k) * 0.35 + k * k * 0.65; // acelera para dentro do anel
      x.clearRect(0, 0, W, H);
      const ty = Math.pow(smooth(0.18, 1, p), 1.6);
      const a = 1 - smooth(0.82, 1, p);
      x.globalAlpha = a;
      for (let i = 0; i < N; i++) {
        const y0 = i * rowH;
        const yc0 = y0 + rowH / 2;
        const dist = Math.abs(yc0 - cy) / H;
        const sq = smooth(0, 0.75, p * 1.45 - dist * 0.55);
        const wk = 1 + (0.02 - 1) * sq;
        const xc = W / 2 + (cx - W / 2) * sq;
        const yc = yc0 + (cy - yc0) * ty;
        const h = rowH * (1 + (0.04 - 1) * ty) + 0.6;
        x.drawImage(snap, 0, y0 * d, snap.width, rowH * d + 1, xc - (W * wk) / 2, yc - h / 2, W * wk, h);
      }
      if (k >= 1) {
        stop();
        cv.remove();
        res();
      }
    };
    // pinta o 1º quadro já (cobre a página antes de qualquer troca); depois segue no ticker único
    x.drawImage(snap, 0, 0, W, H);
    stop = addTick(frame);
  });
}
