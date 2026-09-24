import { buscarItem } from "@/lib/catalog/client";
import {
  origemPermitida,
  type TipoDeImagem,
  tipoDeImagemGenerico,
  tipoDeImagemPermitido,
  tipoPelosBytes,
} from "@/lib/catalog/origem-de-imagem";
import { type ConfigServidor, lerConfigServidor } from "@/lib/config";

export const runtime = "nodejs";
/**
 * Rota dinâmica: NENHUMA resposta (nem erro) pode ficar no cache de rota do
 * Next. Com `revalidate` de segmento, o Next chegou a guardar uma resposta
 * 502 (link do Bling já vencido na hora da 1ª visita após o sync) e serviu
 * essa mesma falha para o visitante seguinte, mesmo com o link já renovado —
 * ver prod-fix-2-brief.md. Quem cacheia a foto de verdade é o `cache-control`
 * da resposta de sucesso (abaixo) e o otimizador do `next/image`/navegador.
 */
export const dynamic = "force-dynamic";

const INDICE_MAXIMO = 20;
const TEMPO_LIMITE_MS = 10_000;
/** Foto de produto passa longe disto; acima, é erro de cadastro ou abuso. */
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;
const CACHE = "public, max-age=86400, stale-while-revalidate=604800";
/** Link assinado do Bling vale só ~30 min; uma releitura sem cache tenta pegar o novo. */
const TENTATIVAS_MAXIMAS = 2;
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

/**
 * Texto fixo, nunca com a URL de origem (que é assinada e não pode vazar).
 * `cache-control: no-store`: nenhuma falha (400/404/502) pode ficar guardada
 * — nem no cache do Next, nem em proxy/navegador — senão um erro passageiro
 * (link vencido, upstream fora do ar) gruda para quem visitar depois.
 */
function falha(status: number, texto: string): Response {
  return new Response(texto, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      ...CABECALHOS_DE_ISOLAMENTO,
    },
  });
}

/**
 * Loga o motivo de uma recusa (404/502) com slug e índice — NUNCA a URL de
 * origem, que é assinada e não pode vazar em log.
 */
function registrarRecusa(motivo: string, slug: string, indice: number): void {
  console.warn(`imagem recusada: ${motivo}`, { slug, indice });
}

function sucesso(tipo: TipoDeImagem, corpo: Uint8Array<ArrayBuffer>): Response {
  return new Response(corpo, {
    status: 200,
    headers: { "content-type": tipo, "cache-control": CACHE, ...CABECALHOS_DE_ISOLAMENTO },
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

/**
 * Lê o item no CRM (com ou sem cache) e resolve a URL de origem da foto.
 * Devolve a URL já validada, ou a resposta 404 pronta (item sem essa foto,
 * ou host fora da lista permitida) quando não dá para seguir.
 */
async function resolverOrigemDaFoto(
  slugProcessado: string,
  slugOriginal: string,
  posicao: number,
  config: ConfigServidor,
  semCache: boolean,
): Promise<URL | Response> {
  const item = await buscarItem(slugProcessado, semCache ? { semCache: true } : {}).catch(
    () => null,
  );
  const bruta = item?.images[posicao];
  if (!bruta) {
    registrarRecusa(
      semCache
        ? "item ou foto não encontrada (releitura sem cache)"
        : "item ou foto não encontrada",
      slugOriginal,
      posicao,
    );
    return falha(404, "Imagem não encontrada.");
  }

  const origem = origemPermitida(bruta, {
    crmUrl: config.crmUrl,
    hostsExtras: config.imagensHostsExtras,
  });
  if (!origem) {
    registrarRecusa(
      semCache
        ? "origem não permitida (releitura sem cache)"
        : "origem não permitida (host fora da lista)",
      slugOriginal,
      posicao,
    );
    return falha(404, "Imagem não encontrada.");
  }
  return origem;
}

/**
 * Link assinado do Bling vencido: o S3 responde 403, ou (para o parâmetro de
 * expiração por query string) 400 com um XML de erro dizendo "Request has
 * expired". Consome o corpo da resposta (não sobra para o chamador ler de
 * novo) — só esses dois casos merecem uma releitura do item sem cache.
 */
async function linkExpirado(resposta: Response): Promise<boolean> {
  if (resposta.status === 403) {
    await resposta.body?.cancel().catch(() => undefined);
    return true;
  }
  if (resposta.status === 400) {
    const texto = await resposta.text().catch(() => "");
    return texto.includes("Request has expired");
  }
  return false;
}

/** Decide o tipo pelo content-type declarado (ou, se genérico, pelos bytes) e responde. */
async function responderComCorpo(
  resposta: Response,
  slug: string,
  posicao: number,
): Promise<Response> {
  const cabecalhoTipo = resposta.headers.get("content-type");
  const tipoDeclarado = tipoDeImagemPermitido(cabecalhoTipo);

  if (tipoDeclarado) {
    const corpo = await lerComTeto(resposta);
    if (!corpo) {
      registrarRecusa("estourou o teto", slug, posicao);
      return falha(502, "Imagem indisponível.");
    }
    return sucesso(tipoDeclarado, corpo);
  }

  if (tipoDeImagemGenerico(cabecalhoTipo)) {
    // O S3 do Bling não guarda content-type de arquivo sem extensão no
    // caminho: devolve genérico mesmo para uma foto real. Só nesse caso os
    // bytes decidem o tipo — nunca quando o upstream declarou algo fora da
    // lista (ex.: image/svg+xml, text/html), tratado abaixo.
    const corpo = await lerComTeto(resposta);
    if (!corpo) {
      registrarRecusa("estourou o teto", slug, posicao);
      return falha(502, "Imagem indisponível.");
    }
    const tipoPelaAssinatura = tipoPelosBytes(corpo);
    if (!tipoPelaAssinatura) {
      registrarRecusa(
        `tipo não identificado pelos bytes (content-type ${cabecalhoTipo ?? "ausente"})`,
        slug,
        posicao,
      );
      return falha(502, "Imagem indisponível.");
    }
    return sucesso(tipoPelaAssinatura, corpo);
  }

  await resposta.body?.cancel().catch(() => undefined);
  registrarRecusa(`tipo não permitido: ${cabecalhoTipo ?? "ausente"}`, slug, posicao);
  return falha(502, "Imagem indisponível.");
}

export async function GET(_requisicao: Request, { params }: Contexto): Promise<Response> {
  const { slug, indice } = await params;

  const posicao = Number(indice);
  if (!Number.isInteger(posicao) || posicao < 0 || posicao > INDICE_MAXIMO) {
    return falha(400, "Índice inválido.");
  }

  const slugProcessado = slug.slice(0, 80);
  const config = lerConfigServidor();

  const origemInicial = await resolverOrigemDaFoto(slugProcessado, slug, posicao, config, false);
  if (origemInicial instanceof Response) return origemInicial;
  let origem = origemInicial;

  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
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
      registrarRecusa("falha ao buscar a origem", slug, posicao);
      return falha(502, "Imagem indisponível.");
    }

    if (resposta.ok) {
      return await responderComCorpo(resposta, slug, posicao);
    }

    const expirado = await linkExpirado(resposta);
    if (!expirado) {
      registrarRecusa(`status ${resposta.status}`, slug, posicao);
      return falha(502, "Imagem indisponível.");
    }
    if (tentativa >= TENTATIVAS_MAXIMAS) {
      registrarRecusa("link expirado mesmo após reler o item sem cache", slug, posicao);
      return falha(502, "Imagem indisponível.");
    }

    registrarRecusa("link expirado, relendo item sem cache para tentar de novo", slug, posicao);
    const origemFresca = await resolverOrigemDaFoto(slugProcessado, slug, posicao, config, true);
    if (origemFresca instanceof Response) return origemFresca;
    origem = origemFresca;
  }

  // Inatingível (o laço sempre retorna dentro de si), só para o TypeScript.
  return falha(502, "Imagem indisponível.");
}
