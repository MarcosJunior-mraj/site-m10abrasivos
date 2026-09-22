"use client";

type JanelaComTurnstile = typeof globalThis & {
  turnstile?: { render: (elemento: HTMLElement, opcoes: Record<string, unknown>) => void };
};

const FONTE = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Resolve o token do desafio invisível do Cloudflare. Sem chave configurada
 * (o estado do canal hoje), devolve `null` na hora — o CRM aceita e ninguém
 * carrega script nenhum.
 */
export async function resolverTurnstile(siteKey: string): Promise<string | null> {
  if (!siteKey) return null;

  await new Promise<void>((resolver, rejeitar) => {
    if ((globalThis as JanelaComTurnstile).turnstile) return resolver();
    const script = document.createElement("script");
    script.src = FONTE;
    script.async = true;
    script.onload = () => resolver();
    script.onerror = () => rejeitar(new Error("Turnstile não carregou"));
    document.head.appendChild(script);
  }).catch(() => undefined);

  const turnstile = (globalThis as JanelaComTurnstile).turnstile;
  if (!turnstile) return null;

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
