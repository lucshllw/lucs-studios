"use client";
// CURSOR RITUAL (proposals/finale/cursor.html, aprovado 13/11): anel SVG com marcas + anel interno tracejado em brasa,
// inércia, inclinação 3D pela velocidade, estados link (rótulo) / imagem (lente ×2) / texto (caret) e pulso no clique.
// Só com ponteiro fino e sem reduced-motion; em toque o cursor nativo permanece. No hero da Home, na câmera escura
// do About e no player do reel ele CEDE (some e o cursor/lente existentes assumem) — sem duplicar a lente.
// Movido pelo ticker único (lib/loop); parado quando o ponteiro sai da janela.
import { useEffect, useRef } from "react";
import { addTick } from "@/lib/loop";

// etapa 6 (pedido de Lucas): no hero e na câmara escura o cursor NÃO some — vira o anel da lente (diâmetro = raio
// da revelação ×2, rótulo). Só cede ao player do reel (cursor próprio) e à intro.
const CEDE = ".rp, .intro.is-on";
const LENS: { sel: string; d: number; label: string }[] = [
  { sel: ".dark-stick", d: 160, label: "Develop" },
  // hero: cursor no tamanho padrão (46 px, sem rótulo) — a lente ASCII→real usa o raio proporcional
  { sel: ".hero-sticky", d: 46, label: "" },
];
const SIZE: Record<string, number> = { "": 46, link: 86, img: 170, text: 46 };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fine = matchMedia("(pointer: fine)");
    const rm = matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || rm.matches || !document.documentElement.classList.contains("js")) return;
    const cz = ref.current!;
    const html = document.documentElement;
    html.classList.add("cur");
    const rig = cz.querySelector<HTMLElement>(".cz-rig")!;
    const dial = cz.querySelector<HTMLElement>(".cz-dial")!;
    const outer = cz.querySelector<SVGElement>(".cz-outer")!;
    const inner = cz.querySelector<SVGElement>(".cz-inner")!;
    const lens = cz.querySelector<HTMLElement>(".cz-lens")!;
    const lab = cz.querySelector<HTMLElement>(".cz-lab")!;
    const pulse = cz.querySelector<HTMLElement>(".cz-pulse")!;
    const M = { x: innerWidth / 2, y: innerHeight / 2, on: false };
    const C = { x: M.x, y: M.y, kick: 0 };
    let state = "";
    let el: Element | null = null;
    let target: Element | null = null;
    let ceded = false;
    let rot = 0;
    let spin = 0.4;
    let tx = 0;
    let ty = 0;
    let idle = 0;
    const setState = (st: string, t: Element | null, label = "", size = 0) => {
      if (st === state && t === el && (st !== "link" && st !== "lens" ? true : lab.textContent === label)) return;
      state = st;
      el = t;
      cz.dataset.st = st;
      const px = (size || SIZE[st] || 46) + "px";
      dial.style.setProperty("--s", px);
      lab.style.setProperty("--s", px);
      if (st === "link" || st === "lens") lab.textContent = label;
      if (st === "img" && t) lens.style.backgroundImage = `url("${(t as HTMLImageElement).currentSrc || (t as HTMLImageElement).src}")`;
    };
    const classify = () => {
      const t = target;
      if (!t || !(t instanceof Element)) return setState("", null);
      const c = !!t.closest(CEDE) || !!document.querySelector("#intro.is-on");
      if (c !== ceded) {
        ceded = c;
        html.classList.toggle("cur-cede", c);
      }
      if (c) return setState("", null);
      // palcos 3D (Studio/Lab) informam se o ponteiro está sobre um objeto clicável
      const stage = t.closest<HTMLElement>("[data-cur]");
      if (stage && stage.dataset.cur) return setState("link", stage, stage.dataset.curLabel ?? "");
      const a = t.closest<HTMLElement>("a,button,[role=button],label,summary,select");
      if (a) {
        const raw = a.dataset.cursor || a.getAttribute("aria-label") || a.textContent || "";
        return setState("link", a, raw.replace(/\s+/g, " ").trim().slice(0, 24));
      }
      for (const z of LENS) {
        const zone = t.closest<HTMLElement>(z.sel);
        if (!zone) continue;
        // monólito clicável no hero (a Home marca o palco com cursor pointer)
        if (zone.style.cursor === "pointer") return setState("link", zone, "Open");
        return setState("lens", zone, z.label, z.d);
      }
      const im = t.closest("img");
      if (im && (im as HTMLImageElement).naturalWidth && im.getBoundingClientRect().width > 120) return setState("img", im);
      if (t.closest("input,textarea,[contenteditable]")) return setState("text", t);
      if (t.closest("p,h1,h2,h3,h4,li,figcaption,blockquote,dd,dt") && t.closest("main")) return setState("text", t);
      setState("", null);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      M.x = e.clientX;
      M.y = e.clientY;
      if (!M.on) {
        M.on = true;
        C.x = M.x;
        C.y = M.y;
        cz.style.opacity = "1";
      }
      target = e.target as Element;
      idle = 0;
      classify();
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || ceded) return;
      pulse.classList.remove("go");
      void pulse.offsetWidth;
      pulse.classList.add("go");
      C.kick = 1;
    };
    const leave = () => {
      M.on = false;
      cz.style.opacity = "0";
    };
    const out = (e: MouseEvent) => {
      if (!e.relatedTarget) leave();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("mouseout", out);
    window.addEventListener("blur", leave);
    let n = 0;
    const untick = addTick((_t, dt) => {
      if (!M.on) return;
      // estado de palcos e páginas que mudam sem mover o mouse (rotas, hover 3D) — barato, a cada 6 quadros
      if (++n % 6 === 0) {
        target = document.elementFromPoint(M.x, M.y) ?? target;
        classify();
      }
      const dx = M.x - C.x;
      const dy = M.y - C.y;
      if (Math.abs(dx) + Math.abs(dy) < 0.05 && Math.abs(tx) + Math.abs(ty) < 0.05 && C.kick <= 0 && state !== "link" && state !== "img") {
        if (++idle > 30 && idle % 4) return; // parado: gira devagar a ~1/4 dos quadros
      }
      // na lente o anel acompanha quase 1:1 (o raio da revelação coincide com ele)
      const k = state === "lens" ? 0.5 : state === "img" ? 0.22 : 0.2;
      const ox = C.x;
      const oy = C.y;
      C.x += dx * k;
      C.y += dy * k;
      const vx = C.x - ox;
      const vy = C.y - oy;
      tx += (clamp(-vy * 2.2, -40, 40) - tx) * 0.2;
      ty += (clamp(vx * 2.2, -40, 40) - ty) * 0.2;
      spin += ((state === "link" ? 4 : state === "img" || state === "lens" ? 0.15 : 0.5) - spin) * 0.08;
      rot = (rot + spin * dt * 60) % 360;
      const kick = C.kick > 0 ? (C.kick = Math.max(0, C.kick - 0.08)) : 0;
      rig.style.transform = `translate3d(${C.x.toFixed(1)}px,${C.y.toFixed(1)}px,0) rotateX(${tx.toFixed(2)}deg) rotateY(${ty.toFixed(2)}deg) scale(${(1 - kick * 0.25).toFixed(3)})`;
      outer.style.transform = `rotate(${rot.toFixed(1)}deg)`;
      inner.style.transform = `translateZ(18px) scale(.62) rotate(${(-rot * 1.6).toFixed(1)}deg)`;
      if (state === "img" && el) {
        const r = el.getBoundingClientRect();
        const z = 2;
        const S = SIZE.img * 0.88;
        const u = (C.x - r.left) / r.width;
        const v = (C.y - r.top) / r.height;
        lens.style.backgroundSize = `${r.width * z}px ${r.height * z}px`;
        lens.style.backgroundPosition = `${-(u * r.width * z - S / 2)}px ${-(v * r.height * z - S / 2)}px`;
      }
    });
    return () => {
      untick();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      document.removeEventListener("mouseout", out);
      window.removeEventListener("blur", leave);
      html.classList.remove("cur", "cur-cede");
    };
  }, []);

  const ticks = [];
  for (let a = 0; a < 360; a += 10) {
    const r = (a * Math.PI) / 180;
    const L = a % 45 === 0 ? 8 : 4;
    const f = (n: number) => n.toFixed(3);
    ticks.push(
      <line
        key={a}
        x1={f(Math.sin(r) * 46)}
        y1={f(-Math.cos(r) * 46)}
        x2={f(Math.sin(r) * (46 - L))}
        y2={f(-Math.cos(r) * (46 - L))}
        stroke={a % 90 === 0 ? "#c20b21" : "#f4f4f2"}
        strokeWidth={a % 45 === 0 ? 1.6 : 1}
      />
    );
  }
  return (
    <div ref={ref} className="cz" aria-hidden="true">
      <div className="cz-rig">
        <div className="cz-pulse" />
        <div className="cz-dial">
          <div className="cz-lens" />
          <svg className="cz-outer" viewBox="-50 -50 100 100">
            <circle r="46" fill="none" stroke="#f4f4f2" strokeWidth="1.6" />
            <g>{ticks}</g>
            <path d="M0 -50 L3 -43 L-3 -43Z" fill="#c20b21" />
          </svg>
          <svg className="cz-inner" viewBox="-50 -50 100 100">
            <circle r="40" fill="none" stroke="#c20b21" strokeWidth="2" strokeDasharray="4 8" />
          </svg>
        </div>
        <span className="cz-lab" />
        <span className="cz-caret" />
      </div>
    </div>
  );
}
