import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/catalog/client", () => ({
  buscarItens: vi.fn().mockResolvedValue([]),
  buscarCategorias: vi.fn().mockResolvedValue([]),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));

import { dadosEstruturadosDaLinha } from "@/app/linhas/[linha]/dados-estruturados";
import PaginaDaLinha, { generateMetadata } from "@/app/linhas/[linha]/page";
import { GREEN_TURBO } from "@/lib/linhas/green-turbo";
import { ehSlugReservado } from "@/lib/rotas";

const params = (linha: string) => ({ params: Promise.resolve({ linha }) });

beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://m10abrasivos.com.br");
  vi.stubEnv("CRM_URL", "https://crm.exemplo");
  vi.stubEnv("CATALOG_KEY", "m10cat_x");
  vi.stubEnv("SITE_REVALIDATE_SECRET", "x".repeat(16));
  vi.stubEnv("EMPRESA_RAZAO_SOCIAL", "M10");
  vi.stubEnv("EMPRESA_CNPJ", "00");
  vi.stubEnv("EMPRESA_EMAIL_ENCARREGADO", "a@b.co");
});

describe("página da linha", () => {
  it("rascunho sem MOSTRAR_RASCUNHOS é 404", async () => {
    vi.stubEnv("MOSTRAR_RASCUNHOS", "");
    await expect(PaginaDaLinha(params("green-turbo"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("linha inexistente é 404", async () => {
    vi.stubEnv("MOSTRAR_RASCUNHOS", "1");
    await expect(PaginaDaLinha(params("nada"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("com MOSTRAR_RASCUNHOS=1 monta as 10 seções na ordem, sem preço", async () => {
    vi.stubEnv("MOSTRAR_RASCUNHOS", "1");
    render(await PaginaDaLinha(params("green-turbo")));
    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titulos[0]).toMatch(/saia do fosco/i);
    expect(titulos).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/voltar a peça/i),
        expect.stringMatching(/pergunte ao especialista/i),
        expect.stringMatching(/dúvidas/i),
        expect.stringMatching(/próxima peça/i),
      ]),
    );
    expect(document.body.textContent).not.toMatch(/R\$|preço/i);
  });

  it("rascunho sai com noindex; título e descrição da linha", async () => {
    vi.stubEnv("MOSTRAR_RASCUNHOS", "1");
    const meta = await generateMetadata(params("green-turbo"));
    expect(meta.title).toBe(GREEN_TURBO.seo.titulo);
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("dados estruturados listam os grãos sem oferta/preço", () => {
    const json = dadosEstruturadosDaLinha(
      GREEN_TURBO,
      [{ slug: "abrasivo-m10-green-turbo-50", title: "Green Turbo #50" }],
      "https://m10abrasivos.com.br",
    );
    expect(json["@type"]).toBe("ItemList");
    expect(JSON.stringify(json)).toContain("/produto/abrasivo-m10-green-turbo-50");
    expect(JSON.stringify(json)).not.toMatch(/offers|price/i);
  });

  it("linhas e catalogo são caminhos reservados", () => {
    expect(ehSlugReservado("linhas")).toBe(true);
    expect(ehSlugReservado("catalogo")).toBe(true);
  });
});
