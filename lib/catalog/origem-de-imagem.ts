/**
 * Lista fechada — e ÚNICA — de onde a rota `/imagens/[slug]/[indice]` pode
 * buscar bytes. A rota é um proxy que roda no servidor do site: sem esta
 * lista, uma URL qualquer que chegasse no catálogo viraria requisição do
 * servidor para dentro da rede (SSRF) ou página servida na origem do site.
 *
 * De onde saíram os hosts: o CRM grava em `bling_products.images` o
 * `imagemURL` que a API v3 do Bling devolve, e essas URLs são links
 * assinados do bucket S3 do Bling (`https://orgbling.s3.amazonaws.com/...`,
 * o padrão visto nas fixtures e relatórios desta etapa). A forma regional
 * do mesmo bucket (`orgbling.s3.<região>.amazonaws.com`) e o domínio do
 * próprio Bling entram por segurança. Se o Bling mudar de armazenamento,
 * as fotos passam a responder 404 — o conserto é aqui, e só aqui.
 *
 * Duas exceções, ambas configuradas pelo operador, nunca pelo catálogo:
 * - a origem do próprio CRM (`CRM_URL`), que já é quem entrega o catálogo;
 * - `IMAGENS_HOSTS_EXTRAS`, para foto de kit cadastrada no CRM com link de
 *   outro host (o campo de imagem do kit aceita qualquer URL).
 */
const HOSTS_DO_BLING = new Set(["orgbling.s3.amazonaws.com"]);
const HOST_REGIONAL_DO_BLING = /^orgbling\.s3[.-][a-z0-9-]+\.amazonaws\.com$/;
const DOMINIO_DO_BLING = ".bling.com.br";

export type OpcoesDeOrigem = {
  /** URL base do CRM (`CRM_URL`); a mesma origem é aceita, inclusive em `http:` local. */
  crmUrl: string;
  /** Hosts extras em `https:` (`IMAGENS_HOSTS_EXTRAS`). */
  hostsExtras: readonly string[];
};

function mesmaOrigem(url: URL, base: string): boolean {
  try {
    return url.origin === new URL(base).origin;
  } catch {
    return false;
  }
}

function hostDoBling(host: string): boolean {
  return (
    HOSTS_DO_BLING.has(host) || HOST_REGIONAL_DO_BLING.test(host) || host.endsWith(DOMINIO_DO_BLING)
  );
}

/** Devolve a URL já analisada quando pode ser buscada; `null` quando não pode. */
export function origemPermitida(bruta: string, opcoes: OpcoesDeOrigem): URL | null {
  let url: URL;
  try {
    url = new URL(bruta);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (mesmaOrigem(url, opcoes.crmUrl)) return url;
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  if (hostDoBling(host)) return url;
  if (opcoes.hostsExtras.some((extra) => extra.toLowerCase() === host)) return url;
  return null;
}

/** Só formatos raster que o navegador exibe como imagem; SVG fica de fora (pode carregar script). */
export const TIPOS_DE_IMAGEM_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

/** `Image/PNG; charset=binary` → `image/png`; tipo fora da lista → `null`. */
export function tipoDeImagemPermitido(cabecalho: string | null): string | null {
  const tipo = (cabecalho ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return TIPOS_DE_IMAGEM_PERMITIDOS.has(tipo) ? tipo : null;
}
