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

/**
 * Resolve o token do desafio invisível do Cloudflare. Sem chave configurada
 * (o estado do canal hoje), devolve `null` na hora — o CRM aceita e ninguém
 * carrega script nenhum.
 */
export async function resolverTurnstile(siteKey: string): Promise<string | null> {
  if (!siteKey) return null;

  // Uma variável comum, ao contrário do identificador especial `globalThis`,
  // é o que o TypeScript sabe estreitar com a guarda de tipo abaixo — por
  // isso a capturamos aqui em vez de checar `globalThis` diretamente.
  const janela: unknown = globalThis;

  await new Promise<void>((resolver, rejeitar) => {
    if (temTurnstile(janela)) {
      resolver();
      return;
    }
    const script = document.createElement("script");
    script.src = FONTE;
    script.async = true;
    script.onload = () => resolver();
    script.onerror = () => rejeitar(new Error("Turnstile não carregou"));
    document.head.appendChild(script);
  }).catch(() => undefined);

  if (!temTurnstile(janela)) return null;
  const { turnstile } = janela;

  const caixa = document.createElement("div");
  caixa.style.display = "none";
  document.body.appendChild(caixa);

  return new Promise<string | null>((resolver) => {
    const desistir = setTimeout(() => resolver(null), 10_000);
    turnstile.render(caixa, {
      sitekey: siteKey,
      size: "invisible",
      callback: (token: string) => {
        clearTimeout(desistir);
        resolver(token);
      },
      "error-callback": () => {
        clearTimeout(desistir);
        resolver(null);
      },
    });
  });
}
