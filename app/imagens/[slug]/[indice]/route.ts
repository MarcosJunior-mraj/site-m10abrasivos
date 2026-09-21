import { buscarItem } from "@/lib/catalog/client";

export const runtime = "nodejs";
/**
 * A resposta fica no cache de rota do Next. Como a leitura do item usa o
 * `fetch` com a tag `catalog`, `revalidateTag("catalog")` também derruba esta
 * entrada — foto trocada no Bling aparece na revalidação seguinte.
 */
export const revalidate = 86400;

const INDICE_MAXIMO = 20;
const TEMPO_LIMITE_MS = 10_000;
const CACHE = "public, max-age=86400, stale-while-revalidate=604800";

type Contexto = { params: Promise<{ slug: string; indice: string }> };

export async function GET(_requisicao: Request, { params }: Contexto): Promise<Response> {
  const { slug, indice } = await params;

  const posicao = Number(indice);
  if (!Number.isInteger(posicao) || posicao < 0 || posicao > INDICE_MAXIMO) {
    return new Response("Índice inválido.", { status: 400 });
  }

  const item = await buscarItem(slug.slice(0, 80)).catch(() => null);
  const origem = item?.images[posicao];
  if (!origem) return new Response("Imagem não encontrada.", { status: 404 });

  let resposta: Response;
  try {
    // `no-store`: o que vale guardar é ESTA resposta (URL estável), não a
    // resposta da URL assinada, que muda a cada sincronização do Bling.
    resposta = await fetch(origem, {
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch {
    return new Response("Imagem indisponível.", { status: 502 });
  }

  const tipo = resposta.headers.get("content-type") ?? "";
  if (!resposta.ok || !tipo.startsWith("image/")) {
    return new Response("Imagem indisponível.", { status: 502 });
  }

  let corpo: ArrayBuffer;
  try {
    corpo = await resposta.arrayBuffer();
  } catch {
    return new Response("Imagem indisponível.", { status: 502 });
  }

  return new Response(corpo, {
    status: 200,
    headers: { "content-type": tipo, "cache-control": CACHE },
  });
}
