import { esquemaLinha, type Linha } from "./esquema";
import { GREEN_TURBO } from "./green-turbo";

/** Validadas na carga: conteúdo quebrado derruba o build, nunca a página em produção. */
export const TODAS_AS_LINHAS: readonly Linha[] = [GREEN_TURBO].map((linha) =>
  esquemaLinha.parse(linha),
);

/*
 * `linhas` é opcional em todo o registro: a página usa sempre `TODAS_AS_LINHAS`;
 * os testes passam uma lista própria (ex.: `{ ...GREEN_TURBO, rascunho: true }`)
 * para não depender do estado atual de rascunho do conteúdo.
 */

export function buscarLinha(
  slug: string,
  linhas: readonly Linha[] = TODAS_AS_LINHAS,
): Linha | null {
  return linhas.find((linha) => linha.slug === slug) ?? null;
}

export function podeMostrar(
  linha: Linha,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return !linha.rascunho || env.MOSTRAR_RASCUNHOS === "1";
}

export function linhasVisiveis(
  env: Record<string, string | undefined> = process.env,
  linhas: readonly Linha[] = TODAS_AS_LINHAS,
): Linha[] {
  return linhas.filter((linha) => podeMostrar(linha, env));
}

/** Home, menu e sitemap: só linha publicada, independentemente de env. */
export function linhasPublicadas(linhas: readonly Linha[] = TODAS_AS_LINHAS): Linha[] {
  return linhas.filter((linha) => !linha.rascunho);
}

/** Linha publicada cuja oferta inclui este item (kit ou avulso). */
export function linhaDoProduto(
  slugDoItem: string,
  linhas: readonly Linha[] = TODAS_AS_LINHAS,
): Linha | null {
  return (
    linhasPublicadas(linhas).find(
      (linha) =>
        linha.oferta.kitSlug === slugDoItem || linha.oferta.avulsosSlugs.includes(slugDoItem),
    ) ?? null
  );
}

export type { Linha } from "./esquema";
