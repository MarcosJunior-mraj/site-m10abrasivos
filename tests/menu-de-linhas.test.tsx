import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const caminhoAtual = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => caminhoAtual,
}));

import { MenuDeLinhas } from "@/components/layout/menu-de-linhas";

const LINHAS = [{ slug: "green-turbo", nome: "Green Turbo" }];
const CATEGORIAS = [{ nome: "Discos de corte", slug: "discos-de-corte" }];

function renderizarMenu() {
  return render(
    <ul>
      <MenuDeLinhas linhas={LINHAS} categorias={CATEGORIAS} />
    </ul>,
  );
}

describe("MenuDeLinhas", () => {
  it("mostra os links certos (linha publicada e categoria sem linha)", () => {
    renderizarMenu();
    expect(screen.getByRole("link", { name: "Green Turbo" }).getAttribute("href")).toBe(
      "/linhas/green-turbo",
    );
    expect(screen.getByRole("link", { name: "Discos de corte" }).getAttribute("href")).toBe(
      "/discos-de-corte",
    );
  });

  it("abre ao clicar no summary", () => {
    renderizarMenu();
    const resumo = screen.getByText("Linhas");
    const detalhes = resumo.closest("details") as HTMLDetailsElement;
    expect(detalhes.open).toBe(false);
    fireEvent.click(resumo);
    expect(detalhes.open).toBe(true);
  });

  it("fecha com Esc e devolve o foco ao summary", () => {
    renderizarMenu();
    const resumo = screen.getByText("Linhas").closest("summary") as HTMLElement;
    const detalhes = resumo.closest("details") as HTMLDetailsElement;
    fireEvent.click(resumo);
    expect(detalhes.open).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(detalhes.open).toBe(false);
    expect(document.activeElement).toBe(resumo);
  });

  it("fecha ao clicar (pointerdown) fora do menu", () => {
    renderizarMenu();
    const resumo = screen.getByText("Linhas");
    const detalhes = resumo.closest("details") as HTMLDetailsElement;
    fireEvent.click(resumo);
    expect(detalhes.open).toBe(true);
    fireEvent.pointerDown(document.body);
    expect(detalhes.open).toBe(false);
  });

  it("clicar dentro do menu (num link, por exemplo) não fecha por causa do pointerdown fora", () => {
    renderizarMenu();
    const resumo = screen.getByText("Linhas");
    const detalhes = resumo.closest("details") as HTMLDetailsElement;
    fireEvent.click(resumo);
    const link = screen.getByRole("link", { name: "Green Turbo" });
    fireEvent.pointerDown(link);
    expect(detalhes.open).toBe(true);
  });
});
