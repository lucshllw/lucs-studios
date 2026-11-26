"use client";
// 26/11 — Lab sem WebGL (aceleração de hardware desligada / WebGL por software): as 4 relíquias em Canvas 2D,
// leves o bastante para a CPU (≤ 30 quadros/s, pausa fora de foco e sob menu/reel/perfil).
// Orb (esfera de pontos que o ponteiro puxa) · Cloth (Verlet, puxão forte rasga) · Ember (partículas formam a palavra
// digitada) · Fluid (rastro de brasas que segue o ponteiro). Antes só existia o Orb e os botões ficavam desativados.
import { addTick } from "@/lib/loop";
import { ui } from "@/lib/store";

export type Lab2D = { set(i: number): void; destroy(): void };

const RED = "255,42,42";
const WHITE = "235,235,235";

export function createLab2D(host: HTMLElement, reduced: boolean): Lab2D {
  const c = document.createElement("canvas");
  c.className = "m2-lab";
  c.setAttribute("aria-hidden", "true");
  host.prepend(c);
  const g = c.getContext("2d")!;
  let w = 0;
  let h = 0;
  let mode = 0;
  const narrow = () => innerWidth < 768;
  const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, px: -1, py: -1, vx: 0, vy: 0, down: false, pulse: 0, moved: false };

  // ---------- Orb ----------
  const N = narrow() ? 420 : 900;
  const orbP = Array.from({ length: N }, (_, i) => {
    const yy = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - yy * yy);
    const th = i * 2.399963;
    return { x: Math.cos(th) * r, y: yy, z: Math.sin(th) * r, n: Math.random() };
  });
  function orb(t: number) {
    g.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * (0.24 + ptr.pulse * 0.05);
    const cx = w / 2 + (ptr.x - 0.5) * w * 0.18;
    const cy = h * 0.46 + (ptr.y - 0.5) * h * 0.14;
    const ay = t * 0.25 + (ptr.x - 0.5) * 1.2;
    const ax = (ptr.y - 0.5) * 0.8;
    const ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
    for (const p of orbP) {
      const noise = 1 + Math.sin(t * 1.6 + p.n * 12 + p.y * 4) * 0.08 + ptr.pulse * 0.25 * Math.sin(p.n * 40);
      let x = p.x * ca - p.z * sa;
      let z = p.x * sa + p.z * ca;
      const y = p.y * cb - z * sb;
      z = p.y * sb + z * cb;
      x *= noise;
      const k = 1.6 / (2.6 - z);
      const a = 0.25 + (z + 1) * 0.35;
      g.fillStyle = `rgba(${z > 0.55 && p.n < 0.3 ? RED : WHITE},${a})`;
      const s = 1 + (z + 1) * 0.8;
      g.fillRect(cx + x * R * k, cy + y * R * noise * k, s, s);
    }
  }

  // ---------- Cloth (Verlet) ----------
  type Pt = { x: number; y: number; ox: number; oy: number; pin: boolean };
  type St = { a: Pt; b: Pt; len: number };
  let pts: Pt[] = [];
  let sts: St[] = [];
  let grab: Pt | null = null;
  function clothInit() {
    const cols = narrow() ? 14 : 22;
    const rows = narrow() ? 16 : 14;
    // o pano termina acima do título da relíquia (≈ 60 % da altura)
    const sp = Math.min(Math.min(w * (narrow() ? 0.86 : 0.5), 720) / (cols - 1), (h * 0.42) / (rows - 1));
    const span = sp * (cols - 1);
    const x0 = (w - span) / 2;
    const y0 = h * 0.16;
    pts = [];
    sts = [];
    for (let r = 0; r < rows; r++)
      for (let q = 0; q < cols; q++) {
        const x = x0 + q * sp;
        const y = y0 + r * sp;
        pts.push({ x, y, ox: x, oy: y, pin: r === 0 && q % 3 === 0 });
      }
    for (let r = 0; r < rows; r++)
      for (let q = 0; q < cols; q++) {
        const p = pts[r * cols + q];
        if (q < cols - 1) sts.push({ a: p, b: pts[r * cols + q + 1], len: sp });
        if (r < rows - 1) sts.push({ a: p, b: pts[(r + 1) * cols + q], len: sp });
      }
  }
  function cloth(dt: number) {
    const mx = ptr.x * w;
    const my = ptr.y * h;
    if (ptr.down && !grab) {
      let best = 40 * 40;
      for (const p of pts) {
        const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
        if (d < best) {
          best = d;
          grab = p;
        }
      }
    }
    if (!ptr.down) grab = null;
    const gy = 900 * dt * dt;
    for (const p of pts) {
      if (p.pin) continue;
      const vx = (p.x - p.ox) * 0.985;
      const vy = (p.y - p.oy) * 0.985;
      p.ox = p.x;
      p.oy = p.y;
      p.x += vx;
      p.y += vy + gy;
    }
    if (grab) {
      grab.x = mx;
      grab.y = my;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = sts.length - 1; i >= 0; i--) {
        const s = sts[i];
        const dx = s.b.x - s.a.x;
        const dy = s.b.y - s.a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d > s.len * 3.2) {
          sts.splice(i, 1); // puxão forte rasga
          continue;
        }
        const f = (d - s.len) / d / 2;
        if (!s.a.pin && s.a !== grab) {
          s.a.x += dx * f;
          s.a.y += dy * f;
        }
        if (!s.b.pin && s.b !== grab) {
          s.b.x -= dx * f;
          s.b.y -= dy * f;
        }
      }
    }
    g.clearRect(0, 0, w, h);
    g.lineWidth = 1;
    g.beginPath();
    for (const s of sts) {
      g.moveTo(s.a.x, s.a.y);
      g.lineTo(s.b.x, s.b.y);
    }
    g.strokeStyle = `rgba(${WHITE},0.5)`;
    g.stroke();
    g.fillStyle = `rgba(${RED},0.9)`;
    for (const p of pts) if (p.pin) g.fillRect(p.x - 2, p.y - 2, 4, 4);
    if (grab) {
      g.beginPath();
      g.arc(grab.x, grab.y, 6, 0, Math.PI * 2);
      g.strokeStyle = `rgba(${RED},0.9)`;
      g.stroke();
    }
  }

  // ---------- Ember (palavra em partículas) ----------
  let word = "LUCAS";
  let typed = false; // a 1ª tecla substitui a palavra-exemplo
  type Em = { x: number; y: number; vx: number; vy: number; tx: number; ty: number; r: number };
  let ems: Em[] = [];
  function emberTargets() {
    const o = document.createElement("canvas");
    const fs = Math.min(w / Math.max(3, word.length) * 1.5, h * 0.32);
    o.width = w;
    o.height = h;
    const x = o.getContext("2d")!;
    x.font = `800 ${fs}px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(word || "·", w / 2, h * 0.42);
    const data = x.getImageData(0, 0, w, h).data;
    const step = Math.max(3, Math.round(fs / 28));
    const tg: { x: number; y: number }[] = [];
    for (let y = 0; y < h; y += step) for (let xx = 0; xx < w; xx += step) if (data[(y * w + xx) * 4 + 3] > 128) tg.push({ x: xx, y });
    const max = narrow() ? 900 : 1800;
    while (tg.length > max) tg.splice((Math.random() * tg.length) | 0, 1);
    const next: Em[] = tg.map((t, i) => {
      const prev = ems[i];
      return prev ? { ...prev, tx: t.x, ty: t.y } : { x: Math.random() * w, y: h + Math.random() * 80, vx: 0, vy: 0, tx: t.x, ty: t.y, r: Math.random() };
    });
    ems = next;
  }
  function ember(t: number, dt: number) {
    const mx = ptr.x * w;
    const my = ptr.y * h;
    g.clearRect(0, 0, w, h);
    for (const e of ems) {
      e.vx += (e.tx - e.x) * 6 * dt;
      e.vy += (e.ty - e.y) * 6 * dt;
      const dx = e.x - mx;
      const dy = e.y - my;
      const d2 = dx * dx + dy * dy;
      if (ptr.moved && d2 < 90 * 90) {
        const k = (1 - Math.sqrt(d2) / 90) * 900 * dt;
        const d = Math.sqrt(d2) || 1;
        e.vx += (dx / d) * k;
        e.vy += (dy / d) * k;
      }
      e.vx *= 0.86;
      e.vy *= 0.86;
      e.x += e.vx + Math.sin(t * 2 + e.r * 20) * 0.15;
      e.y += e.vy;
      g.fillStyle = `rgba(${e.r < 0.25 ? "255,200,120" : RED},${0.55 + e.r * 0.45})`;
      g.fillRect(e.x, e.y, 2, 2);
    }
  }

  // ---------- Fluid (rastro de brasas) ----------
  type Fp = { x: number; y: number; vx: number; vy: number; life: number; s: number };
  const fps: Fp[] = [];
  function fluid(t: number, dt: number) {
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fillRect(0, 0, w, h);
    const mx = ptr.x * w;
    const my = ptr.y * h;
    const sp = Math.hypot(ptr.vx, ptr.vy);
    const emit = Math.min(14, 2 + sp * 0.04) * (narrow() ? 0.6 : 1);
    if (!ptr.moved) {
      // sem ponteiro ainda: uma brasa passeia sozinha
      ptr.tx = 0.5 + Math.cos(t * 0.7) * 0.22;
      ptr.ty = 0.45 + Math.sin(t * 1.1) * 0.14;
    }
    for (let i = 0; i < emit; i++)
      fps.push({ x: mx, y: my, vx: ptr.vx * 0.02 + (Math.random() - 0.5) * 40, vy: ptr.vy * 0.02 + (Math.random() - 0.5) * 40 - 20, life: 1, s: 2 + Math.random() * 6 });
    if (fps.length > 900) fps.splice(0, fps.length - 900);
    g.globalCompositeOperation = "lighter";
    for (let i = fps.length - 1; i >= 0; i--) {
      const p = fps[i];
      const a = Math.sin(p.y * 0.012 + t) * 30;
      const b = Math.cos(p.x * 0.012 - t) * 30;
      p.vx += a * dt;
      p.vy += (b - 30) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 0.7;
      if (p.life <= 0) {
        fps.splice(i, 1);
        continue;
      }
      g.fillStyle = `rgba(255,${(60 + p.life * 120) | 0},${(30 * p.life) | 0},${p.life * 0.35})`;
      const s = p.s * (1.4 - p.life * 0.6);
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    g.globalCompositeOperation = "source-over";
  }

  // ---------- infraestrutura ----------
  const size = () => {
    w = c.width = innerWidth;
    h = c.height = innerHeight;
    if (mode === 1) clothInit();
    if (mode === 2) emberTargets();
  };
  size();
  const mv = (e: PointerEvent) => {
    ptr.tx = e.clientX / innerWidth;
    ptr.ty = e.clientY / innerHeight;
    ptr.moved = true;
  };
  const onUi = (e: Event) => !!(e.target as HTMLElement)?.closest?.("button,a,input,nav,header,.lab-corr");
  const dn = (e: PointerEvent) => {
    if (onUi(e)) return;
    mv(e);
    ptr.x = ptr.tx;
    ptr.y = ptr.ty;
    ptr.down = true;
    ptr.pulse = 1;
  };
  const up = () => (ptr.down = false);
  const key = (e: KeyboardEvent) => {
    if (mode !== 2 || ui.get().menu || (e.target as HTMLElement)?.closest?.("input,textarea")) return;
    if (e.key === "Backspace") word = word.slice(0, -1);
    else if (/^[a-z0-9]$/i.test(e.key) && (!typed || word.length < 10)) {
      word = (typed ? word : "") + e.key.toUpperCase();
      typed = true;
    }
    else return;
    emberTargets();
  };
  window.addEventListener("resize", size);
  window.addEventListener("pointermove", mv, { passive: true });
  window.addEventListener("pointerdown", dn);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("keydown", key);

  let acc = 0;
  let last = -1;
  const frame = (t: number, dt: number) => {
    const lx = ptr.x * w;
    const ly = ptr.y * h;
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * (mode === 1 ? 20 : 4));
    ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * (mode === 1 ? 20 : 4));
    ptr.vx = (ptr.x * w - lx) / Math.max(dt, 1e-3);
    ptr.vy = (ptr.y * h - ly) / Math.max(dt, 1e-3);
    ptr.pulse = Math.max(0, ptr.pulse - dt * 1.5);
    if (mode === 0) orb(t);
    else if (mode === 1) cloth(Math.min(dt, 1 / 30));
    else if (mode === 2) ember(t, Math.min(dt, 1 / 20));
    else fluid(t, Math.min(dt, 1 / 20));
  };
  const untick = addTick((t) => {
    const s = ui.get();
    const dt = last < 0 ? 0 : t - last;
    last = t;
    if (reduced || document.hidden || s.menu || s.reel || s.profile) return;
    acc += dt;
    if (acc < 1 / 30) return; // CPU: no máximo 30 quadros/s
    frame(t, Math.min(acc, 0.1));
    acc = 0;
  });

  const set = (i: number) => {
    mode = ((i % 4) + 4) % 4;
    g.clearRect(0, 0, w, h);
    fps.length = 0;
    grab = null;
    if (mode === 1) clothInit();
    if (mode === 2) emberTargets();
    if (reduced) frame(0, 1 / 30); // reduced-motion: um quadro estático
  };
  set(0);

  return {
    set,
    destroy() {
      untick();
      window.removeEventListener("resize", size);
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerdown", dn);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
      c.remove();
    },
  };
}
