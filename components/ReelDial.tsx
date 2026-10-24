"use client";
// Dial de timecode ao redor do disco do showreel (parecer Vergil v3.1, opção B). SVG único, decorativo.
// 60 ticks (≤767 px: 40), maiores a cada 5 (4); arco brasa de progresso no raio r+4 (substitui o aro vermelho);
// rótulos fixos em textPath (topo SHOWREEL '26 / PLAY REEL no hover; base = timecode). Nada é animado aqui por conta
// própria: o PortalReel chama `update()` a partir da timeline única do pin (sem novo ScrollTrigger) e do giro
// ocioso; em F3 os ticks "desenrolam" do círculo para a régua de 24 s sob o player. Tier low: rotação CSS.
import { useImperativeHandle, useRef, type Ref } from "react";

export type DialGeom = {
  cx: number;
  cy: number;
  r: number; // raio atual do disco
  mobile: boolean;
  track: { left: number; top: number; width: number } | null; // régua (coords do palco)
};
export type DialApi = {
  /** u3 = progresso local do desenrolar (0 círculo → 1 régua); spin em graus; arc 0–1 */
  update: (g: DialGeom, s: { spin: number; spinWeight: number; arc: number; u3: number; labelsOpacity: number; tc: string; top: string }) => void;
  ticks: () => number;
};

const TAU = Math.PI * 2;

export default function ReelDial({ ref, ticks }: { ref?: Ref<DialApi>; ticks: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const tickEls = useRef<(SVGLineElement | null)[]>([]);
  const arc = useRef<SVGCircleElement>(null);
  const topPath = useRef<SVGPathElement>(null);
  const botPath = useRef<SVGPathElement>(null);
  const topText = useRef<SVGTextPathElement>(null);
  const botText = useRef<SVGTextPathElement>(null);
  const labels = useRef<SVGGElement>(null);
  const tickGroup = useRef<SVGGElement>(null);
  const lastKey = useRef("");
  const major = ticks === 40 ? 4 : 5;

  useImperativeHandle(ref, () => ({
    ticks: () => ticks,
    update(g, s) {
      const el = svg.current;
      if (!el) return;
      const rT = g.r + (g.mobile ? 10 : 14);
      // giro ocioso = UMA rotação do grupo; as posições por tick só são recalculadas quando a geometria ou o
      // desenrolar mudam (scroll), não a cada quadro do giro
      const spinA = s.spin * s.spinWeight;
      if (tickGroup.current) tickGroup.current.setAttribute("transform", spinA ? `rotate(${spinA.toFixed(2)} ${g.cx.toFixed(2)} ${g.cy.toFixed(2)})` : "");
      const key = [g.cx, g.cy, g.r, s.u3, g.track?.left, g.track?.top, g.track?.width].map((v) => (v == null ? "-" : (+v).toFixed(2))).join(",");
      const fresh = key !== lastKey.current;
      lastKey.current = key;
      for (let i = 0; fresh && i < ticks; i++) {
        const t = tickEls.current[i];
        if (!t) continue;
        const big = i % major === 0;
        const len = big ? 9 : 4;
        // círculo: ângulo θ (0 = 12 h, horário) + giro ponderado
        const th = (i / ticks) * 360;
        const thr = (th * TAU) / 360;
        const ax = g.cx + rT * Math.sin(thr);
        const ay = g.cy - rT * Math.cos(thr);
        // régua: tick i em t = i/N · 24 s, base na linha de topo da faixa, vertical
        const k = g.track ? Math.min(1, Math.max(0, s.u3 * 1.6 - (i / ticks) * 0.6)) : 0;
        const e = k * k * (3 - 2 * k);
        let x = ax;
        let y = ay;
        let rot = ((th % 360) + 360) % 360;
        if (g.track && e > 0) {
          const bx = g.track.left + (i / ticks) * g.track.width;
          const by = g.track.top + len;
          x = ax + (bx - ax) * e;
          y = ay + (by - ay) * e;
          const r0 = rot > 180 ? rot - 360 : rot;
          rot = r0 * (1 - e);
        }
        t.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)})`);
        t.setAttribute("y1", String(-len));
      }
      // sem régua (paisagem baixa): os ticks não desenrolam, só saem com a abertura
      if (tickGroup.current) tickGroup.current.style.opacity = g.track ? "" : String(1 - Math.min(1, s.u3 * 2));
      const a = arc.current;
      if (a) {
        a.setAttribute("cx", g.cx.toFixed(2));
        a.setAttribute("cy", g.cy.toFixed(2));
        a.setAttribute("r", (g.r + 4).toFixed(2));
        a.setAttribute("transform", `rotate(-90 ${g.cx.toFixed(2)} ${g.cy.toFixed(2)})`);
        a.style.strokeDashoffset = String(1 - s.arc);
        a.style.opacity = String(1 - Math.min(1, s.u3 * 2));
      }
      const rL = rT + 14;
      topPath.current?.setAttribute("d", `M ${g.cx - rL} ${g.cy} A ${rL} ${rL} 0 0 1 ${g.cx + rL} ${g.cy}`);
      const rB = rT + 22;
      botPath.current?.setAttribute("d", `M ${g.cx - rB} ${g.cy} A ${rB} ${rB} 0 0 0 ${g.cx + rB} ${g.cy}`);
      if (topText.current && topText.current.textContent !== s.top) topText.current.textContent = s.top;
      if (botText.current) botText.current.textContent = s.tc;
      if (labels.current) labels.current.style.opacity = String(s.labelsOpacity);
    },
  }));

  return (
    <svg className="reel-dial" ref={svg} aria-hidden="true" focusable="false">
      <defs>
        <path id="reel-dial-top" ref={topPath} d="M0 0" />
        <path id="reel-dial-bot" ref={botPath} d="M0 0" />
      </defs>
      <g className="reel-dial__ticks" ref={tickGroup}>
        {Array.from({ length: ticks }, (_, i) => (
          <line
            key={i}
            ref={(el) => {
              tickEls.current[i] = el;
            }}
            className={`reel-dial__tick${i % major === 0 ? " is-major" : ""}`}
            x1="0"
            y1={i % major === 0 ? -9 : -4}
            x2="0"
            y2="0"
          />
        ))}
      </g>
      <circle className="reel-dial__arc" ref={arc} cx="0" cy="0" r="0" pathLength={1} />
      <g className="reel-dial__labels" ref={labels}>
        <text className="reel-dial__label reel-dial__label--top">
          <textPath ref={topText} href="#reel-dial-top" startOffset="50%" textAnchor="middle">
            SHOWREEL &apos;26
          </textPath>
        </text>
        <text className="reel-dial__label">
          <textPath ref={botText} href="#reel-dial-bot" startOffset="50%" textAnchor="middle">
            00:00:00:00
          </textPath>
        </text>
      </g>
    </svg>
  );
}
