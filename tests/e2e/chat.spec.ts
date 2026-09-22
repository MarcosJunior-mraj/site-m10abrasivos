import { expect, test } from "@playwright/test";

const CRM = "http://localhost:3101";

// O CRM falso guarda a conversa num processo único, compartilhado por toda a
// suíte (Decisão de config: `workers: 1`). Sem zerar aqui, a mensagem de um
// teste vazaria para a sessão restaurada do próximo.
test.beforeEach(async ({ request }) => {
  await request.post(`${CRM}/_zerar`);
});

test("conversa completa até o botão do WhatsApp", async ({ page }) => {
  await page.goto("/produto/gt-50");
  // R1: a página de produto tem dois botões "Falar com especialista" (o da
  // ficha e o flutuante do widget) — `.first()` sempre, nunca um clique por
  // texto sem ele.
  await page
    .getByRole("button", { name: /falar com especialista/i })
    .first()
    .click();
  await page.getByRole("button", { name: /entendi/i }).click();

  await page.getByRole("textbox", { name: /mensagem/i }).fill("Prefiro continuar no whatsapp");
  await page.getByRole("button", { name: /^enviar$/i }).click();

  await expect(page.getByText("Prefiro continuar no whatsapp")).toBeVisible();
  await expect(page.getByText(/digitando/i)).toBeVisible();
  await expect(page.getByRole("log")).toContainText("Posso te ajudar");

  const botao = page.getByRole("link", { name: /continuar no whatsapp/i });
  await expect(botao).toBeVisible();
  await expect(botao).toHaveAttribute(
    "href",
    "https://wa.me/5511999999999?text=Oi!%20Vim%20do%20site.",
  );
});

test("sem CRM, o painel abre só com o WhatsApp", async ({ page }) => {
  await page.route("**/api/public/webchat/session", (rota) => rota.abort());
  await page.goto("/");
  await page
    .getByRole("button", { name: /falar com especialista/i })
    .first()
    .click();
  await page.getByRole("button", { name: /entendi/i }).click();

  // O rodapé também tem um link "WhatsApp" (contato geral) — o locator
  // precisa ficar dentro do painel da conversa, senão pega os dois.
  const painel = page.getByRole("dialog", { name: /conversa com o especialista/i });
  await expect(painel.getByRole("link", { name: /whatsapp/i })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("a conversa continua depois de recarregar a página", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /falar com especialista/i })
    .first()
    .click();
  await page.getByRole("button", { name: /entendi/i }).click();
  await page.getByRole("textbox", { name: /mensagem/i }).fill("Bom dia");
  await page.getByRole("button", { name: /^enviar$/i }).click();
  await expect(page.getByRole("log")).toContainText("Bom dia");

  await page.reload();
  // R1: o botão flutuante é alcançado pelo `data-testid`, não por um texto
  // de rótulo inventado ("abrir conversa" nunca existiu na interface).
  await page.getByTestId("botao-chat").click();
  await expect(page.getByRole("log")).toContainText("Bom dia");
});
