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
};

/** Devolve o corpo em JSON, ou `null` quando o CRM responde 404. */
async function buscarJson(caminho: string, deps: DepsDoCatalogo): Promise<unknown | null> {
  const config = lerConfigServidor(deps.env);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = `${config.crmUrl}/api/public/catalog${caminho}`;

  let resposta: Response;
  try {
    resposta = await fetchImpl(url, {
      headers: { "x-catalog-key": config.catalogKey },
      next: { tags: [TAG_CATALOGO], revalidate: REVALIDACAO_DE_SEGURANCA_S },
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
  return (await resposta.json()) as unknown;
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
