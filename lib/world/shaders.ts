// Shaders do mundo RITO (Works). Parâmetros autorais; nada copiado da referência.

/** Card do arco: cilindro côncavo em volta da câmera + dobra em S por velocidade + onda de folha
 *  + bossa do cursor + depressão (dent) + mistura para o retângulo plano do painel (uOpen). */
export const cardVert = /* glsl */ `
uniform float uS, uW, uH, uR, uY0, uAxis, uBend, uWave, uTime, uIdle, uPhase;
uniform vec2 uHoverUV; uniform float uHover;
uniform vec2 uDentUV; uniform float uDent;
uniform float uOpen, uDepth; uniform vec4 uRect;
varying vec2 vUv;
varying float vShade;

void main() {
  vUv = uv;
  vec2 p = (uv - 0.5) * vec2(uW, uH);
  float along = uAxis < 0.5 ? p.x : -p.y;
  float across = uAxis < 0.5 ? p.y : p.x;
  float alongUv = uAxis < 0.5 ? uv.x : 1.0 - uv.y;
  float edge = uAxis < 0.5 ? abs(uv.y - 0.5) * 2.0 : abs(uv.x - 0.5) * 2.0;
  float stretch = 1.0 + 0.08 * abs(uBend);
  float s = uS + along * stretch;
  float r = uR;
  float ph = 6.2831853 * s / uWave;
  // dobra em S da faixa inteira (sinal = sentido do movimento)
  r += uBend * 0.95 * sin(ph);
  // torção leve: bordas sup./inf. em sentidos opostos
  r += uBend * 0.28 * (across / uH) * cos(ph) * uH;
  // folha: onda leve nas bordas (~3% da altura) + respiração lenta
  r += uIdle * 0.03 * uH * sin(alongUv * 6.2831853 + uPhase + uTime * 1.5708) * (0.35 + 0.65 * edge);
  vec2 asp = vec2(uW / uH, 1.0);
  vec2 hd = (uv - uHoverUV) * asp;
  float hb = exp(-dot(hd, hd) / (2.0 * 0.09 * 0.09));
  r -= uHover * 0.09 * hb;
  vec2 dd = (uv - uDentUV) * asp;
  r += uDent * 0.32 * exp(-dot(dd, dd) / (2.0 * 0.15 * 0.15));
  vShade = uHover * hb * 0.08 - uDent * 0.12 * exp(-dot(dd, dd) / (2.0 * 0.15 * 0.15));
  float a = s / uR;
  vec3 pos = uAxis < 0.5
    ? vec3(r * sin(a), across + uY0, -r * cos(a))
    : vec3(across, -r * sin(a) + uY0, -r * cos(a));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec4 fv = vec4(uRect.x + (uv.x - 0.5) * uRect.z, uRect.y + (uv.y - 0.5) * uRect.w, -uDepth, 1.0);
  gl_Position = projectionMatrix * mix(mv, fv, uOpen);
}
`;

export const cardFrag = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap, uTexAspect, uCardAspect, uOpenAspect, uOpen;
uniform float uRadius, uRadiusOpen, uBorder;
uniform float uDim, uDark, uDarkTo, uAlpha;
varying vec2 vUv;
varying float vShade;

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float aspect = mix(uCardAspect, uOpenAspect, uOpen);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float d = sdRound(p, vec2(aspect, 1.0) * 0.5, mix(uRadius, uRadiusOpen, uOpen));
  float aa = max(fwidth(d), 1e-4);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  if (mask <= 0.001) discard;
  vec2 uv = vUv;
  if (uCardAspect > uTexAspect) { uv.y = (uv.y - 0.5) * (uTexAspect / uCardAspect) + 0.5; }
  else { uv.x = (uv.x - 0.5) * (uCardAspect / uTexAspect) + 0.5; }
  vec3 col = mix(vec3(0.067), texture2D(uMap, uv).rgb, uHasMap);
  col = col * (1.0 + vShade);
  // leve escurecimento na base do card (legibilidade do título), some ao abrir
  col *= mix(mix(0.6, 1.0, smoothstep(0.0, 0.24, vUv.y)), 1.0, uOpen);
  col *= uDim;
  col = mix(col, vec3(uDarkTo), uDark);
  float line = uBorder * (1.0 - smoothstep(0.0, aa * 1.5, abs(d + aa)));
  col = mix(col, vec3(0.165), line);
  gl_FragColor = vec4(col, mask * uAlpha);
}
`;

/** Piso infinito em grade fina (linha ~1 px) + anel do círculo a 6%. */
export const floorVert = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
export const floorFrag = /* glsl */ `
uniform float uAlpha, uRing, uGlow;
uniform vec2 uCenter;
varying vec3 vW;
void main() {
  vec2 g = vW.xz / 1.6;
  vec2 fw = fwidth(g);
  vec2 l = abs(fract(g - 0.5) - 0.5) / max(fw, 1e-4);
  float line = 1.0 - min(min(l.x, l.y), 1.0);
  float dist = length(vW.xz);
  float near = length(vW.xz - uCenter);
  float fade = smoothstep(70.0, 14.0, near) * smoothstep(0.0, 4.0, near);
  // evita moiré perto do horizonte
  fade *= 1.0 - smoothstep(0.35, 0.9, max(fw.x, fw.y));
  float ring = 1.0 - smoothstep(0.0, max(fwidth(dist) * 1.5, 1e-4), abs(dist - uRing));
  vec3 col = vec3(0.227) * line * fade + mix(vec3(1.0) * 0.06, vec3(0.76, 0.043, 0.13) * 0.9, uGlow) * ring;
  gl_FragColor = vec4(col, uAlpha);
}
`;

/** Passe final: portal-lente (blob preto + aro com distorção e separação cromática; canal externo em brasa). */
export const fsVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const portalFrag = /* glsl */ `
uniform sampler2D uScene;
uniform vec2 uRes, uCenter;
uniform float uRadius, uTime, uLite;
varying vec2 vUv;
void main() {
  vec2 fc = vUv * uRes;
  vec2 d = fc - uCenter;
  float len = length(d);
  float ang = atan(d.y, d.x);
  float wob = 1.0 + 0.06 * (0.6 * sin(ang * 2.0 + uTime * 1.3) + 0.4 * sin(ang * 3.0 - uTime * 0.9));
  float rr = uRadius * wob;
  if (len < rr) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float ringW = max(36.0, uRadius * 0.32);
  float k = exp(-(len - rr) / ringW) * step(0.5, uRadius);
  vec2 dir = d / max(len, 1e-3);
  vec2 off = -dir * k * ringW * 0.55 / uRes * (1.0 - uLite);
  vec3 col = vec3(
    texture2D(uScene, vUv + off * 1.3).r,
    texture2D(uScene, vUv + off).g,
    texture2D(uScene, vUv + off * 0.75).b
  );
  float rim = exp(-pow((len - rr) / 5.0, 2.0)) * step(0.5, uRadius);
  col += vec3(0.76, 0.043, 0.13) * k * 0.45 + vec3(1.0) * rim * 0.6;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Miniatura flutuante do Full: quad em espaço de pixels com perspectiva própria. */
export const thumbVert = /* glsl */ `
uniform vec2 uRes, uPos, uSize;
uniform vec3 uRot;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = vec3((uv.x - 0.5) * uSize.x, (0.5 - uv.y) * uSize.y, 0.0);
  float cx = cos(uRot.x), sx = sin(uRot.x), cy = cos(uRot.y), sy = sin(uRot.y), cz = cos(uRot.z), sz = sin(uRot.z);
  p = vec3(p.x * cz - p.y * sz, p.x * sz + p.y * cz, p.z);
  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  float persp = 1100.0 / (1100.0 - p.z);
  vec2 sp = uPos + p.xy * persp;
  vec2 ndc = sp / uRes * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}
`;
export const thumbFrag = /* glsl */ `
uniform sampler2D uMapA, uMapB;
uniform float uMix, uAlpha, uRadius, uDark, uTexA, uTexB;
uniform vec2 uSize;
varying vec2 vUv;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec2 cover(vec2 uv, float ca, float ta) {
  if (ca > ta) uv.y = (uv.y - 0.5) * (ta / ca) + 0.5; else uv.x = (uv.x - 0.5) * (ca / ta) + 0.5;
  return uv;
}
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = sdRound(p, uSize * 0.5, uRadius);
  float aa = max(fwidth(d), 1e-3);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  if (mask <= 0.001) discard;
  float ca = uSize.x / uSize.y;
  vec3 a = texture2D(uMapA, cover(vUv, ca, uTexA)).rgb;
  vec3 b = texture2D(uMapB, cover(vUv, ca, uTexB)).rgb;
  vec3 col = mix(a, b, uMix);
  col = mix(col, vec3(0.0), uDark);
  gl_FragColor = vec4(col, mask * uAlpha);
}
`;
