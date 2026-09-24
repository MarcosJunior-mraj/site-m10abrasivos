import { CartaoItem } from "@/components/catalogo/cartao-item";
import { buscarItens } from "@/lib/catalog/client";
import type { Linha } from "@/lib/linhas/esquema";

/**
 * Seção 8. Kit e avulsos vêm do catálogo do CRM (nome e foto sempre atuais); o que
 * saiu do catálogo some sozinho. Sem kit publicado, a oferta cai para a conversa.
 * Preço: nunca aqui — o CTA pede o valor na conversa.
 */
export async function SecaoOferta({ linha }: { linha: Linha }) {
  const itens = await buscarItens();
  const porSlug = new Map(itens.map((item) => [item.slug, item]));
  const kit = linha.oferta.kitSlug ? porSlug.get(linha.oferta.kitSlug) : undefined;
  const avulsos = linha.oferta.avulsosSlugs.flatMap((slug) => porSlug.get(slug) ?? []);
  // Spec 5.3: com o kit publicado, o título é o nome dele no catálogo (sempre atual).
  const titulo = kit ? kit.title.trim() || linha.oferta.titulo : `Sequência ${linha.nome}`;

  return (
    <section aria-labelledby="oferta" className="bg-superficie py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="rounded-tecnico border border-laranja bg-azul p-8 md:p-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-laranja">A oferta</p>
          <h2 id="oferta" className="mt-3 text-3xl md:text-4xl">
            {titulo}
          </h2>
          <p className="mt-4 max-w-prose text-texto-secundario">{linha.oferta.texto}</p>
          {kit ? (
            <button
              type="button"
              data-abrir-chat=""
              data-item={linha.ia.contexto}
              data-mensagem={linha.oferta.cta}
              className="mt-8 min-h-12 rounded-tecnico bg-laranja px-6 py-3 font-semibold text-azul hover:brightness-110"
            >
              {linha.oferta.cta}
            </button>
          ) : (
            <button
              type="button"
              data-abrir-chat=""
              data-item={linha.ia.contexto}
              className="mt-8 min-h-12 rounded-tecnico bg-laranja px-6 py-3 font-semibold text-azul hover:brightness-110"
            >
              Monte sua sequência com o especialista
            </button>
          )}
        </div>

        {avulsos.length > 0 ? (
          <>
            <h3 className="mt-14 text-xl">Reposição: grãos avulsos</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {avulsos.map((item) => (
                <CartaoItem key={item.slug} item={item} nivelTitulo={4} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
