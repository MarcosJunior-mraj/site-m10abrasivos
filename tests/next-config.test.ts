import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import { conferirVariaveisDeBuild } from "@/lib/conferir-build";
import configuracao from "@/next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("conferirVariaveisDeBuild (M2)", () => {
  it("recusa NEXT_PUBLIC_WHATSAPP_FALLBACK vazio ou sem dígitos — é a saída de emergência do chat", () => {
    expect(() => conferirVariaveisDeBuild({})).toThrow(/NEXT_PUBLIC_WHATSAPP_FALLBACK/);
    expect(() => conferirVariaveisDeBuild({ NEXT_PUBLIC_WHATSAPP_FALLBACK: "" })).toThrow(
      /NEXT_PUBLIC_WHATSAPP_FALLBACK/,
    );
    expect(() =>
      conferirVariaveisDeBuild({ NEXT_PUBLIC_WHATSAPP_FALLBACK: "(sem número)" }),
    ).toThrow(/NEXT_PUBLIC_WHATSAPP_FALLBACK/);
  });

  it("aceita número com ou sem máscara", () => {
    expect(() =>
      conferirVariaveisDeBuild({ NEXT_PUBLIC_WHATSAPP_FALLBACK: "+55 (11) 99999-9999" }),
    ).not.toThrow();
  });
});

describe("next.config", () => {
  it("o build de produção falha sem o número do WhatsApp", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_FALLBACK", "");
    await expect(async () => configuracao(PHASE_PRODUCTION_BUILD)).rejects.toThrow(
      /NEXT_PUBLIC_WHATSAPP_FALLBACK/,
    );
  });

  it("o servidor de desenvolvimento não exige o número", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_FALLBACK", "");
    await expect(configuracao(PHASE_DEVELOPMENT_SERVER)).resolves.toBeDefined();
  });

  it("manda nosniff, referrer-policy e frame-ancestors em toda rota (M3)", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_FALLBACK", "5511999999999");
    const config = await configuracao(PHASE_PRODUCTION_BUILD);
    const regras = (await config.headers?.()) ?? [];

    // "/:path*" casa tudo; as outras fontes desta config são regex de JS válidas.
    function cabecalhosDe(caminho: string): Record<string, string> {
      const aplicadas = regras.filter((regra) =>
        regra.source === "/:path*" ? true : new RegExp(`^${regra.source}$`).test(caminho),
      );
      return Object.fromEntries(
        aplicadas.flatMap((regra) =>
          regra.headers.map((cabecalho) => [cabecalho.key.toLowerCase(), cabecalho.value]),
        ),
      );
    }

    for (const caminho of ["/", "/produto/gt-50", "/abrasivos-para-poliborda"]) {
      const cabecalhos = cabecalhosDe(caminho);
      expect(cabecalhos["x-content-type-options"], caminho).toBe("nosniff");
      expect(cabecalhos["referrer-policy"], caminho).toBe("strict-origin-when-cross-origin");
      expect(cabecalhos["content-security-policy"], caminho).toBe("frame-ancestors 'none'");
    }

    // A rota de imagem manda a própria CSP (com sandbox); a da config a sobrescreveria.
    const daImagem = cabecalhosDe("/imagens/gt-50/0");
    expect(daImagem["x-content-type-options"]).toBe("nosniff");
    expect(daImagem["content-security-policy"]).toBeUndefined();
  });
});
