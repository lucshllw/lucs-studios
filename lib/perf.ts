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
  // 26/11: o teste antigo (0,5 s a partir de 1,5 s) pegava o pico de carga (ex.: GLB do Studio) e rebaixava máquinas com GPU.
  // Agora: espera 4 s, mede janelas de 1 s e só liga o LITE com duas janelas seguidas abaixo de 30 fps.
  let t0 = -1;
  let n = 0;
  let low = 0;
  let done = false;
  addTick((time, dt) => {
    lastDt = dt * 1000;
    if (done || forced !== null || isLite()) return;
    if (t0 < 0) {
      if (time < 4) return; // espera a carga assentar
      t0 = time;
      n = 0;
      return;
    }
    n++;
    if (time - t0 >= 1) {
      const fps = n / (time - t0);
      if (fps < 30) low++;
      else done = true;
      if (low >= 2) {
        document.documentElement.classList.add("lite");
        done = true;
      }
      t0 = time;
      n = 0;
    }
  });
}
