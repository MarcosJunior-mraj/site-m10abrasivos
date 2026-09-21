import type { MetadataRoute } from "next";
import { buscarCategorias, buscarItens } from "@/lib/catalog/client";
import { lerConfigServidor } from "@/lib/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { siteUrl } = lerConfigServidor();
  const [itens, categorias] = await Promise.all([buscarItens(), buscarCategorias()]);
  const comItens = categorias.filter((categoria) =>
    itens.some((item) => item.category?.slug === categoria.slug),
  );

  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
    ...comItens.map((categoria) => ({
      url: `${siteUrl}/${categoria.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...itens.map((item) => ({
      url: `${siteUrl}/produto/${item.slug}`,
      lastModified: new Date(item.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
