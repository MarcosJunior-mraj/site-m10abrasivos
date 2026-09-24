import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const registro = vi.hoisted(() => ({ linhas: [] as import("@/lib/linhas").Linha[] }));
vi.mock("@/lib/linhas", async (importOriginal) => {
  const { registroCom } = await import("./duplos/registro-de-linhas");
  return registroCom(await importOriginal(), () => registro.linhas);
});

vi.mock("@/lib/catalog/client", () => ({
  buscarItens: vi.fn().mockResolvedValue([]),
  buscarCategorias: vi.fn().mockResolvedValue([]),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));
vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));

import { AvisoDaLinha } from "@/components/catalogo/aviso-da-linha";
import { Cabecalho } from "@/components/layout/cabecalho";
import { DestaqueDaLinha } from "@/components/secoes/destaque-da-linha";
import { GREEN_TURBO } from "@/lib/linhas/green-turbo";

const PUBLICADA = { ...GREEN_TURBO, rascunho: false };
const RASCUNHO = { ...GREEN_TURBO, rascunho: true };

beforeEach(() => {
  registro.linhas = [RASCUNHO];
});

describe("navegação por linhas", () => {
  it("cabeçalho tem Catálogo e o botão do especialista", () => {
    render(<Cabecalho categorias={[{ nome: "Fresas", slug: "fresas" }]} />);
    expect(screen.getByRole("link", { name: "Catálogo" }).getAttribute("href")).toBe("/catalogo");
    expect(
      screen
        .getByRole("button", { name: /falar com especialista/i })
        .hasAttribute("data-abrir-chat"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: "Fresas" }).getAttribute("href")).toBe("/fresas");
  });

  it("enquanto o Green Turbo é rascunho, o menu não mostra a página de vendas", () => {
    registro.linhas = [RASCUNHO];
    render(<Cabecalho categorias={[]} />);
    expect(screen.queryByRole("link", { name: /green turbo/i })).toBeNull();
  });

  it("publicada, o menu leva à página de vendas da linha", () => {
    registro.linhas = [PUBLICADA];
    render(<Cabecalho categorias={[]} />);
    expect(screen.getByRole("link", { name: /green turbo/i }).getAttribute("href")).toBe(
      "/linhas/green-turbo",
    );
  });

  it("destaque da home leva à página da linha", () => {
    render(<DestaqueDaLinha linha={PUBLICADA} />);
    expect(screen.getByRole("link", { name: /conheça a linha/i }).getAttribute("href")).toBe(
      "/linhas/green-turbo",
    );
  });

  it("aviso na página técnica leva à linha", () => {
    render(<AvisoDaLinha linha={PUBLICADA} />);
    expect(
      screen.getByRole("link", { name: /conheça a linha green turbo/i }).getAttribute("href"),
    ).toBe("/linhas/green-turbo");
  });
});
