import { CONFIG_PUBLICA } from "@/lib/config-publica";

/**
 * URL pública de um arquivo do bucket `site-midia`. O conteúdo das linhas guarda
 * só o caminho ("green-turbo/topo-celular.mp4"); a base vem de
 * `NEXT_PUBLIC_MIDIA_URL`, então trocar de serviço de vídeo não mexe no conteúdo.
 */
export function urlDaMidia(caminho: string, base: string = CONFIG_PUBLICA.midiaUrl): string {
  return `${base.replace(/\/+$/, "")}/${caminho.replace(/^\/+/, "")}`;
}

/** Visitante pediu menos animação ou está economizando dados: só a capa, sem vídeo. */
export function semMovimento(): boolean {
  if (typeof window === "undefined") return false;
  const reduzido =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const conexao = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return reduzido || conexao?.saveData === true;
}
