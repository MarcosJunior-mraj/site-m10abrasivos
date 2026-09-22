import { beforeEach, describe, expect, it, vi } from "vitest";
import { buscarCategorias, buscarItem, buscarItens, ErroDoCatalogo } from "@/lib/catalog/client";

const ENV = {
  CRM_URL: "https://crm.exemplo",
  CATALOG_KEY: "m10cat_abc",
  SITE_REVALIDATE_SECRET: "segredo-de-pelo-menos-16",
  SITE_URL: "https://site.exemplo",
  EMPRESA_RAZAO_SOCIAL: "M10",
  EMPRESA_CNPJ: "00.000.000/0001-00",
  EMPRESA_EMAIL_ENCARREGADO: "p@exemplo.com",
};

const ITEM = {
  slug: "abrasivo-m10-green-turbo-50",
  kind: "product",
  title: "Abrasivo M10 Green Turbo #50",
  description: null,
  images: ["https://orgbling.s3.amazonaws.com/foto?Signature=abc"],
  category: { name: "Abrasivos para poliborda", slug: "abrasivos-para-poliborda" },
  stones: ["granito", "marmore"],
  applications: ["desbaste"],
  grit: "50",
  diameterMm: 125,
  machines: ["Poliborda"],
  specs: {},
  isFeatured: true,
  seoTitle: null,
  seoDescription: null,
  updatedAt: "2026-09-20T10:00:00.000Z",
  components: [],
};

function respostaFalsa(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("cliente do catálogo", () => {
  let chamadas: { url: string; init: RequestInit }[];

  beforeEach(() => {
    chamadas = [];
  });

  function fetchFalso(resposta: Response | (() => Promise<Response>)) {
    return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      chamadas.push({ url: String(url), init: init ?? {} });
      return typeof resposta === "function" ? await resposta() : resposta;
    }) as unknown as typeof fetch;
  }

  it("busca itens com a chave, a tag de cache e os filtros na URL", async () => {
    const itens = await buscarItens(
      { categoria: "abrasivos-para-poliborda", destaque: true },
      { env: ENV, fetchImpl: fetchFalso(respostaFalsa({ data: [ITEM] })) },
    );

    expect(itens).toHaveLength(1);
    expect(itens[0]?.slug).toBe(ITEM.slug);
    const chamada = chamadas[0];
    expect(chamada?.url).toBe(
      "https://crm.exemplo/api/public/catalog/items?category=abrasivos-para-poliborda&featured=true",
    );
    const cabecalhos = chamada?.init.headers as Record<string, string>;
    expect(cabecalhos["x-catalog-key"]).toBe("m10cat_abc");
    expect((chamada?.init as { next?: { tags?: string[]; revalidate?: number } }).next).toEqual({
      tags: ["catalog"],
      revalidate: 3600,
    });
  });

  it("devolve null quando o item não existe", async () => {
    const item = await buscarItem("nao-existe", {
      env: ENV,
      fetchImpl: fetchFalso(respostaFalsa({ error: "Item não encontrado." }, 404)),
    });
    expect(item).toBeNull();
  });

  it("lança ErroDoCatalogo quando a chave é recusada", async () => {
    await expect(
      buscarItens(
        {},
        {
          env: ENV,
          fetchImpl: fetchFalso(respostaFalsa({ error: "Chave da API inválida." }, 401)),
        },
      ),
    ).rejects.toBeInstanceOf(ErroDoCatalogo);
  });

  it("lança ErroDoCatalogo quando o CRM não responde", async () => {
    const quebrado = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(buscarCategorias({ env: ENV, fetchImpl: quebrado })).rejects.toThrow(/CRM/);
  });

  it("recusa payload fora do formato em vez de devolver dado quebrado", async () => {
    const semSlug = { ...ITEM, slug: undefined };
    await expect(
      buscarItens({}, { env: ENV, fetchImpl: fetchFalso(respostaFalsa({ data: [semSlug] })) }),
    ).rejects.toThrow(/formato/);
  });

  it("descarta da lista de fotos o que não é URL http(s) válida, sem derrubar o item", async () => {
    const comLixo = {
      ...ITEM,
      images: [
        "javascript:alert(1)",
        "não é url",
        "data:image/svg+xml,<svg/>",
        "https://orgbling.s3.amazonaws.com/foto?Signature=abc",
      ],
    };
    const itens = await buscarItens(
      {},
      { env: ENV, fetchImpl: fetchFalso(respostaFalsa({ data: [comLixo] })) },
    );
    expect(itens[0]?.images).toEqual(["https://orgbling.s3.amazonaws.com/foto?Signature=abc"]);
  });

  it("busca categorias", async () => {
    const categorias = await buscarCategorias({
      env: ENV,
      fetchImpl: fetchFalso(
        respostaFalsa({
          data: [
            {
              name: "Abrasivos para poliborda",
              slug: "abrasivos-para-poliborda",
              description: null,
              imageUrl: null,
            },
          ],
        }),
      ),
    });
    expect(categorias[0]?.slug).toBe("abrasivos-para-poliborda");
    expect(chamadas[0]?.url).toBe("https://crm.exemplo/api/public/catalog/categories");
  });

  it("lança ErroDoCatalogo quando a resposta não é JSON válido", async () => {
    const respostaInvalida = new Response("<html>não é json</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    await expect(
      buscarItens({}, { env: ENV, fetchImpl: fetchFalso(respostaInvalida) }),
    ).rejects.toThrow(ErroDoCatalogo);
    try {
      await buscarItens({}, { env: ENV, fetchImpl: fetchFalso(respostaInvalida) });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDoCatalogo);
      expect((erro as ErroDoCatalogo).message).toContain("Resposta do CRM não era JSON válido");
    }
  });
});
