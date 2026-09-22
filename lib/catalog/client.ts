import "server-only";
import { lerConfigServidor } from "@/lib/config";
import {
  type CategoriaCatalogo,
  type ItemCatalogo,
  respostaDeCategorias,
  respostaDeItem,
  respostaDeItens,
} from "./schemas";

/** Tag de cache usada em todo o catálogo; o CRM a revalida por `/api/revalidate`. */
export const TAG_CATALOGO = "catalog";

const TEMPO_LIMITE_MS = 10_000;
const REVALIDACAO_DE_SEGURANCA_S = 3600;

export class ErroDoCatalogo extends Error {
  constructor(
    readonly caminho: string,
    readonly status: number | null,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDoCatalogo";
  }
}

export type DepsDoCatalogo = {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  /**
   * Ignora o Data Cache do Next (`cache: "no-store"` em vez de
   * `next: { tags, revalidate }`). Usada pela rota de imagem para reler o
   * item quando o link assinado do Bling já venceu — sem isso, o CRM podia
   * devolver de novo a mesma resposta cacheada com a URL velha.
   */
  semCache?: boolean;
};

/** Devolve o corpo em JSON, ou `null` quando o CRM responde 404. */
async function buscarJson(caminho: string, deps: DepsDoCatalogo): Promise<unknown | null> {
  const config = lerConfigServidor(deps.env);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = `${config.crmUrl}/api/public/catalog${caminho}`;

  const opcoesDeCache: RequestInit = deps.semCache
    ? { cache: "no-store" }
    : { next: { tags: [TAG_CATALOGO], revalidate: REVALIDACAO_DE_SEGURANCA_S } };

  let resposta: Response;
  try {
    resposta = await fetchImpl(url, {
      headers: { "x-catalog-key": config.catalogKey },
      ...opcoesDeCache,
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new ErroDoCatalogo(caminho, null, `Não foi possível falar com o CRM: ${motivo}`);
  }

  if (resposta.status === 404) return null;
  if (!resposta.ok) {
    throw new ErroDoCatalogo(
      caminho,
      resposta.status,
      `O CRM respondeu ${resposta.status} em ${caminho}.`,
    );
  }

  let corpo: unknown;
  try {
    corpo = (await resposta.json()) as unknown;
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new ErroDoCatalogo(
      caminho,
      resposta.status,
      `Resposta do CRM não era JSON válido em ${caminho}: ${motivo}`,
    );
  }
  return corpo;
}

export type OpcoesDeBusca = { categoria?: string; destaque?: boolean; busca?: string };

export async function buscarItens(
  opcoes: OpcoesDeBusca = {},
  deps: DepsDoCatalogo = {},
): Promise<ItemCatalogo[]> {
  const parametros = new URLSearchParams();
  if (opcoes.categoria) parametros.set("category", opcoes.categoria);
  if (opcoes.destaque) parametros.set("featured", "true");
  if (opcoes.busca) parametros.set("q", opcoes.busca);
  const consulta = parametros.size > 0 ? `?${parametros.toString()}` : "";
  const caminho = `/items${consulta}`;

  const corpo = await buscarJson(caminho, deps);
  const validado = respostaDeItens.safeParse(corpo);
  if (!validado.success) {
    throw new ErroDoCatalogo(
      caminho,
      null,
      `Resposta do CRM fora do formato esperado em ${caminho}.`,
    );
  }
  return validado.data.data;
}

export async function buscarItem(
  slug: string,
  deps: DepsDoCatalogo = {},
): Promise<ItemCatalogo | null> {
  const caminho = `/items/${encodeURIComponent(slug)}`;
  const corpo = await buscarJson(caminho, deps);
  if (corpo === null) return null;

  const validado = respostaDeItem.safeParse(corpo);
  if (!validado.success) {
    throw new ErroDoCatalogo(
      caminho,
      null,
      `Resposta do CRM fora do formato esperado em ${caminho}.`,
    );
  }
  return validado.data.data;
}

export async function buscarCategorias(deps: DepsDoCatalogo = {}): Promise<CategoriaCatalogo[]> {
  const caminho = "/categories";
  const corpo = await buscarJson(caminho, deps);
  const validado = respostaDeCategorias.safeParse(corpo);
  if (!validado.success) {
    throw new ErroDoCatalogo(
      caminho,
      null,
      `Resposta do CRM fora do formato esperado em ${caminho}.`,
    );
  }
  return validado.data.data;
}
