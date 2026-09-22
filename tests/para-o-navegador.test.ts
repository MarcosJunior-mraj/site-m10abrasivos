import { describe, expect, it } from "vitest";
import { itemParaONavegador } from "@/lib/catalog/para-o-navegador";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

const ITEM: ItemCatalogo = {
  slug: "gt-120",
  kind: "product",
  title: "Green Turbo #120",
  description: "Abrasivo para polimento intermediário. Promoção: R$ 99,90 a unidade.",
  images: [
    "https://orgbling.s3.amazonaws.com/a.jpg?Signature=abc",
    "https://orgbling.s3.amazonaws.com/b.jpg?Signature=def",
  ],
  category: { name: "Poliborda", slug: "abrasivos-para-poliborda" },
  stones: ["granito"],
  applications: ["polimento"],
  grit: "120",
  diameterMm: 125,
  machines: ["Poliborda"],
  specs: { Preço: "R$ 10,00", Rosca: "M14" },
  isFeatured: true,
  seoTitle: "Oferta R$ 5",
  seoDescription: "Compre por R$ 5",
  updatedAt: "2026-09-20T10:00:00.000Z",
  components: [],
};

describe("itemParaONavegador", () => {
  it("não leva URL assinada, preço nem texto cru do CRM para o payload do cliente", () => {
    const serializado = JSON.stringify(itemParaONavegador(ITEM));
    expect(serializado).not.toContain("Signature");
    expect(serializado).not.toContain("amazonaws");
    expect(serializado).not.toMatch(/R\$|pre[çc]o/i);
  });

  it("mantém o que a grade e os filtros usam", () => {
    const seguro = itemParaONavegador(ITEM);
    expect(seguro.images).toEqual(["/imagens/gt-120/0", "/imagens/gt-120/1"]);
    expect(seguro.description).toBe("Abrasivo para polimento intermediário.");
    expect(seguro).toMatchObject({
      slug: "gt-120",
      title: "Green Turbo #120",
      stones: ["granito"],
      applications: ["polimento"],
      grit: "120",
      diameterMm: 125,
      category: { slug: "abrasivos-para-poliborda" },
    });
  });
});
