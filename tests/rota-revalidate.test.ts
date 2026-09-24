import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));

const SEGREDO = "segredo-de-pelo-menos-16";

vi.mock("@/lib/config", () => ({
  lerConfigServidor: () => ({
    crmUrl: "https://crm.exemplo",
    catalogKey: "m10cat_abc",
    revalidateSecret: SEGREDO,
    siteUrl: "https://site.exemplo",
    empresa: { razaoSocial: "M10", cnpj: "0", emailEncarregado: "p@exemplo.com" },
  }),
}));

import { POST } from "@/app/api/revalidate/route";

function pedido(corpo: unknown, autorizacao?: string): Request {
  return new Request("https://site.exemplo/api/revalidate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(autorizacao ? { authorization: autorizacao } : {}),
    },
    body: JSON.stringify(corpo),
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => revalidateTag.mockReset());

  it("revalida a tag do catálogo com o segredo certo", async () => {
    const resposta = await POST(pedido({ tag: "catalog" }, `Bearer ${SEGREDO}`));
    expect(resposta.status).toBe(200);
    // Expiração imediata: o primeiro visitante depois de um sync já recebe
    // dado novo. Profile "max" (stale-while-revalidate) entregava a versão
    // velha — ver prod-fix-2-brief.md.
    expect(revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
  });

  it("recusa sem cabeçalho", async () => {
    const resposta = await POST(pedido({ tag: "catalog" }));
    expect(resposta.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("recusa com segredo errado do mesmo tamanho", async () => {
    const resposta = await POST(pedido({ tag: "catalog" }, `Bearer ${"x".repeat(SEGREDO.length)}`));
    expect(resposta.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("recusa tag desconhecida", async () => {
    const resposta = await POST(pedido({ tag: "precos" }, `Bearer ${SEGREDO}`));
    expect(resposta.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("recusa corpo que não é JSON", async () => {
    const quebrado = new Request("https://site.exemplo/api/revalidate", {
      method: "POST",
      headers: { authorization: `Bearer ${SEGREDO}` },
      body: "isto não é json",
    });
    const resposta = await POST(quebrado);
    expect(resposta.status).toBe(400);
  });

  it("recusa JSON válido fora do formato (null, lista, tag não-texto) com 400, sem estourar", async () => {
    for (const corpo of [null, [], { tag: 123 }, {}]) {
      const resposta = await POST(pedido(corpo, `Bearer ${SEGREDO}`));
      expect(resposta.status, JSON.stringify(corpo)).toBe(400);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
