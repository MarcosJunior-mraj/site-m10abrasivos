import { urlDaImagem } from "./imagens";
import type { ItemCatalogo } from "./schemas";
import { textoSemPreco } from "./sem-preco";

/**
 * Cópia do item segura para ir a um componente de CLIENTE. Tudo que é prop de
 * componente de cliente vai inteiro no payload RSC embutido no HTML — mesmo o
 * que ele não mostra. Sem esta cópia, a página de categoria (que passa os
 * itens para `GradeDeItens`, de cliente, por causa dos filtros) levava no
 * HTML as URLs ASSINADAS do Bling e o texto cru do CRM (spec "Preço",
 * descrição com "R$").
 *
 * - `images` vira o caminho estável do próprio site (mesma contagem e ordem:
 *   `temImagem` e `urlDaImagem` continuam valendo);
 * - `description` passa pela trava de preço;
 * - `specs`, campos de SEO e composição do kit saem (a grade não usa).
 */
export function itemParaONavegador(item: ItemCatalogo): ItemCatalogo {
  const descricao = textoSemPreco(item.description?.trim() ?? "");
  return {
    ...item,
    description: descricao ? descricao : null,
    images: item.images.map((_, indice) => urlDaImagem(item.slug, indice)),
    specs: {},
    seoTitle: null,
    seoDescription: null,
    components: [],
  };
}
