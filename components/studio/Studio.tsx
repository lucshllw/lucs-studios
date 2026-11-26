"use client";
// /studio — WORKSHOP v3 (aprovado 13/11). Cena 3D do setup real no World único (StudioLayer); todo o conteúdo e
// todas as ações existem também como HTML (botões, painéis, links). Sem aceleração de hardware (WebGL por software
// ou ausente) entra o MODO FILME (lib/studioFilm): quadros reais da cena, gravados com GPU, tocados em canvas 2D.
import { useCallback, useEffect, useRef, useState } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion, tier } from "@/lib/motion";
import { ui } from "@/lib/store";
import { CV, SITE } from "@/lib/site";
import { PROJECTS, cardTexture } from "@/lib/projects";
import { getWorld } from "@/lib/world/World";
import { HOT_LABEL, StudioLayer, type HotId, type StudioEls } from "@/lib/world/StudioLayer";
import { StudioFilm } from "@/lib/studioFilm";
import { openReel } from "@/components/shell/ReelPlayer";
import { useDialog } from "@/components/shell/useDialog";
import { intro } from "@/components/shell/Intro";

let layer: StudioLayer | null = null;
/** modo filme (sem aceleração de hardware): quadros reais da cena em canvas 2D — uma instância por visita */
let film: StudioFilm | null = null;
const ORDER: HotId[] = ["reel", "works", "keyboard", "case", "folder", "phone", "lamp"];
type PanelId = "stack" | "cv" | "wa" | null;

export function Studio() {
  const root = useRef<HTMLElement>(null);
  const typer = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<PanelId>(null);
  const [live, setLive] = useState("");
  const [typing, setTyping] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const doAction = useCallback((id: HotId, rect: { x: number; y: number; w: number; h: number } | null) => {
    if (id === "reel") openReel(rect, 0);
    else if (id === "works") {
      setLive("Opening Works");
      window.setTimeout(() => intro.go("/works/", "Works"), (layer || film) && !reducedMotion() ? 650 : 0);
    } else if (id === "keyboard") {
      setTyping(true);
      setLive("Typing on the left monitor. Press Escape to stop.");
      window.setTimeout(() => typer.current?.focus({ preventScroll: true }), 30);
    } else if (id === "case") setPanel("stack");
    else if (id === "folder") setPanel("cv");
    else if (id === "phone") setPanel("wa");
  }, []);

  const press = (id: HotId, el: HTMLElement) => {
    opener.current = el;
    if (layer && layer.object.visible) layer.act(id);
    else if (film?.ok) film.act(id);
    else doAction(id, id === "reel" ? rectOf(el) : null);
  };

  useEffect(() => {
    const el = root.current!;
    const stage = el.querySelector<HTMLElement>(".st-stage")!;
    const reduced = reducedMotion();
    const t = tier();
    // 26/11: WebGL por software (classe soft) ou sem WebGL → MODO FILME: os quadros gravados da cena real, com as
    // mesmas interações. A foto do setup não existe mais em nenhum caminho.
    const soft = document.documentElement.classList.contains("soft");
    const world = t > 0 && !soft ? getWorld({ tier: t === 1 ? 1 : 2, reduced }) : null;
    const cleanups: (() => void)[] = [];
    if (!world) {
      const F = new StudioFilm(stage, { reduced, captures: PROJECTS.map(cardTexture), names: PROJECTS.map((p) => p.name) });
      film = F;
      if (/[?&]cap=1/.test(location.search)) (window as unknown as { __film?: StudioFilm }).__film = F;
      const els: StudioEls = {
        label: el.querySelector(".st-label")!,
        bar: el.querySelector(".st-load b")!,
        barText: el.querySelector(".st-load span")!,
        loader: el.querySelector(".st-load")!,
        onAction: (id, rect) => {
          if (id === "lamp") return;
          doAction(id, rect);
        },
        onStatus: (s) => setLive(s),
        onLoaded: () => setLive("Studio scene loaded"),
      };
      F.els = els;
      el.classList.add("studio-gl");
      const mv = (e: PointerEvent) => F.pointerMove(e.clientX, e.clientY, e.pointerType);
      const dn = (e: PointerEvent) => {
        F.pointerDown(e.clientX, e.clientY, e.pointerType);
        stage.setPointerCapture?.(e.pointerId);
      };
      const up = (e: PointerEvent) => {
        if (F.pointerUp(e.pointerType)) opener.current = stage;
      };
      const lv = () => F.pointerLeave();
      stage.addEventListener("pointermove", mv);
      stage.addEventListener("pointerdown", dn);
      stage.addEventListener("pointerup", up);
      stage.addEventListener("pointerleave", lv);
      let cur = "";
      const untick = addTick(() => {
        const c = F.cursor();
        if (c !== cur) {
          stage.style.cursor = cur = c;
          stage.dataset.cur = c === "pointer" ? "1" : "";
          stage.dataset.curLabel = "";
        }
      });
      return () => {
        untick();
        stage.removeEventListener("pointermove", mv);
        stage.removeEventListener("pointerdown", dn);
        stage.removeEventListener("pointerup", up);
        stage.removeEventListener("pointerleave", lv);
        F.dispose();
        if (film === F) film = null;
      };
    }
    const W = world;
    // chegando por transição (genie/intro curta), a criação da cena (PMREM, texturas, shaders) espera a cortina sair
    // para não travar a animação; na carga direta (F5) começa já, sob a intro completa
    let alive = true;
    let bound = false;
    const create = () => {
      if (!alive || layer) return;
      layer = new StudioLayer(W, { reduced, captures: PROJECTS.map(cardTexture), names: PROJECTS.map((p) => p.name) });
      W.addLayer(layer);
      // captura do modo filme (scripts/film-capture.mjs): expõe a camada só com ?cap=1
      if (/[?&]cap=1/.test(location.search)) (window as unknown as { __studio?: StudioLayer }).__studio = layer;
      bind(layer);
    };
    if (!layer) {
      // 26/11 (Lucas): nada de foto do setup antes da cena — no LITE a cena monta direto (qualidade reduzida no StudioLayer);
      // a foto só existe como conteúdo do modo sem WebGL (T0/m2d)
      if (document.querySelector("#intro.is-short")) {
        const un = ui.subscribe(() => {
          if (!ui.get().intro) {
            un();
            window.setTimeout(create, 50);
          }
        });
        cleanups.push(un);
      } else create();
    } else {
      layer.replay();
      if (layer.hots.length) window.setTimeout(() => window.dispatchEvent(new Event("rito:ready")), 0);
    }
    function bind(L: StudioLayer) {
      if (bound) return;
      bound = true;
      L.reduced = reduced;
      L.els = {
        label: el.querySelector(".st-label")!,
        bar: el.querySelector(".st-load b")!,
        barText: el.querySelector(".st-load span")!,
        loader: el.querySelector(".st-load")!,
        onAction: (id, rect) => {
          if (id === "lamp") return;
          doAction(id, rect);
        },
        onStatus: (s) => setLive(s),
        onLoaded: () => setLive("Studio scene loaded"),
      };
      if (L.hots.length) el.querySelector(".st-load")?.classList.add("done");
      L.object.visible = true;
      W.setMode("studio");
      el.classList.add("studio-gl");
      const mv = (e: PointerEvent) => L.pointerMove(e.clientX, e.clientY, e.pointerType);
      const dn = (e: PointerEvent) => {
        L.pointerDown(e.clientX, e.clientY, e.pointerType);
        stage.setPointerCapture?.(e.pointerId);
      };
      const up = (e: PointerEvent) => {
        const h = L.pointerUp(e.pointerType);
        if (h) opener.current = stage;
      };
      const lv = () => L.pointerLeave();
      stage.addEventListener("pointermove", mv);
      stage.addEventListener("pointerdown", dn);
      stage.addEventListener("pointerup", up);
      stage.addEventListener("pointerleave", lv);
      const onResize = () => W.resize();
      window.addEventListener("resize", onResize);
      let cur = "";
      const untick = addTick(() => {
        const s = ui.get();
        // overlays opacos (reel, menu, perfil, intro) cobrindo: a cena para de renderizar
        L.object.visible = !(s.reel || s.menu || s.profile);
        const c = L.cursor();
        if (c !== cur) {
          stage.style.cursor = cur = c;
          stage.dataset.cur = c === "pointer" ? "1" : "";
          stage.dataset.curLabel = ""; // o rótulo 3D (.st-label) já nomeia o objeto
        }
      });
      cleanups.push(untick, () => {
        stage.removeEventListener("pointermove", mv);
        stage.removeEventListener("pointerdown", dn);
        stage.removeEventListener("pointerup", up);
        stage.removeEventListener("pointerleave", lv);
        window.removeEventListener("resize", onResize);
      });
    }
    if (layer) bind(layer);
    return () => {
      alive = false;
      cleanups.forEach((c) => c());
      if (layer) {
        layer.object.visible = false;
        layer.els = null;
        layer.exitType();
        layer.leftMode = "chat";
      }
      if (world.mode === "studio") world.setMode("off");
    };
  }, [doAction]);

  const closePanel = useCallback(() => setPanel(null), []);

  return (
    <main id="main" tabIndex={-1} className="studio" ref={root}>
      <div className="st-stage" aria-hidden="true" />
      <header className="st-head">
        <h1>Studio</h1>
        <p>The real desk, modelled and baked in Blender · move to look · drag to orbit · click the objects</p>
      </header>
      <div className="st-hots" role="group" aria-label="Objects on the desk">
        {ORDER.map((id) => (
          <button key={id} type="button" className="chip st-chip" data-cursor={HOT_LABEL[id].split(" · ")[1]} onClick={(e) => press(id, e.currentTarget)}>
            {HOT_LABEL[id]}
          </button>
        ))}
      </div>
      <div className="st-load" role="status">
        <span>Loading scene…</span>
        <i>
          <b />
        </i>
      </div>
      <div className="st-label" aria-hidden="true" />
      <input
        ref={typer}
        className="st-typer"
        aria-label="Type on the left monitor (Escape to stop)"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        tabIndex={typing ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            (film ?? layer)?.exitType();
            setTyping(false);
            setLive("Stopped typing");
            (opener.current ?? (document.getElementById("main") as HTMLElement))?.focus({ preventScroll: true });
          } else if (e.key === "Backspace") (film ?? layer)?.type("\b");
          else if (e.key.length === 1) (film ?? layer)?.type(e.key);
        }}
        onInput={(e) => void ((e.target as HTMLInputElement).value = "")}
        onBlur={() => {
          (film ?? layer)?.exitType();
          setTyping(false);
        }}
      />
      <p className="st-credit">
        3D textures &amp; HDRI: <a href="https://polyhaven.com" target="_blank" rel="noopener">Poly Haven</a> (CC0) ·{" "}
        <a href="/studio/LICENSES.md" target="_blank" rel="noopener">licenses</a>
      </p>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      <StPanel id="stack" open={panel === "stack"} title="Stack" onClose={closePanel}>
        {CV.skills.map((s) => (
          <div key={s.k} className="st-skill">
            <h3>{s.k}</h3>
            <p>{s.v}</p>
          </div>
        ))}
      </StPanel>
      <StPanel id="cv" open={panel === "cv"} title="Résumé" onClose={closePanel}>
        <p>{SITE.role} — Brazil · Remote.</p>
        <ul className="st-list">
          {CV.education.map((e) => (
            <li key={e.inst}>
              <b>{e.inst}</b> — {e.course} · {e.status}
            </li>
          ))}
        </ul>
        <a className="st-cta" href={SITE.resume} target="_blank" rel="noopener" data-autofocus>
          Résumé (PDF) ↗
        </a>
      </StPanel>
      <StPanel id="wa" open={panel === "wa"} title="WhatsApp" onClose={closePanel}>
        <p>{SITE.phone}</p>
        <a className="st-cta" href={SITE.whatsapp} target="_blank" rel="noopener" data-autofocus>
          Open chat ↗
        </a>
      </StPanel>
    </main>
  );
}

function rectOf(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function StPanel({ id, open, title, onClose, children }: { id: string; open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(open, ref, onClose);
  return (
    <div ref={ref} id={`st-${id}`} className={`st-panel${open ? " on" : ""}`} role="dialog" aria-modal="true" aria-label={title} hidden={!open}>
      <button type="button" className="chip st-x" onClick={onClose}>
        Close
      </button>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
