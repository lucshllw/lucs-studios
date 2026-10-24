"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { CV, CV_LINKS } from "@/lib/curriculo";
import { PROJECTS } from "@/lib/projects";
import { useLang } from "@/lib/i18n/provider";
import { LangToggle } from "./HeaderControls";
import { TransitionLink } from "./PageTransition";
import { gsap, MOTION_OK, useIsoLayoutEffect } from "@/lib/gsap";
import { useMagnetic } from "@/lib/magnetic";

const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function MagLink({ href, children, external = true }: { href: string; children: React.ReactNode; external?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useMagnetic(ref, { radius: 60, max: 6, strength: 0.25 });
  return (
    <a ref={ref} className="cv-link" href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

function CvEmail({ copy, copied }: { copy: string; copied: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const ref = useRef<HTMLButtonElement>(null);
  const t = useRef<number | undefined>(undefined);
  useMagnetic(ref, { radius: 60, max: 6, strength: 0.25 });
  useEffect(() => () => window.clearTimeout(t.current), []);
  const run = async () => {
    window.clearTimeout(t.current);
    try {
      await navigator.clipboard.writeText(CV_LINKS.email);
      setState("ok");
    } catch {
      const sel = window.getSelection();
      const r = document.createRange();
      if (ref.current && sel) {
        r.selectNodeContents(ref.current);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      setState("fail");
    }
    t.current = window.setTimeout(() => setState("idle"), 1600);
  };
  return (
    <span className="cv-email">
      <button ref={ref} type="button" className="cv-link cv-email__btn" onClick={run} title={copy}>
        {CV_LINKS.email}
      </button>
      <span className="cv-email__tip mono no-print" aria-live="polite" data-show={state !== "idle"}>
        {state === "ok" ? copied : state === "fail" ? "Ctrl+C" : ""}
      </span>
    </span>
  );
}

/**
 * /curriculo (v3 §8 + v4 §2 + v5): idioma do estado global (useLang; toggle EN/PT-BR só aqui, ?lang= e localStorage),
 * SSR em EN; entrada em stagger (GSAP, só sem reduced-motion; sem JS fica visível);
 * [ DOWNLOAD CV AS PDF ] = window.print() do idioma ativo, @media print A4 de 1 página.
 */
export default function Curriculo() {
  const { lang } = useLang();
  const root = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const c = CV[lang];

  // stagger de entrada (uma vez)
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el || !first.current) return;
    first.current = false;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const rows = gsap.utils.toArray<HTMLElement>(".cv-row", el);
      gsap.fromTo(
        rows,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, ease: "expo.out", stagger: 0.045, clearProps: "all" },
      );
    });
    return () => mm.revert();
  }, []);

  return (
    <div className="cv" ref={root}>
      <nav className="cv-top no-print cv-row" aria-label={c.labels.nav}>
        <TransitionLink className="cv-link mono" href="/">
          {c.labels.back}
        </TransitionLink>
        <div className="cv-top__r">
          {/* v5: única alternância EN/PT-BR do site */}
          <LangToggle />
          <button type="button" className="cv-print mono" onClick={() => window.print()}>
            {c.labels.print}
          </button>
        </div>
      </nav>

      <main className="cv-body i18n-fade" id="content" tabIndex={-1} lang={c.htmlLang}>
        <header className="cv-head cv-row">
          <h1 className="cv-name" tabIndex={-1}>LUCAS MELO</h1>
          <div className="cv-head__meta">
            <p className="mono cv-role">{c.title}</p>
            <p className="mono cv-status">
              <span className="cv-dot" aria-hidden="true" />
              {c.status}
            </p>
            <p className="mono cv-loc">{c.location}</p>
          </div>
          <ul className="cv-contacts" aria-label={c.labels.contact}>
            <li>
              <CvEmail copy={c.labels.copy} copied={c.labels.copied} />
            </li>
            <li>
              <MagLink href={CV_LINKS.site}>{host(CV_LINKS.site)}</MagLink>
            </li>
            <li>
              <MagLink href={CV_LINKS.github}>github.com/lucshllw</MagLink>
            </li>
            <li>
              <MagLink href={CV_LINKS.linkedin}>LinkedIn</MagLink>
            </li>
            <li className="mono">{CV_LINKS.handle}</li>
          </ul>
        </header>

        <section className="cv-block cv-row" aria-labelledby="cv-summary">
          <h2 className="cv-label mono" id="cv-summary">
            {c.labels.summary}
          </h2>
          <p className="cv-summary">{c.summary}</p>
        </section>

        <section className="cv-block cv-row" aria-labelledby="cv-stack">
          <h2 className="cv-label mono" id="cv-stack">
            {c.labels.stack}
          </h2>
          <div className="cv-stack">
            {c.stack.map((s) => (
              <div key={s.title}>
                <h3 className="mono">{s.title}</h3>
                <p>{s.items}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cv-block" aria-labelledby="cv-cases">
          <h2 className="cv-label mono cv-row" id="cv-cases">
            {c.labels.cases}
          </h2>
          <ol className="cv-projects">
            {PROJECTS.map((p) => (
              <li key={p.slug} className="cv-project cv-row">
                <a className="cv-project__name" href={p.url} target="_blank" rel="noopener noreferrer">
                  {p.name}
                  <ArrowUpRight aria-hidden className="cv-case__arrow" />
                  <span className="sr-only"> {lang === "pt" ? "(abre em nova aba)" : "(opens in a new tab)"}</span>
                </a>
                <span className="cv-project__kind">{p.kind[lang]}</span>
                <span className="mono cv-project__stack">{p.stack.join(" · ")}</span>
                <span className="mono cv-project__url">{host(p.url)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="cv-block cv-row" aria-labelledby="cv-method">
          <h2 className="cv-label mono" id="cv-method">
            {c.labels.method}
          </h2>
          <ol className="cv-method">
            {c.method.map((m) => (
              <li key={m.n}>
                <span className="cv-method__n mono">{m.n}</span>
                <span className="cv-method__name">{m.name}</span>
                <span className="cv-method__text mono">{m.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="cv-block cv-row" aria-labelledby="cv-edu">
          <h2 className="cv-label mono" id="cv-edu">
            {c.labels.education}
          </h2>
          <ul className="cv-edu">
            {c.education.map((e) => (
              <li key={e.inst}>
                <strong>{e.inst}</strong> — {e.course} <span className="mono">· {e.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
