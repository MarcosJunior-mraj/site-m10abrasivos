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
import { tipoPelosBytes } from "@/lib/catalog/origem-de-imagem";

function bytesDeTexto(texto: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(texto, (caractere) => caractere.charCodeAt(0));
}

function contexto(slug: string, indice: string) {
  return { params: Promise.resolve({ slug, indice }) };
}

const ITEM_COM_FOTO = {
  slug: "gt-50",
  images: ["https://orgbling.s3.amazonaws.com/foto?Signature=abc"],
};

describe("urlDaImagem", () => {
  const HD =
    "https://x.supabase.co/storage/v1/object/public/produtos-fotos/org/1/1-db173a28aedd.png";

  it("monta o caminho do próprio site com a versão da foto", () => {
    expect(urlDaImagem({ slug: "gt-50", images: [HD] })).toMatch(
      /^\/imagens\/gt-50\/0\?v=[0-9a-z]+$/,
    );
    expect(urlDaImagem({ slug: "kit gt", images: ["a", "b", HD] }, 2)).toMatch(
      /^\/imagens\/kit%20gt\/2\?v=/,
    );
  });

  it("muda a versão quando a foto muda — o navegador não fica com a antiga", () => {
    const antes = urlDaImagem({ slug: "gt-50", images: [HD] });
    const depois = urlDaImagem({
      slug: "gt-50",
      images: [HD.replace("db173a28aedd", "52ed2b7efed0")],
    });
    expect(depois).not.toBe(antes);
  });

  it("ignora a assinatura da URL do Bling, que muda a cada leitura", () => {
    const base = "https://orgbling.s3.amazonaws.com/96eac/t/b33ba916";
    const um = urlDaImagem({ slug: "gt-50", images: [`${base}?Expires=1&Signature=a`] });
    const outro = urlDaImagem({ slug: "gt-50", images: [`${base}?Expires=2&Signature=b`] });
    expect(um).toBe(outro);
    expect(um).not.toContain("amazonaws");
  });

  it("devolve como está o caminho que já é do site (item já preparado para o navegador)", () => {
    expect(urlDaImagem({ slug: "gt-50", images: ["/imagens/gt-50/0?v=abc"] })).toBe(
      "/imagens/gt-50/0?v=abc",
    );
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

describe("rota da imagem — cache-control", () => {
  beforeEach(() => {
    buscarItem.mockReset();
    vi.unstubAllGlobals();
  });

  it("toda resposta de falha (400/404/502) sai com cache-control no-store", async () => {
    // 400: índice inválido, nem chega a buscar o item.
    const resposta400 = await GET(
      new Request("http://site/imagens/gt-50/abc"),
      contexto("gt-50", "abc"),
    );
    expect(resposta400.status).toBe(400);
    expect(resposta400.headers.get("cache-control")).toBe("no-store");

    // 404: item sem aquela foto.
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    const resposta404 = await GET(
      new Request("http://site/imagens/gt-50/9"),
      contexto("gt-50", "9"),
    );
    expect(resposta404.status).toBe(404);
    expect(resposta404.headers.get("cache-control")).toBe("no-store");

    // 502: origem devolve erro genérico (não é link expirado).
    buscarItem.mockResolvedValue(ITEM_COM_FOTO);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("erro", { status: 500 })),
    );
    const resposta502 = await GET(
      new Request("http://site/imagens/gt-50/0"),
      contexto("gt-50", "0"),
    );
    expect(resposta502.status).toBe(502);
    expect(resposta502.headers.get("cache-control")).toBe("no-store");
  });

  it("sucesso mantém o cache-control público (não-store)", async () => {
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
    expect(resposta.headers.get("cache-control")).toBe(
      "public, max-age=86400, stale-while-revalidate=604800",
    );
  });
});

describe("rota da imagem — link assinado expirado (403 ou 400 'Request has expired')", () => {
  const ITEM_V1 = { slug: "gt-50", images: ["https://orgbling.s3.amazonaws.com/v1?Signature=a"] };
  const ITEM_V2 = { slug: "gt-50", images: ["https://orgbling.s3.amazonaws.com/v2?Signature=b"] };

  beforeEach(() => {
    buscarItem.mockReset();
    vi.unstubAllGlobals();
  });

  it("403 na 1ª tentativa: relê o item SEM cache e a 2ª tentativa com link novo dá 200", async () => {
    buscarItem.mockResolvedValueOnce(ITEM_V1).mockResolvedValueOnce(ITEM_V2);
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(new Response("Access denied", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
      );
    vi.stubGlobal("fetch", fetchFalso);

    const resposta = await GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));

    expect(resposta.status).toBe(200);
    expect(buscarItem).toHaveBeenCalledTimes(2);
    // A releitura ignora o Data Cache.
    expect(buscarItem.mock.calls[1]?.[1]).toMatchObject({ semCache: true });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(String(fetchFalso.mock.calls[0]?.[0])).toBe(ITEM_V1.images[0]);
    expect(String(fetchFalso.mock.calls[1]?.[0])).toBe(ITEM_V2.images[0]);
  });

  it("400 com XML 'Request has expired' também dispara a releitura e dá 200 na 2ª tentativa", async () => {
    buscarItem.mockResolvedValueOnce(ITEM_V1).mockResolvedValueOnce(ITEM_V2);
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          "<Error><Code>AccessDenied</Code><Message>Request has expired</Message></Error>",
          {
            status: 400,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
      );
    vi.stubGlobal("fetch", fetchFalso);

    const resposta = await GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));

    expect(resposta.status).toBe(200);
    expect(buscarItem).toHaveBeenCalledTimes(2);
  });

  it("400 sem a mensagem 'Request has expired' NÃO tenta de novo (502 na primeira falha)", async () => {
    buscarItem.mockResolvedValue(ITEM_V1);
    const fetchFalso = vi.fn(
      async () => new Response("<Error>Outra coisa</Error>", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchFalso);

    const resposta = await GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));

    expect(resposta.status).toBe(502);
    expect(buscarItem).toHaveBeenCalledTimes(1);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("403 nas duas tentativas: 502 no-store sem laço (só 2 buscas ao CRM, só 2 buscas à origem)", async () => {
    buscarItem.mockResolvedValue(ITEM_V1);
    const fetchFalso = vi.fn(async () => new Response("Access denied", { status: 403 }));
    vi.stubGlobal("fetch", fetchFalso);

    const resposta = await GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));

    expect(resposta.status).toBe(502);
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    expect(buscarItem).toHaveBeenCalledTimes(2);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("403 na 1ª tentativa e a releitura não tem mais a foto → 404 (sem tentar buscar origem de novo)", async () => {
    buscarItem.mockResolvedValueOnce(ITEM_V1).mockResolvedValueOnce({ slug: "gt-50", images: [] });
    const fetchFalso = vi.fn(async () => new Response("Access denied", { status: 403 }));
    vi.stubGlobal("fetch", fetchFalso);

    const resposta = await GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));

    expect(resposta.status).toBe(404);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
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

describe("tipoPelosBytes — identifica o tipo pela assinatura dos primeiros bytes", () => {
  it("identifica JPEG (FF D8 FF)", () => {
    expect(tipoPelosBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
  });

  it("identifica PNG (89 50 4E 47 0D 0A 1A 0A)", () => {
    expect(
      tipoPelosBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    ).toBe("image/png");
  });

  it("identifica GIF (GIF87a e GIF89a)", () => {
    expect(tipoPelosBytes(bytesDeTexto("GIF87a resto"))).toBe("image/gif");
    expect(tipoPelosBytes(bytesDeTexto("GIF89a resto"))).toBe("image/gif");
  });

  it("identifica WebP (RIFF....WEBP)", () => {
    const bytes = new Uint8Array(16);
    bytes.set(bytesDeTexto("RIFF"), 0);
    bytes.set(bytesDeTexto("WEBP"), 8);
    expect(tipoPelosBytes(bytes)).toBe("image/webp");
  });

  it("identifica AVIF (....ftypavif / ftypavis)", () => {
    const comAvif = new Uint8Array(12);
    comAvif.set(bytesDeTexto("ftyp"), 4);
    comAvif.set(bytesDeTexto("avif"), 8);
    expect(tipoPelosBytes(comAvif)).toBe("image/avif");

    const comAvis = new Uint8Array(12);
    comAvis.set(bytesDeTexto("ftyp"), 4);
    comAvis.set(bytesDeTexto("avis"), 8);
    expect(tipoPelosBytes(comAvis)).toBe("image/avif");
  });

  it("não identifica SVG/HTML/texto qualquer (nenhuma assinatura bate)", () => {
    expect(tipoPelosBytes(bytesDeTexto("<svg><script>alert(1)</script></svg>"))).toBeNull();
    expect(tipoPelosBytes(bytesDeTexto("<html></html>"))).toBeNull();
  });

  it("não identifica corpo vazio", () => {
    expect(tipoPelosBytes(new Uint8Array(0))).toBeNull();
  });
});

describe("rota da imagem — content-type genérico (octet-stream do Bling)", () => {
  const ITEM = { slug: "gt-50", images: ["https://orgbling.s3.amazonaws.com/foto?Signature=abc"] };

  function imagemGenerica(
    corpo: BodyInit,
    tipo: string | null = "application/octet-stream",
  ): Response {
    const headers = new Headers();
    if (tipo) headers.set("content-type", tipo);
    return new Response(corpo, { headers });
  }

  async function pedir(): Promise<Response> {
    return GET(new Request("http://site/imagens/gt-50/0"), contexto("gt-50", "0"));
  }

  beforeEach(() => {
    buscarItem.mockReset();
    vi.unstubAllGlobals();
  });

  it("octet-stream com bytes de JPEG → 200 image/jpeg", async () => {
    buscarItem.mockResolvedValue(ITEM);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagemGenerica(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]))),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/jpeg");
  });

  it("octet-stream com bytes de PNG → 200 image/png", async () => {
    buscarItem.mockResolvedValue(ITEM);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        imagemGenerica(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      ),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/png");
  });

  it("binary/octet-stream com bytes de WebP → 200 image/webp", async () => {
    buscarItem.mockResolvedValue(ITEM);
    const bytes = new Uint8Array(16);
    bytes.set(bytesDeTexto("RIFF"), 0);
    bytes.set(bytesDeTexto("WEBP"), 8);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagemGenerica(bytes, "binary/octet-stream")),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/webp");
  });

  it("octet-stream com bytes de GIF → 200 image/gif", async () => {
    buscarItem.mockResolvedValue(ITEM);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagemGenerica(bytesDeTexto("GIF89a resto do arquivo"))),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/gif");
  });

  it("octet-stream com bytes de AVIF → 200 image/avif", async () => {
    buscarItem.mockResolvedValue(ITEM);
    const bytes = new Uint8Array(12);
    bytes.set(bytesDeTexto("ftyp"), 4);
    bytes.set(bytesDeTexto("avif"), 8);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagemGenerica(bytes)),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/avif");
  });

  it("content-type ausente com bytes de JPEG → 200 image/jpeg", async () => {
    buscarItem.mockResolvedValue(ITEM);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagemGenerica(new Uint8Array([0xff, 0xd8, 0xff]), null)),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/jpeg");
  });

  it("octet-stream com bytes de SVG (texto) → 502", async () => {
    buscarItem.mockResolvedValue(ITEM);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagemGenerica(bytesDeTexto("<svg><script>alert(1)</script></svg>"))),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(502);
  });

  it("octet-stream com corpo vazio → 502", async () => {
    buscarItem.mockResolvedValue(ITEM);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagemGenerica(new Uint8Array(0))),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(502);
  });

  it("image/svg+xml DECLARADO → 502 mesmo com bytes que parecem JPEG (não olha os bytes)", async () => {
    buscarItem.mockResolvedValue(ITEM);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagemGenerica(new Uint8Array([0xff, 0xd8, 0xff]), "image/svg+xml")),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(502);
  });

  it("o log do servidor nunca inclui a URL de origem, mesmo ao recusar", async () => {
    buscarItem.mockResolvedValue(ITEM);
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => imagemGenerica(bytesDeTexto("<html></html>"), "text/html")),
    );
    const resposta = await pedir();
    expect(resposta.status).toBe(502);
    expect(avisos).toHaveBeenCalled();
    const textoDosAvisos = avisos.mock.calls.map((chamada) => JSON.stringify(chamada)).join(" ");
    expect(textoDosAvisos).not.toContain("orgbling");
    expect(textoDosAvisos).not.toContain("Signature");
    avisos.mockRestore();
  });
});
