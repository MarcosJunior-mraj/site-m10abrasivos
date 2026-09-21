import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
  lerConfigServidor: () => ({
    crmUrl: "https://crm.exemplo",
    catalogKey: "m10cat_abc",
    revalidateSecret: "segredo-de-pelo-menos-16",
    siteUrl: "https://m10abrasivos.com.br",
    empresa: {
      razaoSocial: "M10 Abrasivos Ltda",
      cnpj: "00.000.000/0001-00",
      emailEncarregado: "p@m10.com",
    },
  }),
  CONFIG_PUBLICA: {
    crmUrl: "",
    webchatKey: "",
    turnstileSiteKey: "",
    whatsappFallback: "5511999999999",
  },
}));

import { render } from "@testing-library/react";
import Privacidade from "@/app/privacidade/page";

describe("Privacidade", () => {
  it("contém a frase em destaque de que a conversa é registrada", async () => {
    const { container } = render(await Privacidade());
    const strongElement = container.querySelector("strong");
    expect(strongElement).toBeTruthy();
    expect(strongElement?.textContent).toContain("A conversa do chat é registrada");
    expect(strongElement?.textContent).toContain("pode ser lida pela nossa equipe de vendas");
  });

  it("mostra razão social, CNPJ e e-mail do encarregado", async () => {
    const { container } = render(await Privacidade());
    const texto = container.textContent;
    expect(texto).toContain("M10 Abrasivos Ltda");
    expect(texto).toContain("00.000.000/0001-00");
    expect(texto).toContain("p@m10.com");
  });

  it("tem um h1 único", async () => {
    const { container } = render(await Privacidade());
    const h1Elements = container.querySelectorAll("h1");
    expect(h1Elements).toHaveLength(1);
    expect(h1Elements[0]?.textContent).toBe("Política de privacidade");
  });
});
