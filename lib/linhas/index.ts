import { esquemaLinha, type Linha } from "./esquema";
import { GREEN_TURBO } from "./green-turbo";

/** Validadas na carga: conteúdo quebrado derruba o build, nunca a página em produção. */
export const TODAS_AS_LINHAS: readonly Linha[] = [GREEN_TURBO].map((linha) =>
  esquemaLinha.parse(linha),
);

export function buscarLinha(slug: string): Linha | null {
  return TODAS_AS_LINHAS.find((linha) => linha.slug === slug) ?? null;
}

export function podeMostrar(
  linha: Linha,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return !linha.rascunho || env.MOSTRAR_RASCUNHOS === "1";
}

export function linhasVisiveis(env: Record<string, string | undefined> = process.env): Linha[] {
  return TODAS_AS_LINHAS.filter((linha) => podeMostrar(linha, env));
}

/** Home, menu e sitemap: só linha publicada, independentemente de env. */
export function linhasPublicadas(): Linha[] {
  return TODAS_AS_LINHAS.filter((linha) => !linha.rascunho);
}

/** Linha publicada cuja oferta inclui este item (kit ou avulso). */
export function linhaDoProduto(slugDoItem: string): Linha | null {
  return (
    linhasPublicadas().find(
      (linha) =>
        linha.oferta.kitSlug === slugDoItem || linha.oferta.avulsosSlugs.includes(slugDoItem),
    ) ?? null
  );
}

export type { Linha } from "./esquema";
