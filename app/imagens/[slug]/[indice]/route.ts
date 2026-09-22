import { buscarItem } from "@/lib/catalog/client";
import { origemPermitida, tipoDeImagemPermitido } from "@/lib/catalog/origem-de-imagem";
import { lerConfigServidor } from "@/lib/config";

export const runtime = "nodejs";
/**
 * A resposta fica no cache de rota do Next. Como a leitura do item usa o
 * `fetch` com a tag `catalog`, `revalidateTag("catalog")` também derruba esta
 * entrada — foto trocada no Bling aparece na revalidação seguinte.
 */
export const revalidate = 86400;

const INDICE_MAXIMO = 20;
const TEMPO_LIMITE_MS = 10_000;
/** Foto de produto passa longe disto; acima, é erro de cadastro ou abuso. */
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;
const CACHE = "public, max-age=86400, stale-while-revalidate=604800";
/**
 * `nosniff` impede o navegador de "adivinhar" outro tipo; a CSP garante que,
 * mesmo aberta direto na aba, a resposta não roda nada nem acessa a origem
 * do site.
 */
const CABECALHOS_DE_ISOLAMENTO = {
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; sandbox",
};

type Contexto = { params: Promise<{ slug: string; indice: string }> };

/** Texto fixo, nunca com a URL de origem (que é assinada e não pode vazar). */
function falha(status: number, texto: string): Response {
  return new Response(texto, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...CABECALHOS_DE_ISOLAMENTO },
  });
}

/** Lê o corpo com teto de bytes; `null` se passar do teto ou a leitura falhar. */
async function lerComTeto(resposta: Response): Promise<Uint8Array<ArrayBuffer> | null> {
  const declarado = Number(resposta.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > TAMANHO_MAXIMO_BYTES) {
    await resposta.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!resposta.body) return new Uint8Array(0);

  const leitor = resposta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > TAMANHO_MAXIMO_BYTES) {
        await leitor.cancel().catch(() => undefined);
        return null;
      }
      partes.push(value);
    }
  } catch {
    return null;
  }

  const corpo = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    corpo.set(parte, posicao);
    posicao += parte.byteLength;
  }
  return corpo;
}

export async function GET(_requisicao: Request, { params }: Contexto): Promise<Response> {
  const { slug, indice } = await params;

  const posicao = Number(indice);
  if (!Number.isInteger(posicao) || posicao < 0 || posicao > INDICE_MAXIMO) {
    return falha(400, "Índice inválido.");
  }

  const item = await buscarItem(slug.slice(0, 80)).catch(() => null);
  const bruta = item?.images[posicao];
  if (!bruta) return falha(404, "Imagem não encontrada.");

  const config = lerConfigServidor();
  const origem = origemPermitida(bruta, {
    crmUrl: config.crmUrl,
    hostsExtras: config.imagensHostsExtras,
  });
  if (!origem) return falha(404, "Imagem não encontrada.");

  let resposta: Response;
  try {
    // `no-store`: o que vale guardar é ESTA resposta (URL estável), não a
    // resposta da URL assinada, que muda a cada sincronização do Bling.
    // `redirect: "error"`: um redirecionamento levaria o proxy para fora da
    // lista de hosts permitidos.
    resposta = await fetch(origem, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch {
    return falha(502, "Imagem indisponível.");
  }

  const tipo = tipoDeImagemPermitido(resposta.headers.get("content-type"));
  if (!resposta.ok || !tipo) {
    await resposta.body?.cancel().catch(() => undefined);
    return falha(502, "Imagem indisponível.");
  }

  const corpo = await lerComTeto(resposta);
  if (!corpo) return falha(502, "Imagem indisponível.");

  return new Response(corpo, {
    status: 200,
    headers: { "content-type": tipo, "cache-control": CACHE, ...CABECALHOS_DE_ISOLAMENTO },
  });
}
