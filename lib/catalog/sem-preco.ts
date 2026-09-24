/**
 * Segunda trava contra preço na tela. A primeira é do CRM: a API pública não
 * tem coluna de preço. Mas `specs` (chave/valor livres) e `description` são
 * texto digitado por gente — alguém pode escrever "Preço: R$ 10,00" ali.
 *
 * Por que NÃO usar `\d+,\d{2}` sozinho: medida com vírgula decimal é
 * comum na ficha técnica ("12,50 mm", "1,20 m/s") e sumiria da tela. O que
 * caracteriza preço é o CONTEXTO de moeda (símbolo, código ou a palavra), então
 * o padrão exige isso; um número solto não basta.
 */

/** Chave de spec que fala de preço. "valor" e "custo" entram só aqui: como rótulo, quase sempre são preço. */
const CHAVE_DE_PRECO = /pre[çc]o|price|\bvalor|\bcusto|R\$/i;

/** Texto que fala de preço: símbolo ou código de moeda, "reais", ou a palavra preço/price. */
const TEXTO_DE_PRECO = /R\$|US\$|€|\bBRL\b|\bUSD\b|\breais\b|pre[çc]os?\b|\bprices?\b/i;

export function chaveFalaDePreco(chave: string): boolean {
  return CHAVE_DE_PRECO.test(chave);
}

export function textoFalaDePreco(texto: string): boolean {
  return TEXTO_DE_PRECO.test(texto);
}

/**
 * Tira as frases que falam de preço e devolve o resto (pode ficar vazio).
 * Frase termina em `.`, `!` ou `?` SEGUIDO DE ESPAÇO — assim "R$ 1.500,00"
 * não é partido no ponto de milhar (o que deixaria "500,00" na tela).
 */
export function textoSemPreco(texto: string): string {
  return texto
    .split(/(?<=[.!?])\s+/)
    .map((frase) => frase.trim())
    .filter((frase) => frase.length > 0 && !textoFalaDePreco(frase))
    .join(" ");
}
