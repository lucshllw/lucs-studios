import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Diretório de build configurável (v4): `NEXT_DIST_DIR=.next-build npm run build` não toca no `.next` de um
  // `next dev` aberto. Nesse modo o export estático é gravado dentro de `.next-build` (copiar para out/).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
