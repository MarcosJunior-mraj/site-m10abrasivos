import type { ItemCatalogo } from "./schemas";

const PREFIXO = "/imagens/";

/**
 * Caminho estável da foto, servido pelo próprio site. As URLs que o Bling
 * devolve são links assinados do S3 com validade de ~24 h: se fossem parar no
 * HTML, a página estática ficaria com foto quebrada no dia seguinte.
 *
 * O `?v=` é a versão da foto (hash da URL de origem SEM a query, que no Bling
 * é só a assinatura e muda a cada leitura). Foto trocada ganha caminho novo, e
 * o navegador e o otimizador do Next não ficam presos à cópia antiga pelo
 * `max-age` da rota. A rota ignora a query.
 *
 * Item já preparado por `itemParaONavegador` traz em `images` o caminho do
 * site: ele volta como está.
 */
export function urlDaImagem(item: Pick<ItemCatalogo, "slug" | "images">, indice = 0): string {
  const origem = item.images[indice];
  if (origem?.startsWith(PREFIXO)) return origem;
  const caminho = `${PREFIXO}${encodeURIComponent(item.slug)}/${indice}`;
  return origem ? `${caminho}?v=${versaoDa(origem)}` : caminho;
}

export function temImagem(item: Pick<ItemCatalogo, "images">): boolean {
  return item.images.length > 0;
}

/** FNV-1a de 32 bits em base 36: curto, estável e sem `node:crypto` (roda no navegador). */
function versaoDa(origem: string): string {
  const semQuery = origem.split("?")[0] ?? origem;
  let hash = 0x811c9dc5;
  for (let i = 0; i < semQuery.length; i++) {
    hash ^= semQuery.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
