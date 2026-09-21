import { z } from "zod";

/** Espelha `PublicCatalogItem` do CRM (`lib/catalog/public-queries.ts`). Sem preço, por contrato. */
export const itemSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum(["product", "kit"]),
  title: z.string(),
  description: z.string().nullable(),
  images: z.array(z.string()),
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
