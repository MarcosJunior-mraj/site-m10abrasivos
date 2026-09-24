import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrilhaDoItem } from "@/components/catalogo/trilha-do-item";
import { Cabecalho } from "@/components/layout/cabecalho";

describe("Cabecalho no celular (M4)", () => {
  it("a navegação de categorias não some abaixo de md: rola na horizontal", () => {
    render(
      <Cabecalho
        categorias={[
          { nome: "Abrasivos para poliborda", slug: "abrasivos-para-poliborda" },
          { nome: "Discos de corte", slug: "discos-de-corte" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(nav.className).toMatch(/overflow-x-auto/);
    expect(screen.getByRole("link", { name: "Discos de corte" }).getAttribute("href")).toBe(
      "/discos-de-corte",
    );
  });
});

describe("TrilhaDoItem (M4)", () => {
  it("leva da página de produto para a categoria", () => {
    render(
      <TrilhaDoItem
        categoria={{ name: "Abrasivos para poliborda", slug: "abrasivos-para-poliborda" }}
        titulo="Green Turbo #50"
      />,
    );
    const trilha = screen.getByRole("navigation", { name: /trilha/i });
    expect(trilha).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Abrasivos para poliborda" }).getAttribute("href"),
    ).toBe("/abrasivos-para-poliborda");
    expect(screen.getByRole("link", { name: "Início" }).getAttribute("href")).toBe("/");
    expect(screen.getByText("Green Turbo #50").getAttribute("aria-current")).toBe("page");
  });

  it("sem categoria (ou com slug reservado), a trilha vai direto do início ao item", () => {
    const { rerender } = render(<TrilhaDoItem categoria={null} titulo="Kit GT" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    rerender(<TrilhaDoItem categoria={{ name: "Produto", slug: "produto" }} titulo="Kit GT" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
