import { afterEach, describe, expect, it } from "vitest";
import { registrarEvento } from "@/lib/medicao";

afterEach(() => {
  delete (window as { dataLayer?: unknown[] }).dataLayer;
});

describe("registrarEvento", () => {
  it("sem ferramenta de medição ligada, não faz nada e não quebra", () => {
    expect(() => registrarEvento("chat_aberto", { item: "Linha Green Turbo" })).not.toThrow();
    expect((window as { dataLayer?: unknown[] }).dataLayer).toBeUndefined();
  });

  it("com dataLayer presente (GTM ligado no futuro), empurra o evento", () => {
    (window as { dataLayer?: unknown[] }).dataLayer = [];
    registrarEvento("chat_aberto", { item: "Linha Green Turbo" });
    expect((window as { dataLayer?: unknown[] }).dataLayer).toEqual([
      { event: "chat_aberto", item: "Linha Green Turbo" },
    ]);
  });
});
