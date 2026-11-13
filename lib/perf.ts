"use client";
// Etapa 6 — modo LITE (máquinas lentas / sem aceleração de hardware). A detecção síncrona roda no BOOT (layout.tsx):
// renderer WebGL de software (SwiftShader, llvmpipe, Microsoft Basic Render…), failIfMajorPerformanceCaveat,
// deviceMemory/hardwareConcurrency baixos ou `?lite=1` (persistido; `?lite=0` desliga). Aqui: consulta + teste de fps
// de 0,5 s depois da carga (abaixo de 30 fps → LITE nesta sessão) + duração do último quadro.
import { addTick } from "@/lib/loop";

export const isLite = () => typeof document !== "undefined" && document.documentElement.classList.contains("lite");

let lastDt = 0;
let probed = false;
/** duração do último quadro do ticker (ms) — >50 ms = máquina ocupada: transição vira corte/fade */
export const lastFrameMs = () => lastDt;

export function startPerfProbe() {
  if (probed || typeof window === "undefined") return;
  probed = true;
  let forced: string | null = null;
  try {
    forced = localStorage.getItem("rito-lite");
  } catch {
    /* sem storage */
  }
  let t0 = -1;
  let n = 0;
  addTick((time, dt) => {
    lastDt = dt * 1000;
    if (forced !== null || isLite()) return;
    if (t0 < 0) {
      if (time < 1.5) return; // espera a carga assentar
      t0 = time;
      n = 0;
      return;
    }
    if (t0 > 0) {
      n++;
      if (time - t0 >= 0.5) {
        const fps = n / (time - t0);
        if (fps < 30) document.documentElement.classList.add("lite");
        t0 = 0; // teste único
      }
    }
  });
}
