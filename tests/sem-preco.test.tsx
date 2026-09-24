import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FolhaDeEspecificacao } from "@/components/catalogo/folha-de-especificacao";
import { descricaoDoItem } from "@/lib/catalog/apresentacao";
import type { ItemCatalogo } from "@/lib/catalog/schemas";
import { chaveFalaDePreco, textoFalaDePreco, textoSemPreco } from "@/lib/catalog/sem-preco";

function item(parcial: Partial<ItemCatalogo>): ItemCatalogo {
  return {
    slug: "gt-50",
    kind: "product",
    title: "Green Turbo #50",
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
    updatedAt: "2026-09-20T10:00:00.000Z",
    components: [],
    ...parcial,
  };
}

describe("detecção de preço", () => {
  it("chave de spec que fala de preço", () => {
    for (const chave of ["Preço", "preco", "Price", "Valor unitário", "Custo", "R$"]) {
      expect(chaveFalaDePreco(chave), chave).toBe(true);
    }
    for (const chave of ["Rosca", "Diâmetro", "Espessura", "Granulometria"]) {
      expect(chaveFalaDePreco(chave), chave).toBe(false);
    }
  });

  it("texto com moeda é preço; medida com vírgula decimal não é", () => {
    for (const texto of [
      "R$ 10,00",
      "r$10",
      "US$ 5",
      "12,50 reais",
      "BRL 30",
      "Preço sob consulta",
    ]) {
      expect(textoFalaDePreco(texto), texto).toBe(true);
    }
    for (const texto of ["12,50 mm", "4,5 mm", "Ø 125 mm", "M14", "#50", "1,20 m/s"]) {
      expect(textoFalaDePreco(texto), texto).toBe(false);
    }
  });

  it("tira só a frase com preço e mantém o resto", () => {
    expect(
      textoSemPreco("Disco para granito. Por apenas R$ 99,90 à vista! Rende muito no desbaste."),
    ).toBe("Disco para granito. Rende muito no desbaste.");
    expect(textoSemPreco("Só R$ 99,90.")).toBe("");
    expect(textoSemPreco("Kit completo. Sai por R$ 1.500,00 no boleto.")).toBe("Kit completo.");
  });
});

describe("FolhaDeEspecificacao sem preço", () => {
  it("não renderiza par cuja chave ou valor fale de preço, e mantém medidas", () => {
    const { container } = render(
      <FolhaDeEspecificacao
        item={item({
          specs: {
            Preço: "R$ 10,00",
            Tabela: "US$ 3",
            "Valor unitário": 12,
            Espessura: "12,50 mm",
            Rosca: "M14",
          },
        })}
      />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/R\$|US\$|pre[çc]o|valor/i);
    expect(texto).toContain("12,50 mm");
    expect(texto).toContain("M14");
  });
});

describe("descricaoDoItem sem preço", () => {
  it("tira a frase com preço da descrição do CRM", () => {
    const texto = descricaoDoItem(
      item({ description: "Lixa para mármore. Promoção: R$ 99,90 a unidade." }),
    );
    expect(texto).toBe("Lixa para mármore.");
  });

  it("descrição que era só preço cai para a frase da ficha", () => {
    const texto = descricaoDoItem(item({ description: "R$ 99,90", grit: "50" }));
    expect(texto).not.toMatch(/R\$/);
    expect(texto).toMatch(/grana 50/);
  });
});
