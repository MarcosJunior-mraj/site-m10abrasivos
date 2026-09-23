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
    image: item.images.map((_, indice) => `${siteUrl}${urlDaImagem(item, indice)}`),
    url: `${siteUrl}/produto/${item.slug}`,
  };
}

/**
 * `JSON.stringify` não escapa `<`: um `title` ou `description` vindo do CRM que
 * contenha a sequência literal `</script>` (descrição de fornecedor colada sem
 * querer, por exemplo) fecharia a tag no meio do JSON-LD. Trocamos cada `<` pela
 * sequência de escape Unicode equivalente aqui, junto da serialização, para
 * ninguém esquecer no próximo uso.
 */
export function dadosEstruturadosJson(item: ItemCatalogo, siteUrl: string): string {
  return JSON.stringify(dadosEstruturados(item, siteUrl)).replace(/</g, "\\u003c");
}
