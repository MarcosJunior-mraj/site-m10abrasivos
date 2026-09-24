import { describe, expect, it } from "vitest";
import { textoFalaDePreco } from "@/lib/catalog/sem-preco";
import {
  buscarLinha,
  linhaDoProduto,
  linhasPublicadas,
  podeMostrar,
  TODAS_AS_LINHAS,
} from "@/lib/linhas";
import { esquemaLinha } from "@/lib/linhas/esquema";
import { GREEN_TURBO } from "@/lib/linhas/green-turbo";
import { urlDaMidia } from "@/lib/midia";

/** Todas as strings de um objeto, em profundidade. */
function textos(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(textos);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textos);
  return [];
}

describe("conteúdo das linhas", () => {
  it("toda linha passa no schema e os slugs não se repetem", () => {
    for (const linha of TODAS_AS_LINHAS) expect(() => esquemaLinha.parse(linha)).not.toThrow();
    const slugs = TODAS_AS_LINHAS.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("nenhum texto de linha fala de preço", () => {
    for (const linha of TODAS_AS_LINHAS) {
      for (const texto of textos(linha)) expect(textoFalaDePreco(texto), texto).toBe(false);
    }
  });

  it("número sem fonte é recusado", () => {
    const quebrada = {
      ...GREEN_TURBO,
      numeros: [{ valor: "30%", rotulo: "mais rápido", fonte: "" }],
    };
    expect(esquemaLinha.safeParse(quebrada).success).toBe(false);
  });

  it("depoimento sem autorização é recusado", () => {
    const quebrada = {
      ...GREEN_TURBO,
      depoimentos: [
        {
          video: { arquivo: "gt/dep.mp4", capa: "gt/dep.jpg" },
          nome: "João",
          cidade: "Cachoeiro",
          marmoraria: "Pedras X",
          autorizado: false,
        },
      ],
    };
    expect(esquemaLinha.safeParse(quebrada).success).toBe(false);
  });

  it("piloto: Green Turbo, rascunho, com os 7 grãos e o kit do catálogo", () => {
    expect(GREEN_TURBO.slug).toBe("green-turbo");
    expect(GREEN_TURBO.rascunho).toBe(true);
    expect(GREEN_TURBO.ia.contexto).toBe("Linha Green Turbo");
    expect(GREEN_TURBO.faixa.graos).toEqual([
      "#50",
      "#100",
      "#200",
      "#400",
      "#800",
      "#1500",
      "#3000",
    ]);
    expect(GREEN_TURBO.oferta.kitSlug).toBe("kit-gt-para-poliborda");
    expect(GREEN_TURBO.oferta.avulsosSlugs).toHaveLength(7);
    expect(GREEN_TURBO.razoes.itens.map((r) => r.titulo)).toEqual([
      "Brilho espelhado",
      "Velocidade na produção",
      "Economia de tempo e dinheiro",
      "Satisfação do cliente",
    ]);
  });
});

describe("registro de linhas", () => {
  it("rascunho só aparece com MOSTRAR_RASCUNHOS=1", () => {
    expect(podeMostrar(GREEN_TURBO, {})).toBe(false);
    expect(podeMostrar(GREEN_TURBO, { MOSTRAR_RASCUNHOS: "1" })).toBe(true);
    expect(podeMostrar({ ...GREEN_TURBO, rascunho: false }, {})).toBe(true);
  });

  it("busca por slug e não lista rascunho como publicada", () => {
    expect(buscarLinha("green-turbo")?.nome).toBe("Green Turbo");
    expect(buscarLinha("nao-existe")).toBeNull();
    expect(linhasPublicadas().some((l) => l.slug === "green-turbo")).toBe(false);
    // Enquanto o piloto é rascunho, nenhum produto aponta para a página de vendas.
    expect(linhaDoProduto("abrasivo-m10-green-turbo-50")).toBeNull();
  });

  it("urlDaMidia junta a base pública do bucket sem barra dupla", () => {
    expect(
      urlDaMidia(
        "green-turbo/topo.mp4",
        "https://x.supabase.co/storage/v1/object/public/site-midia/",
      ),
    ).toBe("https://x.supabase.co/storage/v1/object/public/site-midia/green-turbo/topo.mp4");
  });
});
