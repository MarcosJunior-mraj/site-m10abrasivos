import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/catalog/client", () => ({ buscarItens: vi.fn() }));

import { SecaoOferta } from "@/components/linhas/secao-oferta";
import { buscarItens } from "@/lib/catalog/client";
import type { ItemCatalogo } from "@/lib/catalog/schemas";
import { GREEN_TURBO } from "@/lib/linhas/green-turbo";

function item(slug: string, title: string, kind: "product" | "kit" = "product"): ItemCatalogo {
  return {
    slug,
    kind,
    title,
    description: null,
    images: [],
    category: null,
    stones: [],
    applications: [],
    grit: null,
    diameterMm: null,
    machines: [],
    specs: {},
    isFeatured: false,
    seoTitle: null,
    seoDescription: null,
    updatedAt: "2026-09-23T00:00:00Z",
    components: [],
  };
}

const lista = buscarItens as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => lista.mockReset());

describe("SecaoOferta", () => {
  it("mostra o kit e só os avulsos que existem no catálogo, sem preço", async () => {
    lista.mockResolvedValue([
      item("kit-gt-para-poliborda", "Kit GT para Poliborda", "kit"),
      item("abrasivo-m10-green-turbo-50", "Green Turbo #50"),
      item("abrasivo-m10-green-turbo-100", "Green Turbo #100"),
    ]);
    render(await SecaoOferta({ linha: GREEN_TURBO }));
    expect(screen.getByRole("heading", { name: /kit green turbo para poliborda/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /green turbo #50/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /green turbo #100/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /#3000/ })).toBeNull();
    const cta = screen.getByRole("button", { name: /quero o valor do kit/i });
    expect(cta.getAttribute("data-mensagem")).toBe("Quero o valor do kit");
    expect(document.body.textContent).not.toMatch(/R\$/);
  });

  it("sem o kit no catálogo, o CTA vira montar a sequência com o especialista", async () => {
    lista.mockResolvedValue([item("abrasivo-m10-green-turbo-50", "Green Turbo #50")]);
    render(await SecaoOferta({ linha: GREEN_TURBO }));
    const cta = screen.getByRole("button", { name: /monte sua sequência com o especialista/i });
    expect(cta.getAttribute("data-mensagem")).toBeNull();
  });
});
