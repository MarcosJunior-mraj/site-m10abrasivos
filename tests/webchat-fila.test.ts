import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilaDeExibicao, pausaParaTexto } from "@/lib/webchat/fila";

describe("pausaParaTexto", () => {
  it("cresce com o tamanho do texto, com piso e teto", () => {
    expect(pausaParaTexto("Oi")).toBe(425);
    expect(pausaParaTexto("x".repeat(40))).toBe(900);
    expect(pausaParaTexto("x".repeat(1000))).toBe(2500);
  });
});

describe("FilaDeExibicao", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("mostra a primeira na hora e espaça as seguintes", () => {
    const mostradas: string[] = [];
    const fila = new FilaDeExibicao((texto: string) => mostradas.push(texto));

    fila.enfileirar("Oi");
    fila.enfileirar("Tudo bem?");
    expect(mostradas).toEqual(["Oi"]);

    vi.advanceTimersByTime(pausaParaTexto("Tudo bem?"));
    expect(mostradas).toEqual(["Oi", "Tudo bem?"]);
  });

  it("esvazia na hora quando pedem (prefers-reduced-motion)", () => {
    const mostradas: string[] = [];
    const fila = new FilaDeExibicao((texto: string) => mostradas.push(texto));
    fila.enfileirar("a");
    fila.enfileirar("b");
    fila.esvaziarAgora();
    expect(mostradas).toEqual(["a", "b"]);
  });
});
