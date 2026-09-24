import { type Linha, TODAS_AS_LINHAS } from "./linhas";

/** A linha mostra algum arquivo do bucket de mídia (vídeo, foto, capa)? */
function temMidia(linha: Linha): boolean {
  return (
    linha.topo.video !== null ||
    linha.razoes.itens.some((razao) => razao.video !== null) ||
    linha.faixa.fotoEspelhado !== null ||
    linha.seo.imagem !== null ||
    linha.depoimentos.length > 0
  );
}

/**
 * Conferências que só fazem sentido NO BUILD — chamadas pelo `next.config.ts`
 * na fase de build de produção. As `NEXT_PUBLIC_*` são gravadas no pacote do
 * navegador nesse momento: se faltar agora, o site sobe quebrado e nada em
 * runtime conserta.
 *
 * `NEXT_PUBLIC_WHATSAPP_FALLBACK` é a saída de emergência do chat (CRM fora
 * do ar, Turnstile bloqueado, código do chat que não carregou): vazio, o
 * visitante ficaria com um link `https://wa.me/` que não leva a ninguém.
 *
 * `NEXT_PUBLIC_MIDIA_URL` é a base de toda foto/vídeo das páginas de vendas
 * (`urlDaMidia`): vazia, cada mídia vira um caminho relativo quebrado. Só é
 * exigida quando alguma linha PUBLICADA (fora de rascunho) tem mídia.
 */
export function conferirVariaveisDeBuild(
  env: Record<string, string | undefined>,
  linhas: readonly Linha[] = TODAS_AS_LINHAS,
): void {
  const numero = (env.NEXT_PUBLIC_WHATSAPP_FALLBACK ?? "").replace(/\D/g, "");
  if (!numero) {
    throw new Error(
      "Build recusado: NEXT_PUBLIC_WHATSAPP_FALLBACK está vazio (ou sem dígitos). " +
        "É o número de contingência do chat e precisa existir no momento do build.",
    );
  }

  const semBase = !(env.NEXT_PUBLIC_MIDIA_URL ?? "").trim();
  const comMidia = linhas.filter((linha) => !linha.rascunho && temMidia(linha));
  if (semBase && comMidia.length > 0) {
    throw new Error(
      "Build recusado: NEXT_PUBLIC_MIDIA_URL está vazio, mas a(s) linha(s) publicada(s) " +
        `${comMidia.map((linha) => linha.slug).join(", ")} têm fotos/vídeos. ` +
        "Sem a base pública do bucket de mídia, toda mídia da página quebra.",
    );
  }
}
