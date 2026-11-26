// Conteúdo da tela do monitor esquerdo do Studio (canvas 2D, base 1024×576). Usado pela cena 3D (StudioLayer, como
// textura emissiva) e pelo modo filme sem GPU (lib/studioFilm.ts, como camada em perspectiva sobre os quadros).
const smooth = (t: number) => {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
};

export type LeftScreen = { mode: "chat" | "works" | "type"; typed: string; worksT: number; caps: (HTMLImageElement | undefined)[]; names: string[] };

export function drawLeftScreen(x: CanvasRenderingContext2D, k: number, st: LeftScreen) {
  x.setTransform(k, 0, 0, k, 0, 0);
  const W = 1024;
  const H = 576;
  const caps = st.caps.filter(Boolean) as HTMLImageElement[];
  if (st.mode === "works" && caps.length) {
    x.fillStyle = "#08080a";
    x.fillRect(0, 0, W, H);
    const q = st.worksT / 1.8;
    const i = Math.floor(q) % caps.length;
    const f = smooth((q % 1) * 2.2 - 1.2);
    for (let n = -2; n <= 2; n++) {
      const j = (i + n + caps.length * 4) % caps.length;
      const pos = n - f;
      const sc = 0.62 - Math.abs(pos) * 0.14;
      if (sc <= 0.2) continue;
      const w = 760 * sc;
      const h = (w * 9) / 16;
      x.globalAlpha = 1 - Math.min(1, Math.abs(pos) * 0.45);
      x.drawImage(caps[j], W / 2 - w / 2 + pos * 330, H / 2 - h / 2 - 10, w, h);
    }
    x.globalAlpha = 1;
    x.fillStyle = "#fff";
    x.font = '900 34px "Inter Tight Variable", sans-serif';
    x.fillText("WORKS", 36, 56);
    const cur = (i + (f > 0.5 ? 1 : 0)) % caps.length;
    x.font = '500 13px "Martian Mono Variable", monospace';
    x.fillStyle = "#ff3346";
    x.fillText(`${String(cur + 1).padStart(2, "0")}/${String(caps.length).padStart(2, "0")} · ${(st.names[cur] ?? "").toUpperCase()}`, 36, H - 30);
  } else {
    x.fillStyle = "#cfd0d6";
    x.fillRect(0, 0, W, H);
    x.fillStyle = "#c3c4cc";
    x.fillRect(0, 0, 230, H);
    x.fillStyle = "#111";
    x.font = '700 18px "Inter Tight Variable", sans-serif';
    x.fillText("Notes", 22, 40);
    x.font = '500 13px "Inter Tight Variable", sans-serif';
    ["Portfolio v6", "Hero: dial + signal", "Studio scene", "Reel player", "4K captures"].forEach((s, i) => {
      if (!i) {
        x.fillStyle = "#b3b4bf";
        x.fillRect(12, 64, 206, 28);
      }
      x.fillStyle = "#333";
      x.fillText(s, 22, 83 + i * 34);
    });
    x.fillStyle = "#e4e5ea";
    x.fillRect(260, 40, W - 300, 120);
    x.fillStyle = "#555";
    x.font = '400 13px "Inter Tight Variable", sans-serif';
    ["Click the left monitor to open the works.", "Click the keyboard and type — the keys light up."].forEach((s, i) => x.fillText(s, 280, 80 + i * 24));
    x.fillStyle = "#ececf0";
    x.fillRect(260, 190, W - 300, 290);
    x.strokeStyle = "#c20b21";
    x.lineWidth = st.mode === "type" ? 3 : 1;
    x.strokeRect(260, 190, W - 300, 290);
    x.fillStyle = "#111";
    x.font = '500 17px "Martian Mono Variable", monospace';
    const lines = ("> " + st.typed).match(/.{1,52}/g) || ["> "];
    const last = lines.slice(-10);
    last.forEach((s, i) => x.fillText(s, 280, 226 + i * 26));
    if (st.mode === "type" && ((performance.now() / 500) | 0) % 2) x.fillRect(280 + x.measureText(last[last.length - 1]).width + 3, 210 + (last.length - 1) * 26, 10, 20);
    x.fillStyle = "#777";
    x.font = '500 11px "Martian Mono Variable", monospace';
    x.fillText(st.mode === "type" ? "TYPE · ESC TO EXIT" : "CLICK THE KEYBOARD TO TYPE", 280, 510);
  }
}
