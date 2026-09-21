import { descricaoDoItem } from "@/lib/catalog/apresentacao";
import { urlDaImagem } from "@/lib/catalog/imagens";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

/**
 * `Product` SEM `offers`: o site não publica preço, e uma oferta sem preço é
 * pior do que nenhuma (o Google marca como erro).
 */
export function dadosEstruturados(item: ItemCatalogo, siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description: descricaoDoItem(item),
    brand: { "@type": "Brand", name: "M10 Abrasivos" },
    category: item.category?.name,
    image: item.images.map((_, indice) => `${siteUrl}${urlDaImagem(item.slug, indice)}`),
    url: `${siteUrl}/produto/${item.slug}`,
  };
}
