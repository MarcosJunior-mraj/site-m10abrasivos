import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BalaoProativo } from "@/components/linhas/balao-proativo";
import { GREEN_TURBO } from "@/lib/linhas/green-turbo";
import { EVENTO_CHAT_ABERTO } from "@/lib/webchat/eventos";

let aoCruzar: ((e: { isIntersecting: boolean }[]) => void) | null = null;
beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
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
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("BalaoProativo", () => {
  it("aparece depois da espera, como gatilho do chat com a abertura", () => {
    render(<BalaoProativo linha={GREEN_TURBO} esperaMs={8000} />);
    expect(screen.queryByText(GREEN_TURBO.ia.balao)).toBeNull();
    act(() => vi.advanceTimersByTime(8000));
    const balao = screen.getByRole("button", { name: GREEN_TURBO.ia.balao });
    expect(balao.getAttribute("data-abrir-chat")).toBe("");
    expect(balao.getAttribute("data-item")).toBe("Linha Green Turbo");
    expect(balao.getAttribute("data-abertura")).toBe(GREEN_TURBO.ia.balao);
  });

  it("aparece antes se a faixa dos grãos entrar na tela", () => {
    document.body.innerHTML = '<section id="faixa-dos-graos"></section>';
    render(<BalaoProativo linha={GREEN_TURBO} esperaMs={8000} />);
    act(() => aoCruzar?.([{ isIntersecting: true }]));
    expect(screen.getByRole("button", { name: GREEN_TURBO.ia.balao })).toBeTruthy();
  });

  it("uma vez por visita: fechado não volta, nem remontando", async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<BalaoProativo linha={GREEN_TURBO} esperaMs={10} />);
    act(() => vi.advanceTimersByTime(10));
    await usuario.click(screen.getByRole("button", { name: /fechar/i }));
    expect(screen.queryByText(GREEN_TURBO.ia.balao)).toBeNull();
    unmount();
    render(<BalaoProativo linha={GREEN_TURBO} esperaMs={10} />);
    act(() => vi.advanceTimersByTime(50));
    expect(screen.queryByText(GREEN_TURBO.ia.balao)).toBeNull();
  });

  it("não aparece se o chat já foi aberto", () => {
    const { unmount } = render(<BalaoProativo linha={GREEN_TURBO} esperaMs={8000} />);
    expect(screen.queryByText(GREEN_TURBO.ia.balao)).toBeNull();
    act(() => window.dispatchEvent(new Event(EVENTO_CHAT_ABERTO)));
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.queryByText(GREEN_TURBO.ia.balao)).toBeNull();
    // Remontando: sessionStorage foi marcado, não volta
    unmount();
    render(<BalaoProativo linha={GREEN_TURBO} esperaMs={10} />);
    act(() => vi.advanceTimersByTime(50));
    expect(screen.queryByText(GREEN_TURBO.ia.balao)).toBeNull();
  });

  it("some quando o chat abre", () => {
    render(<BalaoProativo linha={GREEN_TURBO} esperaMs={10} />);
    act(() => vi.advanceTimersByTime(10));
    expect(screen.getByRole("button", { name: GREEN_TURBO.ia.balao })).toBeTruthy();
    act(() => window.dispatchEvent(new Event(EVENTO_CHAT_ABERTO)));
    expect(screen.queryByText(GREEN_TURBO.ia.balao)).toBeNull();
  });
});
