import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CartaoItem } from "@/components/catalogo/cartao-item";
import { EscalaDeRugosidade } from "@/components/catalogo/escala-de-rugosidade";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

function item(parcial: Partial<ItemCatalogo>): ItemCatalogo {
  return {
    slug: "gt-50",
    kind: "product",
    title: "Abrasivo M10 Green Turbo #50",
    description: null,
    images: ["https://orgbling.s3.amazonaws.com/foto?Signature=abc"],
    category: { name: "Abrasivos para poliborda", slug: "abrasivos-para-poliborda" },
    stones: ["granito"],
    applications: ["desbaste"],
    grit: "50",
    diameterMm: 125,
    machines: ["Poliborda"],
    specs: {},
    isFeatured: false,
    seoTitle: null,
    seoDescription: null,
    updatedAt: "2026-09-20T10:00:00.000Z",
    components: [],
    ...parcial,
  };
}

describe("CartaoItem", () => {
  it("leva à página do item e mostra a foto pela rota do site", () => {
    const { container } = render(<CartaoItem item={item({})} />);
    expect(screen.getByRole("link", { name: /Green Turbo #50/ }).getAttribute("href")).toBe(
      "/produto/gt-50",
    );
    const imagem = container.querySelector("img");
    // O `next/image` passa o `src` pelo otimizador (`/_next/image?url=...`), por
    // isso decodificamos antes de comparar — o que importa é que a rota interna
    // do site aparece no `src`, nunca a URL assinada do Bling.
    const src = decodeURIComponent(imagem?.getAttribute("src") ?? "");
    expect(src).toContain("/imagens/gt-50/0");
    expect(src).not.toContain("amazonaws");
    expect(src).toMatch(/\/imagens\/gt-50\/0\?v=/);
  });

  it("mostra a foto inteira, sem cortar o produto", () => {
    const { container } = render(<CartaoItem item={item({})} />);
    const imagem = container.querySelector("img");
    expect(imagem?.className).toContain("object-contain");
    expect(imagem?.className).not.toContain("object-cover");
  });

  it("não mostra preço nem promessa de preço", () => {
    const { container } = render(<CartaoItem item={item({})} />);
    expect(container.textContent).not.toMatch(/R\$|preço|valor|a partir de/i);
  });

  it("mostra marcador da marca quando o item não tem foto", () => {
    const { container } = render(
      <CartaoItem item={item({ images: [], slug: "kit", kind: "kit" })} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("marcador-sem-foto")).toBeDefined();
  });
});

describe("EscalaDeRugosidade", () => {
  it("põe as granas em ordem crescente com link para cada item", () => {
    const itens = [item({ slug: "gt-400", grit: "400" }), item({ slug: "gt-50", grit: "50" })];
    const { container } = render(<EscalaDeRugosidade itens={itens} />);
    const links = within(container).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/produto/gt-50",
      "/produto/gt-400",
    ]);
    expect(links[0]?.textContent).toContain("50");
  });

  it("não aparece quando nenhum item tem grana", () => {
    const { container } = render(<EscalaDeRugosidade itens={[item({ grit: null })]} />);
    expect(container.firstChild).toBeNull();
  });
});
