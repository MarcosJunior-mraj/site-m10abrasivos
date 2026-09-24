import type { MetadataRoute } from "next";
import { lerConfigServidor } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = lerConfigServidor();
  return {
    // `/imagens/` fica de fora do rastreamento: é rota de serviço, e a foto
    // que importa para busca já vai no `image` dos dados estruturados.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/imagens/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
