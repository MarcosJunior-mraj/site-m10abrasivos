/** Prefixo que `lib/agent/run.ts`, no CRM, procura para injetar o resumo do site no prompt do WhatsApp. */
export const PREFIXO_DO_SITE = "Oi! Vim do site.";

/**
 * Link do WhatsApp com a mensagem inicial. Fica fora de `cliente.ts` para o
 * botão do chat (carregado em toda página) poder mostrar a saída de
 * emergência sem puxar o cliente do webchat para a carga inicial.
 */
export function linkDoWhatsapp(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(PREFIXO_DO_SITE)}`;
}
