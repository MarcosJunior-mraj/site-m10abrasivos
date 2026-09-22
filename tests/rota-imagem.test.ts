import { beforeEach, describe, expect, it, vi } from "vitest";

const buscarItem = vi.fn();
vi.mock("@/lib/catalog/client", () => ({
  buscarItem: (...args: unknown[]) => buscarItem(...args),
}));

vi.mock("@/lib/config", () => ({
  lerConfigServidor: () => ({
    crmUrl: "http://crm.local:3101",
    catalogKey: "m10cat_abc",
    revalidateSecret: "segredo-de-pelo-menos-16",
    siteUrl: "https://site.exemplo",
    imagensHostsExtras: ["fotos.m10abrasivos.com.br"],
    empresa: { razaoSocial: "M10", cnpj: "0", emailEncarregado: "p@exemplo.com" },
  }),
}));

import { GET } from "@/app/imagens/[slug]/[indice]/route";
import { urlDaImagem } from "@/lib/catalog/imagens";

function contexto(slug: string, indice: string) {
  return { params: Promise.resolve({ slug, indice }) };
}

const ITEM_COM_FOTO = {
  slug: "gt-50",
  images: ["https://orgbling.s3.amazonaws.com/foto?Signature=abc"],
};

describe("urlDaImagem", () => {
  it("monta o caminho do próprio site", () => {
    expect(urlDaImagem("gt-50")).toBe("/imagens/gt-50/0");
    expect(urlDaImagem("kit gt", 2)).toBe("/imagens/kit%20gt/2");
  });
});

describe("rota da imagem", () => {
  beforeEach(() => {
    buscarItem.mockReset();
    vi.unstubAllGlobals();
  });

  it("devolve os bytes da origem com cache longo", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
      ),
    );

    const resposta = await GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/jpeg");
    expect(resposta.headers.get("cache-control")).toContain("max-age=86400");
    expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("404 quando o item não tem aquela foto", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    const resposta = await GET(new Request("http://site/imagens/gt-50/3"), contexto("gt-50", "3"));
    expect(resposta.status).toBe(404);
  });

  it("404 quando o item não existe", async () => {
    buscarItem.mockResolvedValue(null);
    const resposta = await GET(new Request("http://site/imagens/nada/0"), contexto("nada", "0"));
    expect(resposta.status).toBe(404);
  });

  it("400 quando o índice não é número", async () => {
    const resposta = await GET(
      new Request("http://site/imagens/gt-50/abc"),
      contexto("gt-50", "abc"),
    );
    expect(resposta.status).toBe(400);
    expect(buscarItem).not.toHaveBeenCalled();
  });

  it("502 quando a URL assinada já venceu", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Access denied", { status: 403 })),
    );
    const resposta = await GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));
    expect(resposta.status).toBe(502);
  });

  it("502 quando a origem devolve algo que não é imagem", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { headers: { "content-type": "text/html" } })),
    );
    const resposta = await GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));
    expect(resposta.status).toBe(502);
  });

  it("502 quando o corpo da resposta estoura ao ser lido", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    const corpoComFalha = new ReadableStream({
      start(controller) {
        controller.error(new Error("conexão caiu"));
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(corpoComFalha, { status: 200, headers: { "content-type": "image/jpeg" } }),
      ),
    );
    const resposta = await GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));
    expect(resposta.status).toBe(502);
  });
});

describe("rota da imagem — segurança do proxy", () => {
  const ORIGEM = ITEM_COM_FOTO.images[0] ?? "";

  function imagem(tipo: string, corpo: BodyInit = new Uint8Array([1, 2, 3])): Response {
    return new Response(corpo, { headers: { "content-type": tipo } });
  }

  async function pedir(slug = "gt-50", indice = "0"): Promise<Response> {
    return GET(new Request(`http://site/imagens/${slug}/${indice}`), contexto(slug, indice));
  }

  beforeEach(() => {
    buscarItem.mockReset();
    vi.unstubAllGlobals();
  });

  it("SVG vira 502 (poderia carregar script na origem do site)", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagem("image/svg+xml", "<svg><script>alert(1)</script></svg>")),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(502);
  });

  it("aceita tipo com parâmetro e maiúsculas, e devolve o tipo normalizado", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagem("Image/PNG; charset=binary")),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/png");
  });

  it("recusa tipo de imagem fora da lista (ex.: image/x-icon)", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagem("image/x-icon")),
    );
    expect((await pedir()).status).toBe(502);
  });

  it("responde com nosniff e CSP que isola o conteúdo", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagem("image/webp")),
    );
    const resposta = await pedir();
    expect(resposta.headers.get("x-content-type-options")).toBe("nosniff");
    expect(resposta.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
  });

  it("não segue redirecionamento da origem", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    const fetchFalso = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      imagem("image/jpeg"),
    );
    vi.stubGlobal("fetch", fetchFalso);
    await pedir();
    expect(fetchFalso.mock.calls[0]?.[1]?.redirect).toBe("error");
  });

  it("host fora da lista não é buscado (404) e a resposta não vaza a URL de origem", async () => {
    const url = "https://169.254.169.254/latest/meta-data?Signature=segredo";
    buscarItem.mockResolvedValue({ slug: "gt-50", images: [url] });
    const fetchFalso = vi.fn(async () => imagem("image/jpeg"));
    vi.stubGlobal("fetch", fetchFalso);

    const resposta = await pedir();

    expect(resposta.status).toBe(404);
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(await resposta.text()).not.toContain("169.254");
  });

  it("recusa http mesmo em host do Bling", async () => {
    buscarItem.mockResolvedValue({
      slug: "gt-50",
      images: ["http://orgbling.s3.amazonaws.com/foto.jpg"],
    });
    const fetchFalso = vi.fn(async () => imagem("image/jpeg"));
    vi.stubGlobal("fetch", fetchFalso);
    expect((await pedir()).status).toBe(404);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("aceita a própria origem do CRM (é ele quem manda o catálogo) e hosts extras configurados", async () => {
    const fetchFalso = vi.fn(async () => imagem("image/jpeg"));
    vi.stubGlobal("fetch", fetchFalso);

    buscarItem.mockResolvedValue({ slug: "gt-50", images: ["http://crm.local:3101/foto.jpg"] });
    expect((await pedir()).status).toBe(200);

    buscarItem.mockResolvedValue({
      slug: "gt-50",
      images: ["https://fotos.m10abrasivos.com.br/kit.jpg"],
    });
    expect((await pedir()).status).toBe(200);
  });

  it("corpo de erro nunca contém a URL de origem", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(`falhou ao buscar ${ORIGEM}`);
      }),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(502);
    const corpo = await resposta.text();
    expect(corpo).not.toContain("orgbling");
    expect(corpo).not.toContain("Signature");
  });

  it("recusa imagem acima do teto pelo content-length, sem ler o corpo", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1]), {
            headers: { "content-type": "image/jpeg", "content-length": String(6 * 1024 * 1024) },
          }),
      ),
    );
    expect((await pedir()).status).toBe(502);
  });

  it("recusa imagem que passa do teto durante a leitura (sem content-length)", async () => {
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    const pedaco = new Uint8Array(1024 * 1024);
    let enviados = 0;
    const corpo = new ReadableStream<Uint8Array>({
      pull(controller) {
        enviados += 1;
        if (enviados > 8) controller.close();
        else controller.enqueue(pedaco);
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(corpo, { headers: { "content-type": "image/jpeg" } })),
    );
    expect((await pedir()).status).toBe(502);
  });
});
