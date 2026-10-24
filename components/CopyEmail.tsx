"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useMagnetic } from "@/lib/magnetic";
import { useT } from "@/lib/i18n/provider";

type State = "idle" | "copied" | "failed";

/**
 * E-mail copiável (v3 §6, textos no dicionário v4): preenchimento #E60012 da esquerda, magnético (raio 140, máx 12),
 * tooltip "copiar" → "copiado" (1,6 s, aria-live). Falha do clipboard: "selecione e copie" + seleção do texto.
 * Sem JS: texto visível/selecionável + mailto. `compact` = versão do menu (menor, sem link de envio).
 */
export default function CopyEmail({ email, compact = false, tone = "light" }: { email: string; compact?: boolean; tone?: "light" | "dark" }) {
  const t = useT().footer.email;
  const [state, setState] = useState<State>("idle");
  const [tip, setTip] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const txt = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const tipId = useId();
  useMagnetic(btn, compact ? { radius: 60, max: 6, strength: 0.25 } : { radius: 140, max: 12, strength: 0.3 });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const selectText = () => {
    const el = txt.current;
    const sel = window.getSelection();
    if (!el || !sel) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(r);
  };
  const copy = async () => {
    window.clearTimeout(timer.current);
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) selectText();
    setState(ok ? "copied" : "failed");
    setTip(true);
    timer.current = window.setTimeout(() => setState("idle"), ok ? 1600 : 2600);
  };
  const label = state === "copied" ? t.copied : state === "failed" ? t.fail : t.copy;

  return (
    <div className={`femail ${compact ? "femail--compact" : ""}`} data-tone={tone}>
      <span className="femail__tip mono" role="tooltip" id={tipId} data-show={tip || state !== "idle"} data-state={state}>
        {label}
      </span>
      <button
        ref={btn}
        type="button"
        className="footer__email"
        data-state={state}
        aria-describedby={tipId}
        onClick={copy}
        onPointerEnter={(e) => e.pointerType === "mouse" && setTip(true)}
        onPointerLeave={() => setTip(false)}
        onFocus={() => setTip(true)}
        onBlur={() => setTip(false)}
      >
        <span ref={txt}>{email}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? t.liveOk : state === "failed" ? t.liveFail : ""}
      </span>
      {!compact && (
        <a className="femail__send mono" href={`mailto:${email}`}>
          {t.send}
        </a>
      )}
    </div>
  );
}
