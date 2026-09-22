/**
 * Configuração que pode ir ao navegador — de propósito sem Zod e sem nada de
 * servidor: este arquivo entra no pacote de TODA página (rodapé, botão do
 * chat). A configuração de servidor, com validação, fica em `lib/config.ts`.
 *
 * Os nomes precisam estar escritos por extenso: o Next só troca
 * `process.env.NEXT_PUBLIC_X` por valor literal quando a expressão aparece
 * assim no código.
 */
export const CONFIG_PUBLICA = {
  crmUrl: (process.env.NEXT_PUBLIC_CRM_URL ?? "").replace(/\/+$/, ""),
  webchatKey: process.env.NEXT_PUBLIC_WEBCHAT_KEY ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  whatsappFallback: (process.env.NEXT_PUBLIC_WHATSAPP_FALLBACK ?? "").replace(/\D/g, ""),
} as const;
