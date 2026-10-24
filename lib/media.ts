// Showreel 2026 (v5, 24/10/2026). Fonte: VagasAUTO/showreel-4k-60fps.mp4 (3840×2160, 60 fps, 24 s, AAC — não
// alterada). Derivados em public/media/reel/ (ffmpeg; comandos no README):
//   reel-1080.mp4  H.264 1920×1080 60 fps CRF 22 + AAC 160k, faststart (player / portal em telas altas)
//   reel-720.mp4   H.264 1280×720 60 fps CRF 23 + AAC 128k, faststart (telas baixas e mobile)
//   poster.{webp,jpg} 1920×1080 e poster-720.webp (quadro de 9,3 s)
// WebM/VP9 testado e descartado: ficou maior que o MP4 no mesmo nível visual (30 MB vs 19 MB). A prévia sem áudio
// do card do menu foi gerada e removida no mesmo dia (item 9: menu sem cards).
// pickReelSources escolhe pela largura CSS do player × min(dpr, 2) (ver abaixo).
export type ReelSource = { src: string; type: "video/webm" | "video/mp4"; h: number };

export const REEL_SOURCES: ReelSource[] = [
  { src: "/media/reel/reel-1080.mp4", type: "video/mp4", h: 1080 },
  { src: "/media/reel/reel-720.mp4", type: "video/mp4", h: 720 },
];
export const REEL_POSTER = "/media/reel/poster.webp";
export const REEL_POSTER_SMALL = "/media/reel/poster-720.webp";
/** Duração medida (ffprobe, 24/10/2026); o HUD prefere a duração lida do arquivo (loadedmetadata). */
export const REEL_DURATION = 24.042;
/**
 * Cortes do reel em segundos — ffmpeg select=gt(scene,0.35) no reel-720.mp4: cortes duros a cada 3 s (0…21);
 * as detecções em ~x,8 s são transições internas de cada trecho e foram descartadas. Só marcas de tempo: os nomes
 * dos projetos por trecho ficam pendentes de confirmação por Lucas.
 */
export const REEL_CUTS = [0, 3, 6, 9, 12, 15, 18, 21];

/**
 * Fonte pelo tamanho real do player (v5.1): largura CSS × min(dpr, 2). Até 1600 px de dispositivo (≈800 px CSS em
 * DPR 2, ≈1600 px CSS em DPR 1) o 720p basta; acima, 1080p. Ex.: 390 DPR 3 → 358 CSS → 716 → 720p;
 * 1440 DPR 1 → 1037 CSS → 720p; 1440 DPR 2 → 2074 → 1080p.
 */
export function pickReelSources(cssWidth: number, dpr = 1): ReelSource[] {
  const want = cssWidth * Math.min(Math.max(dpr, 1), 2) > 1600 ? 1080 : 720;
  return REEL_SOURCES.filter((s) => s.h === want);
}

/** Fonte usada no HTML do servidor (sem JS): o 720p, que é a escolha na maioria dos players. */
export const REEL_SOURCES_SSR: ReelSource[] = REEL_SOURCES.filter((s) => s.h === 720);

/**
 * Libera o download sem reiniciar o elemento: com preload="none" a seleção de fonte fica suspensa e mudar o atributo
 * (ou chamar play()) retoma na mesma requisição. load() só quando nada foi selecionado ainda.
 */
export function wakeVideo(v: HTMLVideoElement) {
  if (v.preload !== "auto") v.preload = "auto";
  if (v.networkState === HTMLMediaElement.NETWORK_EMPTY) v.load();
}

/** Avatar original recortado em círculo (derivado de brand/lucas-avatar.png por scripts/derive-avatar.py). */
export const EMBLEM_SRC = "/brand/avatar-emblem.webp";
