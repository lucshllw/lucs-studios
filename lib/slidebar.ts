"use client";
import { useEffect, type RefObject } from "react";

/** Sublinhado deslizante dos toggles (EN/PT, GRID/LIST): mede o botão pressionado e grava --lt-x/--lt-w no grupo. */
export function useSlideBar(ref: RefObject<HTMLElement | null>, dep: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => {
      const b = el.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!b) return;
      el.style.setProperty("--lt-x", `${b.offsetLeft + 4}px`);
      el.style.setProperty("--lt-w", `${Math.max(8, b.offsetWidth - 8)}px`);
    };
    set();
    document.fonts?.ready.then(set);
    const ro = new ResizeObserver(set); // também cobre o grupo dentro do menu (oculto até abrir)
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, dep]);
}
