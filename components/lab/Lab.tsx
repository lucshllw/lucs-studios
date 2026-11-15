"use client";
// /lab — corredor de 4 relíquias (LabLayer no World). Navegação e controles em HTML (botões reais); Esc volta ao
// corredor. Sem WebGL: Brasa e Fluido seguem em canvas 2D; Orb e Pano mostram aviso.
import { useEffect, useRef, useState } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion, tier } from "@/lib/motion";
import { ui } from "@/lib/store";
import { getWorld } from "@/lib/world/World";
import { LabLayer, RELICS, type LabMode } from "@/lib/world/LabLayer";

let layer: LabLayer | null = null;

export function Lab() {
  const root = useRef<HTMLElement>(null);
  const c2 = useRef<HTMLCanvasElement>(null);
  const wordRef = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState(0);
  const [mode, setModeS] = useState<LabMode>("corr");
  const [mic, setMic] = useState("");
  const [cut, setCut] = useState(false);
  const [gl, setGl] = useState(true);
  const enterBtns = useRef<(HTMLButtonElement | null)[]>([]);

  const L = () => layer;
  const go = (m: LabMode) => {
    const l = L();
    if (!l) return;
    l.setMode(m);
  };

  useEffect(() => {
    const el = root.current!;
    const stage = el.querySelector<HTMLElement>(".lab-stage")!;
    const reduced = reducedMotion();
    const t = tier();
    const world = t > 0 ? getWorld({ tier: t === 1 ? 1 : 2, reduced }) : null;
    if (!world) setGl(false);
    if (world && !layer) {
      layer = new LabLayer(world, { reduced });
      world.addLayer(layer);
      void world.warm(layer, layer.warmList());
    }
    window.setTimeout(() => window.dispatchEvent(new Event("rito:ready")), 0);
    if (!layer) return;
    const Ly = layer;
    Ly.reduced = reduced;
    Ly.els = {
      c2: c2.current!,
      word: () => wordRef.current?.value ?? "LUCAS",
      onSelect: (i) => setSel(i),
      onMode: (m) => {
        setModeS(m);
        if (m === "word") window.setTimeout(() => wordRef.current?.focus({ preventScroll: true }), 50);
        if (m === "corr") window.setTimeout(() => enterBtns.current[Ly.sel]?.focus({ preventScroll: true }), 30);
        else window.setTimeout(() => el.querySelector<HTMLElement>(".lab-back")?.focus({ preventScroll: true }), m === "word" ? 400 : 30);
      },
      onMic: (s) => setMic(s),
    };
    Ly.resize2d();
    Ly.setMode("corr");
    Ly.select(0);
    Ly.object.visible = true;
    world!.setMode("lab");
    const mv = (e: PointerEvent) => Ly.pointer("move", e.clientX, e.clientY, e.pointerType);
    const dn = (e: PointerEvent) => {
      Ly.pointer("down", e.clientX, e.clientY, e.pointerType);
      stage.setPointerCapture?.(e.pointerId);
    };
    const up = (e: PointerEvent) => Ly.pointer("up", e.clientX, e.clientY, e.pointerType);
    const lv = () => Ly.pointer("leave", 0, 0, "mouse");
    stage.addEventListener("pointermove", mv);
    stage.addEventListener("pointerdown", dn);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointerleave", lv);
    const onResize = () => {
      world!.resize();
      Ly.resize2d();
    };
    window.addEventListener("resize", onResize);
    const onKey = (e: KeyboardEvent) => {
      if (ui.get().menu || ui.get().profile || ui.get().intro) return;
      const tgt = e.target as HTMLElement;
      if (e.key === "Escape" && Ly.mode !== "corr") {
        e.preventDefault();
        Ly.setMode("corr");
      } else if (Ly.mode === "corr" && !tgt.closest?.("input")) {
        if (e.key === "ArrowRight") Ly.select(Ly.sel + 1);
        if (e.key === "ArrowLeft") Ly.select(Ly.sel - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    let cur = "";
    const untick = addTick(() => {
      const s = ui.get();
      Ly.object.visible = !(s.menu || s.profile);
      const c = Ly.mode === "corr" ? (Ly.overRelic() ? "pointer" : "grab") : "crosshair";
      if (c !== cur) {
        stage.style.cursor = cur = c;
        stage.dataset.cur = c === "pointer" ? "1" : "";
        stage.dataset.curLabel = c === "pointer" ? (Ly.sel >= 0 ? "Enter" : "") : "";
      }
    });
    return () => {
      untick();
      stage.removeEventListener("pointermove", mv);
      stage.removeEventListener("pointerdown", dn);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointerleave", lv);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      Ly.stopMic();
      Ly.mode = "corr";
      Ly.object.visible = false;
      Ly.els = null;
      if (world!.mode === "lab") world!.setMode("off");
    };
  }, []);

  const is2d = mode === "word" || mode === "fluid";
  const R = RELICS[sel];
  const cur = RELICS.find((r) => r.id === mode);
  return (
    <main id="main" tabIndex={-1} className={`lab${gl ? "" : " lab-nogl"}`} data-mode={mode} ref={root}>
      <canvas ref={c2} className="lab-c2" aria-hidden="true" hidden={!is2d} />
      <div className="lab-stage" aria-hidden="true" />
      <header className="lab-head">
        <h1>Lab</h1>
        <p>A corridor of relics · ← → or drag · click to enter</p>
      </header>
      {mode === "corr" ? (
        <div className="lab-corr">
          <p className="lab-now" aria-live="polite">
            <b>
              {String(sel + 1).padStart(2, "0")} · {R.name}
            </b>
            <span>{R.sub}</span>
          </p>
          <div className="lab-row" role="group" aria-label="Relics">
            <button type="button" className="chip" aria-label="Previous relic" onClick={() => L()?.select(sel - 1)}>
              ←
            </button>
            {RELICS.map((r, i) => (
              <button
                key={r.id}
                ref={(b) => void (enterBtns.current[i] = b)}
                type="button"
                className="chip"
                aria-pressed={i === sel}
                disabled={!gl}
                onFocus={() => L()?.select(i)}
                onClick={() => {
                  L()?.select(i);
                  go(r.id);
                }}
              >
                {r.name}
              </button>
            ))}
            <button type="button" className="chip" aria-label="Next relic" onClick={() => L()?.select(sel + 1)}>
              →
            </button>
          </div>
          {!gl && (
            <ul className="lab-note">
              <li>Without WebGL (hardware acceleration off) the relics run as a 2D particle study; enable it for the full corridor.</li>
              {RELICS.map((r) => (
                <li key={r.id}>
                  <b>{r.name}</b> — {r.sub}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="lab-exp" role="group" aria-label={`Experiment: ${cur?.name}`}>
          <button type="button" className="chip lab-back" onClick={() => go("corr")}>
            ← Corridor (Esc)
          </button>
          <h2 className="lab-t">{cur?.name}</h2>
          {mode === "orb" && (
            <>
              <button type="button" className="chip" onClick={() => void L()?.enableMic()} disabled={mic.startsWith("Microphone on")}>
                Enable microphone
              </button>
              <span className="lab-hint" aria-live="polite">
                {mic || "move the pointer: the orb pulls towards it"}
              </span>
            </>
          )}
          {mode === "cloth" && (
            <>
              <button
                type="button"
                className="chip"
                aria-pressed={cut}
                onClick={() => {
                  const l = L();
                  if (!l) return;
                  l.cutMode = !l.cutMode;
                  setCut(l.cutMode);
                }}
              >
                Tear mode: {cut ? "on" : "off"}
              </button>
              <button type="button" className="chip" onClick={() => L()?.resetCloth()}>
                Reset
              </button>
              <span className="lab-hint">drag to pull · a hard pull tears</span>
            </>
          )}
          {mode === "word" && (
            <>
              <label className="lab-word">
                <span className="sr-only">Word (up to 16 characters)</span>
                <input ref={wordRef} maxLength={16} defaultValue="LUCAS" autoComplete="off" spellCheck={false} onInput={() => L()?.buildTargets()} />
              </label>
              <span className="lab-hint">type · the pointer scatters</span>
            </>
          )}
          {mode === "fluid" && <span className="lab-hint">move the pointer / drag a finger</span>}
        </div>
      )}
    </main>
  );
}
