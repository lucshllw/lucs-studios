// Referência global da instância Lenis (única) e travas de scroll nomeadas. O SmoothScroll é o dono: cria,
// registra e destrói. Quem precisa parar o scroll (intro, menu, transição, player, /works em grade) usa
// holdScroll(chave)/releaseScroll(chave); o Lenis só volta quando não há nenhuma trava.
import type Lenis from "lenis";

let current: Lenis | null = null;
const holds = new Set<string>();

const sync = () => {
  if (!current) return;
  if (holds.size) current.stop();
  else current.start();
};
export const setLenisStore = (l: Lenis | null) => {
  current = l;
  if (typeof window !== "undefined") (window as unknown as { __lenis?: Lenis | null }).__lenis = l; // QA
  sync();
};
export const getLenis = () => current;
export const holdScroll = (key: string) => {
  holds.add(key);
  sync();
};
export const releaseScroll = (key: string) => {
  holds.delete(key);
  sync();
};
export const scrollHolds = () => [...holds];
