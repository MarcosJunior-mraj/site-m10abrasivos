/**
 * Encaixe de medição (spec 2026-09-23, seção 8): hoje não carrega nada. Quando o
 * usuário ligar GTM/GA4/Pixel (com aviso de cookies), o script deles cria
 * `window.dataLayer` e estes eventos passam a chegar sem mexer no resto do site.
 */
export function registrarEvento(
  nome: "chat_aberto" | "mensagem_enviada",
  dados: Record<string, string | null> = {},
): void {
  if (typeof window === "undefined") return;
  const camada = (window as { dataLayer?: unknown[] }).dataLayer;
  if (!Array.isArray(camada)) return;
  camada.push({ event: nome, ...dados });
}
