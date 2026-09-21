import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // As imagens entram pela rota /imagens/[slug]/[indice], do próprio site:
  // nenhuma URL assinada do Bling aparece no HTML, então não há host remoto.
  images: { formats: ["image/avif", "image/webp"] },
};

export default config;
