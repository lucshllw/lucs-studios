"use client";
// Ponteiro global único para os componentes adaptados do React Bits (um listener; leitura no gsap.ticker).
export const pointer = { x: -9999, y: -9999, active: false, fine: true };
let bound = false;
export function bindPointer() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  pointer.fine = matchMedia("(pointer: fine)").matches;
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    },
    { passive: true }
  );
  document.addEventListener("pointerleave", () => (pointer.active = false));
}
