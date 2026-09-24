import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { TAG_CATALOGO } from "@/lib/catalog/client";
import { lerConfigServidor } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contrato com `notifySiteCatalogChanged` do CRM: `{ "tag": "catalog" }`. */
const esquemaDoCorpo = z.object({ tag: z.string() });

/** Comparação de tempo constante; tamanhos diferentes já não batem. */
function confere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(requisicao: Request): Promise<Response> {
  const config = lerConfigServidor();
  const autorizacao = requisicao.headers.get("authorization") ?? "";
  if (!confere(autorizacao, `Bearer ${config.revalidateSecret}`)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  let bruto: unknown;
  try {
    bruto = await requisicao.json();
  } catch {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const corpo = esquemaDoCorpo.safeParse(bruto);
  if (!corpo.success) {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }
  if (corpo.data.tag !== TAG_CATALOGO) {
    return Response.json({ error: "Tag desconhecida." }, { status: 400 });
  }

  // Expiração imediata: o primeiro visitante depois de um sync (ou de uma
  // despublicação) já recebe dado novo. O profile "max" (stale-while-
  // revalidate) entregava a versão velha antes de regenerar — ver
  // .superpowers/sdd/2026-09-21-etapa-4a-site-vitrine-widget/prod-fix-2-brief.md.
  revalidateTag(TAG_CATALOGO, { expire: 0 });
  return Response.json({ data: { ok: true } });
}
