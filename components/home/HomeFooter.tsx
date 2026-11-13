"use client";
// Rodapé da Home — proposta 05 "Fusion" aprovada por Lucas (proposals/footer/fusao.html, fiel ao protótipo).
// Trilho 320 svh com palco sticky; fases guiadas pelo scroll e reversíveis:
//   0–.28 varredura revela o campo ASCII do emblema + chuva de glifos (linha brasa)
//   .2–.62 globo wireframe com anel/flare brasa · .48–.7 globo → cartão OPEN Commissions
//   .6–.78 título linha a linha + disco gira · >.74 contatos decodificam · .85–.95 linha final.
// Tudo no ticker único (lib/loop) e na rolagem do Lenis; canvas 2D com grade limitada por DPR, pausado fora de vista.
// Sem JS: contatos em HTML visíveis. Reduced-motion: estado final, sem animação.
import { useEffect, useRef, useState } from "react";
import { addTick } from "@/lib/loop";
import { copyText, reducedMotion } from "@/lib/motion";
import { SITE } from "@/lib/site";

type Row = { k: string; v: string; href?: string; external?: boolean; copy?: string; download?: boolean; extra?: { label: string; href: string } };

export const CONTACTS: Row[] = [
  { k: "E-mail", v: SITE.email, copy: SITE.email },
  { k: "Phone · WhatsApp", v: SITE.phone, href: SITE.whatsapp, external: true, extra: { label: "Call", href: SITE.tel } },
  { k: "LinkedIn", v: "in/lucashenriquemelobarbosa", href: SITE.linkedin, external: true },
  { k: "GitHub", v: "github.com/lucshllw", href: SITE.github, external: true },
  // rede não confirmada → só texto
  { k: "Handle", v: SITE.handle },
  { k: "Résumé", v: "Download PDF ↓", href: SITE.resume, download: true },
];

const RAMP = " .:-=+*#%@";
const EMB = "░▒▓█";
const GL = "!<>-_\\/[]{}—=+*^?#";
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const eo = (t: number) => 1 - Math.pow(1 - t, 4);
const eio = (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
const dots = (s: string) => s.replace(/[^\s]/g, "·");

export function HomeFooter() {
  const track = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState("");

  useEffect(() => {
    const tr = track.current!;
    const stage = tr.querySelector<HTMLElement>(".ff-stage")!;
    const ca = tr.querySelector<HTMLCanvasElement>(".ff-ascii")!;
    const cg = tr.querySelector<HTMLCanvasElement>(".ff-globe")!;
    const xa = ca.getContext("2d")!;
    const xg = cg.getContext("2d")!;
    const card = tr.querySelector<HTMLElement>(".ff-card")!;
    const titles = Array.from(card.querySelectorAll<HTMLElement>(".ff-title .l span"));
    const small = card.querySelector<HTMLElement>(".ff-title small")!;
    const disc = card.querySelector<HTMLElement>(".ff-disc");
    const foot = tr.querySelector<HTMLElement>(".ff-foot")!;
    const bar = tr.querySelector<HTMLElement>(".ff-bar")!;
    const tc = card.querySelector<HTMLElement>(".ff-tc")!;
    const vals = Array.from(card.querySelectorAll<HTMLElement>(".ff-val"));
    const lis = Array.from(card.querySelectorAll<HTMLElement>(".ff-rows li"));
    const reduce = reducedMotion();
    tr.classList.add("is-live");

    // emblema → luminância 140² para o campo ASCII
    const LW = 140;
    let lum: Uint8ClampedArray | null = null;
    const img = new Image();
    img.src = "/brand/avatar-emblem.webp";
    img.onload = () => {
      const o = document.createElement("canvas");
      o.width = o.height = LW;
      const ox = o.getContext("2d")!;
      ox.drawImage(img, 0, 0, LW, LW);
      lum = ox.getImageData(0, 0, LW, LW).data;
    };

    const mouse = { x: -1, y: -1, on: false, sx: 0.5, sy: 0.5 };
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = (e.clientY - r.top) / r.height;
      mouse.on = true;
      const cr = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - cr.left) / cr.width) * 100 + "%");
      card.style.setProperty("--my", ((e.clientY - cr.top) / cr.height) * 100 + "%");
    };
    const onLeave = () => (mouse.on = false);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    // magnetismo nos contatos
    const mags = lis.map((li) => {
      const mv = (e: PointerEvent) => {
        if (reduce) return;
        const r = li.getBoundingClientRect();
        li.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.06}px,${(e.clientY - r.top - r.height / 2) * 0.22}px)`;
      };
      const lv = () => (li.style.transform = "");
      li.addEventListener("pointermove", mv);
      li.addEventListener("pointerleave", lv);
      return () => {
        li.removeEventListener("pointermove", mv);
        li.removeEventListener("pointerleave", lv);
      };
    });

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(stage);

    const fit = (cv: HTMLCanvasElement) => {
      const r = cv.getBoundingClientRect();
      const d = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(r.width * d);
      if (cv.width !== w || cv.height !== Math.round(r.height * d)) {
        cv.width = w;
        cv.height = Math.round(r.height * d);
      }
      return [cv.width, cv.height, d] as const;
    };

    const drawAscii = (now: number, p: number) => {
      const [W, H, d] = fit(ca);
      xa.fillStyle = "#000";
      xa.fillRect(0, 0, W, H);
      const cs = Math.max(10, Math.round(Math.min(W, H) / d / 58)) * d;
      xa.font = `${cs}px "Martian Mono Variable", "Martian Mono", monospace`;
      xa.textBaseline = "top";
      const cw = cs * 0.62;
      const cols = Math.ceil(W / cw);
      const rws = Math.ceil(H / cs);
      const scan = reduce ? 2 : eio(seg(p, 0, 0.28)) * 1.04; // varredura revela o campo
      const dim = 1 - 0.45 * seg(p, 0.45, 0.7); // campo recua quando o cartão entra
      const narrow = W / d < 760;
      const es = (narrow ? 0.95 : 0.78) * Math.min(W, H);
      const zoom = 1 + 0.25 * seg(p, 0.2, 1); // emblema ASCII cresce com o scroll (paralaxe)
      mouse.sx += ((mouse.on ? mouse.x : 0.5) - mouse.sx) * 0.08;
      mouse.sy += ((mouse.on ? mouse.y : 0.5) - mouse.sy) * 0.08;
      const ex = W * 0.5 - (es * zoom) / 2 + (mouse.sx - 0.5) * -30 * d;
      const ey = H * 0.5 - (es * zoom) / 2 + (mouse.sy - 0.5) * -20 * d;
      const t = reduce ? 0 : now;
      for (let j = 0; j < rws; j++) {
        const yN = j / rws;
        if (yN > scan) break;
        const near = Math.abs(yN - scan) < 0.018 && scan < 1;
        for (let i = 0; i < cols; i++) {
          const x = i * cw;
          const y = j * cs;
          let v = 0;
          const u = (x - ex) / (es * zoom);
          const w = (y - ey) / (es * zoom);
          if (lum && u >= 0 && u < 1 && w >= 0 && w < 1) v = lum[(Math.floor(w * LW) * LW + Math.floor(u * LW)) * 4] / 255;
          const fall = (i * 13 + Math.floor(j - t * 9 + i * 0.7)) % 53 === 0 ? 0.55 : 0; // chuva de glifos
          const rn = ((i * 928371 + j * 1237 + Math.floor(t * 11 + i * 0.3)) % 97) / 97;
          v = Math.max(v * 0.95, fall, rn < 0.035 ? 0.22 : 0) * dim;
          let hot = 0;
          if (mouse.on && !reduce) {
            const dx = ((x / W - mouse.x) * W) / H;
            const dy = y / H - mouse.y;
            hot = Math.max(0, 1 - Math.hypot(dx, dy) / 0.15);
          }
          if (v < 0.07 && hot < 0.05 && !near) continue;
          if (hot > 0.05) {
            xa.fillStyle = `rgba(${194 + 61 * hot},${11 + 70 * hot},${33 + 50 * hot},${0.35 + 0.65 * hot})`;
            xa.fillText(EMB[Math.min(3, Math.floor(hot * 4))], x, y);
          } else {
            xa.fillStyle = near ? "#c20b21" : `rgba(244,244,242,${0.18 + 0.62 * v})`;
            xa.fillText(RAMP[Math.min(9, Math.floor(v * 10))], x, y);
          }
        }
      }
    };

    const drawGlobe = (now: number, p: number) => {
      const [W, H, d] = fit(cg);
      xg.clearRect(0, 0, W, H);
      const form = eo(seg(p, 0.2, 0.42));
      const fade = 1 - seg(p, 0.5, 0.62);
      if (reduce || form <= 0 || fade <= 0) return;
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.24 * form * (1 + 0.6 * seg(p, 0.45, 0.62));
      const rot = now / 1.8;
      xg.globalAlpha = fade;
      xg.lineWidth = d;
      xg.strokeStyle = "rgba(255,255,255,.85)";
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI + rot;
        xg.beginPath();
        xg.ellipse(cx, cy, Math.abs(Math.cos(a)) * R, R, 0, 0, Math.PI * 2);
        xg.stroke();
      }
      for (let i = 1; i < 7; i++) {
        const y = ((i / 7) * 2 - 1) * R;
        xg.beginPath();
        xg.ellipse(cx, cy + y, Math.sqrt(Math.max(0, R * R - y * y)), R * 0.08, 0, 0, Math.PI * 2);
        xg.stroke();
      }
      xg.strokeStyle = "#c20b21";
      xg.lineWidth = 2 * d;
      xg.beginPath();
      xg.ellipse(cx, cy, R, R * 0.12, 0, 0, Math.PI * 2);
      xg.stroke();
      const fx = cx + R * Math.cos(rot * 1.4);
      const g = xg.createRadialGradient(fx, cy, 0, fx, cy, 70 * d);
      g.addColorStop(0, "rgba(255,235,235,.95)");
      g.addColorStop(1, "rgba(194,11,33,0)");
      xg.fillStyle = g;
      xg.beginPath();
      xg.arc(fx, cy, 70 * d, 0, 7);
      xg.fill();
      xg.strokeStyle = "rgba(255,220,220,.5)";
      xg.lineWidth = d;
      xg.beginPath();
      xg.moveTo(fx - 260 * d, cy);
      xg.lineTo(fx + 260 * d, cy);
      xg.stroke();
      xg.globalAlpha = 1;
    };

    // decodificação dos contatos (no ticker; reverte ao voltar)
    let decodedAt = -1;
    const finals = vals.map((v) => v.dataset.t ?? "");
    vals.forEach((v, i) => (v.textContent = reduce ? finals[i] : dots(finals[i])));
    const decode = (on: boolean, now: number) => {
      if (on && decodedAt < 0) decodedAt = now;
      if (!on && decodedAt >= 0) {
        decodedAt = -1;
        vals.forEach((v, i) => (v.textContent = dots(finals[i])));
      }
      if (decodedAt < 0) return;
      vals.forEach((v, i) => {
        if (v.dataset.copied) return;
        const fin = finals[i];
        const f = Math.max(0, (now - decodedAt - i * 0.11) / 0.026);
        if (f / 1.4 >= fin.length) {
          if (v.textContent !== fin) v.textContent = fin;
          return;
        }
        v.textContent = fin
          .split("")
          .map((c, k) => (k < f / 1.4 ? c : f > 0 ? GL[Math.floor(Math.random() * GL.length)] : "·"))
          .join("");
      });
    };

    const applyCard = (p: number, now: number) => {
      const k = reduce ? 1 : eo(seg(p, 0.48, 0.7)); // globo → cartão
      const mx = mouse.on && !reduce ? mouse.x - 0.5 : 0;
      const my = mouse.on && !reduce ? mouse.y - 0.5 : 0;
      card.style.opacity = String(k);
      card.style.clipPath = `inset(${(1 - k) * 42}% ${(1 - k) * 30}% round ${16 + (1 - k) * 200}px)`;
      card.style.transform = `translateY(${(1 - k) * 60}px) rotateX(${my * -9 + (1 - k) * 14}deg) rotateY(${mx * 13}deg) scale(${0.82 + 0.18 * k})`;
      card.style.pointerEvents = k > 0.6 ? "auto" : "none";
      const tp = reduce ? 1 : eo(seg(p, 0.6, 0.78));
      titles.forEach((s, i) => (s.style.transform = `translateY(${(1 - clamp(tp * 1.2 - i * 0.2)) * 110}%)`));
      small.style.opacity = String(tp);
      if (disc) disc.style.transform = `rotate(${(1 - tp) * -120}deg) scale(${0.6 + 0.4 * tp})`;
      if (!reduce) decode(p > 0.74, now);
      foot.style.opacity = String(reduce ? 1 : seg(p, 0.85, 0.95));
    };

    let Ps = 0;
    const untick = addTick((now, dt) => {
      if (!visible) return;
      const r = tr.getBoundingClientRect();
      const target = clamp(-r.top / Math.max(1, r.height - innerHeight));
      Ps += (target - Ps) * (reduce ? 1 : 1 - Math.pow(1 - 0.12, dt * 60));
      if (Math.abs(target - Ps) < 1e-4) Ps = target;
      drawAscii(now, Ps);
      drawGlobe(now, Ps);
      applyCard(Ps, now);
      bar.style.width = Ps * 100 + "%";
      const f = Math.floor(now * 24);
      const s = Math.floor(f / 24);
      tc.textContent = `TC 20:${String(26 + (Math.floor(s / 60) % 34)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}:${String(f % 24).padStart(2, "0")}`;
      (tr as HTMLElement & { __p?: number }).__p = Ps;
    });

    return () => {
      untick();
      io.disconnect();
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      mags.forEach((m) => m());
      tr.classList.remove("is-live");
      vals.forEach((v, i) => (v.textContent = finals[i]));
    };
  }, []);

  const copyEmail = (el: HTMLElement) =>
    copyText(SITE.email).then(() => {
      setCopied(true);
      setLive("E-mail copied to clipboard");
      el.dataset.copied = "1";
      el.textContent = "Copied ✓";
      setTimeout(() => {
        delete el.dataset.copied;
        el.textContent = SITE.email;
        setCopied(false);
      }, 1100);
    });

  const toTop = () => {
    const lenis = window.__lenis?.find((x) => x.key === "document")?.lenis;
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    document.getElementById("main")?.focus({ preventScroll: true });
  };

  return (
    <div className="ff-track" id="contact" ref={track}>
      <div className="ff-stage">
        <canvas className="ff-ascii" aria-hidden="true" />
        <canvas className="ff-globe" aria-hidden="true" />
        <div className="ff-scene">
          <footer className="ff-card" aria-labelledby="ff-title">
            <div className="ff-hud" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="ff-top" aria-hidden="true">
              [ LUCAS MELO — CREATIVE DEV ] · [ ● AVAILABLE 2026 ]
            </div>
            <div className="ff-tc" aria-hidden="true">
              TC 20:26:00:00
            </div>
            <h2 className="ff-title" id="ff-title">
              <span className="l">
                <span className="g">OPEN</span>
              </span>
              <span className="l">
                <span className="b">Commissions</span>
              </span>
              <small>{SITE.tagline}.</small>
            </h2>
            <div className="ff-side" aria-hidden="true">
              <div className="ff-disc" />
            </div>
            <ul className="ff-rows">
              {CONTACTS.map((c) => (
                <li key={c.k}>
                  <div className="k">{c.k}</div>
                  {c.copy ? (
                    <button type="button" className={copied ? "copied" : ""} aria-label={`${c.k}: ${c.v} — copy to clipboard`} onClick={(e) => copyEmail(e.currentTarget.querySelector(".ff-val")!)}>
                      <span className="ff-val" aria-hidden="true" data-t={c.v}>
                        {c.v}
                      </span>
                    </button>
                  ) : c.href ? (
                    <a
                      href={c.href}
                      aria-label={`${c.k}: ${c.v}${c.external ? " (opens in a new tab)" : ""}`}
                      {...(c.external ? { target: "_blank", rel: "noopener" } : {})}
                      {...(c.download ? { download: "lucas-melo-resume.pdf" } : {})}
                    >
                      <span className="ff-val" aria-hidden="true" data-t={c.v}>
                        {c.v}
                      </span>
                    </a>
                  ) : (
                    <span className="ff-text">
                      <span className="sr-only">{c.v}</span>
                      <span className="ff-val" aria-hidden="true" data-t={c.v}>
                        {c.v}
                      </span>
                    </span>
                  )}
                  {c.extra && (
                    <a className="ff-extra" href={c.extra.href} aria-label={`Call ${SITE.phone}`}>
                      {c.extra.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </footer>
        </div>
        <div className="ff-foot">
          <span>© 2026 LUCAS MELO</span>
          <span>BRAZIL · REMOTE</span>
          <button type="button" onClick={toTop}>
            BACK TO TOP ↑
          </button>
        </div>
        <div className="ff-bar" aria-hidden="true" />
      </div>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
