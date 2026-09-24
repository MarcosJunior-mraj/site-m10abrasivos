"use client";

type ApiTurnstile = {
  render: (elemento: HTMLElement, opcoes: Record<string, unknown>) => void;
};

type JanelaComTurnstile = typeof globalThis & { turnstile: ApiTurnstile };

/**
 * Guarda de tipo: em vez de forçar o tipo com `as` (que o projeto proíbe),
 * verifica a forma de `globalThis.turnstile` em etapas — o mesmo espírito do
 * adaptador de `FonteDeEventos` em `lib/webchat/cliente.ts`, que resolveu o
 * mesmo tipo de problema sem nenhum casting.
 */
function temTurnstile(g: unknown): g is JanelaComTurnstile {
  if (typeof g !== "object" || g === null) return false;
  if (!("turnstile" in g)) return false;
  const { turnstile } = g;
  if (typeof turnstile !== "object" || turnstile === null) return false;
  if (!("render" in turnstile)) return false;
  return typeof turnstile.render === "function";
}

const FONTE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Script da Cloudflare que não chega nisto (bloqueador, rede ruim): segue sem token. */
const ESPERA_DO_SCRIPT_MS = 8_000;
/** Desafio que não responde nisto: segue sem token. */
const ESPERA_DO_TOKEN_MS = 10_000;

/** Carrega o script uma vez; resolve quando `turnstile` existe ou quando desiste (nunca rejeita). */
function carregarScript(janela: unknown): Promise<void> {
  return new Promise<void>((resolver) => {
    if (temTurnstile(janela)) {
      resolver();
      return;
    }
    const desistir = setTimeout(resolver, ESPERA_DO_SCRIPT_MS);
    const terminar = () => {
      clearTimeout(desistir);
      resolver();
    };
    const script = document.createElement("script");
    script.src = FONTE;
    script.async = true;
    script.onload = terminar;
    script.onerror = terminar;
    document.head.appendChild(script);
  });
}

/**
 * Resolve o token do desafio do Cloudflare. Sem chave configurada (o estado
 * do canal hoje), devolve `null` na hora — o CRM aceita e ninguém carrega
 * script nenhum.
 *
 * Não passa `size`: "invisible" não é valor válido de `render` (o
 * `render` lança). Ser invisível é o TIPO de widget escolhido no painel da
 * Cloudflare para esta site key. Qualquer falha — script bloqueado ou
 * lento, `render` que lança, erro do desafio, demora — vira `null`: o
 * painel segue sem token e o CRM decide se aceita. Esta função nunca
 * rejeita.
 */
export async function resolverTurnstile(siteKey: string): Promise<string | null> {
  if (!siteKey) return null;

  // Uma variável comum, ao contrário do identificador especial `globalThis`,
  // é o que o TypeScript sabe estreitar com a guarda de tipo abaixo — por
  // isso a capturamos aqui em vez de checar `globalThis` diretamente.
  const janela: unknown = globalThis;

  await carregarScript(janela);
  if (!temTurnstile(janela)) return null;
  const { turnstile } = janela;

  const caixa = document.createElement("div");
  caixa.style.display = "none";
  document.body.appendChild(caixa);

  return new Promise<string | null>((resolver) => {
    const desistir = setTimeout(() => resolver(null), ESPERA_DO_TOKEN_MS);
    const terminar = (token: string | null) => {
      clearTimeout(desistir);
      resolver(token);
    };
    try {
      turnstile.render(caixa, {
        sitekey: siteKey,
        callback: (token: string) => terminar(token),
        "error-callback": () => terminar(null),
        "timeout-callback": () => terminar(null),
      });
    } catch {
      terminar(null);
    }
  });
}
