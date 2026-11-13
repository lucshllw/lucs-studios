import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  // etapa 6: CSS embutido no HTML (o .css de 64 KB bloqueava a 1ª pintura ~1,2 s no celular simulado)
  experimental: { inlineCss: true },
};

export default config;
