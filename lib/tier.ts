"use client";
// Tiers de efeito (parecer v4 §9.1): reduced > low > mid > high. Sinais síncronos (reduced, saveData, WebGL com
// failIfMajorPerformanceCaveat / renderer por software, hardware) definem o teto e o tier inicial; uma sonda única
// de 60 quadros pode descer (ou subir uma vez a high). Em execução, useTierGuard só desce. ?tier= força (QA).
// v5 (24/10/2026): "low" é o tier lite (sem WebGL, sem Lenis, vídeos só pôster + play sob demanda, sem blur/
// mix-blend). Sinais novos: effectiveType 2g/3g → teto low; ≤4 núcleos OU ≤4 GB → teto mid (antes exigia os dois);
// pointer: coarse → teto mid (sem Rain/efeitos high no toque). Critérios completos no README ("Tier lite").
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { gsap } from "./gsap";

export type Tier = "reduced" | "low" | "mid" | "high";
const ORDER: Tier[] = ["low", "mid", "high"];
const KEY = "lm-tier";

type Info = { tier: Tier; cap: Tier; forced: boolean; reasons: string[]; probe?: number };
let info: Info | null = null;
const subs = new Set<(t: Tier) => void>();

function webglSoftware(): string | null {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
      c.getContext("webgl", { failIfMajorPerformanceCaveat: true })) as WebGLRenderingContext | null;
    if (!gl) return "webgl-caveat";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (/SwiftShader|llvmpipe|Software|Basic Render|Microsoft Basic/i.test(r)) return `software:${r}`;
    return null;
  } catch {
    return "webgl-error";
  }
}

const min = (a: Tier, b: Tier): Tier => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b);

function apply(t: Tier) {
  if (!info) return;
  info.tier = t;
  document.documentElement.dataset.tier = t;
  try {
    if (!info.forced) sessionStorage.setItem(KEY, JSON.stringify({ tier: t, cap: info.cap, probe: info.probe }));
  } catch {}
  subs.forEach((f) => f(t));
}

/** Resolução síncrona (1ª chamada) — idempotente. */
export function initTier(): Info {
  if (info) return info;
  const reasons: string[] = [];
  const q = new URLSearchParams(location.search).get("tier") as Tier | null;
  if (q && ["reduced", "low", "mid", "high"].includes(q)) {
    info = { tier: q, cap: q, forced: true, reasons: ["query"] };
    document.documentElement.dataset.tier = q;
    return info;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    info = { tier: "reduced", cap: "reduced", forced: false, reasons: ["reduced-motion"] };
    document.documentElement.dataset.tier = "reduced";
    return info;
  }
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (s && ORDER.includes(s.tier)) {
      info = { tier: s.tier, cap: s.cap ?? s.tier, forced: false, reasons: ["session"], probe: s.probe };
      document.documentElement.dataset.tier = s.tier;
      return info;
    }
  } catch {}
  let cap: Tier = "high";
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  if (nav.connection?.saveData) {
    cap = "low";
    reasons.push("save-data");
  }
  if (/^(slow-2g|2g|3g)$/.test(nav.connection?.effectiveType ?? "")) {
    cap = "low";
    reasons.push(`net:${nav.connection?.effectiveType}`);
  }
  const sw = webglSoftware();
  if (sw) {
    cap = "low";
    reasons.push(sw);
  }
  if ((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4) {
    cap = min(cap, "mid");
    reasons.push("hardware");
  }
  if (window.matchMedia("(pointer: coarse)").matches) {
    cap = min(cap, "mid");
    reasons.push("coarse-pointer");
  }
  info = { tier: min("mid", cap), cap, forced: false, reasons };
  document.documentElement.dataset.tier = info.tier;
  return info;
}

/** Sonda única por sessão: 60 quadros de rAF após 500 ms. Mediana > 33 ms → low; > 22 ms → desce 1; senão sobe 1× a high. */
function probe() {
  if (!info || info.forced || info.tier === "reduced" || info.probe != null) return;
  const start = () => {
    const dts: number[] = [];
    let prev = 0;
    const f = (now: number) => {
      if (prev) dts.push(now - prev);
      prev = now;
      if (dts.length < 60) return requestAnimationFrame(f);
      if (document.visibilityState !== "visible" || !info) return;
      dts.sort((a, b) => a - b);
      const med = dts[30];
      info.probe = Math.round(med * 10) / 10;
      let t = info.tier;
      if (med > 33) t = "low";
      else if (med > 22) t = ORDER[Math.max(0, ORDER.indexOf(t) - 1)];
      else t = min("high", info.cap);
      apply(t);
    };
    requestAnimationFrame(f);
  };
  window.setTimeout(start, 500);
}

/** Desce um nível (guarda em execução). */
export function downgradeTier(reason: string) {
  if (!info || info.forced || info.tier === "reduced" || info.tier === "low") return;
  info.reasons.push(`guard:${reason}`);
  apply(ORDER[ORDER.indexOf(info.tier) - 1]);
}

export const tierInfo = () => info;

const TierCtx = createContext<Tier>("mid");
export const useTier = () => useContext(TierCtx);

export function TierProvider({ children }: { children: ReactNode }) {
  // SSR/hidratação: "mid"; o tier real entra no 1º efeito (o HTML não depende disso)
  const [tier, setTier] = useState<Tier>("mid");
  useEffect(() => {
    const i = initTier();
    setTier(i.tier);
    const on = (t: Tier) => setTier(t);
    subs.add(on);
    probe();
    (window as unknown as { __tier?: () => Info | null }).__tier = () => info;
    return () => {
      subs.delete(on);
    };
  }, []);
  return createElement(TierCtx.Provider, { value: tier }, children);
}

/**
 * Guarda de FPS (grade, portal, filmstrip): enquanto `active`, média móvel de dt > 28 ms por 2 s → desce um nível.
 * Usa o ticker do GSAP (já rodando com o Lenis); remove o listener ao desativar.
 */
export function useTierGuard(active: boolean, name: string) {
  useEffect(() => {
    if (!active) return;
    let avg = 16.7;
    let bad = 0;
    let last = 0;
    const tick = (_t: number, dt: number) => {
      if (document.visibilityState !== "visible") return;
      const d = Math.min(dt, 250);
      avg += (d - avg) * 0.1;
      const now = performance.now();
      if (avg > 28) {
        if (!last) last = now;
        bad = now - last;
        if (bad > 2000) {
          downgradeTier(name);
          last = 0;
          avg = 16.7;
        }
      } else last = 0;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [active, name]);
}
