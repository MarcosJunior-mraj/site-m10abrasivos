import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Rodape } from "@/components/layout/rodape";
import { Cota } from "@/components/marca/cota";

describe("tokens da identidade", () => {
  const css = readFileSync("app/globals.css", "utf8");

  it("usa exatamente as cores do Guia da Marca", () => {
    expect(css).toContain("--cor-azul: #20233A");
    expect(css).toContain("--cor-laranja: #F97709");
    expect(css).toContain("--cor-superficie: #2A2E4A");
    expect(css).toContain("--cor-borda: #3A3F60");
    expect(css).toContain("--cor-texto: #F2F3F7");
    expect(css).toContain("--cor-texto-secundario: #B9BCD0");
    expect(css).toContain("--cor-laranja-escuro: #C85A00");
  });

  it("não carrega a fonte do logo (Panton só existe na imagem)", () => {
    expect(css.toLowerCase()).not.toContain("panton");
  });
});

describe("Cota", () => {
  it("mostra a medida em fonte mono com o rótulo acessível", () => {
    render(<Cota valor="125 mm" rotulo="Diâmetro" />);
    expect(screen.getByText("125 mm")).toBeDefined();
    expect(screen.getByText("Diâmetro")).toBeDefined();
  });
});

describe("Rodape", () => {
  it("leva à política de privacidade e ao WhatsApp, sem citar preço", () => {
    const { container } = render(<Rodape />);
    const privacidade = screen.getByRole("link", { name: /privacidade/i });
    expect(privacidade.getAttribute("href")).toBe("/privacidade");
    expect(screen.getByRole("link", { name: /whatsapp/i }).getAttribute("href")).toContain("wa.me");
    expect(container.textContent).not.toMatch(/R\$/);
  });
});
