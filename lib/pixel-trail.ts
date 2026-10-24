// Rastro pixelado compartilhado (v5): extraído do Emblem do hero para ser reaproveitado no wordmark do rodapé.
// Grade de blocos de CELL px CSS; cada movimento do cursor "carimba" um pincel de raio BRUSH com borda suave e
// o campo decai por quadro (DECAY a 60 fps ≈ 90→10% em ~1,08 s com o smoothstep do shader). O campo vai para o
// shader como textura LUMINANCE NEAREST (1 byte por bloco), reenviada só enquanto há rastro.
export const TRAIL_CELL = 20; // spec Flash 1.4
export const TRAIL_BRUSH = 60;
export const TRAIL_DECAY = 0.974;

/** GLSL: intensidade do rastro no pixel `px` (px CSS do canvas). Requer `uTrail` e `uTrailGrid`. */
export const TRAIL_GLSL = /* glsl */ `
float trailAt(sampler2D tr, vec2 grid, vec2 px) {
  return smoothstep(0.05, 0.6, texture(tr, px / (grid * ${TRAIL_CELL.toFixed(1)})).r);
}`;

export class PixelTrail {
  cols = 1;
  rows = 1;
  field = new Float32Array(1);
  bytes = new Uint8Array(1);
  private last: { x: number; y: number } | null = null;
  private live = false;

  constructor(
    private cell = TRAIL_CELL,
    private brush = TRAIL_BRUSH,
    private decayPerFrame = TRAIL_DECAY,
  ) {}

  /** Redimensiona a grade (px CSS). Devolve true quando os buffers mudaram (reenviar a textura). */
  resize(w: number, h: number) {
    const cols = Math.max(1, Math.ceil(w / this.cell));
    const rows = Math.max(1, Math.ceil(h / this.cell));
    if (cols === this.cols && rows === this.rows) return false;
    this.cols = cols;
    this.rows = rows;
    this.field = new Float32Array(cols * rows);
    this.bytes = new Uint8Array(cols * rows);
    return true;
  }

  stamp(x: number, y: number, strength = 1) {
    const { cell, brush, cols, rows, field } = this;
    const c0 = Math.max(0, Math.floor((x - brush) / cell));
    const c1 = Math.min(cols - 1, Math.floor((x + brush) / cell));
    const r0 = Math.max(0, Math.floor((y - brush) / cell));
    const r1 = Math.min(rows - 1, Math.floor((y + brush) / cell));
    for (let j = r0; j <= r1; j++)
      for (let i = c0; i <= c1; i++) {
        const d = Math.hypot((i + 0.5) * cell - x, (j + 0.5) * cell - y);
        const t = Math.min(1, Math.max(0, (d - brush * 0.5) / (brush * 0.5)));
        const v = (1 - t * t * (3 - 2 * t)) * strength;
        const k = j * cols + i;
        if (v > field[k]) field[k] = v;
      }
  }

  /** Carimba do último ponto até (x, y) em passos de 10 px (rastro contínuo em movimentos rápidos). */
  moveTo(x: number, y: number) {
    const from = this.last ?? { x, y };
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 10));
    for (let s = 1; s <= steps; s++) this.stamp(from.x + ((x - from.x) * s) / steps, from.y + ((y - from.y) * s) / steps);
    this.last = { x, y };
  }

  lift() {
    this.last = null;
  }

  /** Decaimento normalizado por dt (s). Devolve se a textura precisa ser reenviada neste quadro. */
  decay(dt: number) {
    const k = Math.pow(this.decayPerFrame, dt * 60);
    const { field, bytes } = this;
    let any = false;
    for (let i = 0; i < field.length; i++) {
      const v = field[i] * k;
      field[i] = v < 0.004 ? 0 : v;
      if (field[i] > 0) any = true;
      bytes[i] = Math.round(field[i] * 255);
    }
    const upload = any || this.live;
    this.live = any;
    return upload;
  }

  get active() {
    return this.live;
  }
}
