import { expect, test } from "@playwright/test";

const CRM = "http://localhost:3101";

// Prefixo `zz-`: precisa rodar por último. Este teste desliga o catálogo do
// CRM falso de propósito e nunca liga de volta — nenhum outro arquivo pode
// depender do catálogo depois dele.
test("/sitemap.xml com o CRM fora do ar", async ({ request }) => {
  await request.post(`${CRM}/_desligar_catalogo`);

  const resposta = await request.get("/sitemap.xml");
  const corpo = await resposta.text();

  test.info().annotations.push({
    type: "sitemap-com-crm-fora-do-ar",
    description: `status=${resposta.status()} tamanho-do-corpo=${corpo.length}`,
  });

  // Não corrigimos nada aqui — só documentamos o comportamento real no
  // relatório da Tarefa 13. A única garantia que exigimos é que a rota
  // responda alguma coisa (não trave o processo do site).
  expect(resposta.status()).toBeGreaterThan(0);
});
