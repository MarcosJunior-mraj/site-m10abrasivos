import type { Linha } from "@/lib/linhas/esquema";

/** `ItemList` dos itens da oferta, apontando para as páginas técnicas. Sem `offers`: o site não publica preço. */
export function dadosEstruturadosDaLinha(
  linha: Linha,
  itens: { slug: string; title: string }[],
  siteUrl: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${linha.nome} — M10 Abrasivos`,
    description: linha.seo.descricao,
    url: `${siteUrl}/linhas/${linha.slug}`,
    itemListElement: itens.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.title,
      url: `${siteUrl}/produto/${item.slug}`,
    })),
  };
}

export function dadosEstruturadosDaLinhaJson(
  ...args: Parameters<typeof dadosEstruturadosDaLinha>
): string {
  return JSON.stringify(dadosEstruturadosDaLinha(...args)).replace(/</g, "\\u003c");
}
