# Lucas Melo — Portfolio

Personal portfolio built with Next.js, React and TypeScript.

Live website: https://lucs-studios.vercel.app

## Features

- Home, selected work, about and résumé pages.
- English interface; résumé available in English and Brazilian Portuguese.
- GSAP motion, Lenis scrolling and optional WebGL effects with reduced-motion fallbacks.
- Responsive images, project previews and a showreel.

## Local development

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

The development server runs at http://localhost:4317.

```sh
npm run typecheck
npm run build
npm run serve
```

The build produces a static export in `out/`; the preview server runs at http://127.0.0.1:4318.
No API credentials are required to build this portfolio.

## Project structure

- `app/`: routes and styles.
- `components/`: interface and animation components.
- `lib/`: content, localization and shared behavior.
- `public/`: assets already used by the published portfolio.

## Credits

Website development by Lucas Melo. Project artwork, audiovisuals, logos and fonts retain their respective authors and licenses. Inclusion in this repository does not grant rights to reuse third-party material.
