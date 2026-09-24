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

  // Comportamento desejado e protegido aqui: a rota serve a versão gerada no
  // build, alheia ao CRM estar no ar ou não, até a próxima revalidação.
  expect(resposta.status()).toBe(200);
  expect(corpo).toContain("/produto/gt-50");
});
