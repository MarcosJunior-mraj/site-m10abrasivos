import { expect, test } from "@playwright/test";

const CRM = "http://localhost:3101";

test.beforeEach(async ({ request, page }) => {
  await request.post(`${CRM}/_zerar`);
  await page.addInitScript(() => localStorage.setItem("m10_lgpd_aceito", "1"));
});

test("a página do Green Turbo abre com as seções e sem preço", async ({ page }) => {
  await page.goto("/linhas/green-turbo");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/brilho de espelho/i);
  await expect(page.getByRole("heading", { name: /saia do fosco/i })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/R\$|preço/i);
});

test("pergunta pronta envia a mensagem com o contexto da linha, no chat embutido", async ({
  page,
  request,
}) => {
  await page.goto("/linhas/green-turbo");
  await page.getByRole("button", { name: "Serve para quartzito?" }).click();
  const embutido = page.getByTestId("chat-embutido");
  // Escopo na região da conversa (não no `chat-embutido` inteiro): o botão da
  // pergunta pronta continua no DOM (só escondido por CSS) com o mesmo texto
  // da mensagem enviada, então `embutido.getByText(...)` bate nos dois e vira
  // "strict mode violation" — a região do painel não tem o botão dentro.
  const conversa = embutido.getByRole("region", { name: /conversa com o especialista/i });
  await expect(conversa).toBeVisible();
  await expect(conversa.getByText("Serve para quartzito?")).toBeVisible();
  await expect(conversa.getByRole("log")).toContainText("Posso te ajudar");
  const ctx = await (await request.get(`${CRM}/_ultimo_contexto`)).json();
  expect(ctx.data).toMatchObject({ item: "Linha Green Turbo", abertura: null });
});

test("botão do cabeçalho leva o contexto da linha ao CRM", async ({ page, request }) => {
  await page.goto("/linhas/green-turbo");
  await page
    .getByRole("banner")
    .getByRole("button", { name: /falar com especialista/i })
    .click();
  await page.getByRole("textbox", { name: /mensagem/i }).fill("Oi");
  await page.getByRole("button", { name: /^enviar$/i }).click();
  await expect
    .poll(async () => (await (await request.get(`${CRM}/_ultimo_contexto`)).json()).data?.item)
    .toBe("Linha Green Turbo");
});

test("balão: uma vez por visita, e leva a pergunta como abertura", async ({ page, request }) => {
  await page.goto("/linhas/green-turbo");
  await page.getByRole("heading", { name: /saia do fosco/i }).scrollIntoViewIfNeeded();
  const balao = page.getByRole("button", {
    name: "Qual pedra você está polindo hoje na poliborda?",
  });
  await expect(balao).toBeVisible();
  await balao.click();
  await expect(
    page.getByRole("dialog").getByText("Qual pedra você está polindo hoje na poliborda?"),
  ).toBeVisible();
  await page.getByRole("textbox", { name: /mensagem/i }).fill("Granito");
  await page.getByRole("button", { name: /^enviar$/i }).click();
  await expect
    .poll(async () => (await (await request.get(`${CRM}/_ultimo_contexto`)).json()).data?.abertura)
    .toBe("Qual pedra você está polindo hoje na poliborda?");
  await page.reload();
  // Gatilho imediato do balão (a faixa entrando na tela) em vez de esperar os 8 s
  // do temporizador: se o balão reaparecesse depois de já mostrado nesta sessão,
  // seria por este caminho que reapareceria mais rápido.
  await page.getByRole("heading", { name: /saia do fosco/i }).scrollIntoViewIfNeeded();
  // Espera curta para o IntersectionObserver processar a entrada na tela (não há
  // rede envolvida, só o tempo do observer entregar a entrada e o React montar).
  await page.waitForTimeout(500);
  await expect(
    page.getByRole("button", { name: "Qual pedra você está polindo hoje na poliborda?" }),
  ).toHaveCount(0);
});

test("embutido e flutuante são a mesma conversa", async ({ page }) => {
  await page.goto("/linhas/green-turbo");
  await page.getByRole("button", { name: "Qual sequência para mármore?" }).click();
  // Mesmo motivo do teste anterior: escopo na região da conversa, não no
  // `chat-embutido` inteiro (que também contém o botão da pergunta pronta,
  // só escondido por CSS, com o mesmo texto).
  const conversaEmbutida = page
    .getByTestId("chat-embutido")
    .getByRole("region", { name: /conversa com o especialista/i });
  await expect(conversaEmbutida.getByText("Qual sequência para mármore?")).toBeVisible();
  await page.getByTestId("botao-chat").click();
  await expect(page.getByRole("dialog").getByText("Qual sequência para mármore?")).toBeVisible();
});

test("a faixa acende os 7 grãos ao rolar", async ({ page }) => {
  await page.goto("/linhas/green-turbo");
  await page.getByRole("heading", { name: /saia do fosco/i }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 400);
  await expect(page.locator('[data-testid="grao"][data-aceso="true"]')).toHaveCount(7);
});

test("vídeos de seção não baixam antes da hora", async ({ page }) => {
  const videos: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".mp4")) videos.push(r.url());
  });
  await page.goto("/linhas/green-turbo");
  await page.waitForLoadState("networkidle");
  // Convenção: o vídeo do topo (herói, above the fold) tem "topo" no caminho do
  // arquivo (ex.: green-turbo/topo-celular.mp4) e carrega de propósito já na
  // carga da página (prioridade, sem espera por rolagem) — por isso é ignorado
  // aqui. O caso positivo (rolar até outra seção → o vídeo dela carrega) entra
  // na Fase 2, quando existir mídia de verdade nas demais seções.
  const foraDoTopo = videos.filter((url) => !url.includes("/topo"));
  expect(foraDoTopo).toEqual([]);
});

test("rotas antigas continuam no ar", async ({ page }) => {
  for (const caminho of ["/", "/catalogo", "/abrasivos-para-poliborda", "/produto/gt-50"]) {
    const resposta = await page.goto(caminho);
    expect(resposta?.status(), caminho).toBe(200);
  }
});
