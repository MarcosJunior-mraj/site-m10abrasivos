import { expect, test } from "@playwright/test";

const CRM = "http://localhost:3101";

type Contagem = { data: Record<string, number> };

async function lerContagem(request: import("@playwright/test").APIRequestContext) {
  const resposta = await request.get(`${CRM}/_contagem`);
  const corpo = (await resposta.json()) as Contagem;
  return corpo.data;
}

function somaCatalogo(contagem: Record<string, number>): number {
  return Object.entries(contagem)
    .filter(([caminho]) => caminho.startsWith("/api/public/catalog/"))
    .reduce((total, [, quantidade]) => total + quantidade, 0);
}

// Roda em série e num arquivo que ordena antes dos demais (prefixo `0-`):
// o primeiro teste da suíte inteira precisa ver a contagem exatamente como
// o `npm run build` a deixou, antes de qualquer outro teste zerar ou somar
// requisições por cima.
test.describe
  .serial("verificações adiadas de cache do catálogo", () => {
    test("memoização por requisição: quantas vezes o build leu o catálogo para a página de categoria", async ({
      request,
    }) => {
      const contagem = await lerContagem(request);

      // `generateMetadata` e o componente da página de categoria chamam
      // `buscarCategorias()` e `buscarItens({ categoria })`/`buscarItens()`
      // com os mesmos parâmetros. O Data Cache do Next (mesma URL, mesma tag)
      // deveria coalescer isso num único fetch de rede por URL, não um por
      // chamador. Aqui só registramos o que foi observado — o número exato
      // vai para o relatório da tarefa.
      const doCategoria =
        contagem["/api/public/catalog/items?category=abrasivos-para-poliborda"] ?? 0;
      const dasCategorias = contagem["/api/public/catalog/categories"] ?? 0;
      const deTodosOsItens = contagem["/api/public/catalog/items"] ?? 0;

      test.info().annotations.push({
        type: "contagem-de-build",
        description: JSON.stringify(contagem),
      });

      // Cada URL só deveria mesmo bater na rede do CRM falso uma vez durante
      // todo o build (Home, categoria e as 3 páginas de produto pedem as
      // mesmas URLs de catálogo/categorias repetidas vezes ao longo do
      // build). Mais de uma leitura por URL única indica que a coalescência
      // não está acontecendo.
      expect(doCategoria).toBeLessThanOrEqual(1);
      expect(dasCategorias).toBeLessThanOrEqual(1);
      expect(deTodosOsItens).toBeLessThanOrEqual(1);
    });

    test("cache do catálogo: visitar páginas não gera uma leitura por visita", async ({
      page,
      request,
    }) => {
      await request.post(`${CRM}/_zerar`);

      await page.goto("/");
      await page.goto("/produto/gt-50");
      await page.goto("/produto/kit-gt");

      const contagem = await lerContagem(request);
      const total = somaCatalogo(contagem);

      test.info().annotations.push({
        type: "contagem-pos-visitas",
        description: JSON.stringify(contagem),
      });

      // As três rotas visitadas já foram geradas estaticamente no build: o
      // esperado é ZERO leituras novas no CRM (as páginas vêm do cache de
      // rota do Next), nunca uma leitura por página visitada (o que daria 6+
      // aqui: itens + categorias por visita, no mínimo).
      expect(total).toBeLessThan(3);
    });
  });
