import { expect, test } from "@playwright/test";

const PADROES_DE_PRECO = [/R\$/, /\d+,\d{2}/, /\bpre[çc]o\b/i, /a partir de/i];

for (const caminho of ["/", "/abrasivos-para-poliborda", "/produto/gt-50", "/produto/kit-gt"]) {
  test(`nenhum preço em ${caminho}`, async ({ page }) => {
    const resposta = await page.goto(caminho);
    expect(resposta?.status()).toBe(200);
    const html = await page.content();
    for (const padrao of PADROES_DE_PRECO) {
      expect(html, `${caminho} não pode conter ${padrao}`).not.toMatch(padrao);
    }
  });
}

test("a página de produto mostra a ficha e não expõe a URL assinada", async ({ page }) => {
  await page.goto("/produto/gt-50");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Green Turbo");
  await expect(page.getByText("Folha de especificação")).toBeVisible();
  expect(await page.content()).not.toContain("Signature=");
});

test("o filtro reduz a lista e fica na URL", async ({ page }) => {
  await page.goto("/abrasivos-para-poliborda");
  await page.getByRole("button", { name: "Mármore" }).click();
  await expect(page).toHaveURL(/pedra=marmore/);
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("o sitemap lista os produtos", async ({ request }) => {
  const resposta = await request.get("/sitemap.xml");
  expect(resposta.status()).toBe(200);
  expect(await resposta.text()).toContain("/produto/gt-50");
});

test("o cartão de item não tem altura zero (aspect-4/3 vale no navegador)", async ({ page }) => {
  await page.goto("/abrasivos-para-poliborda");
  const caixaDaImagem = page.locator('[class*="aspect-4/3"]').first();
  await expect(caixaDaImagem).toBeVisible();
  const caixa = await caixaDaImagem.boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa?.height).toBeGreaterThan(0);
  expect(caixa?.width).toBeGreaterThan(0);
});
