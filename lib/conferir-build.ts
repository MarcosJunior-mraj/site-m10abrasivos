/**
 * Conferências que só fazem sentido NO BUILD — chamadas pelo `next.config.ts`
 * na fase de build de produção. As `NEXT_PUBLIC_*` são gravadas no pacote do
 * navegador nesse momento: se faltar agora, o site sobe quebrado e nada em
 * runtime conserta.
 *
 * `NEXT_PUBLIC_WHATSAPP_FALLBACK` é a saída de emergência do chat (CRM fora
 * do ar, Turnstile bloqueado, código do chat que não carregou): vazio, o
 * visitante ficaria com um link `https://wa.me/` que não leva a ninguém.
 */
export function conferirVariaveisDeBuild(env: Record<string, string | undefined>): void {
  const numero = (env.NEXT_PUBLIC_WHATSAPP_FALLBACK ?? "").replace(/\D/g, "");
  if (!numero) {
    throw new Error(
      "Build recusado: NEXT_PUBLIC_WHATSAPP_FALLBACK está vazio (ou sem dígitos). " +
        "É o número de contingência do chat e precisa existir no momento do build.",
    );
  }
}
