import type { Linha } from "@/lib/linhas";

type Registro = typeof import("@/lib/linhas");

/**
 * Registro de linhas para `vi.mock("@/lib/linhas", ...)`: mesmas funções de
 * verdade, mas lendo a lista que o teste escolher (`lista()`), em vez de
 * `TODAS_AS_LINHAS`. Assim o teste fixa `rascunho: true/false` numa fixture e
 * passa igual antes e depois de o piloto ser publicado.
 */
export function registroCom(real: Registro, lista: () => readonly Linha[]): Registro {
  return {
    ...real,
    buscarLinha: (slug) => real.buscarLinha(slug, lista()),
    linhasVisiveis: (env) => real.linhasVisiveis(env, lista()),
    linhasPublicadas: () => real.linhasPublicadas(lista()),
    linhaDoProduto: (slug) => real.linhaDoProduto(slug, lista()),
  };
}
