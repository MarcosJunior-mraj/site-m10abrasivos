import { z } from "zod/mini";

/**
 * Validação do que o CRM devolve ao navegador. `zod/mini` (e não o `zod`
 * completo) porque este arquivo vai no pedaço do chat baixado no clique —
 * a API funcional dele deixa o empacotador levar só o que é usado.
 */

/** Igual ao `PublicMessage` do CRM (`lib/webchat/queries.ts`). */
export const esquemaMensagem = z.object({
  id: z.string(),
  from: z.enum(["cliente", "especialista"]),
  by: z.enum(["cliente", "ia", "vendedor"]),
  body: z.string(),
  createdAt: z.string(),
  externalId: z.nullable(z.string()),
  event: z.nullable(z.enum(["handoff_whatsapp"])),
});

/** `POST /session`. */
export const esquemaSessao = z.object({
  data: z.object({
    token: z.string().check(z.minLength(1)),
    whatsappNumber: z.nullable(z.string()),
    messages: z.array(esquemaMensagem),
  }),
});

/** `GET /messages`. */
export const esquemaMensagens = z.object({
  data: z.object({
    messages: z.array(esquemaMensagem),
    typing: z.boolean(),
  }),
});

/** Evento SSE `digitando`. */
export const esquemaDigitando = z.object({ digitando: z.boolean() });
