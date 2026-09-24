import { array, boolean, enum as enumeracao, minLength, nullable, object, string } from "zod/mini";

/**
 * Validação do que o CRM devolve ao navegador. `zod/mini` (e não o `zod`
 * completo) porque este arquivo vai no pedaço do chat baixado no clique.
 * Importações NOMEADAS de propósito: com `import { z }` o empacotador leva o
 * objeto `z` inteiro (todos os formatos, locais etc.); assim leva só o usado.
 */

/** Igual ao `PublicMessage` do CRM (`lib/webchat/queries.ts`). */
export const esquemaMensagem = object({
  id: string(),
  from: enumeracao(["cliente", "especialista"]),
  by: enumeracao(["cliente", "ia", "vendedor"]),
  body: string(),
  createdAt: string(),
  externalId: nullable(string()),
  event: nullable(enumeracao(["handoff_whatsapp"])),
});

/** `POST /session`. */
export const esquemaSessao = object({
  data: object({
    token: string().check(minLength(1)),
    whatsappNumber: nullable(string()),
    messages: array(esquemaMensagem),
  }),
});

/** `GET /messages`. */
export const esquemaMensagens = object({
  data: object({
    messages: array(esquemaMensagem),
    typing: boolean(),
  }),
});

/** Evento SSE `digitando`. */
export const esquemaDigitando = object({ digitando: boolean() });
