"use client";
// Estado mínimo compartilhado entre HUD, overlays e Works (sem dependência externa).
import { useSyncExternalStore } from "react";

export type UI = {
  menu: boolean;
  reel: boolean;
  profile: boolean;
  /** slug do painel aberto (Works) */
  panel: string | null;
  /** vista atual do Works (para o HUD) */
  works: "featured" | "full" | null;
  /** intro/transição cobrindo a tela */
  intro: boolean;
};

let state: UI = { menu: false, reel: false, profile: false, panel: null, works: null, intro: false };
const listeners = new Set<() => void>();
/** ações registradas pelo Works (o HUD chama sem conhecer a cena) */
/** etapa 6: a intro cobre a tela inteira (opaca) — o mundo WebGL não precisa renderizar quadros invisíveis */
export const cover = { on: false };
export const actions: { closePanel?: () => void } = {};

export const ui = {
  get: () => state,
  set(patch: Partial<UI>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

const server: UI = { menu: false, reel: false, profile: false, panel: null, works: null, intro: false };
export function useUI<T>(sel: (s: UI) => T): T {
  return useSyncExternalStore(ui.subscribe, () => sel(state), () => sel(server));
}
