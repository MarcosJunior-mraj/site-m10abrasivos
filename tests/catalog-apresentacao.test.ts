import { describe, expect, it } from "vitest";
import {
  aplicarFiltros,
  descricaoDoItem,
  escreverSelecaoNaUrl,
  filtrosDisponiveis,
  lerSelecaoDaUrl,
  ordenarPorGrana,
  rotuloDePedra,
} from "@/lib/catalog/apresentacao";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

function item(parcial: Partial<ItemCatalogo>): ItemCatalogo {
  return {
    slug: "item",
    kind: "product",
    title: "Item",
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

describe("descricaoDoItem", () => {
  it("usa a descrição do CRM quando existe", () => {
    expect(descricaoDoItem(item({ description: "  Disco de desbaste rápido.  " }))).toBe(
      "Disco de desbaste rápido.",
    );
  });

  it("monta a frase só com fatos da ficha quando não há descrição", () => {
    const frase = descricaoDoItem(
      item({
        grit: "50",
        diameterMm: 125,
        applications: ["desbaste", "polimento"],
        stones: ["granito", "marmore"],
      }),
    );
    expect(frase).toBe(
      "Abrasivo M10, grana 50, Ø 125 mm, para desbaste e polimento em granito e mármore.",
    );
  });

  it("não inventa nada quando a ficha está vazia", () => {
    expect(descricaoDoItem(item({}))).toBe("Abrasivo M10 para marmorarias.");
  });

  it("descreve kit pela composição", () => {
    const kit = item({
      kind: "kit",
      components: [
        { title: "Green Turbo #50", slug: "gt-50", quantity: 1 },
        { title: "Green Turbo #100", slug: "gt-100", quantity: 2 },
      ],
    });
    expect(descricaoDoItem(kit)).toBe("Kit com 2 itens selecionados para trabalhar em conjunto.");
  });
});

describe("ordenarPorGrana", () => {
  it("ordena numericamente e joga quem não tem grana para o fim", () => {
    const itens = [
      item({ slug: "b", grit: "3000" }),
      item({ slug: "k", grit: null }),
      item({ slug: "a", grit: "50" }),
      item({ slug: "c", grit: "400" }),
    ];
    expect(ordenarPorGrana(itens).map((i) => i.slug)).toEqual(["a", "c", "b", "k"]);
  });
});

describe("filtros", () => {
  const itens = [
    item({
      slug: "a",
      grit: "50",
      diameterMm: 125,
      stones: ["granito"],
      applications: ["desbaste"],
    }),
    item({
      slug: "b",
      grit: "400",
      diameterMm: 125,
      stones: ["granito", "marmore"],
      applications: ["polimento"],
    }),
  ];

  it("só oferece valores que existem, com a contagem", () => {
    const filtros = filtrosDisponiveis(itens);
    expect(filtros.pedras).toEqual([
      { valor: "granito", rotulo: "Granito", quantidade: 2 },
      { valor: "marmore", rotulo: "Mármore", quantidade: 1 },
    ]);
    expect(filtros.granas.map((o) => o.valor)).toEqual(["50", "400"]);
    expect(filtros.diametros).toEqual([{ valor: "125", rotulo: "Ø 125 mm", quantidade: 2 }]);
  });

  it("filtra por combinação e devolve tudo quando nada foi escolhido", () => {
    expect(aplicarFiltros(itens, {}).map((i) => i.slug)).toEqual(["a", "b"]);
    expect(aplicarFiltros(itens, { pedra: "marmore" }).map((i) => i.slug)).toEqual(["b"]);
    expect(
      aplicarFiltros(itens, { pedra: "granito", aplicacao: "polimento" }).map((i) => i.slug),
    ).toEqual(["b"]);
    expect(aplicarFiltros(itens, { pedra: "granito", grana: "50" }).map((i) => i.slug)).toEqual([
      "a",
    ]);
  });

  it("lê e escreve a seleção na URL, ignorando o que não é filtro", () => {
    const selecao = lerSelecaoDaUrl(new URLSearchParams("pedra=granito&grana=50&lixo=1"));
    expect(selecao).toEqual({ pedra: "granito", grana: "50" });
    expect(escreverSelecaoNaUrl(selecao)).toBe("?pedra=granito&grana=50");
    expect(escreverSelecaoNaUrl({})).toBe("");
  });
});

describe("rótulos", () => {
  it("acentua os valores que vêm sem acento do CRM", () => {
    expect(rotuloDePedra("marmore")).toBe("mármore");
    expect(rotuloDePedra("ardosia")).toBe("ardósia");
    expect(rotuloDePedra("basalto")).toBe("basalto");
  });
});
