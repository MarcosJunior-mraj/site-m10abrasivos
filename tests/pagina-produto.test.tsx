import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { dadosEstruturados } from "@/app/produto/[slug]/dados-estruturados";
import { BotaoFalarComEspecialista } from "@/components/catalogo/botao-falar-com-especialista";
import { ComposicaoDoKit } from "@/components/catalogo/composicao-do-kit";
import { FolhaDeEspecificacao } from "@/components/catalogo/folha-de-especificacao";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

function item(parcial: Partial<ItemCatalogo>): ItemCatalogo {
  return {
    slug: "gt-50",
    kind: "product",
    title: "Green Turbo #50",
    description: null,
    images: ["https://orgbling.s3.amazonaws.com/foto?Signature=abc"],
    category: { name: "Poliborda", slug: "abrasivos-para-poliborda" },
    stones: ["granito", "marmore"],
    applications: ["desbaste"],
    grit: "50",
    diameterMm: 125,
    machines: ["Poliborda"],
    specs: { Rosca: "M14" },
    isFeatured: false,
    seoTitle: null,
    seoDescription: null,
    updatedAt: "2026-09-20T10:00:00.000Z",
    components: [],
    ...parcial,
  };
}

describe("FolhaDeEspecificacao", () => {
  it("lista grana, diâmetro, pedras, aplicações, máquinas e specs livres", () => {
    render(<FolhaDeEspecificacao item={item({})} />);
    expect(screen.getByText("#50")).toBeDefined();
    expect(screen.getByText("125 mm")).toBeDefined();
    expect(screen.getByText(/granito/i)).toBeDefined();
    expect(screen.getByText(/Mármore/i)).toBeDefined();
    expect(screen.getByText("Poliborda")).toBeDefined();
    expect(screen.getByText("M14")).toBeDefined();
  });

  it("omite a linha que não existe no item", () => {
    const { container } = render(<FolhaDeEspecificacao item={item({ grit: null, specs: {} })} />);
    expect(container.textContent).not.toContain("Grana");
    expect(container.textContent).not.toMatch(/R\$/);
  });
});

describe("ComposicaoDoKit", () => {
  it("mostra quantidade e link do componente publicado", () => {
    render(
      <ComposicaoDoKit
        componentes={[
          { title: "Green Turbo #50", slug: "gt-50", quantity: 2 },
          { title: "Acessório", slug: null, quantity: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Green Turbo #50/ }).getAttribute("href")).toBe(
      "/produto/gt-50",
    );
    expect(screen.getByText("2×")).toBeDefined();
    expect(screen.queryByRole("link", { name: /Acessório/ })).toBeNull();
  });
});

describe("BotaoFalarComEspecialista", () => {
  it("marca o botão com o item para o widget mandar como contexto", () => {
    render(<BotaoFalarComEspecialista item={item({})} />);
    const botao = screen.getByRole("button", { name: /falar com especialista/i });
    expect(botao.dataset.abrirChat).toBe("");
    expect(botao.dataset.item).toBe("Green Turbo #50");
  });
});

describe("dadosEstruturados", () => {
  const dados = dadosEstruturados(item({}), "https://m10abrasivos.com.br");

  it("declara Product sem oferta e sem preço", () => {
    expect(dados["@type"]).toBe("Product");
    expect(JSON.stringify(dados)).not.toMatch(/offers|price|R\$/i);
  });

  it("aponta a imagem para a rota do site, não para o S3", () => {
    expect(JSON.stringify(dados)).toContain("https://m10abrasivos.com.br/imagens/gt-50/0");
    expect(JSON.stringify(dados)).not.toContain("amazonaws");
  });
});
