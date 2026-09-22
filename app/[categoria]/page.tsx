import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GradeDeItens } from "@/components/catalogo/grade-de-itens";
import { Cabecalho } from "@/components/layout/cabecalho";
import { textoDeSeo } from "@/lib/catalog/apresentacao";
import { buscarCategorias, buscarItens } from "@/lib/catalog/client";
import { itemParaONavegador } from "@/lib/catalog/para-o-navegador";
import { ehSlugReservado } from "@/lib/rotas";

export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ categoria: string }[]> {
  const categorias = await buscarCategorias();
  return categorias
    .filter((categoria) => !ehSlugReservado(categoria.slug))
    .map((categoria) => ({ categoria: categoria.slug }));
}

async function carregar(slug: string) {
  if (ehSlugReservado(slug)) return null;
  const categorias = await buscarCategorias();
  const categoria = categorias.find((c) => c.slug === slug);
  if (!categoria) return null;
  const [itens, todos] = await Promise.all([buscarItens({ categoria: slug }), buscarItens()]);
  return { categoria, itens, categorias, todos };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string }>;
}): Promise<Metadata> {
  const { categoria } = await params;
  const dados = await carregar(categoria);
  if (!dados) return {};
  return {
    title: dados.categoria.name,
    description:
      textoDeSeo(dados.categoria.description) ??
      `${dados.categoria.name} da M10 Abrasivos para marmorarias. Fale com um especialista.`,
    alternates: { canonical: `/${dados.categoria.slug}` },
  };
}

export default async function PaginaDeCategoria({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
  const { categoria } = await params;
  const dados = await carregar(categoria);
  if (!dados) notFound();

  // Texto livre do CRM: mesma trava de preço da descrição do item.
  const descricao = textoDeSeo(dados.categoria.description);
  const comItens = dados.categorias.filter((c) =>
    dados.todos.some((item) => item.category?.slug === c.slug),
  );

  return (
    <>
      <Cabecalho categorias={comItens.map((c) => ({ nome: c.name, slug: c.slug }))} />
      <main>
        <header className="mx-auto max-w-6xl px-4 pt-12">
          <h1 className="text-3xl">{dados.categoria.name}</h1>
          {descricao ? <p className="mt-3 max-w-prose text-texto-secundario">{descricao}</p> : null}
        </header>
        {/* `GradeDeItens` é de cliente: tudo que vai nas props sai no HTML (payload RSC). */}
        <GradeDeItens itens={dados.itens.map(itemParaONavegador)} />
      </main>
    </>
  );
}
