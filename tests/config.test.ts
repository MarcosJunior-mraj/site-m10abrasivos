import { describe, expect, it } from "vitest";
import { lerConfigServidor } from "@/lib/config";

const COMPLETO = {
  CRM_URL: "https://crm.m10abrasivos.com.br/",
  CATALOG_KEY: "m10cat_abc",
  SITE_REVALIDATE_SECRET: "segredo-de-pelo-menos-16",
  SITE_URL: "https://m10abrasivos.com.br",
  EMPRESA_RAZAO_SOCIAL: "M10 Abrasivos Ltda",
  EMPRESA_CNPJ: "00.000.000/0001-00",
  EMPRESA_EMAIL_ENCARREGADO: "privacidade@m10abrasivos.com.br",
};

describe("lerConfigServidor", () => {
  it("lê a configuração completa e tira a barra final das URLs", () => {
    const config = lerConfigServidor(COMPLETO);
    expect(config.crmUrl).toBe("https://crm.m10abrasivos.com.br");
    expect(config.catalogKey).toBe("m10cat_abc");
    expect(config.empresa.razaoSocial).toBe("M10 Abrasivos Ltda");
  });

  it("diz qual variável falta", () => {
    const { CATALOG_KEY: _, ...semChave } = COMPLETO;
    expect(() => lerConfigServidor(semChave)).toThrow(/CATALOG_KEY/);
  });

  it("recusa URL inválida", () => {
    expect(() => lerConfigServidor({ ...COMPLETO, CRM_URL: "crm.m10abrasivos" })).toThrow(
      /CRM_URL/,
    );
  });

  it("recusa segredo curto demais", () => {
    expect(() => lerConfigServidor({ ...COMPLETO, SITE_REVALIDATE_SECRET: "curto" })).toThrow(
      /SITE_REVALIDATE_SECRET/,
    );
  });

  it("hosts extras de imagem são opcionais e viram lista limpa", () => {
    expect(lerConfigServidor(COMPLETO).imagensHostsExtras).toEqual([]);
    expect(
      lerConfigServidor({
        ...COMPLETO,
        IMAGENS_HOSTS_EXTRAS: " Fotos.M10.com.br , ,cdn.m10.com.br",
      }).imagensHostsExtras,
    ).toEqual(["fotos.m10.com.br", "cdn.m10.com.br"]);
  });
});
