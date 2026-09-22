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

export type TipoDeImagem = "image/jpeg" | "image/png" | "image/webp" | "image/avif" | "image/gif";

/** Só formatos raster que o navegador exibe como imagem; SVG fica de fora (pode carregar script). */
const LISTA_DE_TIPOS_PERMITIDOS: readonly TipoDeImagem[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];

export const TIPOS_DE_IMAGEM_PERMITIDOS: ReadonlySet<TipoDeImagem> = new Set(
  LISTA_DE_TIPOS_PERMITIDOS,
);

function ehTipoDeImagemPermitido(tipo: string): tipo is TipoDeImagem {
  for (const permitido of LISTA_DE_TIPOS_PERMITIDOS) {
    if (permitido === tipo) return true;
  }
  return false;
}

function tipoNormalizado(cabecalho: string | null): string {
  return (cabecalho ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

/** `Image/PNG; charset=binary` → `image/png`; tipo fora da lista → `null`. */
export function tipoDeImagemPermitido(cabecalho: string | null): TipoDeImagem | null {
  const tipo = tipoNormalizado(cabecalho);
  return ehTipoDeImagemPermitido(tipo) ? tipo : null;
}

/**
 * O S3 do Bling não guarda o content-type de arquivos sem extensão no
 * caminho: ele devolve `application/octet-stream` (às vezes `binary/*`, às
 * vezes nem manda o cabeçalho) mesmo para uma foto real. Um content-type
 * assim não diz nada sobre o conteúdo — nem permite, nem recusa por si só;
 * quem decide são os bytes (`tipoPelosBytes`).
 */
const TIPOS_GENERICOS = new Set(["application/octet-stream", "binary/octet-stream"]);

export function tipoDeImagemGenerico(cabecalho: string | null): boolean {
  const tipo = tipoNormalizado(cabecalho);
  return tipo === "" || TIPOS_GENERICOS.has(tipo);
}

const ASSINATURA_JPEG: readonly number[] = [0xff, 0xd8, 0xff];
const ASSINATURA_PNG: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function bytesIguais(bytes: Uint8Array, esperado: readonly number[], deslocamento = 0): boolean {
  if (bytes.length < deslocamento + esperado.length) return false;
  return esperado.every((byte, i) => bytes[deslocamento + i] === byte);
}

/** Compara um trecho dos bytes com um texto ASCII fixo (ex.: "RIFF", "ftyp"). */
function textoAsciiIgual(bytes: Uint8Array, inicio: number, texto: string): boolean {
  if (bytes.length < inicio + texto.length) return false;
  for (let i = 0; i < texto.length; i++) {
    if (bytes[inicio + i] !== texto.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Identifica o tipo de imagem pelas assinaturas fixas dos primeiros bytes do
 * corpo — usada só quando o upstream declarou um content-type genérico (ou
 * nenhum, ver `tipoDeImagemGenerico`). `null` quando nenhuma assinatura
 * conhecida bate; SVG/HTML/XML são texto e nunca casam com nenhuma delas.
 */
export function tipoPelosBytes(bytes: Uint8Array): TipoDeImagem | null {
  if (bytesIguais(bytes, ASSINATURA_JPEG)) return "image/jpeg";
  if (bytesIguais(bytes, ASSINATURA_PNG)) return "image/png";
  if (textoAsciiIgual(bytes, 0, "GIF87a") || textoAsciiIgual(bytes, 0, "GIF89a")) {
    return "image/gif";
  }
  if (textoAsciiIgual(bytes, 0, "RIFF") && textoAsciiIgual(bytes, 8, "WEBP")) return "image/webp";
  if (
    textoAsciiIgual(bytes, 4, "ftyp") &&
    (textoAsciiIgual(bytes, 8, "avif") || textoAsciiIgual(bytes, 8, "avis"))
  ) {
    return "image/avif";
  }
  return null;
}
