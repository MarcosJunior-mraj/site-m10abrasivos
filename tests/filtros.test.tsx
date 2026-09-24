import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/abrasivos-para-poliborda",
}));

import { GradeDeItens } from "@/components/catalogo/grade-de-itens";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

/** Muda a URL sem navegar de verdade — o mesmo que voltar/avançar do navegador faz. */
function irParaUrl(caminhoComQuery: string) {
  window.history.pushState({}, "", caminhoComQuery);
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

function item(parcial: Partial<ItemCatalogo>): ItemCatalogo {
  return {
    slug: "gt-50",
    kind: "product",
    title: "Green Turbo #50",
    description: null,
    images: [],
    category: { name: "Poliborda", slug: "abrasivos-para-poliborda" },
    stones: ["granito"],
    applications: ["desbaste"],
    grit: "50",
    diameterMm: 125,
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

const ITENS = [
  item({}),
  item({
    slug: "gt-400",
    title: "Green Turbo #400",
    grit: "400",
    stones: ["marmore"],
    applications: ["polimento"],
  }),
];

describe("GradeDeItens", () => {
  beforeEach(() => {
    replace.mockReset();
    // Volta a URL para o estado "sem filtro" antes de cada teste — o jsdom
    // mantém `window.location` entre os testes do arquivo.
    window.history.pushState({}, "", "/abrasivos-para-poliborda");
  });

  afterEach(() => {
    window.history.pushState({}, "", "/abrasivos-para-poliborda");
  });

  it("mostra todos os itens e a contagem", () => {
    render(<GradeDeItens itens={ITENS} />);
    expect(screen.getByText(/2 itens/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /Green Turbo #50/ })).toBeDefined();
    expect(screen.getByRole("link", { name: /Green Turbo #400/ })).toBeDefined();
  });

  it("filtra ao escolher uma pedra e grava a escolha na URL", async () => {
    const usuario = userEvent.setup();
    render(<GradeDeItens itens={ITENS} />);

    await usuario.click(screen.getByRole("button", { name: /Mármore/i }));

    expect(screen.queryByRole("link", { name: /Green Turbo #50/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Green Turbo #400/ })).toBeDefined();
    expect(replace).toHaveBeenCalledWith("/abrasivos-para-poliborda?pedra=marmore", {
      scroll: false,
    });
  });

  it("avisa quando a combinação não deixa nada e oferece limpar", async () => {
    const usuario = userEvent.setup();
    render(<GradeDeItens itens={ITENS} />);

    await usuario.click(screen.getByRole("button", { name: /Mármore/i }));
    await usuario.click(screen.getByRole("button", { name: /#50/ }));

    expect(screen.getByText(/nenhum item com essa combinação/i)).toBeDefined();
    await usuario.click(screen.getByRole("button", { name: /limpar filtros/i }));
    expect(screen.getByRole("link", { name: /Green Turbo #50/ })).toBeDefined();
  });

  it("só oferece filtros que existem nos itens", () => {
    render(<GradeDeItens itens={[item({ stones: ["granito"], applications: ["desbaste"] })]} />);
    expect(screen.queryByRole("button", { name: /Mármore/i })).toBeNull();
  });

  it("abre com tudo (sem filtro) na primeira pintura e filtra assim que monta, lendo a URL", async () => {
    irParaUrl("/abrasivos-para-poliborda?pedra=marmore");
    render(<GradeDeItens itens={ITENS} />);

    // A grade some o item sem a pedra assim que o efeito de montagem lê
    // `window.location.search` — é o comportamento que faz o servidor poder
    // mandar TODOS os itens no HTML (sem bail-out de `useSearchParams`) e o
    // cliente ainda assim abrir já filtrado.
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /Green Turbo #50/ })).toBeNull();
    });
    expect(screen.getByRole("link", { name: /Green Turbo #400/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Mármore/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("ressincroniza a seleção quando a URL muda por fora do componente (voltar/avançar)", async () => {
    render(<GradeDeItens itens={ITENS} />);

    expect(screen.getByRole("link", { name: /Green Turbo #50/ })).toBeDefined();

    irParaUrl("/abrasivos-para-poliborda?pedra=marmore");

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /Green Turbo #50/ })).toBeNull();
    });
    expect(screen.getByRole("link", { name: /Green Turbo #400/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Mármore/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("anuncia o resultado numa região viva (status)", () => {
    render(<GradeDeItens itens={ITENS} />);
    const regiao = screen.getByRole("status");
    expect(regiao.textContent).toMatch(/2 itens/i);
  });
});
