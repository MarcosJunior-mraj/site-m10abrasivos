import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
  lerConfigServidor: () => ({
    crmUrl: "https://crm.exemplo",
    catalogKey: "m10cat_abc",
    revalidateSecret: "segredo-de-pelo-menos-16",
    siteUrl: "https://m10abrasivos.com.br",
    empresa: {
      razaoSocial: "M10 Abrasivos Ltda",
      cnpj: "00.000.000/0001-00",
      emailEncarregado: "p@m10.com",
    },
  }),
  CONFIG_PUBLICA: {
    crmUrl: "",
    webchatKey: "",
    turnstileSiteKey: "",
    whatsappFallback: "5511999999999",
  },
}));

vi.mock("@/lib/catalog/client", () => ({
  buscarItens: async () => [
    {
      slug: "gt-50",
      updatedAt: "2026-09-20T10:00:00.000Z",
      category: { name: "P", slug: "poliborda" },
    },
  ],
  buscarCategorias: async () => [
    { name: "P", slug: "poliborda", description: null, imageUrl: null },
  ],
}));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("lista home, categorias, produtos e privacidade com URL absoluta", async () => {
    const urls = (await sitemap()).map((entrada) => entrada.url);
    expect(urls).toContain("https://m10abrasivos.com.br");
    expect(urls).toContain("https://m10abrasivos.com.br/poliborda");
    expect(urls).toContain("https://m10abrasivos.com.br/produto/gt-50");
    expect(urls).toContain("https://m10abrasivos.com.br/privacidade");
  });
});

describe("robots", () => {
  it("libera o site e aponta o sitemap, barrando as rotas internas", () => {
    const regras = robots();
    expect(regras.sitemap).toBe("https://m10abrasivos.com.br/sitemap.xml");
    const bloqueios = Array.isArray(regras.rules)
      ? regras.rules[0]?.disallow
      : regras.rules?.disallow;
    expect(bloqueios).toContain("/api/");
    expect(bloqueios).toContain("/imagens/");
  });
});
