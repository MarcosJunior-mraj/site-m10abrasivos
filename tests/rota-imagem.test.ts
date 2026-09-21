import { beforeEach, describe, expect, it, vi } from "vitest";

const buscarItem = vi.fn();
vi.mock("@/lib/catalog/client", () => ({
  buscarItem: (...args: unknown[]) => buscarItem(...args),
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
