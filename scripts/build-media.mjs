// Gera derivados AVIF/WebP das capturas 4K (3840×2160) — nunca amplia acima do original.
// Uso: npm run media  (lê ../assets/captures-4k, grava public/media/4k e lib/media-manifest.json)
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("../assets/captures-4k");
const OUT = path.resolve("public/media/4k");
const WIDTHS = [3840, 2560, 1920, 1280, 828];
// s00 = capa/textura do card; demais = galeria (curadoria: telas distintas, sem quadros repetidos)
const PICK = {
  orinoco: [0, 2, 5, 9, 10, 11],
  ado: [0, 3, 4, 6, 8],
  "rio-uruguay": [0, 2, 3, 4, 6, 8],
  ikari: [0, 2, 5, 6, 8, 10, 12],
  // Jorak: capa = quadro 4K do vídeo editado por Lucas (~29 s, site no monitor); + capturas de jorakstudio.vercel.app
  jorak: ["jorak-frames/s90", 0, 2, "jorak-frames/s91", "jorak-frames/s92"],
  ohm: [0, 1, 2, 5, 6],
  infernai: [0, 1, 2, 3, 5, 7, 9],
  mavell: [0, 2, 4, 7, 8, 9],
  danz: [0, 2, 3, 4, 5, 6, 7],
  // Aizawa (23/11): capturas 4K de aizawastudio.vercel.app — porta, corredor ×2, ficha, EXIT, floresta+footer, aba Projetos
  aizawa: [0, 1, 2, 3, 4, 5, 6],
  // Olucius (26/11): quadros 1080p das gravações reais do jogo (Lucius/video/rec) — título, floresta, quarto, boss, sobre, projetos, fim
  olucius: [0, 1, 2, 3, 4, 5, 6],
};
sharp.concurrency(4);
const manifest = {};
for (const [slug, ids] of Object.entries(PICK)) {
  fs.mkdirSync(path.join(OUT, slug), { recursive: true });
  manifest[slug] = [];
  for (const id of ids) {
    const name = typeof id === "string" ? path.basename(id) : `s${String(id).padStart(2, "0")}`;
    const file = typeof id === "string" ? path.resolve("../assets", `${id}.png`) : path.join(SRC, slug, `${name}.png`);
    const meta = await sharp(file).metadata();
    const widths = WIDTHS.filter((w) => w <= meta.width);
    await Promise.all(
      widths.flatMap((w) => {
        const base = path.join(OUT, slug, `${name}-${w}`);
        const r = () => sharp(file).resize({ width: w, withoutEnlargement: true, kernel: "lanczos3" });
        return [
          fs.existsSync(base + ".avif") ? null : r().avif({ quality: 86, effort: 4, chromaSubsampling: "4:4:4" }).toFile(base + ".avif"),
          fs.existsSync(base + ".webp") ? null : r().webp({ quality: 90, smartSubsample: true, effort: 5 }).toFile(base + ".webp"),
        ].filter(Boolean);
      })
    );
    manifest[slug].push({ id: name, w: meta.width, h: meta.height, widths });
    console.log(slug, name, meta.width + "x" + meta.height, widths.join(","));
  }
}
fs.writeFileSync(path.resolve("lib/media-manifest.json"), JSON.stringify(manifest, null, 2));
console.log("ok");
