import { z } from "zod";

function urlDeFotoValida(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Fotos: só URL `http(s)` bem formada fica na lista; o resto é descartado sem
 * derrubar o item inteiro (uma foto quebrada no Bling não pode tirar o
 * produto do ar). Quem decide de qual host a rota de imagem pode buscar é
 * `lib/catalog/origem-de-imagem.ts` — lá o `https:` é obrigatório, com
 * exceção só da origem do próprio CRM. O filtro roda aqui, antes de
 * qualquer uso, para a página e a rota verem os mesmos índices.
 */
const listaDeFotos = z
  .array(z.string())
  .transform((fotos) => fotos.filter((foto) => urlDeFotoValida(foto)));

/** Espelha `PublicCatalogItem` do CRM (`lib/catalog/public-queries.ts`). Sem preço, por contrato. */
export const itemSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(["product", "kit"]),
  title: z.string(),
  description: z.string().nullable(),
  images: listaDeFotos,
  category: z.object({ name: z.string(), slug: z.string() }).nullable(),
  stones: z.array(z.string()),
  applications: z.array(z.string()),
  grit: z.string().nullable(),
  diameterMm: z.number().nullable(),
  machines: z.array(z.string()),
  specs: z.record(z.string(), z.unknown()),
  isFeatured: z.boolean(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  updatedAt: z.string(),
  components: z.array(
    z.object({ title: z.string(), slug: z.string().nullable(), quantity: z.number() }),
  ),
});

export type ItemCatalogo = z.infer<typeof itemSchema>;

export const categoriaSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

export type CategoriaCatalogo = z.infer<typeof categoriaSchema>;

export const respostaDeItens = z.object({ data: z.array(itemSchema) });
export const respostaDeItem = z.object({ data: itemSchema });
export const respostaDeCategorias = z.object({ data: z.array(categoriaSchema) });
