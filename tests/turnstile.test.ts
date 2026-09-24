import { afterEach, describe, expect, it, vi } from "vitest";
import { resolverTurnstile } from "@/components/chat/turnstile";

type Opcoes = Record<string, unknown>;

function instalarTurnstile(render: (elemento: HTMLElement, opcoes: Opcoes) => void): void {
  vi.stubGlobal("turnstile", { render });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  for (const script of document.head.querySelectorAll("script")) script.remove();
});

describe("resolverTurnstile", () => {
  it("sem chave não carrega nada e devolve null", async () => {
    await expect(resolverTurnstile("")).resolves.toBeNull();
    expect(document.head.querySelector("script")).toBeNull();
  });

  it('não passa `size: "invisible"` (não é valor válido de render)', async () => {
    let recebidas: Opcoes = {};
    instalarTurnstile((_elemento, opcoes) => {
      recebidas = opcoes;
      const callback = opcoes.callback;
      if (typeof callback === "function") callback("token-ok");
    });

    await expect(resolverTurnstile("chave")).resolves.toBe("token-ok");
    expect(recebidas.sitekey).toBe("chave");
    expect("size" in recebidas).toBe(false);
  });

  it("render que lança vira null (segue sem token), sem rejeitar", async () => {
    instalarTurnstile(() => {
      throw new Error("TurnstileError: Invalid input for parameter");
    });
    await expect(resolverTurnstile("chave")).resolves.toBeNull();
  });

  it("script que nunca carrega não trava: desiste no tempo limite", async () => {
    vi.useFakeTimers();
    const promessa = resolverTurnstile("chave");
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(promessa).resolves.toBeNull();
  });
});
