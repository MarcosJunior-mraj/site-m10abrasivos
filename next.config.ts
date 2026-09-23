import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { conferirVariaveisDeBuild } from "./lib/conferir-build";

/** Cabeçalhos de segurança básicos em toda resposta. */
const CABECALHOS_DE_SEGURANCA = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/**
 * De propósito NÃO é uma CSP completa: só `frame-ancestors` (ninguém embute
 * o site num iframe). Fica de fora da rota `/imagens`, que manda a própria
 * CSP, mais restrita (`default-src 'none'; sandbox`) — o cabeçalho daqui
 * sobrescreveria o da rota (conferido no servidor de produção).
 */
const CSP_DAS_PAGINAS = [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" }];

export default async function configuracao(fase: string): Promise<NextConfig> {
  if (fase === PHASE_PRODUCTION_BUILD) conferirVariaveisDeBuild(process.env);

  return {
    output: "standalone",
    reactStrictMode: true,
    // As imagens entram pela rota /imagens/[slug]/[indice], do próprio site:
    // nenhuma URL assinada do Bling aparece no HTML, então não há host remoto.
    // `/imagens/**` sem `search` aceita a versão da foto (`?v=`, ver
    // `urlDaImagem`); as demais imagens locais (logo etc.) vão sem query.
    images: {
      formats: ["image/avif", "image/webp"],
      localPatterns: [{ pathname: "/imagens/**" }, { pathname: "/**", search: "" }],
    },
    async headers() {
      return [
        { source: "/:path*", headers: CABECALHOS_DE_SEGURANCA },
        { source: "/((?!imagens/).*)", headers: CSP_DAS_PAGINAS },
      ];
    },
  };
}
