"use client";
import { useEffect, useState } from "react";
import RotatingStack from "./RotatingStack";

/**
 * Overlay da intro. Marcos (ms desde o carregamento): 1100 fade-in · 1100–3300 troca a cada 120ms ·
 * 3300 fade-out · ~3550 removido. Tempos de CSS em globals.css; aqui só o loop e a remoção do DOM.
 * Sem JS ou com reduced-motion o overlay não aparece (data-intro ausente).
 */
export default function Preloader() {
  const [state, setState] = useState<"pending" | "run" | "gone">("pending");

  useEffect(() => {
    if (document.documentElement.dataset.intro !== "run") {
      setState("gone");
      return;
    }
    setState("run");
    const t = window.setTimeout(() => setState("gone"), Math.max(0, 3600 - performance.now()));
    // v4 §8: fim da intro → data-intro="done" (depois da última entrada, ~5,4 s), para um retorno client-side
    // à home não repetir o preloader nem os atrasos. A transição de página também encerra a intro.
    const d = window.setTimeout(() => {
      document.documentElement.dataset.intro = "done";
    }, Math.max(0, 5600 - performance.now()));
    return () => {
      clearTimeout(t);
      clearTimeout(d);
    };
  }, []);

  if (state === "gone") return null;
  return (
    <div className="preloader" aria-hidden="true">
      <RotatingStack active={state === "run"} stopAfter={3300} />
    </div>
  );
}
