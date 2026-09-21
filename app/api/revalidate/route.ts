import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { TAG_CATALOGO } from "@/lib/catalog/client";
import { lerConfigServidor } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let corpo: { tag?: unknown };
  try {
    corpo = (await requisicao.json()) as { tag?: unknown };
  } catch {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }

  if (corpo.tag !== TAG_CATALOGO) {
    return Response.json({ error: "Tag desconhecida." }, { status: 400 });
  }

  revalidateTag(TAG_CATALOGO);
  return Response.json({ data: { ok: true } });
}
