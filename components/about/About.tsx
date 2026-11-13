"use client";
// About (etapa 4) — A3 CÂMARA ESCURA (DarkroomLayer no World) + currículo 01–04 em "fichas de laboratório" + footer 05.
// Sem WebGL: foto + lista do método + currículo. Reduced-motion: tratamento por estação sem animação autônoma.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion, tier } from "@/lib/motion";
import { PROJECTS } from "@/lib/projects";
import { CV, SITE } from "@/lib/site";
import { getWorld } from "@/lib/world/World";
import { DarkroomLayer } from "@/lib/world/DarkroomLayer";
import { DecryptedText } from "@/components/bits/DecryptedText";
import { ShinyText } from "@/components/bits/ShinyText";
import { Magnet } from "@/components/bits/Magnet";
import { SectionIntro } from "@/components/bits/SectionIntro";
import { HomeFooter } from "@/components/home/HomeFooter";
import { SectionIndex } from "@/components/SectionIndex";

const INDEX = [
  { id: "darkroom", label: "Darkroom" },
  { id: "darkroom", label: "Method", at: 0.17 },
  { id: "about-cv", label: "Résumé" },
  { id: "contact", label: "Contact", goAt: 0.9 },
];

const METHOD = [
  { n: "01", t: "Observe", cap: "Negative, inverted", img: "/brand/metodo-01-observar.webp" },
  { n: "02", t: "Direct", cap: "Crop marks and grid", img: "/brand/metodo-02-dirigir.webp" },
  { n: "03", t: "Forge", cap: "Coarse halftone in ember", img: "/brand/metodo-03-forjar.webp" },
  { n: "04", t: "Animate", cap: "Dots in flow", img: "/brand/metodo-04-animar.webp" },
  { n: "05", t: "Measure", cap: "Measurement HUD", img: "/brand/metodo-05-medir.webp" },
  { n: "06", t: "Deliver", cap: "Final black-and-white print", img: "/brand/metodo-06-entregar.webp" },
];

let layer: DarkroomLayer | null = null;

export function About() {
  const root = useRef<HTMLElement>(null);
  const [station, setStation] = useState(-1);
  const [rev, setRev] = useState(0);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const el = root.current!;
    const track = el.querySelector<HTMLElement>(".dark")!;
    const stick = el.querySelector<HTMLElement>(".dark-stick")!;
    const reduced = reducedMotion();
    const t = tier();
    const world = t > 0 ? getWorld({ tier: t === 1 ? 1 : 2, reduced }) : null;
    let inView = true;
    const cleanups: (() => void)[] = [];
    let lastRev = -1;
    if (world) {
      if (!layer) {
        layer = new DarkroomLayer(world, { reduced });
        world.addLayer(layer);
      }
      const L = layer;
      L.reduced = reduced;
      L.resetVisit();
      L.els = {
        overlays: {
          grid: el.querySelector(".ov-grid")!,
          meas: el.querySelector(".ov-meas")!,
          final: el.querySelector(".ov-final")!,
          frame: el.querySelector(".ov-frame")!,
        },
        onStation: (i) => setStation(i),
        onReveal: (f, ok) => {
          const pct = Math.round(f * 100);
          if (pct !== lastRev) {
            lastRev = pct;
            setRev(pct);
          }
          if (ok) setUnlocked(true);
        },
      };
      L.resize();
      L.object.visible = true;
      world.setMode("about");
      el.classList.add("about-gl");
      const mv = (e: PointerEvent) => L.pointer(e.clientX, e.clientY, true, e.pointerType, e.buttons > 0);
      const dn = (e: PointerEvent) => L.pointer(e.clientX, e.clientY, true, e.pointerType, true);
      const up = (e: PointerEvent) => L.pointer(e.clientX, e.clientY, e.pointerType === "mouse", e.pointerType, false);
      const lv = () => L.pointer(-999, -999, false, "mouse", false);
      stick.addEventListener("pointermove", mv);
      stick.addEventListener("pointerdown", dn);
      stick.addEventListener("pointerup", up);
      stick.addEventListener("pointerleave", lv);
      const onResize = () => {
        world.resize();
        L.resize();
      };
      window.addEventListener("resize", onResize);
      const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting));
      io.observe(track);
      cleanups.push(() => {
        stick.removeEventListener("pointermove", mv);
        stick.removeEventListener("pointerdown", dn);
        stick.removeEventListener("pointerup", up);
        stick.removeEventListener("pointerleave", lv);
        window.removeEventListener("resize", onResize);
        io.disconnect();
      });
      const untick = addTick(() => {
        const r = track.getBoundingClientRect();
        L.p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
        L.object.visible = inView;
        // o canvas é fixo: quando o palco desafixa e sobe, a foto WebGL sobe junto (antes ficava parada e cobria o
        // currículo, com o "Lucas Melo" da cópia final sobre o 01 PROFILE)
        const st = stick.getBoundingClientRect().top;
        world.canvas.style.transform = st < -0.5 ? `translate3d(0, ${st.toFixed(1)}px, 0)` : "";
        // o canvas some quando o palco termina
        world.canvas.style.opacity = String(Math.min(1, Math.max(0, r.bottom / (innerHeight * 0.5))));
        stick.style.setProperty("--safe", String((1 - Math.min(1, Math.max(0, (L.p - 5 / 6) * 6))) * 0.2));
      });
      cleanups.push(untick);
    } else {
      window.dispatchEvent(new Event("rito:ready"));
    }
    return () => {
      cleanups.forEach((c) => c());
      if (layer) {
        layer.object.visible = false;
        layer.els = null;
      }
      if (world) world.canvas.style.transform = "";
      if (world && world.mode === "about") world.setMode("off");
    };
  }, []);

  return (
    <main id="main" tabIndex={-1} className="about" ref={root}>
      <h1 className="sr-only">About Lucas Melo</h1>
      <section className="dark" id="darkroom" aria-label="Darkroom portrait and method">
        <div className="dark-stick">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="dark-fallback" src="/brand/foto-620.webp" alt="Lucas Melo in a white shirt, sitting at night" width={620} height={814} />
          <div className="dark-safe" aria-hidden="true" />
          <p className="dark-hud tl" aria-hidden="true">
            <span className="dot">●</span> DARKROOM · SAFELIGHT 20%
            <br />
            REVEALED {rev}%
          </p>
          <p className="dark-hud tr" aria-live="polite">
            {station < 0 ? (
              <DecryptedText text="Safelight · move the cursor to develop the print" animateOn="view" />
            ) : (
              <DecryptedText key={station} text={`${METHOD[station].n} · ${METHOD[station].t} — ${METHOD[station].cap}`} animateOn="view" speed={40} />
            )}
          </p>
          <ol className="stations" aria-label="Method">
            {METHOD.map((m, i) => (
              <li key={m.n} className={`station${i === station ? " on" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.img} alt="" loading="lazy" />
                <div>
                  <b>
                    {m.n} {m.t}
                  </b>
                  <small>{m.cap}</small>
                </div>
              </li>
            ))}
          </ol>
          <div className="ov ov-frame" aria-hidden="true" />
          <div className="ov ov-grid" aria-hidden="true">
            <span>CROP 4:5 · 1/3</span>
          </div>
          <div className="ov ov-meas" aria-hidden="true">
            <div className="box" />
            <div className="ln" />
            <p className="rd">
              F/1.8
              <br />
              1/60 S<br />
              ISO 1600
              <br />
              WB 3200K
              <br />
              FOCUS 0.82
            </p>
          </div>
          <div className="ov ov-final" aria-hidden="true">
            <p>Lucas Melo</p>
          </div>
          <Magnet className="resume-cta-wrap" padding={40}>
            <a className={`resume-cta${unlocked ? " unlocked" : ""}`} href={SITE.resume} download="lucas-melo-resume.pdf">
              {unlocked ? <ShinyText>Résumé (PDF) ↓</ShinyText> : "Résumé (PDF) ↓"}
              <span className="sr-only"> — Portuguese, {unlocked ? "unlocked" : "download"}</span>
            </a>
          </Magnet>
        </div>
      </section>

      <SectionIntro n={1} title="Profile" className="cv-sec-a" id="about-cv">
        <p className="cv-lead">{CV.profile}</p>
      </SectionIntro>
      <SectionIntro n={2} title="Skills" className="cv-sec-a">
        <dl className="cv-skills">
          {CV.skills.map((s) => (
            <div key={s.k}>
              <dt>{s.k}</dt>
              <dd>{s.v}</dd>
            </div>
          ))}
        </dl>
      </SectionIntro>
      <SectionIntro n={3} title="Selected work" className="cv-sec-a">
        <ol className="cv-work">
          {PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link href={`/works/${p.slug}/`}>
                <span className="n">{p.n}</span>
                <span className="name">{p.name}</span>
                <span className="kind">
                  {p.kind}
                  {p.slug === "infernai" ? " · built as a pair" : ""}
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </SectionIntro>
      <SectionIntro n={4} title="Education" className="cv-sec-a">
        <ul className="cv-edu">
          {CV.education.map((e) => (
            <li key={e.inst}>
              <span className="inst">{e.inst}</span>
              <span className="course">{e.course}</span>
              <span className="status">{e.status}</span>
            </li>
          ))}
        </ul>
      </SectionIntro>
      <HomeFooter />
      <SectionIndex items={INDEX} />
    </main>
  );
}
