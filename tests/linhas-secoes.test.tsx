import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SecaoDepoimentos } from "@/components/linhas/secao-depoimentos";
import { SecaoDor } from "@/components/linhas/secao-dor";
import { SecaoDuvidas } from "@/components/linhas/secao-duvidas";
import { SecaoFechamento } from "@/components/linhas/secao-fechamento";
import { SecaoNumeros } from "@/components/linhas/secao-numeros";
import { SecaoRazoes } from "@/components/linhas/secao-razoes";
import { SecaoTopo } from "@/components/linhas/secao-topo";
import { GREEN_TURBO } from "@/lib/linhas/green-turbo";

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe() {}
    disconnect() {}
  },
);
vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));

const PUBLICADA = { ...GREEN_TURBO, rascunho: false };
/** Fixo em rascunho: o teste não depende do estado atual do piloto. */
const RASCUNHO = { ...GREEN_TURBO, rascunho: true };

describe("seções da linha", () => {
  it("topo: título como h1 e CTA que abre o chat com o contexto da linha", () => {
    render(<SecaoTopo linha={PUBLICADA} />);
    expect(screen.getByRole("heading", { level: 1, name: /brilho de espelho/i })).toBeTruthy();
    const cta = screen.getByRole("button", { name: /pergunte ao especialista/i });
    expect(cta.getAttribute("data-abrir-chat")).toBe("");
    expect(cta.getAttribute("data-item")).toBe("Linha Green Turbo");
  });

  it("topo sem vídeo: rascunho mostra o marcador; publicada não mostra", () => {
    const { rerender } = render(<SecaoTopo linha={RASCUNHO} />);
    expect(screen.getByText(/aguardando material: vídeo do topo/i)).toBeTruthy();
    rerender(<SecaoTopo linha={PUBLICADA} />);
    expect(screen.queryByText(/aguardando material/i)).toBeNull();
  });

  it("dor e fechamento sempre têm texto; fechamento abre o chat", () => {
    render(
      <>
        <SecaoDor linha={PUBLICADA} />
        <SecaoFechamento linha={PUBLICADA} />
      </>,
    );
    expect(screen.getByRole("heading", { name: /voltar a peça para a bancada/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /falar com especialista/i }).getAttribute("data-item"),
    ).toBe("Linha Green Turbo");
  });

  it("razões: as quatro, com marcador de vídeo só no rascunho", () => {
    const { rerender } = render(<SecaoRazoes linha={RASCUNHO} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Brilho espelhado",
      "Velocidade na produção",
      "Economia de tempo e dinheiro",
      "Satisfação do cliente",
    ]);
    expect(screen.getAllByText(/aguardando material/i)).toHaveLength(4);
    rerender(<SecaoRazoes linha={PUBLICADA} />);
    expect(screen.queryByText(/aguardando material/i)).toBeNull();
  });

  it("depoimentos e números vazios: some em linha publicada, marcador no rascunho", () => {
    const { container } = render(
      <>
        <SecaoDepoimentos linha={PUBLICADA} />
        <SecaoNumeros linha={PUBLICADA} />
      </>,
    );
    expect(container.innerHTML).toBe("");
    render(
      <>
        <SecaoDepoimentos linha={RASCUNHO} />
        <SecaoNumeros linha={RASCUNHO} />
      </>,
    );
    expect(screen.getByText(/aguardando material: depoimentos/i)).toBeTruthy();
    expect(screen.getByText(/aguardando material: dados técnicos/i)).toBeTruthy();
  });

  it("números mostram a fonte junto do valor", () => {
    const linha = {
      ...PUBLICADA,
      numeros: [{ valor: "2x", rotulo: "mais rápido", fonte: "Teste interno M10, set/2026" }],
    };
    render(<SecaoNumeros linha={linha} />);
    expect(screen.getByText("2x")).toBeTruthy();
    expect(screen.getByText(/fonte: teste interno m10/i)).toBeTruthy();
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getByRole("listitem")).toBeTruthy();
  });

  it("dúvidas viram perguntas expansíveis, incluindo 'Trabalha com água?'", () => {
    render(<SecaoDuvidas linha={PUBLICADA} />);
    expect(screen.getByText("Trabalha com água?").closest("details")).not.toBeNull();
  });
});
