"use client";
import { Pause, Play } from "lucide-react";

/**
 * Pausa/retoma de mídia em movimento (WCAG 2.2.2). size "sm" (v3): 32×32 só ícone, canto inferior direito,
 * alvo de toque 44×44 via pseudo-elemento; `ariaLabel` substitui o rótulo gerado.
 */
export default function PauseButton({
  paused,
  onToggle,
  pos = "tl",
  label,
  size = "md",
  ariaLabel,
}: {
  paused: boolean;
  onToggle: () => void;
  pos?: "tl" | "bl" | "br";
  label: string;
  size?: "md" | "sm";
  ariaLabel?: string;
}) {
  const cls = ["btn-pause", pos === "bl" ? "btn-pause--bl" : "", pos === "br" ? "btn-pause--br" : "", size === "sm" ? "btn-pause--sm" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      aria-pressed={paused}
      aria-label={ariaLabel ?? `${paused ? "Play" : "Pause"} — ${paused ? "retomar" : "pausar"} ${label}`}
      onClick={onToggle}
    >
      {paused ? <Play aria-hidden fill="currentColor" /> : <Pause aria-hidden fill="currentColor" />}
      {size === "md" && <span aria-hidden>{paused ? "Play" : "Pause"}</span>}
    </button>
  );
}
