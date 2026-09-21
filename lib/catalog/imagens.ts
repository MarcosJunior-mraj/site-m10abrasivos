import type { ItemCatalogo } from "./schemas";

/**
 * Caminho estável da foto, servido pelo próprio site. As URLs que o Bling
 * devolve são links assinados do S3 com validade de ~24 h: se fossem parar no
 * HTML, a página estática ficaria com foto quebrada no dia seguinte.
 */
export function urlDaImagem(slug: string, indice = 0): string {
  return `/imagens/${encodeURIComponent(slug)}/${indice}`;
}

export function temImagem(item: Pick<ItemCatalogo, "images">): boolean {
  return item.images.length > 0;
}
