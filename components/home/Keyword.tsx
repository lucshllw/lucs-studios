"use client";
// Palavra-chave do hero: React Bits Magnet + VariableProximity (adaptados), decodificando de ASCII ao entrar
// (comportamento do DecryptedText). Clique/Enter/foco destacam (aria-pressed). Texto real no aria-label.
import { useEffect, useRef, useState } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion } from "@/lib/motion";
import { ui } from "@/lib/store";
import { Magnet } from "@/components/bits/Magnet";
import { VariableProximity } from "@/components/bits/VariableProximity";

const ASCII = ".:-=+*#%@/\\|<>";

export function Keyword({ label, index }: { label: string; index: number }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [on, setOn] = useState(false);
  const [focus, setFocus] = useState(false);

  // decodifica de ASCII depois que a intro termina (stagger por índice)
  useEffect(() => {
    const el = btn.current;
    if (!el || reducedMotion()) return;
    const letters = Array.from(el.querySelectorAll<HTMLSpanElement>(".vp-l"));
    const chars = letters.map((l) => l.textContent ?? "");
    let start = -1;
    let done = false;
    letters.forEach((l, i) => (l.textContent = chars[i] === " " ? " " : ASCII[i % ASCII.length]));
    const untick = addTick((time) => {
      if (done) return;
      if (ui.get().intro) return;
      if (start < 0) {
        start = time + 0.25 + index * 0.12;
        // etapa 6 (CLS): cada letra fica com a largura do caractere real durante a decodificação — os glifos
        // aleatórios não empurram o resto da palavra (antes: dezenas de layout shifts no celular)
        letters.forEach((l, i) => (l.textContent = chars[i]));
        const ws = letters.map((l) => l.getBoundingClientRect().width);
        letters.forEach((l, i) => {
          l.style.width = `${ws[i]}px`;
          l.style.textAlign = "center";
          l.style.overflow = "hidden";
        });
      }
      const k = (time - start) / 0.7;
      const revealed = Math.floor(Math.max(0, k) * chars.length);
      letters.forEach((l, i) => {
        if (chars[i] === " ") return;
        l.textContent = i < revealed ? chars[i] : ASCII[Math.floor(Math.random() * ASCII.length)];
      });
      if (revealed >= chars.length) {
        done = true;
        letters.forEach((l, i) => {
          l.textContent = chars[i];
          l.style.width = l.style.textAlign = l.style.overflow = "";
        });
      }
    });
    return () => {
      untick();
      letters.forEach((l, i) => (l.textContent = chars[i]));
    };
  }, [index]);

  return (
    <button
      ref={btn}
      type="button"
      className={`kw${on ? " is-on" : ""}`}
      aria-pressed={on}
      aria-label={label}
      onClick={() => setOn((x) => !x)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    >
      <Magnet padding={50} strength={4}>
        <VariableProximity label={label} radius={110} from={300} to={900} focused={on || focus} />
      </Magnet>
    </button>
  );
}
