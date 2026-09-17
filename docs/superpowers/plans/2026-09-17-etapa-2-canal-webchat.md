# Etapa 2 — Canal webchat no CRM: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao CRM um canal `webchat` completo — adapter, canal "Site" configurável e rotas públicas (sessão, mensagens, SSE) — para que uma página HTML simples converse com a inbox e com o agente, sem provedor externo.

**Architecture:** O canal segue a arquitetura de 3 camadas já existente (UI → router → adapter): o adapter `webchat` é um tradutor de protocolo sem provedor (o envio só marca `delivered`), e todo o resto reaproveita o router (`processInboundMessage`), o disparo do agente e o broadcast Realtime da inbox. As rotas públicas ficam em `app/api/webchat/`, autenticadas por um token de sessão HMAC ligado a `channel_id` + `conversation_id`, com validação de `Origin` contra `allowedOrigins` do canal. O SSE roda no processo Node do Easypanel e repassa para o navegador apenas os eventos da conversa daquele token.

**Tech Stack:** Next.js 16 (App Router, Route Handlers, `after()`), TypeScript estrito, Supabase (Postgres + RLS + Realtime broadcast), Zod, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-09-16-site-abrasivos-ia-vendedora-design.md` (seção 5; limites na seção 10; erros na seção 9)

**Repositório:** CRM (`MarcosJunior-mraj/crm_m10`), branch nova a partir da `main`. O site (`ias/site`) só entra na Etapa 4.

## Global Constraints

- Idioma: todo texto visível ao usuário, comentário e mensagem de commit em **português do Brasil**.
- `enable row level security`, **nunca** `force` (regra do CLAUDE.md raiz do CRM).
- Segredos de canal (`sessionSecret`, `turnstileSecret`) vivem em `channels.config` e **nunca** vão para o navegador.
- Adapter não conhece tabelas do CRM: quem grava no banco é o router.
- Idempotência de mensagem por `UNIQUE (conversation_id, external_id)`; o `clientMessageId` do widget vira `external_id`.
- Token de sessão: HMAC ligado a `channel_id` + `conversation_id`, validade de 30 dias.
- Limites por sessão e por IP: **20 mensagens/min**, **200/dia**, **1.000 caracteres** por mensagem.
- Turnstile na abertura da sessão (`POST /api/webchat/session`).
- Migrations novas em `supabase/migrations/`, aplicadas depois no Supabase de produção.
- Biome só nos arquivos tocados (`npx biome check --write <arquivos>`); `npm run check` reformata centenas de arquivos antigos.
- Testes: `npx vitest run`; verificação de tipos: `npx tsc --noEmit`. Ambos limpos antes de cada commit.
- Commits pequenos, em português, com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## Decisões de desenho (tomadas a partir do código atual do CRM)

O mapeamento do CRM mostrou que **não existe** nenhuma das peças abaixo. Cada ausência virou uma decisão:

| Peça ausente | Decisão |
|---|---|
| Cliente Realtime no servidor (`supabase.channel()` só existe em componentes `"use client"`) | O SSE **não** assina o broadcast `inbox:{org_id}`. Ele faz uma leitura curta no banco a cada 1,5 s dentro do próprio processo Node e empurra o que mudou. Sem infra nova, sem depender da policy `to authenticated` do `realtime.messages`. |
| Qualquer SSE no repositório | Este é o primeiro. Fica isolado em uma rota só, com cursor por `(created_at, id)`, batida de vida a cada 20 s e teto de 15 min por conexão. |
| CORS (nenhum header, nenhum `OPTIONS`) | Helper próprio (`lib/webchat/origin.ts`) que ecoa o `Origin` **apenas** se ele estiver em `allowedOrigins` do canal. Sem curinga. |
| Turnstile | Helper próprio (`lib/webchat/turnstile.ts`) chamando `siteverify`. Se o canal não tiver `turnstileSecret`, a verificação é pulada (ambiente de teste). |
| Rate limit reaproveitável (o do `middleware.ts` é privado e não cobre `/api/`) | Helper próprio (`lib/webchat/rate-limit.ts`) em memória do processo, com janelas de minuto e de dia, por sessão e por IP. |
| Helper de mock do Supabase nos testes (`tests/setup.ts` está vazio) | Cada teste monta sua própria fábrica, como o resto do repositório (`tests/messaging-router-receive.test.ts` é o modelo). |

**Rotas sob `/api/public/webchat/`** (e não `/api/webchat/` como na especificação): o `middleware.ts` já libera `/api/public/` sem autenticação (`middleware.ts:141-146`). Assim o middleware não é tocado — ele é código sensível de autenticação e usa CRLF.

**Identificação do canal pelo navegador:** `channels.external_id` guarda uma **chave pública** (`m10chat_...`), em texto claro. Ela não é segredo: quem protege é a lista de origens e o Turnstile. O `sessionSecret` (que assina os tokens) fica em `config` e nunca sai do servidor.

**Entrega das respostas:** o agente já grava a mensagem e chama `processSendOutbound`, que chama `adapter.sendMessage`. O adapter webchat não faz HTTP nenhum: devolve um `externalId` sintético. Quem entrega ao navegador é o SSE (ou o `GET /messages?after=`).

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260918000001_webchat_channel_type.sql` | Aceitar `'webchat'` no CHECK de `channels.type` |
| `lib/messaging/adapters/webchat/schema.ts` | Zod da `channels.config` do canal Site |
| `lib/messaging/adapters/webchat/adapter.ts` | `MessagingAdapter` sem provedor externo |
| `lib/messaging/adapters/webchat/index.ts` | Registra o adapter no boot |
| `lib/messaging/adapters/webchat/actions.ts` | Server Actions: conectar, trocar domínios, gerar chave nova, desconectar |
| `lib/messaging/adapters/webchat/action-schemas.ts` | Zod das entradas das actions |
| `lib/webchat/public-key.ts` | Gera a chave pública `m10chat_...` |
| `lib/webchat/session-token.ts` | Assina e confere o token de sessão (HMAC) |
| `lib/webchat/origin.ts` | Casa a origem com `allowedOrigins` e monta os cabeçalhos CORS |
| `lib/webchat/rate-limit.ts` | Limites por minuto e por dia, por sessão e por IP |
| `lib/webchat/turnstile.ts` | Verifica o desafio do Cloudflare |
| `lib/webchat/queries.ts` | Leituras do canal, da conversa e das mensagens (service client) |
| `app/api/public/webchat/_lib/guard.ts` | Porta de entrada comum: origem, token, canal, CORS |
| `app/api/public/webchat/session/route.ts` | Abre ou retoma a sessão |
| `app/api/public/webchat/messages/route.ts` | `POST` envia; `GET` lê a partir de um cursor |
| `app/api/public/webchat/stream/route.ts` | SSE com `typing`, `message`, `agent_joined`, `handoff_whatsapp` |
| `app/(app)/app/[orgSlug]/settings/channels/_components/connect-webchat-dialog.tsx` | Criar o canal Site pela interface |
| `app/(app)/app/[orgSlug]/settings/channels/webchat/[channelId]/page.tsx` | Detalhe: chave, domínios, agente, desconectar |
| `app/(app)/app/[orgSlug]/settings/channels/webchat/[channelId]/_components/webchat-settings.tsx` | Formulário de domínios e botão de chave nova |
| `app/(app)/app/[orgSlug]/settings/channels/webchat/[channelId]/_components/disconnect-button.tsx` | Remover o canal |
| `public/webchat-teste.html` | Página simples para o teste ponta a ponta (servida pelo próprio CRM, sem iframe: a CSP atual continua valendo) |
| `lib/webchat/CLAUDE.md` | Documentação da pasta, no padrão do repositório |

**Modificar:**

| Arquivo | Mudança |
|---|---|
| `lib/messaging/adapter.ts:6-13` | `ChannelType` ganha `"webchat"` |
| `lib/messaging/index.ts` | `import "./adapters/webchat";` |
| `app/(app)/app/[orgSlug]/settings/channels/page.tsx:62-67` | Roteamento do detalhe para `webchat` (e conserto do `whatsapp_uazapi`, hoje caindo em `"#"`) |
| `app/(app)/app/[orgSlug]/settings/channels/page.tsx:41-43` | Botão "Conectar site" ao lado do dropdown do WhatsApp |
| `lib/messaging/CLAUDE.md` | Seção do canal webchat e smoke test |
| `types/supabase.ts` | Regerar com `npm run types` após a migration |

**Não tocar:** `middleware.ts`, `lib/messaging/router.ts`, `lib/agent/trigger.ts`, `app/api/webhooks/messaging/[provider]/route.ts` (`VALID_PROVIDERS` continua sem `webchat`, porque o canal não usa webhook).

---

## Preparação (antes da Tarefa 1)

- [ ] Criar a branch a partir da `main` já com a Etapa 1 integrada:

```bash
cd "C:/Users/Marcos Junior/ias/CRM/a716fb05-c23a-4715-819a-aa4f4e833115-template_crm_agentes-main/template_crm_agentes-main"
git checkout main && git pull
git worktree add .worktrees/canal-webchat -b feat/canal-webchat
```

> O `npm run build` só funciona em caminho curto (limite do Windows). Para compilar, use a cópia em `C:\m10b` (`git fetch` do repositório local + `git checkout <commit>`), como foi feito na Etapa 1. `npx vitest run` e `npx tsc --noEmit` rodam normalmente no worktree.

---

### Task 1: Adapter webchat e tipo de canal

**Files:**
- Create: `supabase/migrations/20260918000001_webchat_channel_type.sql`
- Create: `lib/messaging/adapters/webchat/schema.ts`
- Create: `lib/messaging/adapters/webchat/adapter.ts`
- Create: `lib/messaging/adapters/webchat/index.ts`
- Modify: `lib/messaging/adapter.ts:6-13` (union `ChannelType`)
- Modify: `lib/messaging/index.ts` (linha de import)
- Test: `tests/webchat-adapter.test.ts`

**Interfaces:**
- Consumes: `MessagingAdapter`, `NormalizedEvent`, `SendMessageOpts`, `SendTemplateOpts`, `VerifyWebhookRequest` de `lib/messaging/adapter.ts`; `registerAdapter` de `lib/messaging/registry.ts`.
- Produces: `webchatAdapter: MessagingAdapter`; `webchatConfigSchema` (Zod) e `type WebchatConfig = { allowedOrigins: string[]; sessionSecret: string; turnstileSecret: string | null; whatsappNumber: string | null }`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/webchat-adapter.test.ts
import { describe, expect, it } from "vitest";
import { webchatAdapter } from "@/lib/messaging/adapters/webchat/adapter";

const configValida = {
  allowedOrigins: ["https://m10abrasivos.com.br"],
  sessionSecret: "a".repeat(64),
  turnstileSecret: null,
  whatsappNumber: null,
};

describe("adapter webchat", () => {
  it("é um canal sem provedor externo", () => {
    expect(webchatAdapter.channel).toBe("webchat");
    expect(webchatAdapter.capabilities).toEqual({
      templates: false,
      reactions: false,
      readReceipts: false,
      media: false,
    });
  });

  it("sendMessage não fala com ninguém e devolve id sintético único", async () => {
    const a = await webchatAdapter.sendMessage(configValida, { to: "visitante-1", body: "oi" });
    const b = await webchatAdapter.sendMessage(configValida, { to: "visitante-1", body: "oi" });
    expect(a.externalId).toMatch(/^web_[0-9a-f-]{36}$/);
    expect(a.externalId).not.toBe(b.externalId);
  });

  it("não tem templates nem webhook", async () => {
    await expect(
      webchatAdapter.sendTemplate(configValida, {
        to: "visitante-1",
        templateName: "x",
        language: "pt_BR",
        params: {},
      }),
    ).resolves.toEqual({ unsupported: true });
    expect(
      webchatAdapter.verifyWebhook({ headers: {}, rawBody: Buffer.from(""), query: {} }),
    ).toBe(false);
    expect(webchatAdapter.parseWebhook({ qualquer: "coisa" })).toEqual([]);
  });

  it("valida a config do canal", () => {
    expect(webchatAdapter.validateConfig(configValida)).toEqual({
      ok: true,
      config: configValida,
    });
    const semOrigem = webchatAdapter.validateConfig({ ...configValida, allowedOrigins: [] });
    expect(semOrigem.ok).toBe(false);
    const segredoCurto = webchatAdapter.validateConfig({ ...configValida, sessionSecret: "curto" });
    expect(segredoCurto.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/webchat-adapter.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/messaging/adapters/webchat/adapter"`.

- [ ] **Step 3: Criar o schema da config**

```ts
// lib/messaging/adapters/webchat/schema.ts
import { z } from "zod";

/** Config do canal Site. Só `allowedOrigins` e `whatsappNumber` podem ir pro browser. */
export const webchatConfigSchema = z.object({
  /** Origens (esquema + domínio + porta) que podem chamar as rotas públicas. */
  allowedOrigins: z.array(z.string().min(1).max(200)).min(1).max(10),
  /** Segredo que assina os tokens de sessão. Gerado pelo sistema, nunca exibido. */
  sessionSecret: z.string().min(32).max(200),
  /** Segredo do Cloudflare Turnstile. `null` desliga a verificação (ambiente de teste). */
  turnstileSecret: z.string().max(200).nullable(),
  /** Número usado no botão "Continuar no WhatsApp" (só dígitos, com DDI). */
  whatsappNumber: z.string().max(20).nullable(),
});

export type WebchatConfig = z.infer<typeof webchatConfigSchema>;
```

- [ ] **Step 4: Criar o adapter e o registro**

```ts
// lib/messaging/adapters/webchat/adapter.ts
import { randomUUID } from "node:crypto";
import type {
  MessagingAdapter,
  NormalizedEvent,
  SendMessageOpts,
  SendTemplateOpts,
  VerifyWebhookRequest,
} from "../../adapter";
import { registerAdapter } from "../../registry";
import { webchatConfigSchema } from "./schema";

/**
 * Canal do chat do site. Não existe provedor externo: a mensagem do agente é
 * gravada pelo router e entregue ao navegador pelo SSE (ou pelo GET de
 * mensagens). Por isso `sendMessage` só devolve um id sintético — se ele
 * lançasse, a mensagem ficaria `failed` e sumiria da conversa.
 */
export const webchatAdapter: MessagingAdapter = {
  channel: "webchat",
  capabilities: { templates: false, reactions: false, readReceipts: false, media: false },

  validateConfig(config) {
    const parsed = webchatConfigSchema.safeParse(config);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Configuração inválida" };
    }
    return { ok: true, config: parsed.data };
  },

  async sendMessage(_config: unknown, _opts: SendMessageOpts) {
    return { externalId: `web_${randomUUID()}` };
  },

  async sendTemplate(_config: unknown, _opts: SendTemplateOpts) {
    return { unsupported: true as const };
  },

  /** O canal não recebe webhook: a entrada é a rota pública autenticada por token. */
  verifyWebhook(_req: VerifyWebhookRequest) {
    return false;
  },

  parseWebhook(_payload: unknown): NormalizedEvent[] {
    return [];
  },
};

registerAdapter(webchatAdapter);
```

```ts
// lib/messaging/adapters/webchat/index.ts
export { webchatAdapter } from "./adapter";
export { type WebchatConfig, webchatConfigSchema } from "./schema";
```

- [ ] **Step 5: Ligar o tipo no resto do sistema**

Em `lib/messaging/adapter.ts`, acrescentar `"webchat"` ao union:

```ts
export type ChannelType =
  | "whatsapp_cloud"
  | "whatsapp_evolution"
  | "whatsapp_uazapi"
  | "telegram"
  | "instagram_dm"
  | "sms"
  | "webchat"
  | "mock";
```

Em `lib/messaging/index.ts`, acrescentar junto dos outros imports de efeito colateral:

```ts
import "./adapters/webchat";
```

- [ ] **Step 6: Escrever a migration**

```sql
-- supabase/migrations/20260918000001_webchat_channel_type.sql
-- Canal do chat do site (Etapa 2). Mesmo padrão das migrations que já
-- ampliaram esse CHECK (20260605000004 e 20260724000001).
alter table public.channels drop constraint if exists channels_type_check;
alter table public.channels add constraint channels_type_check
  check (type in (
    'whatsapp_cloud', 'whatsapp_evolution', 'whatsapp_uazapi',
    'telegram', 'instagram_dm', 'sms', 'webchat', 'mock'
  ));
```

- [ ] **Step 7: Rodar os testes e a checagem de tipos**

Run: `npx vitest run tests/webchat-adapter.test.ts && npx tsc --noEmit`
Expected: 4 testes passando, `tsc` sem saída.

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: tudo passando. Se algum `switch`/mapa sobre `ChannelType` quebrar por falta do caso `webchat`, corrigir ali mesmo — é o compilador apontando o que o canal novo precisa.

- [ ] **Step 9: Commit**

```bash
npx biome check --write lib/messaging/adapters/webchat lib/messaging/adapter.ts lib/messaging/index.ts tests/webchat-adapter.test.ts
git add supabase/migrations/20260918000001_webchat_channel_type.sql lib/messaging tests/webchat-adapter.test.ts
git commit -m "feat(webchat): adapter do canal do site e tipo de canal webchat"
```

---

### Task 2: Token de sessão assinado

**Files:**
- Create: `lib/webchat/session-token.ts`
- Test: `tests/webchat-session-token.test.ts`

**Interfaces:**
- Produces:
  - `type WebchatSession = { channelId: string; visitorId: string; exp: number }`
  - `signSessionToken(payload: { channelId: string; visitorId: string }, secret: string, now?: number): string`
  - `verifySessionToken(token: string | null | undefined, secret: string, now?: number): WebchatSession | null`
  - `SESSION_TTL_MS: number` (30 dias)

> **Desvio da especificação, proposital:** a especificação liga o token a `channel_id` + `conversation_id`. Aqui ele é ligado a `channel_id` + `visitorId`, e a conversa é resolvida por `(channel_id, external_thread_id = visitorId)` — que é justamente o `UNIQUE` de `conversations`. Assim quem cria a conversa continua sendo o router (`processInboundMessage`), sem duplicar a criação nem os eventos de automação. O `visitorId` é gerado **no servidor**: tomar a sessão de outro visitante exige forjar o HMAC.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/webchat-session-token.test.ts
import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  signSessionToken,
  verifySessionToken,
} from "@/lib/webchat/session-token";

const SEGREDO = "s".repeat(64);
const OUTRO_SEGREDO = "o".repeat(64);
const AGORA = 1_800_000_000_000;

describe("token de sessão do webchat", () => {
  it("assina e confere, devolvendo canal e visitante", () => {
    const token = signSessionToken({ channelId: "canal-1", visitorId: "visitante-1" }, SEGREDO, AGORA);
    const sessao = verifySessionToken(token, SEGREDO, AGORA + 1000);
    expect(sessao).toEqual({
      channelId: "canal-1",
      visitorId: "visitante-1",
      exp: AGORA + SESSION_TTL_MS,
    });
  });

  it("recusa segredo errado, token adulterado, expirado e lixo", () => {
    const token = signSessionToken({ channelId: "canal-1", visitorId: "visitante-1" }, SEGREDO, AGORA);
    expect(verifySessionToken(token, OUTRO_SEGREDO, AGORA)).toBeNull();
    expect(verifySessionToken(token, SEGREDO, AGORA + SESSION_TTL_MS + 1)).toBeNull();
    expect(verifySessionToken(null, SEGREDO, AGORA)).toBeNull();
    expect(verifySessionToken("lixo", SEGREDO, AGORA)).toBeNull();
    expect(verifySessionToken(`${token}x`, SEGREDO, AGORA)).toBeNull();

    // Troca o conteúdo mantendo a assinatura: precisa cair.
    const [corpo, assinatura] = token.split(".");
    const adulterado = Buffer.from(
      JSON.stringify({ channelId: "canal-2", visitorId: "visitante-1", exp: AGORA + SESSION_TTL_MS }),
      "utf8",
    ).toString("base64url");
    expect(verifySessionToken(`${adulterado}.${assinatura}`, SEGREDO, AGORA)).toBeNull();
    expect(corpo).not.toBe(adulterado);
  });

  it("recusa token absurdamente grande sem gastar CPU com HMAC", () => {
    expect(verifySessionToken(`${"a".repeat(5000)}.b`, SEGREDO, AGORA)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/webchat-session-token.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// lib/webchat/session-token.ts
import { createHmac, timingSafeEqual } from "node:crypto";

/** Validade do token de sessão: 30 dias (seção 5.2 da especificação). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const TAMANHO_MAXIMO = 2000;

export type WebchatSession = {
  channelId: string;
  visitorId: string;
  exp: number;
};

function assinar(corpo: string, secret: string): string {
  return createHmac("sha256", secret).update(corpo).digest("base64url");
}

export function signSessionToken(
  payload: { channelId: string; visitorId: string },
  secret: string,
  now: number = Date.now(),
): string {
  const sessao: WebchatSession = { ...payload, exp: now + SESSION_TTL_MS };
  const corpo = Buffer.from(JSON.stringify(sessao), "utf8").toString("base64url");
  return `${corpo}.${assinar(corpo, secret)}`;
}

/** Devolve a sessão só se a assinatura confere e o token não expirou. */
export function verifySessionToken(
  token: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): WebchatSession | null {
  if (!token || token.length > TAMANHO_MAXIMO) return null;
  const ponto = token.lastIndexOf(".");
  if (ponto <= 0) return null;

  const corpo = token.slice(0, ponto);
  const recebida = Buffer.from(token.slice(ponto + 1), "utf8");
  const esperada = Buffer.from(assinar(corpo, secret), "utf8");
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  let bruto: unknown;
  try {
    bruto = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const sessao = bruto as Partial<WebchatSession>;
  if (
    typeof sessao.channelId !== "string" ||
    typeof sessao.visitorId !== "string" ||
    typeof sessao.exp !== "number" ||
    sessao.exp <= now
  ) {
    return null;
  }
  return { channelId: sessao.channelId, visitorId: sessao.visitorId, exp: sessao.exp };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/webchat-session-token.test.ts && npx tsc --noEmit`
Expected: 3 testes passando.

- [ ] **Step 5: Commit**

```bash
npx biome check --write lib/webchat/session-token.ts tests/webchat-session-token.test.ts
git add lib/webchat/session-token.ts tests/webchat-session-token.test.ts
git commit -m "feat(webchat): token de sessão assinado por HMAC"
```

---

### Task 3: Origem permitida, limites de uso e Turnstile

**Files:**
- Create: `lib/webchat/origin.ts`
- Create: `lib/webchat/rate-limit.ts`
- Create: `lib/webchat/turnstile.ts`
- Test: `tests/webchat-origin.test.ts`, `tests/webchat-rate-limit.test.ts`, `tests/webchat-turnstile.test.ts`

**Interfaces:**
- Produces:
  - `normalizeOrigin(valor: string): string | null`
  - `isOriginAllowed(origin: string | null, permitidas: string[]): boolean`
  - `corsHeaders(origin: string): Record<string, string>`
  - `checkWebchatLimits(chaves: { sessionKey: string; ipKey: string }, agora?: number): { ok: true } | { ok: false; retryAfterSeconds: number }`
  - `__resetWebchatLimits(): void` (apenas testes)
  - `LIMITE_POR_MINUTO = 20`, `LIMITE_POR_DIA = 200`
  - `verifyTurnstile(secret: string | null, token: string | null, ip: string | null): Promise<boolean>`

- [ ] **Step 1: Escrever o teste da origem**

```ts
// tests/webchat-origin.test.ts
import { describe, expect, it } from "vitest";
import { corsHeaders, isOriginAllowed, normalizeOrigin } from "@/lib/webchat/origin";

describe("origem do webchat", () => {
  it("normaliza para esquema + domínio + porta", () => {
    expect(normalizeOrigin("https://m10abrasivos.com.br/pagina?x=1")).toBe(
      "https://m10abrasivos.com.br",
    );
    expect(normalizeOrigin("  http://localhost:3000  ")).toBe("http://localhost:3000");
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeOrigin("m10abrasivos.com.br")).toBeNull();
  });

  it("só aceita origem que está na lista, sem curinga", () => {
    const permitidas = ["https://m10abrasivos.com.br", "http://localhost:3000"];
    expect(isOriginAllowed("https://m10abrasivos.com.br", permitidas)).toBe(true);
    expect(isOriginAllowed("https://m10abrasivos.com.br/", permitidas)).toBe(true);
    expect(isOriginAllowed("https://evil.com", permitidas)).toBe(false);
    expect(isOriginAllowed("https://m10abrasivos.com.br.evil.com", permitidas)).toBe(false);
    expect(isOriginAllowed(null, permitidas)).toBe(false);
    expect(isOriginAllowed("https://m10abrasivos.com.br", [])).toBe(false);
  });

  it("ecoa a origem nos cabeçalhos e varia por origem", () => {
    const h = corsHeaders("https://m10abrasivos.com.br");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://m10abrasivos.com.br");
    expect(h.Vary).toBe("Origin");
    expect(h["Access-Control-Allow-Headers"]).toContain("x-webchat-token");
  });
});
```

- [ ] **Step 2: Escrever o teste dos limites**

```ts
// tests/webchat-rate-limit.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetWebchatLimits,
  checkWebchatLimits,
  LIMITE_POR_DIA,
  LIMITE_POR_MINUTO,
} from "@/lib/webchat/rate-limit";

const AGORA = 1_800_000_000_000;
const chaves = { sessionKey: "sessao-1", ipKey: "1.2.3.4" };

describe("limites do webchat", () => {
  beforeEach(() => __resetWebchatLimits());

  it("libera até o limite do minuto e barra o excedente", () => {
    for (let i = 0; i < LIMITE_POR_MINUTO; i++) {
      expect(checkWebchatLimits(chaves, AGORA).ok).toBe(true);
    }
    const barrado = checkWebchatLimits(chaves, AGORA);
    expect(barrado.ok).toBe(false);
    if (!barrado.ok) expect(barrado.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("libera de novo na janela seguinte", () => {
    for (let i = 0; i < LIMITE_POR_MINUTO; i++) checkWebchatLimits(chaves, AGORA);
    expect(checkWebchatLimits(chaves, AGORA + 60_001).ok).toBe(true);
  });

  it("barra pelo teto diário mesmo trocando de minuto", () => {
    let permitidas = 0;
    for (let i = 0; i < LIMITE_POR_DIA + 10; i++) {
      // Um minuto novo a cada 10 mensagens: nunca esbarra no limite por minuto.
      const instante = AGORA + Math.floor(i / 10) * 61_000;
      if (checkWebchatLimits(chaves, instante).ok) permitidas++;
    }
    expect(permitidas).toBe(LIMITE_POR_DIA);
  });

  it("um visitante barrado não derruba outro em IP diferente", () => {
    for (let i = 0; i < LIMITE_POR_MINUTO; i++) checkWebchatLimits(chaves, AGORA);
    expect(checkWebchatLimits({ sessionKey: "sessao-2", ipKey: "5.6.7.8" }, AGORA).ok).toBe(true);
  });

  it("requisição barrada não consome cota", () => {
    for (let i = 0; i < LIMITE_POR_MINUTO; i++) checkWebchatLimits(chaves, AGORA);
    for (let i = 0; i < 50; i++) checkWebchatLimits(chaves, AGORA); // tentativas barradas
    // Na janela seguinte, a cota diária gasta ainda é só a do primeiro minuto.
    let permitidas = 0;
    for (let i = 0; i < LIMITE_POR_MINUTO; i++) {
      if (checkWebchatLimits(chaves, AGORA + 61_000).ok) permitidas++;
    }
    expect(permitidas).toBe(LIMITE_POR_MINUTO);
  });
});
```

- [ ] **Step 3: Escrever o teste do Turnstile**

```ts
// tests/webchat-turnstile.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "@/lib/webchat/turnstile";

vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

function stubFetch(resposta: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => resposta }) as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Turnstile", () => {
  it("sem segredo no canal, a verificação é pulada", async () => {
    const fetchMock = stubFetch({ success: true });
    await expect(verifyTurnstile(null, null, null)).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aceita quando o Cloudflare responde success", async () => {
    const fetchMock = stubFetch({ success: true });
    await expect(verifyTurnstile("segredo", "resposta-do-widget", "1.2.3.4")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recusa sem token, com success false, com HTTP ruim e quando a rede falha", async () => {
    stubFetch({ success: true });
    await expect(verifyTurnstile("segredo", null, null)).resolves.toBe(false);
    stubFetch({ success: false, "error-codes": ["invalid-input-response"] });
    await expect(verifyTurnstile("segredo", "x", null)).resolves.toBe(false);
    stubFetch({ success: true }, false);
    await expect(verifyTurnstile("segredo", "x", null)).resolves.toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("rede caiu");
      }),
    );
    await expect(verifyTurnstile("segredo", "x", null)).resolves.toBe(false);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run tests/webchat-origin.test.ts tests/webchat-rate-limit.test.ts tests/webchat-turnstile.test.ts`
Expected: FAIL nos três — módulos não encontrados.

- [ ] **Step 5: Implementar a origem e o CORS**

```ts
// lib/webchat/origin.ts

/** Reduz uma entrada a esquema + domínio + porta. Devolve null se não for http(s). */
export function normalizeOrigin(valor: string): string | null {
  try {
    const url = new URL(valor.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Comparação exata contra a lista do canal — sem curinga, sem casar sufixo. */
export function isOriginAllowed(origin: string | null, permitidas: string[]): boolean {
  if (!origin) return false;
  const alvo = normalizeOrigin(origin);
  if (!alvo) return false;
  return permitidas.some((permitida) => normalizeOrigin(permitida) === alvo);
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-webchat-key, x-webchat-token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
```

- [ ] **Step 6: Implementar os limites**

```ts
// lib/webchat/rate-limit.ts

/** Limites da seção 10 da especificação, por sessão E por IP. */
export const LIMITE_POR_MINUTO = 20;
export const LIMITE_POR_DIA = 200;

const JANELA_MINUTO_MS = 60_000;
const JANELA_DIA_MS = 24 * 60 * 60 * 1000;
/** Teto de chaves na memória do processo; estourou, zera tudo (mesma ideia do middleware). */
const TETO_DE_CHAVES = 20_000;

type Balde = { contagem: number; expiraEm: number };

const baldes = new Map<string, Balde>();

function ler(chave: string, janelaMs: number, agora: number): Balde {
  const balde = baldes.get(chave);
  if (balde && balde.expiraEm > agora) return balde;
  return { contagem: 0, expiraEm: agora + janelaMs };
}

/**
 * Confere as quatro janelas (minuto e dia, por sessão e por IP) ANTES de gastar
 * qualquer cota: requisição barrada não consome nada — senão quem insiste
 * queimaria o teto diário só batendo na porta.
 *
 * A memória é do processo. Com mais de uma réplica no Easypanel, o limite passa
 * a valer por réplica; só vira limite global com armazenamento compartilhado.
 */
export function checkWebchatLimits(
  chaves: { sessionKey: string; ipKey: string },
  agora: number = Date.now(),
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  if (baldes.size > TETO_DE_CHAVES) baldes.clear();

  const alvos = [
    { chave: `m:s:${chaves.sessionKey}`, janela: JANELA_MINUTO_MS, teto: LIMITE_POR_MINUTO },
    { chave: `m:i:${chaves.ipKey}`, janela: JANELA_MINUTO_MS, teto: LIMITE_POR_MINUTO },
    { chave: `d:s:${chaves.sessionKey}`, janela: JANELA_DIA_MS, teto: LIMITE_POR_DIA },
    { chave: `d:i:${chaves.ipKey}`, janela: JANELA_DIA_MS, teto: LIMITE_POR_DIA },
  ];

  const lidos = alvos.map((alvo) => ({ alvo, balde: ler(alvo.chave, alvo.janela, agora) }));
  const estourado = lidos.find(({ alvo, balde }) => balde.contagem >= alvo.teto);
  if (estourado) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((estourado.balde.expiraEm - agora) / 1000)),
    };
  }

  for (const { alvo, balde } of lidos) {
    baldes.set(alvo.chave, { contagem: balde.contagem + 1, expiraEm: balde.expiraEm });
  }
  return { ok: true };
}

/** APENAS para testes. */
export function __resetWebchatLimits(): void {
  baldes.clear();
}
```

- [ ] **Step 7: Implementar o Turnstile**

```ts
// lib/webchat/turnstile.ts
import { logError } from "@/lib/logger";

const URL_VERIFICACAO = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TEMPO_LIMITE_MS = 5000;

/**
 * Confere o desafio do Cloudflare. Canal sem `turnstileSecret` (ambiente de
 * teste) passa direto; qualquer falha de rede ou resposta ruim recusa.
 */
export async function verifyTurnstile(
  secret: string | null,
  token: string | null,
  ip: string | null,
): Promise<boolean> {
  if (!secret) return true;
  if (!token || token.length > 2048) return false;

  try {
    const corpo = new URLSearchParams({ secret, response: token });
    if (ip) corpo.set("remoteip", ip);
    const resposta = await fetch(URL_VERIFICACAO, {
      method: "POST",
      body: corpo,
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!resposta.ok) return false;
    const json = (await resposta.json()) as { success?: boolean };
    return json.success === true;
  } catch (err) {
    logError("webchat.turnstile", err);
    return false;
  }
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run tests/webchat-origin.test.ts tests/webchat-rate-limit.test.ts tests/webchat-turnstile.test.ts && npx tsc --noEmit`
Expected: 12 testes passando.

- [ ] **Step 9: Commit**

```bash
npx biome check --write lib/webchat tests/webchat-origin.test.ts tests/webchat-rate-limit.test.ts tests/webchat-turnstile.test.ts
git add lib/webchat tests/webchat-origin.test.ts tests/webchat-rate-limit.test.ts tests/webchat-turnstile.test.ts
git commit -m "feat(webchat): origem permitida, limites de uso e Turnstile"
```

---

### Task 4: Leituras do canal e porta de entrada das rotas públicas

**Files:**
- Create: `lib/webchat/queries.ts`
- Create: `app/api/public/webchat/_lib/guard.ts`
- Test: `tests/webchat-guard.test.ts`

**Interfaces:**
- Consumes: `verifySessionToken` (Task 2); `isOriginAllowed`, `corsHeaders` (Task 3); `webchatConfigSchema` (Task 1); `createServiceClient` de `@/lib/supabase/service`.
- Produces (`lib/webchat/queries.ts`):
  - `type WebchatChannel = { id: string; organizationId: string; agentId: string | null; config: WebchatConfig }`
  - `type PublicMessage = { id: string; from: "cliente" | "especialista"; by: "cliente" | "ia" | "vendedor"; body: string; createdAt: string; externalId: string | null; event: "handoff_whatsapp" | null }` — `from` é o que o widget mostra; `by` distingue a IA de uma pessoa (usado pelo evento `vendedor_entrou` do SSE).
  - `loadWebchatChannelByKey(publicKey: string): Promise<WebchatChannel | null>`
  - `loadWebchatChannelById(channelId: string): Promise<WebchatChannel | null>`
  - `findConversationId(channelId: string, visitorId: string): Promise<string | null>`
  - `listPublicMessages(conversationId: string, opts?: { after?: string; limit?: number }): Promise<PublicMessage[]>`
  - `loadAgentStatus(conversationId: string): Promise<"idle" | "thinking" | "paused_handoff">`
- Produces (`app/api/public/webchat/_lib/guard.ts`):
  - `clientIp(req: Request): string`
  - `jsonCors(body: unknown, status: number, origin: string, extras?: Record<string, string>): Response`
  - `erro(mensagem: string, status: number, origin: string | null, extras?: Record<string, string>): Response`
  - `preflight(req: Request): Promise<Response>`
  - `temToken(req: Request): boolean`
  - `autorizarPorChave(req: Request): Promise<{ channel: WebchatChannel; origin: string } | Response>`
  - `autorizarPorToken(req: Request): Promise<{ channel: WebchatChannel; session: WebchatSession; origin: string } | Response>`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/webchat-guard.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/webchat/queries", () => ({
  loadWebchatChannelByKey: vi.fn(),
  loadWebchatChannelById: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { autorizarPorChave, autorizarPorToken, clientIp, preflight, temToken } from "@/app/api/public/webchat/_lib/guard";
import { loadWebchatChannelById, loadWebchatChannelByKey } from "@/lib/webchat/queries";
import { signSessionToken } from "@/lib/webchat/session-token";

const CANAL_ID = "3f4a1e16-0d2b-4c77-9f6e-7f7a1b2c3d4e";
const SEGREDO = "s".repeat(64);
const canal = {
  id: CANAL_ID,
  organizationId: "org-1",
  agentId: null,
  config: {
    allowedOrigins: ["https://m10abrasivos.com.br"],
    sessionSecret: SEGREDO,
    turnstileSecret: null,
    whatsappNumber: null,
  },
};

const porChave = loadWebchatChannelByKey as unknown as ReturnType<typeof vi.fn>;
const porId = loadWebchatChannelById as unknown as ReturnType<typeof vi.fn>;

function req(headers: Record<string, string>): Request {
  return new Request("https://crm.exemplo/api/public/webchat/session", {
    method: "POST",
    headers,
  });
}

describe("porta de entrada do webchat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    porChave.mockResolvedValue(canal);
    porId.mockResolvedValue(canal);
  });

  it("aceita chave pública com origem permitida", async () => {
    const r = await autorizarPorChave(
      req({ "x-webchat-key": "m10chat_abc", origin: "https://m10abrasivos.com.br" }),
    );
    expect(r).not.toBeInstanceOf(Response);
    if (!(r instanceof Response)) expect(r.channel.id).toBe(CANAL_ID);
  });

  it("recusa chave desconhecida com 401 e origem de fora com 403", async () => {
    porChave.mockResolvedValue(null);
    const semCanal = await autorizarPorChave(
      req({ "x-webchat-key": "m10chat_x", origin: "https://m10abrasivos.com.br" }),
    );
    expect((semCanal as Response).status).toBe(401);

    porChave.mockResolvedValue(canal);
    const foraDaLista = await autorizarPorChave(
      req({ "x-webchat-key": "m10chat_abc", origin: "https://evil.com" }),
    );
    expect((foraDaLista as Response).status).toBe(403);
    expect((foraDaLista as Response).headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("aceita token válido e recusa token de outro segredo", async () => {
    const token = signSessionToken({ channelId: CANAL_ID, visitorId: "visitante-1" }, SEGREDO);
    const ok = await autorizarPorToken(
      req({ "x-webchat-token": token, origin: "https://m10abrasivos.com.br" }),
    );
    expect(ok).not.toBeInstanceOf(Response);
    if (!(ok instanceof Response)) expect(ok.session.visitorId).toBe("visitante-1");

    const forjado = signSessionToken({ channelId: CANAL_ID, visitorId: "visitante-2" }, "x".repeat(64));
    const recusado = await autorizarPorToken(
      req({ "x-webchat-token": forjado, origin: "https://m10abrasivos.com.br" }),
    );
    expect((recusado as Response).status).toBe(401);
  });

  it("não consulta o banco quando o token não tem canal válido", async () => {
    const r = await autorizarPorToken(
      req({ "x-webchat-token": "lixo.lixo", origin: "https://m10abrasivos.com.br" }),
    );
    expect((r as Response).status).toBe(401);
    expect(porId).not.toHaveBeenCalled();
  });

  it("responde ao preflight sem tocar no banco quando não há chave", async () => {
    const r = await preflight(req({ origin: "https://m10abrasivos.com.br" }));
    expect(r.status).toBe(204);
  });

  it("reconhece a presença do token e resolve o IP", () => {
    expect(temToken(req({ "x-webchat-token": "abc" }))).toBe(true);
    expect(temToken(req({}))).toBe(false);
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("local"); // sem TRUST_PROXY
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/webchat-guard.test.ts`
Expected: FAIL — módulos não encontrados.

- [ ] **Step 3: Implementar as leituras**

```ts
// lib/webchat/queries.ts
import { logError } from "@/lib/logger";
import {
  type WebchatConfig,
  webchatConfigSchema,
} from "@/lib/messaging/adapters/webchat/schema";
import { createServiceClient } from "@/lib/supabase/service";

export type WebchatChannel = {
  id: string;
  organizationId: string;
  agentId: string | null;
  config: WebchatConfig;
};

export type PublicMessage = {
  id: string;
  /** O que o widget mostra. */
  from: "cliente" | "especialista";
  /** Quem escreveu de verdade: o visitante, a IA ou uma pessoa da equipe. */
  by: "cliente" | "ia" | "vendedor";
  body: string;
  createdAt: string;
  externalId: string | null;
  event: "handoff_whatsapp" | null;
};

const COLUNAS_CANAL = "id, organization_id, agent_id, config, type";

type LinhaCanal = {
  id: string;
  organization_id: string;
  agent_id: string | null;
  config: unknown;
  type: string;
};

/**
 * As rotas do webchat não têm sessão de usuário, então a leitura é feita com o
 * service client. Toda a autorização acontece antes: chave pública do canal,
 * origem permitida e token assinado.
 */
function montarCanal(linha: LinhaCanal | null): WebchatChannel | null {
  if (!linha || linha.type !== "webchat") return null;
  const config = webchatConfigSchema.safeParse(linha.config);
  if (!config.success) {
    logError("webchat.queries.config", { code: "config_invalida", channelId: linha.id });
    return null;
  }
  return {
    id: linha.id,
    organizationId: linha.organization_id,
    agentId: linha.agent_id,
    config: config.data,
  };
}

export async function loadWebchatChannelByKey(publicKey: string): Promise<WebchatChannel | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("channels")
    .select(COLUNAS_CANAL)
    .eq("external_id", publicKey)
    .eq("type", "webchat")
    .maybeSingle();
  if (error) {
    logError("webchat.queries.canal-por-chave", error);
    return null;
  }
  return montarCanal(data as LinhaCanal | null);
}

export async function loadWebchatChannelById(channelId: string): Promise<WebchatChannel | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("channels")
    .select(COLUNAS_CANAL)
    .eq("id", channelId)
    .maybeSingle();
  if (error) {
    logError("webchat.queries.canal-por-id", error);
    return null;
  }
  return montarCanal(data as LinhaCanal | null);
}

/** A conversa é criada pelo router na primeira mensagem; antes disso não existe. */
export async function findConversationId(
  channelId: string,
  visitorId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("channel_id", channelId)
    .eq("external_thread_id", visitorId)
    .maybeSingle();
  if (error) {
    logError("webchat.queries.conversa", error);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Mensagens que o visitante pode ver: sem notas internas, sem mensagens de
 * sistema (o aviso de contexto da página é para a inbox e para o prompt) e sem
 * as que falharam.
 */
export async function listPublicMessages(
  conversationId: string,
  opts: { after?: string; limit?: number } = {},
): Promise<PublicMessage[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("messages")
    .select("id, body, created_at, external_id, sender_kind, provider_metadata")
    .eq("conversation_id", conversationId)
    .eq("is_internal", false)
    .in("sender_kind", ["contact", "bot", "user"])
    .neq("status", "failed")
    .order("created_at", { ascending: true })
    .limit(Math.min(opts.limit ?? 50, 200));
  if (opts.after) query = query.gt("created_at", opts.after);

  const { data, error } = await query;
  if (error) {
    logError("webchat.queries.mensagens", error);
    return [];
  }

  return (data ?? [])
    .filter((linha) => typeof linha.body === "string" && linha.body.length > 0)
    .map((linha) => {
      const metadata = (linha.provider_metadata ?? {}) as { webchat_event?: string };
      const by =
        linha.sender_kind === "contact"
          ? ("cliente" as const)
          : linha.sender_kind === "bot"
            ? ("ia" as const)
            : ("vendedor" as const);
      return {
        id: linha.id,
        from: by === "cliente" ? ("cliente" as const) : ("especialista" as const),
        by,
        body: linha.body as string,
        createdAt: linha.created_at,
        externalId: linha.external_id,
        event: metadata.webchat_event === "handoff_whatsapp" ? ("handoff_whatsapp" as const) : null,
      };
    });
}

export async function loadAgentStatus(
  conversationId: string,
): Promise<"idle" | "thinking" | "paused_handoff"> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("agent_status")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    logError("webchat.queries.agent-status", error);
    return "idle";
  }
  const status = data?.agent_status;
  return status === "thinking" || status === "paused_handoff" ? status : "idle";
}
```

- [ ] **Step 4: Implementar a porta de entrada**

```ts
// app/api/public/webchat/_lib/guard.ts
import { corsHeaders, isOriginAllowed } from "@/lib/webchat/origin";
import {
  loadWebchatChannelById,
  loadWebchatChannelByKey,
  type WebchatChannel,
} from "@/lib/webchat/queries";
import { verifySessionToken, type WebchatSession } from "@/lib/webchat/session-token";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIXO_CHAVE = "m10chat_";

/**
 * Só confia em `x-forwarded-for` quando o app está atrás de proxy conhecido
 * (mesma regra do `middleware.ts`). Sem isso, qualquer visitante escolheria o
 * próprio IP e furaria o limite.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY !== "1") return "local";
  const encaminhado = req.headers.get("x-forwarded-for");
  return encaminhado?.split(",")[0]?.trim() || "desconhecido";
}

export function jsonCors(
  body: unknown,
  status: number,
  origin: string,
  extras: Record<string, string> = {},
): Response {
  return Response.json(body, { status, headers: { ...corsHeaders(origin), ...extras } });
}

/** Erro sem CORS quando a origem não é confiável: o navegador nem lê a resposta. */
export function erro(
  mensagem: string,
  status: number,
  origin: string | null,
  extras: Record<string, string> = {},
): Response {
  const headers = origin ? { ...corsHeaders(origin), ...extras } : extras;
  return Response.json({ error: mensagem }, { status, headers });
}

export function temToken(req: Request): boolean {
  return Boolean(req.headers.get("x-webchat-token"));
}

/**
 * Pedido de outra origem sempre traz o cabeçalho `Origin`. Quando ele falta, o
 * pedido é da mesma origem do CRM (é o caso do `EventSource` na página de
 * teste) ou não veio de navegador — e aí a origem considerada é a do próprio
 * CRM, que precisa estar na lista do canal como qualquer outra.
 */
function origemDoPedido(req: Request): string {
  return req.headers.get("origin") ?? new URL(req.url).origin;
}

/** Preflight: só ecoa a origem se ela estiver na lista do canal da chave enviada. */
export async function preflight(req: Request): Promise<Response> {
  const origin = origemDoPedido(req);
  const chave = req.headers.get("x-webchat-key") ?? "";
  if (!chave.startsWith(PREFIXO_CHAVE)) return new Response(null, { status: 204 });

  const channel = await loadWebchatChannelByKey(chave);
  if (!channel || !isOriginAllowed(origin, channel.config.allowedOrigins)) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function autorizarPorChave(
  req: Request,
): Promise<{ channel: WebchatChannel; origin: string } | Response> {
  const origin = origemDoPedido(req);
  const chave = req.headers.get("x-webchat-key") ?? "";
  if (!chave.startsWith(PREFIXO_CHAVE) || chave.length > 200) {
    return erro("Chave do chat inválida.", 401, null);
  }
  const channel = await loadWebchatChannelByKey(chave);
  if (!channel) return erro("Chave do chat inválida.", 401, null);
  if (!isOriginAllowed(origin, channel.config.allowedOrigins)) {
    return erro("Este site não está autorizado a usar o chat.", 403, null);
  }
  return { channel, origin };
}

export async function autorizarPorToken(
  req: Request,
): Promise<{ channel: WebchatChannel; session: WebchatSession; origin: string } | Response> {
  const origin = origemDoPedido(req);
  const token = req.headers.get("x-webchat-token");
  const channelId = lerChannelIdSemConferir(token);
  if (!channelId) return erro("Sessão inválida. Recarregue a página.", 401, null);

  const channel = await loadWebchatChannelById(channelId);
  if (!channel) return erro("Sessão inválida. Recarregue a página.", 401, null);

  const session = verifySessionToken(token, channel.config.sessionSecret);
  if (!session || session.channelId !== channel.id) {
    return erro("Sessão inválida. Recarregue a página.", 401, null);
  }
  if (!isOriginAllowed(origin, channel.config.allowedOrigins)) {
    return erro("Este site não está autorizado a usar o chat.", 403, null);
  }
  return { channel, session, origin };
}

/**
 * Lê o `channelId` do corpo do token SEM conferir a assinatura — é só para
 * saber qual segredo buscar. A conferência de verdade acontece logo depois,
 * em `verifySessionToken`. Só aceita UUID para não levar lixo ao banco.
 */
function lerChannelIdSemConferir(token: string | null): string | null {
  if (!token || token.length > 2000) return null;
  const ponto = token.lastIndexOf(".");
  if (ponto <= 0) return null;
  try {
    const corpo = JSON.parse(Buffer.from(token.slice(0, ponto), "base64url").toString("utf8")) as {
      channelId?: unknown;
    };
    return typeof corpo.channelId === "string" && UUID.test(corpo.channelId)
      ? corpo.channelId
      : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/webchat-guard.test.ts && npx tsc --noEmit`
Expected: 6 testes passando.

- [ ] **Step 6: Commit**

```bash
npx biome check --write lib/webchat/queries.ts "app/api/public/webchat/_lib/guard.ts" tests/webchat-guard.test.ts
git add lib/webchat/queries.ts app/api/public/webchat tests/webchat-guard.test.ts
git commit -m "feat(webchat): leituras do canal e porta de entrada das rotas públicas"
```

---

### Task 5: Rota de sessão

**Files:**
- Create: `app/api/public/webchat/session/route.ts`
- Test: `tests/webchat-route-session.test.ts`

**Interfaces:**
- Consumes: tudo das tarefas 2 a 4.
- Produces: `POST /api/public/webchat/session` e `OPTIONS`.
  - Entrada: cabeçalho `x-webchat-key` (primeira visita) **ou** `x-webchat-token` (retomada); corpo `{ turnstileToken?: string }`.
  - Saída 200: `{ data: { token, expiresAt, whatsappNumber, messages: PublicMessage[] } }`.
  - Erros: 401 chave/sessão inválida, 403 origem ou Turnstile, 429 limite.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/webchat-route-session.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/webchat/queries", () => ({
  loadWebchatChannelByKey: vi.fn(),
  loadWebchatChannelById: vi.fn(),
  findConversationId: vi.fn(),
  listPublicMessages: vi.fn(),
}));
vi.mock("@/lib/webchat/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { POST } from "@/app/api/public/webchat/session/route";
import {
  findConversationId,
  listPublicMessages,
  loadWebchatChannelById,
  loadWebchatChannelByKey,
} from "@/lib/webchat/queries";
import { __resetWebchatLimits } from "@/lib/webchat/rate-limit";
import { verifySessionToken } from "@/lib/webchat/session-token";
import { verifyTurnstile } from "@/lib/webchat/turnstile";

const CANAL_ID = "3f4a1e16-0d2b-4c77-9f6e-7f7a1b2c3d4e";
const SEGREDO = "s".repeat(64);
const ORIGEM = "https://m10abrasivos.com.br";
const canal = {
  id: CANAL_ID,
  organizationId: "org-1",
  agentId: "agente-1",
  config: {
    allowedOrigins: [ORIGEM],
    sessionSecret: SEGREDO,
    turnstileSecret: "segredo-cf",
    whatsappNumber: "5511999999999",
  },
};

const porChave = loadWebchatChannelByKey as unknown as ReturnType<typeof vi.fn>;
const porId = loadWebchatChannelById as unknown as ReturnType<typeof vi.fn>;
const acharConversa = findConversationId as unknown as ReturnType<typeof vi.fn>;
const listar = listPublicMessages as unknown as ReturnType<typeof vi.fn>;
const turnstile = verifyTurnstile as unknown as ReturnType<typeof vi.fn>;

function req(headers: Record<string, string>, body: unknown = {}): Request {
  return new Request("https://crm.exemplo/api/public/webchat/session", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGEM, ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/webchat/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetWebchatLimits();
    porChave.mockResolvedValue(canal);
    porId.mockResolvedValue(canal); // caminho da retomada por token
    acharConversa.mockResolvedValue(null);
    listar.mockResolvedValue([]);
    turnstile.mockResolvedValue(true);
  });

  it("abre sessão nova com token assinado e número de WhatsApp", async () => {
    const res = await POST(req({ "x-webchat-key": "m10chat_abc" }, { turnstileToken: "cf-ok" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGEM);

    const { data } = (await res.json()) as {
      data: { token: string; whatsappNumber: string; messages: unknown[] };
    };
    const sessao = verifySessionToken(data.token, SEGREDO);
    expect(sessao?.channelId).toBe(CANAL_ID);
    expect(sessao?.visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(data.whatsappNumber).toBe("5511999999999");
    expect(data.messages).toEqual([]);
    expect(turnstile).toHaveBeenCalledWith("segredo-cf", "cf-ok", null);
  });

  it("recusa quando o Turnstile falha", async () => {
    turnstile.mockResolvedValue(false);
    const res = await POST(req({ "x-webchat-key": "m10chat_abc" }, { turnstileToken: "ruim" }));
    expect(res.status).toBe(403);
  });

  it("retoma a sessão pelo token, devolve o histórico e não chama o Turnstile", async () => {
    const primeira = await POST(req({ "x-webchat-key": "m10chat_abc" }, { turnstileToken: "cf-ok" }));
    const { data } = (await primeira.json()) as { data: { token: string } };
    const visitante = verifySessionToken(data.token, SEGREDO)?.visitorId as string;

    vi.clearAllMocks();
    __resetWebchatLimits();
    porId.mockResolvedValue(canal);
    acharConversa.mockResolvedValue("conversa-1");
    listar.mockResolvedValue([
      { id: "m1", from: "cliente", body: "oi", createdAt: "2026-09-18T10:00:00Z", externalId: "c1", event: null },
    ]);

    const res = await POST(req({ "x-webchat-token": data.token }));
    expect(res.status).toBe(200);
    const corpo = (await res.json()) as { data: { token: string; messages: { id: string }[] } };
    expect(verifySessionToken(corpo.data.token, SEGREDO)?.visitorId).toBe(visitante);
    expect(corpo.data.messages[0]?.id).toBe("m1");
    expect(turnstile).not.toHaveBeenCalled();
    expect(acharConversa).toHaveBeenCalledWith(CANAL_ID, visitante);
  });

  it("barra o excesso de aberturas com 429 e Retry-After", async () => {
    for (let i = 0; i < 20; i++) {
      await POST(req({ "x-webchat-key": "m10chat_abc" }, { turnstileToken: "cf-ok" }));
    }
    const res = await POST(req({ "x-webchat-key": "m10chat_abc" }, { turnstileToken: "cf-ok" }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("recusa origem de fora da lista sem devolver cabeçalho de CORS", async () => {
    const res = await POST(
      req({ "x-webchat-key": "m10chat_abc", origin: "https://evil.com" }, { turnstileToken: "cf-ok" }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/webchat-route-session.test.ts`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar a rota**

```ts
// app/api/public/webchat/session/route.ts
import { randomUUID } from "node:crypto";
import { checkWebchatLimits } from "@/lib/webchat/rate-limit";
import { findConversationId, listPublicMessages } from "@/lib/webchat/queries";
import { SESSION_TTL_MS, signSessionToken } from "@/lib/webchat/session-token";
import { verifyTurnstile } from "@/lib/webchat/turnstile";
import {
  autorizarPorChave,
  autorizarPorToken,
  clientIp,
  erro,
  jsonCors,
  preflight,
  temToken,
} from "../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_HISTORICO = 50;

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req);
}

export async function POST(req: Request): Promise<Response> {
  const autorizacao = temToken(req) ? await autorizarPorToken(req) : await autorizarPorChave(req);
  if (autorizacao instanceof Response) return autorizacao;

  const { channel, origin } = autorizacao;
  const visitanteConhecido = "session" in autorizacao ? autorizacao.session.visitorId : null;
  const ip = clientIp(req);

  const limites = checkWebchatLimits({
    sessionKey: visitanteConhecido ?? `abertura:${ip}`,
    ipKey: ip,
  });
  if (!limites.ok) {
    return erro("Muitas tentativas. Tente de novo em instantes.", 429, origin, {
      "Retry-After": String(limites.retryAfterSeconds),
    });
  }

  // Turnstile só na primeira visita: quem já tem token assinado provou ser o
  // mesmo visitante.
  if (!visitanteConhecido) {
    const corpo = await lerCorpo(req);
    const humano = await verifyTurnstile(
      channel.config.turnstileSecret,
      corpo.turnstileToken,
      ip === "local" ? null : ip,
    );
    if (!humano) {
      return erro("Não foi possível confirmar que você não é um robô.", 403, origin);
    }
  }

  const visitorId = visitanteConhecido ?? randomUUID();
  const conversationId = await findConversationId(channel.id, visitorId);
  const messages = conversationId
    ? await listPublicMessages(conversationId, { limit: LIMITE_HISTORICO })
    : [];

  return jsonCors(
    {
      data: {
        token: signSessionToken({ channelId: channel.id, visitorId }, channel.config.sessionSecret),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        whatsappNumber: channel.config.whatsappNumber,
        messages,
      },
    },
    200,
    origin,
  );
}

async function lerCorpo(req: Request): Promise<{ turnstileToken: string | null }> {
  try {
    const bruto = (await req.json()) as { turnstileToken?: unknown };
    return {
      turnstileToken: typeof bruto.turnstileToken === "string" ? bruto.turnstileToken : null,
    };
  } catch {
    return { turnstileToken: null };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/webchat-route-session.test.ts && npx tsc --noEmit`
Expected: 5 testes passando.

- [ ] **Step 5: Commit**

```bash
npx biome check --write "app/api/public/webchat/session/route.ts" tests/webchat-route-session.test.ts
git add app/api/public/webchat/session tests/webchat-route-session.test.ts
git commit -m "feat(webchat): rota de abertura e retomada de sessão"
```

---

### Task 6: Rota de mensagens (enviar e ler a partir de um cursor)

**Files:**
- Create: `lib/webchat/page-context.ts`
- Create: `app/api/public/webchat/messages/route.ts`
- Test: `tests/webchat-route-messages.test.ts`

**Interfaces:**
- Consumes: `autorizarPorToken`, `clientIp`, `erro`, `jsonCors`, `preflight` (Task 4); `checkWebchatLimits` (Task 3); `findConversationId`, `listPublicMessages`, `loadAgentStatus` (Task 4); `processInboundMessage(channelType, event)` de `@/lib/messaging/router`.
- Produces:
  - `type PageContext = { url: string | null; item: string | null }`
  - `registrarContextoDaPagina(canal: { id: string; organizationId: string }, visitorId: string, contexto: PageContext): Promise<void>`
  - `POST /api/public/webchat/messages` — corpo `{ clientMessageId: string; body: string; pageContext?: { url?: string; item?: string } }`; resposta 202 `{ data: { ok: true, clientMessageId } }`.
  - `GET /api/public/webchat/messages?after=<ISO>` — resposta 200 `{ data: { messages: PublicMessage[]; typing: boolean } }`.

> O `clientMessageId` vira `external_id` da mensagem. É ele que faz o `UNIQUE (conversation_id, external_id)` descartar reenvio e duplo clique — sem ele, `external_id` ficaria nulo e o Postgres não deduplica nulos.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/webchat-route-messages.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/webchat/queries", () => ({
  loadWebchatChannelById: vi.fn(),
  loadWebchatChannelByKey: vi.fn(),
  findConversationId: vi.fn(),
  listPublicMessages: vi.fn(),
  loadAgentStatus: vi.fn(),
}));
vi.mock("@/lib/messaging/router", () => ({ processInboundMessage: vi.fn() }));
vi.mock("@/lib/webchat/page-context", () => ({ registrarContextoDaPagina: vi.fn() }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => Promise.resolve(fn()) }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { GET, POST } from "@/app/api/public/webchat/messages/route";
import { processInboundMessage } from "@/lib/messaging/router";
import { registrarContextoDaPagina } from "@/lib/webchat/page-context";
import {
  findConversationId,
  listPublicMessages,
  loadAgentStatus,
  loadWebchatChannelById,
} from "@/lib/webchat/queries";
import { __resetWebchatLimits } from "@/lib/webchat/rate-limit";
import { signSessionToken } from "@/lib/webchat/session-token";

const CANAL_ID = "3f4a1e16-0d2b-4c77-9f6e-7f7a1b2c3d4e";
const SEGREDO = "s".repeat(64);
const ORIGEM = "https://m10abrasivos.com.br";
const canal = {
  id: CANAL_ID,
  organizationId: "org-1",
  agentId: "agente-1",
  config: {
    allowedOrigins: [ORIGEM],
    sessionSecret: SEGREDO,
    turnstileSecret: null,
    whatsappNumber: null,
  },
};
const token = signSessionToken({ channelId: CANAL_ID, visitorId: "visitante-1" }, SEGREDO);

const porId = loadWebchatChannelById as unknown as ReturnType<typeof vi.fn>;
const acharConversa = findConversationId as unknown as ReturnType<typeof vi.fn>;
const listar = listPublicMessages as unknown as ReturnType<typeof vi.fn>;
const status = loadAgentStatus as unknown as ReturnType<typeof vi.fn>;
const router = processInboundMessage as unknown as ReturnType<typeof vi.fn>;
const contexto = registrarContextoDaPagina as unknown as ReturnType<typeof vi.fn>;

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://crm.exemplo/api/public/webchat/messages", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGEM, "x-webchat-token": token, ...headers },
    body: JSON.stringify(body),
  });
}

describe("rota de mensagens do webchat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetWebchatLimits();
    porId.mockResolvedValue(canal);
    acharConversa.mockResolvedValue("conversa-1");
    listar.mockResolvedValue([]);
    status.mockResolvedValue("idle");
  });

  it("entrega a mensagem ao router com o id do canal e o contexto da página", async () => {
    const res = await POST(
      post({
        clientMessageId: "cli-1",
        body: "Qual abrasivo usar em quartzito?",
        pageContext: { url: "https://m10abrasivos.com.br/p/gt-400", item: "Green Turbo #400" },
      }),
    );
    expect(res.status).toBe(202);
    expect(router).toHaveBeenCalledTimes(1);
    const [tipo, evento] = router.mock.calls[0] as [string, Record<string, unknown>];
    expect(tipo).toBe("webchat");
    expect(evento).toMatchObject({
      kind: "message",
      externalThreadId: "visitante-1",
      externalMessageId: "cli-1",
      message: { body: "Qual abrasivo usar em quartzito?" },
      raw: { channelId: CANAL_ID },
    });
  });

  it("registra o aviso de contexto só quando a conversa é nova", async () => {
    acharConversa.mockResolvedValue(null);
    await POST(
      post({ clientMessageId: "cli-1", body: "oi", pageContext: { item: "Green Turbo #400" } }),
    );
    expect(contexto).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    acharConversa.mockResolvedValue("conversa-1");
    await POST(
      post({ clientMessageId: "cli-2", body: "oi de novo", pageContext: { item: "Green Turbo #400" } }),
    );
    expect(contexto).not.toHaveBeenCalled();
  });

  it("recusa corpo inválido, vazio e acima de 1000 caracteres", async () => {
    expect((await POST(post({ body: "sem id" }))).status).toBe(400);
    expect((await POST(post({ clientMessageId: "c", body: "   " }))).status).toBe(400);
    expect((await POST(post({ clientMessageId: "c", body: "a".repeat(1001) }))).status).toBe(400);
    expect(router).not.toHaveBeenCalled();
  });

  it("barra o excesso com 429", async () => {
    for (let i = 0; i < 20; i++) await POST(post({ clientMessageId: `c${i}`, body: "oi" }));
    const res = await POST(post({ clientMessageId: "estouro", body: "oi" }));
    expect(res.status).toBe(429);
  });

  it("lê mensagens a partir do cursor e informa se a IA está digitando", async () => {
    listar.mockResolvedValue([
      {
        id: "m2",
        from: "especialista",
        by: "ia",
        body: "Recomendo o #400.",
        createdAt: "2026-09-18T10:00:05Z",
        externalId: "web_1",
        event: null,
      },
    ]);
    status.mockResolvedValue("thinking");

    const res = await GET(
      new Request(
        "https://crm.exemplo/api/public/webchat/messages?after=2026-09-18T10:00:00.000Z",
        { headers: { origin: ORIGEM, "x-webchat-token": token } },
      ),
    );
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { messages: { id: string }[]; typing: boolean };
    };
    expect(data.messages[0]?.id).toBe("m2");
    expect(data.typing).toBe(true);
    expect(listar).toHaveBeenCalledWith("conversa-1", {
      after: "2026-09-18T10:00:00.000Z",
      limit: 100,
    });
  });

  it("ignora cursor inválido em vez de quebrar", async () => {
    await GET(
      new Request("https://crm.exemplo/api/public/webchat/messages?after=ontem", {
        headers: { origin: ORIGEM, "x-webchat-token": token },
      }),
    );
    expect(listar).toHaveBeenCalledWith("conversa-1", { after: undefined, limit: 100 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/webchat-route-messages.test.ts`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar o aviso de contexto da página**

```ts
// lib/webchat/page-context.ts
import { logError } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import { findConversationId } from "./queries";

export type PageContext = { url: string | null; item: string | null };

/**
 * Grava, uma única vez por conversa, a nota de sistema que diz de onde o
 * cliente veio (seção 5.4 da especificação). Ela aparece na inbox e entra no
 * histórico que o agente lê — por isso `is_internal` fica falso.
 *
 * Roda depois da primeira mensagem, porque é o router que cria a conversa.
 * O `external_id` fixo por visitante faz o UNIQUE recusar uma segunda nota.
 */
export async function registrarContextoDaPagina(
  canal: { id: string; organizationId: string },
  visitorId: string,
  contexto: PageContext,
): Promise<void> {
  if (!contexto.item && !contexto.url) return;
  const conversationId = await findConversationId(canal.id, visitorId);
  if (!conversationId) return;

  const onde = contexto.item ? `na página de ${contexto.item}` : `em ${contexto.url}`;
  const supabase = createServiceClient();
  const { error } = await supabase.from("messages").insert({
    organization_id: canal.organizationId,
    conversation_id: conversationId,
    direction: "inbound",
    sender_kind: "system",
    body: `Cliente abriu o chat ${onde}`,
    status: "delivered",
    external_id: `ctx_${visitorId}`,
    provider_metadata: { webchat_page_context: contexto } as never,
    sent_at: new Date().toISOString(),
  });
  // 23505 = a nota já existia nesta conversa. Não é erro.
  if (error && (error as { code?: string }).code !== "23505") {
    logError("webchat.page-context", error);
  }
}
```

- [ ] **Step 4: Implementar a rota**

```ts
// app/api/public/webchat/messages/route.ts
import { after } from "next/server";
import "@/lib/messaging"; // registra os adapters (inclusive o webchat)
import { processInboundMessage } from "@/lib/messaging/router";
import { logError } from "@/lib/logger";
import { type PageContext, registrarContextoDaPagina } from "@/lib/webchat/page-context";
import { findConversationId, listPublicMessages, loadAgentStatus } from "@/lib/webchat/queries";
import { checkWebchatLimits } from "@/lib/webchat/rate-limit";
import { autorizarPorToken, clientIp, erro, jsonCors, preflight } from "../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TAMANHO_MAXIMO_MENSAGEM = 1000;
const LIMITE_LEITURA = 100;

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req);
}

export async function POST(req: Request): Promise<Response> {
  const autorizacao = await autorizarPorToken(req);
  if (autorizacao instanceof Response) return autorizacao;
  const { channel, session, origin } = autorizacao;

  const ip = clientIp(req);
  const limites = checkWebchatLimits({ sessionKey: session.visitorId, ipKey: ip });
  if (!limites.ok) {
    return erro("Você enviou muitas mensagens. Aguarde um instante.", 429, origin, {
      "Retry-After": String(limites.retryAfterSeconds),
    });
  }

  const entrada = await lerEntrada(req);
  if (!entrada) return erro("Mensagem inválida.", 400, origin);

  // Saber se a conversa já existe ANTES do router é o que define se esta é a
  // primeira mensagem (e, portanto, se cabe a nota de contexto da página).
  const conversaAnterior = await findConversationId(channel.id, session.visitorId);

  after(async () => {
    try {
      await processInboundMessage("webchat", {
        kind: "message",
        externalThreadId: session.visitorId,
        externalMessageId: entrada.clientMessageId,
        timestamp: new Date().toISOString(),
        message: { body: entrada.body },
        raw: { channelId: channel.id, pageContext: entrada.pageContext },
      });
      if (!conversaAnterior && entrada.pageContext) {
        await registrarContextoDaPagina(
          { id: channel.id, organizationId: channel.organizationId },
          session.visitorId,
          entrada.pageContext,
        );
      }
    } catch (err) {
      logError("webchat.messages.processar", err);
    }
  });

  // 202: a mensagem foi aceita; a resposta do especialista chega pelo SSE.
  return jsonCors({ data: { ok: true, clientMessageId: entrada.clientMessageId } }, 202, origin);
}

export async function GET(req: Request): Promise<Response> {
  const autorizacao = await autorizarPorToken(req);
  if (autorizacao instanceof Response) return autorizacao;
  const { channel, session, origin } = autorizacao;

  const conversationId = await findConversationId(channel.id, session.visitorId);
  if (!conversationId) return jsonCors({ data: { messages: [], typing: false } }, 200, origin);

  const bruto = new URL(req.url).searchParams.get("after");
  const after = bruto && !Number.isNaN(Date.parse(bruto)) ? bruto : undefined;

  const [messages, agentStatus] = await Promise.all([
    listPublicMessages(conversationId, { after, limit: LIMITE_LEITURA }),
    loadAgentStatus(conversationId),
  ]);

  return jsonCors({ data: { messages, typing: agentStatus === "thinking" } }, 200, origin);
}

type Entrada = { clientMessageId: string; body: string; pageContext: PageContext | null };

async function lerEntrada(req: Request): Promise<Entrada | null> {
  let bruto: { clientMessageId?: unknown; body?: unknown; pageContext?: unknown };
  try {
    bruto = (await req.json()) as typeof bruto;
  } catch {
    return null;
  }

  const clientMessageId = typeof bruto.clientMessageId === "string" ? bruto.clientMessageId.trim() : "";
  const body = typeof bruto.body === "string" ? bruto.body.trim() : "";
  if (!clientMessageId || clientMessageId.length > 100) return null;
  if (!body || body.length > TAMANHO_MAXIMO_MENSAGEM) return null;

  const contexto = (bruto.pageContext ?? null) as { url?: unknown; item?: unknown } | null;
  const pageContext: PageContext | null = contexto
    ? {
        url: typeof contexto.url === "string" ? contexto.url.slice(0, 300) : null,
        item: typeof contexto.item === "string" ? contexto.item.slice(0, 120) : null,
      }
    : null;

  return { clientMessageId, body, pageContext };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/webchat-route-messages.test.ts && npx tsc --noEmit`
Expected: 6 testes passando.

- [ ] **Step 6: Commit**

```bash
npx biome check --write lib/webchat/page-context.ts "app/api/public/webchat/messages/route.ts" tests/webchat-route-messages.test.ts
git add lib/webchat/page-context.ts app/api/public/webchat/messages tests/webchat-route-messages.test.ts
git commit -m "feat(webchat): rota de envio e leitura de mensagens"
```

---

### Task 7: SSE — mensagens, "digitando", entrada do vendedor e passagem para o WhatsApp

**Files:**
- Create: `app/api/public/webchat/stream/route.ts`
- Test: `tests/webchat-route-stream.test.ts`

**Interfaces:**
- Consumes: `autorizarPorToken`, `preflight` (Task 4); `findConversationId`, `listPublicMessages`, `loadAgentStatus` (Task 4).
- Produces: `GET /api/public/webchat/stream?after=<ISO>` com `Content-Type: text/event-stream`. Eventos:
  - `mensagem` → `PublicMessage`
  - `digitando` → `{ digitando: boolean }`
  - `vendedor_entrou` → `{ em: string }` (primeira mensagem de pessoa, `by === "vendedor"`)
  - `handoff_whatsapp` → `{ mensagemId: string }`
  - `reconectar` → `{}` (antes de fechar por tempo)
  - Comentário `: batida` a cada 20 s, para o proxy não derrubar a conexão.

> **Por que não usar o Realtime:** o broadcast `inbox:{org_id}` só é assinado no navegador de quem está logado (`inbox-shell.tsx`), e não existe cliente Realtime no servidor. Criar um seria estrear infraestrutura nova e depender da policy `to authenticated` de `realtime.messages`. A leitura curta a cada 1,5 s no mesmo processo entrega o mesmo resultado para 1 conversa por conexão, com código que qualquer um lê.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/webchat-route-stream.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/webchat/queries", () => ({
  loadWebchatChannelById: vi.fn(),
  loadWebchatChannelByKey: vi.fn(),
  findConversationId: vi.fn(),
  listPublicMessages: vi.fn(),
  loadAgentStatus: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { GET } from "@/app/api/public/webchat/stream/route";
import {
  findConversationId,
  listPublicMessages,
  loadAgentStatus,
  loadWebchatChannelById,
} from "@/lib/webchat/queries";
import { signSessionToken } from "@/lib/webchat/session-token";

const CANAL_ID = "3f4a1e16-0d2b-4c77-9f6e-7f7a1b2c3d4e";
const SEGREDO = "s".repeat(64);
const ORIGEM = "https://m10abrasivos.com.br";
const canal = {
  id: CANAL_ID,
  organizationId: "org-1",
  agentId: "agente-1",
  config: { allowedOrigins: [ORIGEM], sessionSecret: SEGREDO, turnstileSecret: null, whatsappNumber: null },
};
const token = signSessionToken({ channelId: CANAL_ID, visitorId: "visitante-1" }, SEGREDO);

const porId = loadWebchatChannelById as unknown as ReturnType<typeof vi.fn>;
const acharConversa = findConversationId as unknown as ReturnType<typeof vi.fn>;
const listar = listPublicMessages as unknown as ReturnType<typeof vi.fn>;
const status = loadAgentStatus as unknown as ReturnType<typeof vi.fn>;

function pedido(controlador: AbortController): Request {
  return new Request("https://crm.exemplo/api/public/webchat/stream", {
    headers: { origin: ORIGEM, "x-webchat-token": token },
    signal: controlador.signal,
  });
}

/** Lê o que já foi empurrado para o fluxo, sem travar quando ele continua aberto. */
async function lerTudo(res: Response, controlador: AbortController): Promise<string> {
  const leitor = (res.body as ReadableStream<Uint8Array>).getReader();
  const decodificador = new TextDecoder();
  let texto = "";
  const parar = setTimeout(() => controlador.abort(), 50);
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      texto += decodificador.decode(value, { stream: true });
    }
  } catch {
    // aborto esperado
  } finally {
    clearTimeout(parar);
  }
  return texto;
}

describe("SSE do webchat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    porId.mockResolvedValue(canal);
    acharConversa.mockResolvedValue("conversa-1");
    listar.mockResolvedValue([]);
    status.mockResolvedValue("idle");
  });
  afterEach(() => vi.useRealTimers());

  it("recusa token inválido antes de abrir o fluxo", async () => {
    const res = await GET(
      new Request("https://crm.exemplo/api/public/webchat/stream", {
        headers: { origin: ORIGEM, "x-webchat-token": "lixo" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("abre o fluxo com os cabeçalhos de SSE e CORS", async () => {
    const controlador = new AbortController();
    const res = await GET(pedido(controlador));
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGEM);
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
    controlador.abort();
  });

  it("empurra mensagem nova, aviso de digitando e entrada do vendedor", async () => {
    listar
      .mockResolvedValueOnce([
        {
          id: "m1",
          from: "especialista",
          by: "ia",
          body: "Recomendo o #400.",
          createdAt: "2026-09-18T10:00:05.000Z",
          externalId: "web_1",
          event: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "m2",
          from: "especialista",
          by: "vendedor",
          body: "Aqui é o Marcos.",
          createdAt: "2026-09-18T10:00:09.000Z",
          externalId: null,
          event: null,
        },
      ])
      .mockResolvedValue([]);
    status.mockResolvedValueOnce("thinking").mockResolvedValue("idle");

    const controlador = new AbortController();
    const res = await GET(pedido(controlador));
    await vi.advanceTimersByTimeAsync(3200); // dois tiques de 1,5 s
    const texto = await lerTudo(res, controlador);

    expect(texto).toContain("event: mensagem");
    expect(texto).toContain("Recomendo o #400.");
    expect(texto).toContain("event: digitando");
    expect(texto).toContain('"digitando":true');
    expect(texto).toContain("event: vendedor_entrou");
  });

  it("avisa a passagem para o WhatsApp", async () => {
    listar.mockResolvedValueOnce([
      {
        id: "m3",
        from: "especialista",
        by: "ia",
        body: "Posso te chamar no WhatsApp?",
        createdAt: "2026-09-18T10:01:00.000Z",
        externalId: "web_2",
        event: "handoff_whatsapp",
      },
    ]);
    const controlador = new AbortController();
    const res = await GET(pedido(controlador));
    await vi.advanceTimersByTimeAsync(1600);
    const texto = await lerTudo(res, controlador);
    expect(texto).toContain("event: handoff_whatsapp");
    expect(texto).toContain('"mensagemId":"m3"');
  });

  it("não repete a mesma mensagem no tique seguinte", async () => {
    listar.mockResolvedValueOnce([
      {
        id: "m1",
        from: "especialista",
        by: "ia",
        body: "Uma vez só.",
        createdAt: "2026-09-18T10:00:05.000Z",
        externalId: "web_1",
        event: null,
      },
    ]);
    const controlador = new AbortController();
    const res = await GET(pedido(controlador));
    await vi.advanceTimersByTimeAsync(3200);
    const texto = await lerTudo(res, controlador);
    expect(texto.match(/Uma vez só\./g)?.length).toBe(1);
    // O segundo tique pede a partir do cursor da mensagem já entregue.
    expect(listar).toHaveBeenLastCalledWith("conversa-1", {
      after: "2026-09-18T10:00:05.000Z",
      limit: 50,
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/webchat-route-stream.test.ts`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar o SSE**

```ts
// app/api/public/webchat/stream/route.ts
import { logError } from "@/lib/logger";
import { corsHeaders } from "@/lib/webchat/origin";
import { findConversationId, listPublicMessages, loadAgentStatus } from "@/lib/webchat/queries";
import { autorizarPorToken, preflight } from "../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Leitura curta no banco; é o que substitui o Realtime aqui. */
const INTERVALO_MS = 1500;
/** Comentário periódico para proxies não derrubarem a conexão ociosa. */
const BATIDA_MS = 20_000;
/** Conexão longa demais é reciclada; o widget reconecta sozinho. */
const DURACAO_MAXIMA_MS = 15 * 60 * 1000;
const MENSAGENS_POR_TIQUE = 50;

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req);
}

export async function GET(req: Request): Promise<Response> {
  const autorizacao = await autorizarPorToken(req);
  if (autorizacao instanceof Response) return autorizacao;
  const { channel, session, origin } = autorizacao;

  const inicial = new URL(req.url).searchParams.get("after");
  const codificador = new TextEncoder();

  const fluxo = new ReadableStream<Uint8Array>({
    start(controller) {
      let fechado = false;
      let cursor = inicial && !Number.isNaN(Date.parse(inicial)) ? inicial : new Date().toISOString();
      let digitando = false;
      let vendedorAnunciado = false;
      const abertoEm = Date.now();

      const enviar = (evento: string, dados: unknown) => {
        if (fechado) return;
        controller.enqueue(codificador.encode(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`));
      };

      const fechar = () => {
        if (fechado) return;
        fechado = true;
        clearInterval(tique);
        clearInterval(batida);
        try {
          controller.close();
        } catch {
          // já estava fechado
        }
      };

      const batida = setInterval(() => {
        if (!fechado) controller.enqueue(codificador.encode(": batida\n\n"));
      }, BATIDA_MS);

      const tique = setInterval(async () => {
        if (fechado) return;
        if (Date.now() - abertoEm > DURACAO_MAXIMA_MS) {
          enviar("reconectar", {});
          fechar();
          return;
        }
        try {
          const conversationId = await findConversationId(channel.id, session.visitorId);
          if (!conversationId) return; // conversa nasce na primeira mensagem

          const novas = await listPublicMessages(conversationId, {
            after: cursor,
            limit: MENSAGENS_POR_TIQUE,
          });
          for (const mensagem of novas) {
            cursor = mensagem.createdAt;
            if (mensagem.by === "vendedor" && !vendedorAnunciado) {
              vendedorAnunciado = true;
              enviar("vendedor_entrou", { em: mensagem.createdAt });
            }
            enviar("mensagem", mensagem);
            if (mensagem.event === "handoff_whatsapp") {
              enviar("handoff_whatsapp", { mensagemId: mensagem.id });
            }
          }

          const status = await loadAgentStatus(conversationId);
          const deveDigitar = status === "thinking";
          if (deveDigitar !== digitando) {
            digitando = deveDigitar;
            enviar("digitando", { digitando });
          }
        } catch (err) {
          logError("webchat.stream.tique", err);
        }
      }, INTERVALO_MS);

      req.signal.addEventListener("abort", fechar);
    },
  });

  return new Response(fluxo, {
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Desliga o buffer de proxies (nginx do Easypanel), senão nada chega na hora.
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/webchat-route-stream.test.ts && npx tsc --noEmit`
Expected: 5 testes passando.

- [ ] **Step 5: Rodar a suíte inteira e commitar**

Run: `npx vitest run`

```bash
npx biome check --write "app/api/public/webchat/stream/route.ts" tests/webchat-route-stream.test.ts
git add app/api/public/webchat/stream tests/webchat-route-stream.test.ts
git commit -m "feat(webchat): fluxo SSE com mensagens, digitando e passagem para o WhatsApp"
```

---

### Task 8: Criar e administrar o canal Site pela interface

**Files:**
- Create: `lib/webchat/public-key.ts`
- Create: `lib/messaging/adapters/webchat/action-schemas.ts`
- Create: `lib/messaging/adapters/webchat/actions.ts`
- Create: `app/(app)/app/[orgSlug]/settings/channels/_components/connect-webchat-dialog.tsx`
- Create: `app/(app)/app/[orgSlug]/settings/channels/webchat/[channelId]/page.tsx`
- Create: `app/(app)/app/[orgSlug]/settings/channels/webchat/[channelId]/_components/webchat-settings.tsx`
- Create: `app/(app)/app/[orgSlug]/settings/channels/webchat/[channelId]/_components/disconnect-button.tsx`
- Modify: `app/(app)/app/[orgSlug]/settings/channels/page.tsx` (botão e roteamento do detalhe)
- Test: `tests/webchat-actions.test.ts`

**Interfaces:**
- Produces:
  - `WEBCHAT_KEY_PREFIX = "m10chat_"`, `generateWebchatKey(): string`, `generateSessionSecret(): string`
  - `conectarWebchatAction(input): Promise<ActionResult<{ channelId: string; publicKey: string }>>`
  - `atualizarWebchatAction(input): Promise<ActionResult>`
  - `rotacionarChaveWebchatAction(input): Promise<ActionResult<{ publicKey: string }>>`
  - `desconectarWebchatAction(input): Promise<ActionResult>`
- Consumes: `requireOrgRole` de `@/lib/auth/guards`; `createClient` de `@/lib/supabase/server`; `revalidatePath`; `webchatConfigSchema` (Task 1).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/webchat-actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({ requireOrgRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { requireOrgRole } from "@/lib/auth/guards";
import {
  conectarWebchatAction,
  rotacionarChaveWebchatAction,
} from "@/lib/messaging/adapters/webchat/actions";
import { webchatConfigSchema } from "@/lib/messaging/adapters/webchat/schema";
import { createClient } from "@/lib/supabase/server";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const CANAL_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

const guard = requireOrgRole as unknown as ReturnType<typeof vi.fn>;
const cliente = createClient as unknown as ReturnType<typeof vi.fn>;

type Registro = { inserts: Record<string, unknown>[]; updates: Record<string, unknown>[] };

function supabaseFalso(): { sb: unknown; registro: Registro } {
  const registro: Registro = { inserts: [], updates: [] };
  const sb = {
    from() {
      return {
        insert(linha: Record<string, unknown>) {
          registro.inserts.push(linha);
          return {
            select: () => ({ single: async () => ({ data: { id: CANAL_ID }, error: null }) }),
          };
        },
        update(linha: Record<string, unknown>) {
          registro.updates.push(linha);
          return {
            eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
          };
        },
        select() {
          return {
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: CANAL_ID,
                      config: {
                        allowedOrigins: ["https://m10abrasivos.com.br"],
                        sessionSecret: "s".repeat(64),
                        turnstileSecret: null,
                        whatsappNumber: null,
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        },
      };
    },
  };
  return { sb, registro };
}

describe("actions do canal Site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.mockResolvedValue({ org: { id: ORG_ID }, user: { id: USER_ID } });
  });

  it("cria o canal com chave pública, segredo forte e config válida", async () => {
    const { sb, registro } = supabaseFalso();
    cliente.mockResolvedValue(sb);

    const r = await conectarWebchatAction({
      orgSlug: "m10abrasivos",
      name: "Site",
      allowedOrigins: ["https://m10abrasivos.com.br"],
      turnstileSecret: null,
      whatsappNumber: "5511999999999",
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data?.publicKey).toMatch(/^m10chat_/);
    const linha = registro.inserts[0] as Record<string, string | object>;
    expect(linha.type).toBe("webchat");
    expect(linha.organization_id).toBe(ORG_ID);
    expect(linha.created_by).toBe(USER_ID);
    expect(String(linha.external_id)).toMatch(/^m10chat_/);
    const config = webchatConfigSchema.parse(linha.config);
    expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.allowedOrigins).toEqual(["https://m10abrasivos.com.br"]);
  });

  it("recusa domínio inválido antes de tocar no banco", async () => {
    const { sb, registro } = supabaseFalso();
    cliente.mockResolvedValue(sb);
    const r = await conectarWebchatAction({
      orgSlug: "m10abrasivos",
      name: "Site",
      allowedOrigins: ["m10abrasivos.com.br"],
      turnstileSecret: null,
      whatsappNumber: null,
    });
    expect(r.ok).toBe(false);
    expect(registro.inserts).toHaveLength(0);
  });

  it("gerar chave nova troca chave e segredo (derruba as sessões abertas)", async () => {
    const { sb, registro } = supabaseFalso();
    cliente.mockResolvedValue(sb);
    const r = await rotacionarChaveWebchatAction({ orgSlug: "m10abrasivos", channelId: CANAL_ID });
    expect(r.ok).toBe(true);
    const update = registro.updates[0] as { external_id: string; config: { sessionSecret: string } };
    expect(update.external_id).toMatch(/^m10chat_/);
    expect(update.config.sessionSecret).not.toBe("s".repeat(64));
  });

  it("só owner e admin passam", async () => {
    guard.mockRejectedValue(new Error("sem permissão"));
    await expect(
      conectarWebchatAction({
        orgSlug: "m10abrasivos",
        name: "Site",
        allowedOrigins: ["https://m10abrasivos.com.br"],
        turnstileSecret: null,
        whatsappNumber: null,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/webchat-actions.test.ts`
Expected: FAIL — módulos não encontrados.

- [ ] **Step 3: Implementar a geração de chave e segredo**

```ts
// lib/webchat/public-key.ts
import { randomBytes } from "node:crypto";

/** Prefixo que identifica a chave do chat, como `m10cat_` faz no catálogo. */
export const WEBCHAT_KEY_PREFIX = "m10chat_";

/** Chave pública do widget. Vai para o navegador; não é segredo. */
export function generateWebchatKey(): string {
  return `${WEBCHAT_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

/** Segredo que assina os tokens de sessão. Nunca sai do servidor. */
export function generateSessionSecret(): string {
  return randomBytes(32).toString("hex");
}
```

- [ ] **Step 4: Implementar os schemas das actions**

```ts
// lib/messaging/adapters/webchat/action-schemas.ts
import { z } from "zod";

const origem = z
  .string()
  .min(1)
  .max(200)
  .refine((valor) => {
    try {
      const url = new URL(valor.trim());
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Informe o endereço completo do site, começando com https://");

const camposDoCanal = {
  allowedOrigins: z.array(origem).min(1, "Informe ao menos um site").max(10),
  turnstileSecret: z.string().max(200).nullable(),
  whatsappNumber: z
    .string()
    .regex(/^\d{10,15}$/, "Use só dígitos, com DDI e DDD (ex.: 5511999999999)")
    .nullable(),
};

export const conectarWebchatSchema = z.object({
  orgSlug: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  ...camposDoCanal,
});

export const atualizarWebchatSchema = z.object({
  orgSlug: z.string().min(1).max(80),
  channelId: z.guid(),
  ...camposDoCanal,
});

export const canalWebchatSchema = z.object({
  orgSlug: z.string().min(1).max(80),
  channelId: z.guid(),
});

export type ConectarWebchatInput = z.infer<typeof conectarWebchatSchema>;
export type AtualizarWebchatInput = z.infer<typeof atualizarWebchatSchema>;
export type CanalWebchatInput = z.infer<typeof canalWebchatSchema>;
```

- [ ] **Step 5: Implementar as actions**

```ts
// lib/messaging/adapters/webchat/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireOrgRole } from "@/lib/auth/guards";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";
import { generateSessionSecret, generateWebchatKey } from "@/lib/webchat/public-key";
import {
  type AtualizarWebchatInput,
  type CanalWebchatInput,
  type ConectarWebchatInput,
  atualizarWebchatSchema,
  canalWebchatSchema,
  conectarWebchatSchema,
} from "./action-schemas";
import { type WebchatConfig, webchatConfigSchema } from "./schema";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function revalidar(orgSlug: string, channelId?: string) {
  revalidatePath(`/app/${orgSlug}/settings/channels`);
  if (channelId) revalidatePath(`/app/${orgSlug}/settings/channels/webchat/${channelId}`);
}

export async function conectarWebchatAction(
  input: ConectarWebchatInput,
): Promise<ActionResult<{ channelId: string; publicKey: string }>> {
  const parsed = conectarWebchatSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { user, org } = await requireOrgRole({
    orgSlug: parsed.data.orgSlug,
    roles: ["owner", "admin"],
  });

  const publicKey = generateWebchatKey();
  const config: WebchatConfig = {
    allowedOrigins: parsed.data.allowedOrigins.map((o) => new URL(o.trim()).origin),
    sessionSecret: generateSessionSecret(),
    turnstileSecret: parsed.data.turnstileSecret,
    whatsappNumber: parsed.data.whatsappNumber,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channels")
    .insert({
      organization_id: org.id,
      type: "webchat",
      name: parsed.data.name,
      external_id: publicKey,
      config: config as unknown as Json,
      status: "connected",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    logError("webchat.actions.conectar", error);
    return { ok: false, error: "Não foi possível criar o canal do site. Tente de novo." };
  }

  revalidar(parsed.data.orgSlug, data.id);
  return { ok: true, data: { channelId: data.id, publicKey } };
}

export async function atualizarWebchatAction(input: AtualizarWebchatInput): Promise<ActionResult> {
  const parsed = atualizarWebchatSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { org } = await requireOrgRole({
    orgSlug: parsed.data.orgSlug,
    roles: ["owner", "admin"],
  });

  const atual = await lerConfig(parsed.data.channelId, org.id);
  if (!atual) return { ok: false, error: "Canal não encontrado." };

  const config: WebchatConfig = {
    ...atual,
    allowedOrigins: parsed.data.allowedOrigins.map((o) => new URL(o.trim()).origin),
    turnstileSecret: parsed.data.turnstileSecret,
    whatsappNumber: parsed.data.whatsappNumber,
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("channels")
    .update({ config: config as unknown as Json })
    .eq("id", parsed.data.channelId)
    .eq("organization_id", org.id)
    .eq("type", "webchat");

  if (error) {
    logError("webchat.actions.atualizar", error);
    return { ok: false, error: "Não foi possível salvar as configurações." };
  }
  revalidar(parsed.data.orgSlug, parsed.data.channelId);
  return { ok: true };
}

/**
 * Chave nova + segredo novo. Derruba todas as sessões abertas: quem estava
 * conversando no site precisa recarregar a página. É o botão a usar quando a
 * chave vazar ou quando o site for reinstalado.
 */
export async function rotacionarChaveWebchatAction(
  input: CanalWebchatInput,
): Promise<ActionResult<{ publicKey: string }>> {
  const parsed = canalWebchatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { org } = await requireOrgRole({
    orgSlug: parsed.data.orgSlug,
    roles: ["owner", "admin"],
  });

  const atual = await lerConfig(parsed.data.channelId, org.id);
  if (!atual) return { ok: false, error: "Canal não encontrado." };

  const publicKey = generateWebchatKey();
  const config: WebchatConfig = { ...atual, sessionSecret: generateSessionSecret() };

  const supabase = await createClient();
  const { error } = await supabase
    .from("channels")
    .update({ external_id: publicKey, config: config as unknown as Json })
    .eq("id", parsed.data.channelId)
    .eq("organization_id", org.id)
    .eq("type", "webchat");

  if (error) {
    logError("webchat.actions.rotacionar", error);
    return { ok: false, error: "Não foi possível gerar uma chave nova." };
  }
  revalidar(parsed.data.orgSlug, parsed.data.channelId);
  return { ok: true, data: { publicKey } };
}

export async function desconectarWebchatAction(input: CanalWebchatInput): Promise<ActionResult> {
  const parsed = canalWebchatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { org } = await requireOrgRole({
    orgSlug: parsed.data.orgSlug,
    roles: ["owner", "admin"],
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("channels")
    .delete()
    .eq("id", parsed.data.channelId)
    .eq("organization_id", org.id)
    .eq("type", "webchat");

  if (error) {
    logError("webchat.actions.desconectar", error);
    return { ok: false, error: "Não foi possível remover o canal." };
  }
  revalidar(parsed.data.orgSlug);
  return { ok: true };
}

async function lerConfig(channelId: string, orgId: string): Promise<WebchatConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channels")
    .select("id, config")
    .eq("id", channelId)
    .eq("organization_id", orgId)
    .eq("type", "webchat")
    .maybeSingle();
  if (error || !data) {
    if (error) logError("webchat.actions.ler-config", error);
    return null;
  }
  const config = webchatConfigSchema.safeParse(data.config);
  return config.success ? config.data : null;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/webchat-actions.test.ts && npx tsc --noEmit`
Expected: 4 testes passando.

- [ ] **Step 7: Criar o diálogo de conexão**

Copie a estrutura de `_components/connect-uazapi-dialog.tsx` (estado manual, sem react-hook-form). Campos: **Nome interno** (padrão "Site"), **Endereços do site** (um por linha, `textarea`), **Número de WhatsApp** (opcional) e **Segredo do Turnstile** (opcional). Ao confirmar, chama `conectarWebchatAction`; em caso de erro, `toast.error(r.error)`; em caso de sucesso, mostra a chave com botão de copiar e um link "Ver detalhe" para `/app/${orgSlug}/settings/channels/webchat/${channelId}`, e chama `router.refresh()` ao fechar.

```tsx
// app/(app)/app/[orgSlug]/settings/channels/_components/connect-webchat-dialog.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { conectarWebchatAction } from "@/lib/messaging/adapters/webchat/actions";

type Criado = { channelId: string; publicKey: string };

export function ConnectWebchatDialog({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [criado, setCriado] = useState<Criado | null>(null);
  const [nome, setNome] = useState("Site");
  const [dominios, setDominios] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [turnstile, setTurnstile] = useState("");

  async function conectar() {
    setEnviando(true);
    const resultado = await conectarWebchatAction({
      orgSlug,
      name: nome.trim(),
      allowedOrigins: dominios
        .split("\n")
        .map((linha) => linha.trim())
        .filter(Boolean),
      turnstileSecret: turnstile.trim() || null,
      whatsappNumber: whatsapp.replace(/\D/g, "") || null,
    });
    setEnviando(false);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    setCriado(resultado.data ?? null);
  }

  function fechar(proximo: boolean) {
    setAberto(proximo);
    if (!proximo && criado) {
      setCriado(null);
      router.refresh();
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogTrigger render={<Button variant="outline" size="sm" />} nativeButton={false}>
        Conectar site
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar o chat do site</DialogTitle>
          <DialogDescription>
            O widget do site conversa com este canal. Só os endereços listados aqui podem usá-lo.
          </DialogDescription>
        </DialogHeader>

        {criado ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Chave do site</Label>
              <Input readOnly value={criado.publicKey} />
              <p className="text-muted-foreground text-xs">
                Guarde no site como variável de ambiente. Ela pode aparecer no navegador — quem
                protege o canal é a lista de endereços.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href={`/app/${orgSlug}/settings/channels/webchat/${criado.channelId}`} />
              }
              nativeButton={false}
            >
              Ver detalhe do canal
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="webchat-nome">Nome interno</Label>
              <Input id="webchat-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="webchat-dominios">Endereços do site (um por linha)</Label>
              <Textarea
                id="webchat-dominios"
                rows={3}
                placeholder={"https://m10abrasivos.com.br\nhttp://localhost:3000"}
                value={dominios}
                onChange={(e) => setDominios(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="webchat-whatsapp">WhatsApp para a passagem (opcional)</Label>
              <Input
                id="webchat-whatsapp"
                placeholder="5511999999999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="webchat-turnstile">Segredo do Turnstile (opcional)</Label>
              <Input
                id="webchat-turnstile"
                value={turnstile}
                onChange={(e) => setTurnstile(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Sem ele, a proteção contra robôs fica desligada — use só em teste.
              </p>
            </div>
            <Button onClick={conectar} disabled={enviando || !dominios.trim()}>
              {enviando ? "Criando…" : "Criar canal"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

> Confira os componentes reais em `components/ui/` antes de copiar (o repositório usa Base UI: `render={<Button />} nativeButton={false}`, regra absoluta #14 do CLAUDE.md). Se `Textarea` não existir, use `Input` com uma linha por endereço e um botão "adicionar".

- [ ] **Step 8: Criar a página de detalhe**

Espelhe `whatsapp-uazapi/[channelId]/page.tsx`: `requireOrgRole` com `["owner","admin"]`, busca do canal com `.eq("type","webchat")`, `notFound()` se não achar, cabeçalho com `label-mono` (`/ canais / site / detalhe`) e `<Card>` por bloco:

1. **Como instalar** — mostra a chave (`channel.external_id`) e o endereço base das rotas (`${process.env.NEXT_PUBLIC_APP_URL}/api/public/webchat`).
2. **Endereços autorizados** — `WebchatSettings` (cliente) com o formulário que chama `atualizarWebchatAction` e o botão "Gerar chave nova" (`rotacionarChaveWebchatAction`) com confirmação, avisando que derruba as sessões abertas.
3. **Agente de IA** — reusa `<AgentSelector orgSlug={orgSlug} channelId={channel.id} currentAgentId={channel.agent_id ?? null} agents={agents ?? []} />` sem nenhuma mudança.
4. **Remover canal** — `DisconnectButton` chamando `desconectarWebchatAction` e voltando para a lista.

Nunca renderize `config.sessionSecret` nem `config.turnstileSecret` — mostre apenas "configurado" ou "não configurado".

- [ ] **Step 9: Ligar na lista de canais**

Em `app/(app)/app/[orgSlug]/settings/channels/page.tsx`, trocar o ternário do `detailHref` por um mapa (e, de quebra, consertar o `whatsapp_uazapi`, que hoje cai em `"#"`):

```tsx
const PASTA_DO_TIPO: Record<string, string> = {
  whatsapp_cloud: "whatsapp-cloud",
  whatsapp_evolution: "whatsapp-evolution",
  whatsapp_uazapi: "whatsapp-uazapi",
  webchat: "webchat",
};

const pasta = PASTA_DO_TIPO[c.type];
const detailHref = pasta ? `/app/${orgSlug}/settings/channels/${pasta}/${c.id}` : "#";
```

E, ao lado do `<ConnectWhatsappDropdown orgSlug={orgSlug} />`, acrescentar `<ConnectWebchatDialog orgSlug={orgSlug} />`.

- [ ] **Step 10: Conferir no navegador**

Run: `npm run dev` (na cópia `C:\m10b`) e abrir `/app/<slug>/settings/channels`.
Expected: botão "Conectar site"; criar o canal; o canal aparece na lista com status "conectado"; o detalhe abre, mostra a chave, salva endereços e troca a chave.

- [ ] **Step 11: Commit**

```bash
npx biome check --write lib/webchat/public-key.ts lib/messaging/adapters/webchat "app/(app)/app/[orgSlug]/settings/channels" tests/webchat-actions.test.ts
git add lib/webchat/public-key.ts lib/messaging/adapters/webchat "app/(app)/app/[orgSlug]/settings/channels" tests/webchat-actions.test.ts
git commit -m "feat(webchat): criar e administrar o canal do site pela interface"
```

---

### Task 9: Página de teste, documentação e fechamento da etapa

**Files:**
- Create: `public/webchat-teste.html`
- Create: `lib/webchat/CLAUDE.md`
- Modify: `lib/messaging/CLAUDE.md` (seção do canal Site)
- Modify: `types/supabase.ts` (gerado)

**Interfaces:**
- Consumes: todas as rotas das tarefas 5 a 7.
- Produces: página estática de teste servida pelo próprio CRM em `/webchat-teste.html`.

> A página é servida pelo CRM, então o pedido é da mesma origem e o navegador não manda `Origin`. O `guard` resolve isso usando a origem do próprio CRM — por isso o canal de teste precisa ter `http://localhost:3000` na lista de endereços.

- [ ] **Step 1: Criar a página de teste**

```html
<!-- public/webchat-teste.html -->
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Teste do chat do site</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #20233a; color: #f2f3f7; }
      main { max-width: 640px; margin: 0 auto; }
      #conversa { border: 1px solid #3a3f60; border-radius: 8px; padding: 12px; height: 360px; overflow-y: auto; background: #2a2e4a; }
      .linha { margin-bottom: 10px; line-height: 1.4; }
      .cliente { color: #f97709; }
      .estado { color: #b9bcd0; font-size: 12px; min-height: 18px; }
      form { display: flex; gap: 8px; margin-top: 12px; }
      input[type="text"] { flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #3a3f60; background: #20233a; color: inherit; }
      button { padding: 10px 16px; border: 0; border-radius: 6px; background: #f97709; color: #20233a; font-weight: 700; cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>Teste do chat do site</h1>
      <p class="estado">Abra esta página com a chave do canal: <code>?key=m10chat_...</code></p>
      <div id="conversa"></div>
      <p class="estado" id="estado"></p>
      <form id="form">
        <input type="text" id="texto" placeholder="Escreva sua mensagem" autocomplete="off" />
        <button type="submit">Enviar</button>
      </form>
    </main>

    <script>
      const base = "/api/public/webchat";
      const chave = new URLSearchParams(location.search).get("key") || "";
      const conversa = document.getElementById("conversa");
      const estado = document.getElementById("estado");
      const vistas = new Set();
      let token = localStorage.getItem("webchat_token_" + chave);

      function escrever(quem, texto) {
        const linha = document.createElement("div");
        linha.className = "linha " + (quem === "cliente" ? "cliente" : "");
        linha.textContent = (quem === "cliente" ? "Você: " : "Especialista: ") + texto;
        conversa.appendChild(linha);
        conversa.scrollTop = conversa.scrollHeight;
      }

      function mostrar(mensagem) {
        if (vistas.has(mensagem.id)) return;
        vistas.add(mensagem.id);
        escrever(mensagem.from, mensagem.body);
      }

      async function abrirSessao() {
        const headers = { "content-type": "application/json" };
        if (token) headers["x-webchat-token"] = token;
        else headers["x-webchat-key"] = chave;

        const res = await fetch(base + "/session", { method: "POST", headers, body: "{}" });
        if (!res.ok) {
          estado.textContent = "Não foi possível abrir o chat (" + res.status + ").";
          return;
        }
        const { data } = await res.json();
        token = data.token;
        localStorage.setItem("webchat_token_" + chave, token);
        data.messages.forEach(mostrar);
        estado.textContent = data.whatsappNumber ? "WhatsApp: " + data.whatsappNumber : "";
        ouvir();
      }

      function ouvir() {
        // O EventSource não manda cabeçalho, então o token vai na URL só aqui.
        const fonte = new EventSource(base + "/stream?token=" + encodeURIComponent(token));
        fonte.addEventListener("mensagem", (e) => mostrar(JSON.parse(e.data)));
        fonte.addEventListener("digitando", (e) => {
          estado.textContent = JSON.parse(e.data).digitando ? "Especialista está digitando…" : "";
        });
        fonte.addEventListener("vendedor_entrou", () => {
          estado.textContent = "Um vendedor entrou na conversa.";
        });
        fonte.addEventListener("handoff_whatsapp", () => {
          estado.textContent = "O especialista sugeriu continuar no WhatsApp.";
        });
        fonte.addEventListener("reconectar", () => {
          fonte.close();
          ouvir();
        });
        fonte.onerror = () => {
          estado.textContent = "Conexão caiu; tentando de novo…";
        };
      }

      document.getElementById("form").addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const campo = document.getElementById("texto");
        const texto = campo.value.trim();
        if (!texto || !token) return;
        campo.value = "";
        escrever("cliente", texto);
        const res = await fetch(base + "/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-webchat-token": token },
          body: JSON.stringify({
            clientMessageId: crypto.randomUUID(),
            body: texto,
            pageContext: { url: location.href, item: "Página de teste" },
          }),
        });
        if (res.status === 429) estado.textContent = "Muitas mensagens. Aguarde um instante.";
      });

      if (!chave) estado.textContent = "Falta a chave na URL (?key=m10chat_...).";
      else abrirSessao();
    </script>
  </body>
</html>
```

- [ ] **Step 2: Aceitar o token na URL do SSE**

O `EventSource` do navegador não manda cabeçalhos. Em `app/api/public/webchat/stream/route.ts`, aceite o token também por `?token=`, mantendo o cabeçalho como caminho preferido. Em `app/api/public/webchat/_lib/guard.ts`, troque a leitura do token por:

```ts
function lerToken(req: Request): string | null {
  const doCabecalho = req.headers.get("x-webchat-token");
  if (doCabecalho) return doCabecalho;
  // O EventSource não manda cabeçalho; só o SSE usa este caminho.
  return new URL(req.url).searchParams.get("token");
}
```

e use `lerToken(req)` em `temToken` e em `autorizarPorToken`.

- [ ] **Step 3: Cobrir esse caminho com teste**

Acrescente a `tests/webchat-guard.test.ts`:

```ts
  it("aceita o token pela URL, para o EventSource", async () => {
    const token = signSessionToken({ channelId: CANAL_ID, visitorId: "visitante-1" }, SEGREDO);
    const pedido = new Request(
      `https://crm.exemplo/api/public/webchat/stream?token=${encodeURIComponent(token)}`,
      { headers: { origin: "https://m10abrasivos.com.br" } },
    );
    const r = await autorizarPorToken(pedido);
    expect(r).not.toBeInstanceOf(Response);
    expect(temToken(pedido)).toBe(true);
  });
```

Run: `npx vitest run tests/webchat-guard.test.ts`
Expected: 7 testes passando.

- [ ] **Step 4: Documentar**

Criar `lib/webchat/CLAUDE.md` seguindo o padrão de `lib/catalog/CLAUDE.md`: responsabilidade da pasta, quem chama o quê, por que o SSE lê o banco em vez de usar o Realtime, os limites, e a regra de que `sessionSecret` e `turnstileSecret` nunca vão para o navegador.

Acrescentar em `lib/messaging/CLAUDE.md` uma seção "Canal webchat (Etapa 2)" com: rotas públicas e seus contratos, o fluxo (widget → rota → `processInboundMessage` → agente → `processSendOutbound` → adapter sem provedor → SSE), e o smoke test do Step 6 abaixo.

- [ ] **Step 5: Regenerar tipos e rodar tudo**

```bash
npm run types          # types/supabase.ts com o novo valor de channels.type
npx vitest run
npx tsc --noEmit
```

Depois, compilar na cópia curta:

```bash
cd /c/m10b && git fetch "<caminho do repo>" feat/canal-webchat && git checkout FETCH_HEAD && npm run build
```

- [ ] **Step 6: Smoke test manual**

1. Aplicar a migration no Supabase (painel ou MCP).
2. `npm run dev` em `C:\m10b`.
3. Em `/app/<slug>/settings/channels`, clicar em **Conectar site**, com o endereço `http://localhost:3000`, sem Turnstile, e o WhatsApp da empresa. Copiar a chave.
4. Ligar um agente ao canal no detalhe (o agente vendedor de verdade só chega na Etapa 3; qualquer agente ativo serve para ver a resposta automática).
5. Abrir `http://localhost:3000/webchat-teste.html?key=<chave>` e enviar "Preciso de abrasivo para quartzito".
6. Conferir na inbox: conversa nova com o selo do canal Site, a nota "Cliente abriu o chat na página de Página de teste" e a mensagem do cliente.
7. Ver a resposta do agente aparecer sozinha na página, e o aviso "digitando" antes dela.
8. Responder pela inbox como vendedor: a resposta aparece na página e o aviso "Um vendedor entrou na conversa".
9. Recarregar a página: a conversa volta (mesmo token no `localStorage`).
10. Enviar 25 mensagens seguidas: as últimas devem ser recusadas com aviso de limite.
11. Conferir a origem:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/public/webchat/session \
  -H "content-type: application/json" -H "x-webchat-key: <chave>" -H "Origin: https://evil.com" -d '{}'
```

Esperado: `403`.

12. No detalhe do canal, clicar em **Gerar chave nova** e recarregar a página de teste com a chave antiga: deve falhar; com a chave nova, deve funcionar.

- [ ] **Step 7: Commit final**

```bash
npx biome check --write public/webchat-teste.html lib/webchat "app/api/public/webchat" tests/webchat-guard.test.ts
git add -A
git commit -m "feat(webchat): página de teste, token pela URL no SSE e documentação"
```

---

## Verificação antes de considerar a etapa pronta

- [ ] `npx vitest run` — tudo passando (a Etapa 1 fechou com 1.415 testes; a Etapa 2 acrescenta cerca de 45).
- [ ] `npx tsc --noEmit` — sem saída.
- [ ] `npm run build` na cópia `C:\m10b` — sem erro.
- [ ] Migration aplicada no Supabase de produção.
- [ ] Smoke test da Tarefa 9 feito ponta a ponta, com a inbox aberta em outra aba.
- [ ] `lib/webchat/CLAUDE.md` e a seção nova em `lib/messaging/CLAUDE.md` escritas.
- [ ] Nenhum segredo aparece no navegador: procurar por `sessionSecret` e `turnstileSecret` em tudo que é renderizado (`grep -rn "sessionSecret" app components`).

---

## Conferência do plano contra a especificação (seção 5)

| Item da especificação | Onde está |
|---|---|
| 5.1 Adapter `webchat` registrado e `ChannelType` novo | Tarefa 1 |
| 5.1 Migration do CHECK de `channels.type` | Tarefa 1 |
| 5.1 Canal "Site" com `allowedOrigins`, `sessionSecret`, `turnstileSecret` | Tarefas 1 e 8 |
| 5.1 `channels.agent_id` apontando para o agente | Tarefa 8 (reusa `AgentSelector`) |
| 5.2 `POST /session` com Turnstile, origem, token e histórico | Tarefa 5 |
| 5.2 `POST /messages` com limites e `external_id` do cliente | Tarefa 6 |
| 5.2 `GET /stream` (SSE) com `typing`, `message`, `agent_joined`, `handoff_whatsapp` | Tarefa 7 |
| 5.2 `GET /messages?after=` como reserva | Tarefa 6 |
| 5.3 Conversa com `contact_id` nulo e `external_thread_id` do visitante | Tarefas 5 e 6 (quem cria é o router) |
| 5.3 Router, inbox em tempo real e disparo do agente sem mudança | Tarefa 6 (gatilho existente, `raw.channelId`) |
| 5.3 `sendMessage` do adapter sem provedor externo | Tarefa 1 |
| 5.3 Resposta do vendedor humano chegando ao widget | Tarefa 7 (evento `vendedor_entrou`) |
| 5.4 `pageContext` em `provider_metadata` e nota de sistema | Tarefa 6 |
| 5.4 Ligar a conversa ao contato pelo WhatsApp | **Etapa 3** — é a ferramenta da IA que grava o telefone; aqui a conversa nasce sem contato |
| 5.5 SSE no processo Node do Easypanel | Tarefa 7 |
| 10 Limites de 20/min, 200/dia e 1.000 caracteres | Tarefas 3 e 6 |
| 10 Segredos só no servidor | Tarefas 4 e 8 |
| 9 SSE cai → reconexão e reserva por `after` | Tarefas 6, 7 e 9 (evento `reconectar` e `onerror` na página) |

**Fica fora desta etapa, de propósito:** o agente vendedor e suas ferramentas (Etapa 3), o widget bonito e o site (Etapa 4), e o aviso de LGPD no widget (Etapa 4, junto da página de privacidade).
