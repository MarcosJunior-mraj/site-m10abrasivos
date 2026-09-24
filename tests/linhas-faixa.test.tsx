import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FaixaDosGraos } from "@/components/linhas/faixa-dos-graos";
import { GREEN_TURBO } from "@/lib/linhas/green-turbo";

const FOTO = {
  caminho: "gt/espelhado.jpg",
  alt: "Borda de granito espelhada",
  largura: 1600,
  altura: 900,
};
const COM_FOTO = {
  ...GREEN_TURBO,
  rascunho: false,
  faixa: { ...GREEN_TURBO.faixa, fotoEspelhado: FOTO },
};

let aoCruzar: ((e: { intersectionRatio: number; isIntersecting: boolean }[]) => void) | null = null;
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: typeof aoCruzar) {
        aoCruzar = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
});
afterEach(() => vi.unstubAllGlobals());

const acesos = () => screen.getAllByTestId("grao").filter((g) => g.dataset.aceso === "true").length;

describe("FaixaDosGraos", () => {
  it("acende os grãos conforme a faixa entra na tela e revela a foto no fim", () => {
    render(<FaixaDosGraos faixa={COM_FOTO.faixa} rascunho={COM_FOTO.rascunho} />);
    expect(
      screen.getByRole("heading", { name: /saia do fosco e chegue ao espelhado/i }),
    ).toBeTruthy();
    expect(acesos()).toBe(0);
    act(() => aoCruzar?.([{ intersectionRatio: 0.5, isIntersecting: true }]));
    expect(acesos()).toBe(4);
    expect(screen.getByTestId("foto-espelhado").dataset.revelada).toBe("false");
    act(() => aoCruzar?.([{ intersectionRatio: 1, isIntersecting: true }]));
    expect(acesos()).toBe(7);
    expect(screen.getByTestId("foto-espelhado").dataset.revelada).toBe("true");
  });

  it("não apaga de volta ao rolar para cima", () => {
    render(<FaixaDosGraos faixa={COM_FOTO.faixa} rascunho={COM_FOTO.rascunho} />);
    act(() => aoCruzar?.([{ intersectionRatio: 1, isIntersecting: true }]));
    act(() => aoCruzar?.([{ intersectionRatio: 0.2, isIntersecting: true }]));
    expect(acesos()).toBe(7);
  });

  it("com menos animação, começa tudo aceso e revelado", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q }));
    render(<FaixaDosGraos faixa={COM_FOTO.faixa} rascunho={COM_FOTO.rascunho} />);
    expect(acesos()).toBe(7);
    expect(screen.getByTestId("foto-espelhado").dataset.revelada).toBe("true");
  });

  it("sem foto: marcador no rascunho; publicada fica só com a barra", () => {
    const { rerender } = render(<FaixaDosGraos faixa={GREEN_TURBO.faixa} rascunho={true} />);
    expect(screen.getByText(/aguardando material: foto do brilho espelhado/i)).toBeTruthy();
    rerender(<FaixaDosGraos faixa={GREEN_TURBO.faixa} rascunho={false} />);
    expect(screen.queryByTestId("foto-espelhado")).toBeNull();
    expect(screen.getAllByTestId("grao")).toHaveLength(7);
  });
});
