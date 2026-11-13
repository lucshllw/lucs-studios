# Lucas Melo — portfolio v6 (RITO)

Next.js 15 (App Router, `output: "export"`), React 19, TypeScript, Three.js (vanilla, a single `World`), GSAP and Lenis.
A single animation loop drives everything (`lib/loop.ts` → `gsap.ticker`). ScrollTrigger is not used: it keeps its own
`requestAnimationFrame`, so scroll progress is read inside the ticker.

## Scripts

- `npm run dev` — dev server on port 5200
- `npm run build` — static export to `out/`
- `npm run serve` — serves `out/` on port 5201
- `npm run media` — regenerates the AVIF/WebP derivatives of the 4K captures
- `node scripts/qa*.cjs <playwright-core>` — QA runs (captures in `qa/`)

## Third-party components — React Bits

Origin: [React Bits](https://reactbits.dev) by David Haz and contributors (official registry `https://reactbits.dev/r/{name}.json`,
TS-CSS variants consulted on 12/11/2026). License: **MIT + Commons Clause** — use within this site is allowed; do not
resell or redistribute these components as a product. Every file below is an **adaptation**, not a verbatim copy:
the components were rewritten to use the site's single loop (`gsap.ticker`), the already installed fonts and GSAP
(no `motion` / ScrollTrigger / GSAP SplitText), reduced-motion fallbacks and real text for assistive technology.

| File | React Bits component | Where it is used |
|---|---|---|
| `components/bits/VariableProximity.tsx` | VariableProximity | hero keywords (Inter Tight variable weight) |
| `components/bits/Magnet.tsx` | Magnet | hero keywords, About "Résumé (PDF)" CTA |
| `components/bits/DecryptedText.tsx` | DecryptedText | hero HUD stage, About darkroom HUD; keyword ASCII decode follows the same behaviour |
| `components/bits/SplitText.tsx` | SplitText | section titles, hero/résumé name |
| `components/bits/CountUp.tsx` | CountUp | section numbers |
| `components/bits/ShinyText.tsx` | ShinyText | unlocked "Résumé (PDF)" CTA (CSS only) |

## Media

- 4K captures → `public/media/4k/<slug>/sNN-<w>.{avif,webp}` (828–3840 px, never upscaled).
- Reel: `public/reel/lucas-melo-reel-1080p.mp4` (default) and `public/reel/lucas-melo-reel-4k-web.mp4` (3840×2160 H.264
  CRF19 faststart, 57 MB; offered in the player, automatic only on ≥2560 px physical screens with a good connection,
  never in LITE/mobile). `NEXT_PUBLIC_REEL_4K_URL` overrides it with an external host.
- Jorak: `public/media/projects/jorak/desktop{.mp4,.webm,-1440.mp4}` encoded from Lucas's edit (no audio).
- Studio (`/studio`): `public/studio/setup-v3cc-{1k,4k}.glb` (Lucas's real desk, modelled and baked in Blender;
  1K first, 4K on desktop), CC0 textures and HDRI from Poly Haven in `public/studio/tex/` — licences in
  `public/studio/LICENSES.md`, credited on the page. Fallback photo: `public/studio/setup-lucas.webp`.
