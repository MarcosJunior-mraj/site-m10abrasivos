import type { Metadata } from "next";
import Link from "next/link";
import { CartaoItem } from "@/components/catalogo/cartao-item";
import { Cabecalho } from "@/components/layout/cabecalho";
import { buscarCategorias, buscarItens } from "@/lib/catalog/client";

export const metadata: Metadata = { title: "Catálogo" };

export default async function Catalogo() {
  const [itens, categorias] = await Promise.all([buscarItens(), buscarCategorias()]);

  // Categoria sem item publicado não vira cartão: link para vitrine vazia é pior do que link nenhum.
  const comItens = categorias.filter((categoria) =>
    itens.some((item) => item.category?.slug === categoria.slug),
  );
  const destaques = itens.filter((item) => item.isFeatured);
  const kits = itens.filter((item) => item.kind === "kit");
  const vitrine = (destaques.length > 0 ? destaques : itens).slice(0, 6);

  return (
    <>
      <Cabecalho categorias={comItens.map((c) => ({ nome: c.name, slug: c.slug }))} />
      <main>
        <h1 className="mx-auto max-w-6xl px-4 pt-12 text-4xl">Catálogo</h1>

        {comItens.length > 0 || kits.length > 0 ? (
          <section aria-labelledby="linhas" className="mx-auto max-w-6xl px-4 py-16">
            <h2 id="linhas">Linhas M10</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {comItens.map((categoria) => (
                <Link
                  key={categoria.slug}
                  href={`/${categoria.slug}`}
                  className="flex flex-col justify-between gap-6 rounded-tecnico border border-borda bg-superficie p-6 hover:border-laranja"
                >
                  <h3 className="text-xl">{categoria.name}</h3>
                  <span className="font-mono text-sm text-laranja">
                    {itens.filter((item) => item.category?.slug === categoria.slug).length} itens
                  </span>
                </Link>
              ))}
              {kits.map((kit) => (
                <CartaoItem key={kit.slug} item={kit} />
              ))}
            </div>
          </section>
        ) : null}

        {vitrine.length > 0 ? (
          <section aria-labelledby="vitrine" className="mx-auto max-w-6xl px-4 py-16">
            <h2 id="vitrine">Em destaque</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {vitrine.map((item) => (
                <CartaoItem key={item.slug} item={item} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
