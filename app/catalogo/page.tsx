import type { Metadata } from "next";
import Link from "next/link";
import { CartaoItem } from "@/components/catalogo/cartao-item";
import { Cabecalho } from "@/components/layout/cabecalho";
import { buscarCategorias, buscarItens } from "@/lib/catalog/client";

export const metadata: Metadata = { title: "Catálogo" };

/** Título de seção: caixa normal, peso 700 — o h1 é o único em caixa-alta na página. */
function TituloDaSecao({
  id,
  titulo,
  descricao,
}: {
  id: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-2xl font-bold normal-case tracking-tight md:text-3xl">
        {titulo}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-texto-secundario">{descricao}</p>
    </div>
  );
}

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
      <main className="pb-8">
        <header className="mx-auto max-w-6xl px-4 pt-16 pb-4 md:pt-20">
          <h1 className="text-4xl md:text-5xl">Catálogo</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-texto-secundario">
            Escolha a linha pelo tipo de trabalho. Na dúvida, um especialista indica a sequência
            certa para a sua pedra.
          </p>
        </header>

        {comItens.length > 0 ? (
          <section aria-labelledby="linhas" className="mx-auto max-w-6xl px-4 pt-14">
            <TituloDaSecao
              id="linhas"
              titulo="Linhas M10"
              descricao="Cada linha reúne os abrasivos de um tipo de acabamento."
            />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {comItens.map((categoria) => {
                const quantidade = itens.filter(
                  (item) => item.category?.slug === categoria.slug,
                ).length;
                return (
                  <li key={categoria.slug}>
                    <Link
                      href={`/${categoria.slug}`}
                      className="flex h-full items-center justify-between gap-4 rounded-tecnico border border-borda bg-superficie px-6 py-5 transition-colors hover:border-laranja"
                    >
                      <span className="font-titulo text-lg font-semibold leading-snug">
                        {categoria.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-fundo px-3 py-1 text-sm text-texto-secundario">
                        {quantidade} {quantidade === 1 ? "item" : "itens"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {kits.length > 0 ? (
          <section aria-labelledby="kits" className="mx-auto max-w-6xl px-4 pt-20">
            <TituloDaSecao
              id="kits"
              titulo="Kits prontos"
              descricao="A sequência completa de grãos, montada pela equipe M10."
            />
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {kits.map((kit) => (
                <CartaoItem key={kit.slug} item={kit} />
              ))}
            </div>
          </section>
        ) : null}

        {vitrine.length > 0 ? (
          <section aria-labelledby="vitrine" className="mx-auto max-w-6xl px-4 pt-20">
            <TituloDaSecao
              id="vitrine"
              titulo="Em destaque"
              descricao="Uma seleção de itens do catálogo."
            />
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
