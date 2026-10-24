"use client";
// Footer monumental (parecer v4 §5.5): branco com sticky reveal, "BRING THE Problem", @lucshllw + e-mail copiável,
// CTAs, canais e LUCAS MELO ajustado à largura (v5: sem letras cortadas; entrada por letra no DOM e, nos tiers
// mid/high, camada WebGL com loop sutil + rastro pixelado do emblema no hover — components/WordmarkFx.tsx).
import { useEffect, useRef } from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import { HANDLE, PROFILE } from "@/lib/content";
import { useT } from "@/lib/i18n/provider";
import { gsap, isReduced, ScrollTrigger, SplitText } from "@/lib/gsap";
import { getLenis } from "@/lib/lenis-store";
import CopyEmail from "./CopyEmail";
import { TransitionLink } from "./PageTransition";
import WordmarkFx from "./WordmarkFx";

const WORD = "LUCAS MELO";

/** "[ ALL WORKS → ]" → colchetes e seta em spans próprios (hover: abrem ∓6 px, seta desliza 4 px). Texto igual. */
function Bracket({ text }: { text: string }) {
  const m = /^\[\s*(.*?)\s*(→)?\s*\]$/.exec(text);
  if (!m) return <>{text}</>;
  // um único filho: o .sf__cta é inline-flex e descartaria os espaços entre itens
  return (
    <span className="sf__cta-in">
      <span className="sf__br">[</span> {m[1]}
      {m[2] && (
        <>
          {" "}
          <span className="sf__arr">{m[2]}</span>
        </>
      )}{" "}
      <span className="sf__br">]</span>
    </span>
  );
}

/** Anel 1 px desenhado no hover/foco dos ícones (stroke-dashoffset). */
function Ring() {
  return (
    <svg className="sf__ring" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <circle cx="22" cy="22" r="20.5" pathLength={1} />
    </svg>
  );
}

/** "© 2026 Lucas Melo": os 4 dígitos do ano viram colunas de odômetro (estado final no CSS; sem JS = texto pronto). */
function Odometer({ text }: { text: string }) {
  const m = /^(.*?)(\d{4})(.*)$/.exec(text);
  if (!m) return <span>{text}</span>;
  return (
    <span className="sf__copy">
      <span aria-hidden="true">
        {m[1]}
        {m[2].split("").map((d, i) => (
          <span key={i} className="sf__odo">
            <span className="sf__odo-col" data-d={d} style={{ transform: `translateY(-${+d * 10}%)` }}>
              {"0123456789".split("").map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        ))}
        {m[3]}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

const TECH = ["Next.js", "GSAP", "Lenis", "OGL"];
/** "Built with Next.js, GSAP, Lenis and OGL": nomes das tecnologias em spans para o decode (≥768). */
function Decode({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${TECH.map((x) => x.split(".").join("[.]")).join("|")})`));
  return (
    <span className="sf__built">
      <span aria-hidden="true">{parts.map((p, i) => (TECH.includes(p) ? <span key={i} className="sf__tech">{p}</span> : p))}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

export default function SiteFooter() {
  const t = useT().footer;
  const big = useRef<HTMLParagraphElement>(null);
  const root = useRef<HTMLElement>(null);

  // ajuste à largura: mede uma vez por resize. v5: a largura medida inclui a folga das letras (o tracking negativo
  // deixa a borda direita do glifo além da caixa) e o alvo tem 2% de margem — nenhuma letra corta em 390–1440 px.
  useEffect(() => {
    const el = big.current;
    if (!el) return;
    let alive = true;
    const fit = () => {
      const host = root.current;
      if (!alive || !host || !el.isConnected) return;
      el.style.fontSize = "";
      const cs = getComputedStyle(host);
      const target = (host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.98;
      const inner = el.firstElementChild as HTMLElement;
      const w = inner.scrollWidth;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (w > 0) el.style.fontSize = `${Math.floor((target / w) * fs * 100) / 100}px`;
      window.dispatchEvent(new Event("fbig:fit"));
    };
    fit();
    document.fonts?.ready.then(fit);
    let rt = 0;
    const onR = () => {
      cancelAnimationFrame(rt);
      rt = requestAnimationFrame(fit);
    };
    window.addEventListener("resize", onR);
    return () => {
      alive = false;
      window.removeEventListener("resize", onR);
      cancelAnimationFrame(rt);
    };
  }, []);

  // entrada letra a letra com máscara (só a base é recortada) quando 40% do wordmark entra em vista
  useEffect(() => {
    const el = big.current;
    if (!el || isReduced() || document.documentElement.dataset.tier === "low") return;
    const letters = el.querySelectorAll<HTMLElement>(".fbig__l");
    gsap.set(letters, { yPercent: 105 });
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        gsap.to(letters, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: { each: 0.045, from: "start" }, clearProps: "transform" });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      gsap.killTweensOf(letters);
      gsap.set(letters, { clearProps: "transform" });
    };
  }, []);

  // Entrada dos textos secundários (parecer v3.1, parte 2): UMA timeline, disparada uma vez quando o rodapé
  // aparece (o footer é sticky atrás do <main>: o gatilho é a base do <main> a 60% da viewport). Técnicas
  // distintas: decode, máscara por palavra, traço de pena, linha a linha, digitação, sublinhado, entrada dos CTAs
  // e ícones, odômetro e decode das tecnologias. Cascata ≤ 1,6 s. Estados iniciais só via JS. Lite: fade 0,3 s
  // (sem SplitText/ScrambleText). Reduced: nada.
  useEffect(() => {
    const el = root.current;
    const main = document.querySelector("main");
    if (!el || !main || isReduced()) return;
    const lite = /^(low|reduced)$/.test(document.documentElement.dataset.tier ?? "");
    const q = <T extends Element = HTMLElement>(sel: string) => [...el.querySelectorAll<T & Element>(sel)] as unknown as T[];
    const groups = q(".sf__label, .sf__title, .sf__line, .sf__handle, .footer__email, .sf__cta, .sf__icons li, .sf__copy, .sf__built");
    const splits: SplitText[] = [];
    let tl: gsap.core.Timeline | null = null;
    // montagem preguiçosa (SplitText, estados iniciais) quando a base do <main> chega a 2 viewports: o rodapé sticky
    // fica pintado atrás do <main> desde o carregamento, e dividir o texto cedo criava um candidato tardio a LCP
    const build = () => {
    if (tl) return tl;
    if (lite) {
      tl = gsap.timeline({ paused: true }).from(groups, { opacity: 0, duration: 0.3, ease: "none", clearProps: "opacity" });
    } else {
      const label = el.querySelector<HTMLElement>(".sf__label .sf__fx")!;
      const labelText = label.textContent ?? "";
      const grot = el.querySelector<HTMLElement>(".sf__title .grot")!;
      const pen = el.querySelector<HTMLElement>(".sf__pen")!;
      const nib = el.querySelector<HTMLElement>(".sf__nib")!;
      const line = el.querySelector<HTMLElement>(".sf__line")!;
      const typed = el.querySelector<HTMLElement>(".sf__typed")!;
      const caret = el.querySelector<HTMLElement>(".sf__caret")!;
      const handle = typed.textContent ?? "";
      const email = el.querySelector<HTMLElement>(".sf__row2 .footer__email");
      const ctas = q(".sf__cta");
      const icons = q(".sf__icons li");
      const cols = q(".sf__odo-col");
      const techs = q(".sf__tech");
      const wide = window.matchMedia("(min-width: 768px)").matches;
      const sw = splits[splits.push(new SplitText(grot, { type: "words", mask: "words" })) - 1];
      const sl = splits[splits.push(new SplitText(line, { type: "lines", mask: "lines" })) - 1];
      const k = wide ? 1 : 0.75; // stagger mobile × 0,75
      const type = { n: 0 };
      const t2 = gsap.timeline({ paused: true });
      tl = t2;
      t2.to(label, { duration: 0.7, ease: "none", scrambleText: { text: labelText, chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·", revealDelay: 0.1, speed: 0.6 } }, 0)
        .from(sw.words, { yPercent: 110, duration: 0.8, ease: "expo.out", stagger: 0.08 * k }, 0.15)
        .fromTo(pen, { clipPath: "inset(-30% 105% -30% -10%)" }, { clipPath: "inset(-30% -10% -30% -10%)", duration: 0.9, ease: "power4.inOut", clearProps: "clipPath" }, 0.35)
        .fromTo(nib, { left: "0%", opacity: 1 }, { left: "100%", duration: 0.9, ease: "power4.inOut" }, 0.35)
        .to(nib, { opacity: 0, duration: 0.15 }, 1.25)
        .from(sl.lines, { yPercent: 100, duration: 0.7, ease: "power3.out", stagger: 0.1 * k }, 0.55)
        .fromTo(type, { n: 0 }, { n: handle.length, duration: handle.length * 0.045, ease: "none", onUpdate: () => (typed.textContent = handle.slice(0, Math.round(type.n))) }, 0.7)
        .fromTo(caret, { opacity: 1 }, { opacity: 0, duration: 0.15, repeat: 5, yoyo: true, ease: "steps(1)" }, 0.7 + handle.length * 0.045)
        .set(caret, { display: "none" })
        .from(ctas, { y: 8, opacity: 0, duration: 0.5, ease: "power2.out", stagger: 0.06 * k, clearProps: "transform,opacity" }, 0.95)
        .from(icons, { scale: 0.6, opacity: 0, duration: 0.45, ease: "back.out(2)", stagger: 0.05 * k, clearProps: "transform,opacity" }, 1.05)
;
      cols.forEach((c, i) => {
        const d = Number(c.dataset.d ?? 0);
        t2.fromTo(c, { y: 0, yPercent: 0 }, { yPercent: -d * 10, duration: 0.9, ease: "power3.out" }, 0.6 + i * 0.07 * k);
      });
      if (email) t2.fromTo(email, { "--ul": 0 }, { "--ul": 1, duration: 0.6, ease: "power2.inOut" }, 0.85);
      if (wide)
        techs.forEach((tch, i) => {
          t2.to(tch, { duration: 0.3, ease: "none", scrambleText: { text: tch.textContent ?? "", chars: "upperAndLowerCase", speed: 0.8 } }, 0.9 + i * 0.12);
        });
      // estados iniciais (só com JS)
      gsap.set(caret, { opacity: 1, display: "inline" });
      typed.textContent = "";
    }
    (window as unknown as { __qa?: Record<string, unknown> }).__qa = { ...(window as unknown as { __qa?: Record<string, unknown> }).__qa, footerTl: tl };
    return tl;
    };
    // end "max": qualquer posição depois do início conta como dentro (um salto direto ao fim também dispara)
    // início limitado ao fim real da rolagem: em páginas cujo rodapé é mais baixo que 40% da viewport a base do
    // <main> nunca chegaria a 60% (o gatilho ficaria inalcançável e o texto preso no estado inicial)
    const at = (k: number) => () => {
      const y = main.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * k;
      return Math.max(0, Math.min(y, ScrollTrigger.maxScroll(window) - 2));
    };
    const prep = ScrollTrigger.create({ trigger: main, start: at(2), end: "max", once: true, onEnter: () => void build() });
    const st = ScrollTrigger.create({ trigger: main, start: at(0.6), end: "max", once: true, onEnter: () => build().play() });
    return () => {
      prep.kill();
      st.kill();
      tl?.kill();
      splits.forEach((x) => x.revert());
      gsap.set(groups, { clearProps: "all" });
      const typed = el.querySelector<HTMLElement>(".sf__typed");
      if (typed) typed.textContent = typed.previousElementSibling?.textContent ?? "";
      el.querySelector<HTMLElement>(".sf__caret")?.style.removeProperty("display");
    };
  }, []);

  const top = (e: React.MouseEvent) => {
    e.preventDefault();
    const l = getLenis();
    if (l) l.scrollTo(0, { duration: 1.4 });
    else window.scrollTo({ top: 0, behavior: isReduced() ? "auto" : "smooth" });
    document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
  };

  return (
    <footer className="site-footer" id="contact" data-theme="light" ref={root}>
      <div className="sf__row1">
        <p className="mono sf__label">
          <span className="sf__fx" aria-hidden="true">
            {t.label}
          </span>
          <span className="sr-only">{t.label}</span>
        </p>
        <h2 className="sf__title">
          <span className="grot">{t.titleGrot}</span>{" "}
          <span className="black sf__pen">
            {t.titleBlack}
            <span className="sf__nib" aria-hidden="true" />
          </span>
        </h2>
        <p className="mono sf__line">{t.line}</p>
      </div>
      <div className="sf__row2">
        <p className="sf__handle">
          <span className="sf__type" aria-hidden="true">
            <span className="sf__ghost">{HANDLE}</span>
            <span className="sf__typed">{HANDLE}</span>
          </span>
          <span className="sf__caret" aria-hidden="true">
            ▌
          </span>
          <span className="sr-only">{HANDLE}</span>
        </p>
        <CopyEmail email={PROFILE.email} />
      </div>
      <div className="sf__row3">
        <nav className="sf__ctas" aria-label="Footer">
          <TransitionLink href="/works" className="sf__cta mono">
            <Bracket text={t.ctas.works} />
          </TransitionLink>
          <TransitionLink href="/about" className="sf__cta mono">
            <Bracket text={t.ctas.about} />
          </TransitionLink>
          <TransitionLink href="/curriculo" className="sf__cta mono">
            <Bracket text={t.ctas.cv} />
          </TransitionLink>
        </nav>
        <ul className="sf__icons" aria-label={t.channels}>
          <li>
            <a href={PROFILE.github} target="_blank" rel="noopener noreferrer" aria-label={t.github}>
              <Github aria-hidden />
              <Ring />
            </a>
          </li>
          <li>
            <a href={PROFILE.linkedin} target="_blank" rel="noopener noreferrer" aria-label={t.linkedin}>
              <Linkedin aria-hidden />
              <Ring />
            </a>
          </li>
          <li>
            <a href={`mailto:${PROFILE.email}`} aria-label={`${t.mail}: ${PROFILE.email}`}>
              <Mail aria-hidden />
              <Ring />
            </a>
          </li>
        </ul>
      </div>
      <p className="fbig" ref={big} aria-hidden="true">
        <span className="fbig__in">
          {WORD.split("").map((c, i) => (
            <span key={i} className="fbig__m">
              <span className="fbig__ghost">{c === " " ? " " : c}</span>
              <span className="fbig__l">{c === " " ? " " : c}</span>
            </span>
          ))}
          <span className="fbig__base" />
        </span>
        <WordmarkFx host={big} />
      </p>
      <p className="sf__legal mono">
        <Odometer text={t.legal.copy} />
        <Decode text={t.legal.built} />
        <a href="#content" onClick={top} className="sf__top">
          {t.legal.top}
        </a>
      </p>
    </footer>
  );
}
