import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AvisoDaLinha } from "@/components/catalogo/aviso-da-linha";
import { BotaoFalarComEspecialista } from "@/components/catalogo/botao-falar-com-especialista";
import { CartaoItem } from "@/components/catalogo/cartao-item";
import { ComposicaoDoKit } from "@/components/catalogo/composicao-do-kit";
import { FolhaDeEspecificacao } from "@/components/catalogo/folha-de-especificacao";
import { TrilhaDoItem } from "@/components/catalogo/trilha-do-item";
import { Cabecalho } from "@/components/layout/cabecalho";
import { descricaoDoItem, textoDeSeo } from "@/lib/catalog/apresentacao";
import { buscarCategorias, buscarItem, buscarItens } from "@/lib/catalog/client";
import { temImagem, urlDaImagem } from "@/lib/catalog/imagens";
import { lerConfigServidor } from "@/lib/config";
import { linhaDoProduto } from "@/lib/linhas";
import { dadosEstruturadosJson } from "./dados-estruturados";

export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const itens = await buscarItens();
  return itens.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await buscarItem(slug);
  if (!item) return {};
  // Campos de SEO são texto livre do CRM: passam pela mesma trava de preço.
  const titulo = textoDeSeo(item.seoTitle) ?? item.title;
  const descricao = textoDeSeo(item.seoDescription) ?? descricaoDoItem(item);
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `/produto/${item.slug}` },
    openGraph: {
      title: titulo,
      description: descricao,
      images: temImagem(item) ? [urlDaImagem(item)] : [],
    },
  };
}

export default async function PaginaDeProduto({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await buscarItem(slug);
  if (!item) notFound();

  const { siteUrl } = lerConfigServidor();
  const [categorias, todos] = await Promise.all([buscarCategorias(), buscarItens()]);
  // `item.category` pode ser `null` (item sem categoria no CRM). Sem essa guarda,
  // `undefined === undefined` juntaria todo item sem categoria como "irmão" de
  // qualquer outro item sem categoria — uma relação falsa.
  const categoriaSlug = item.category?.slug;
  const irmaos = categoriaSlug
    ? todos.filter((outro) => outro.slug !== item.slug && outro.category?.slug === categoriaSlug)
    : [];
  const comItens = categorias.filter((categoria) =>
    todos.some((outro) => outro.category?.slug === categoria.slug),
  );

  return (
    <>
      <Cabecalho categorias={comItens.map((c) => ({ nome: c.name, slug: c.slug }))} />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD é o nosso próprio objeto serializado (com `<` escapado), não conteúdo de visitante.
          dangerouslySetInnerHTML={{ __html: dadosEstruturadosJson(item, siteUrl) }}
        />

        <div className="grid gap-10 md:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-tecnico border border-borda bg-superficie">
            {temImagem(item) ? (
              <Image
                src={urlDaImagem(item)}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                className="bg-white object-contain p-4"
              />
            ) : (
              <div aria-hidden className="grade-tecnica flex h-full items-center justify-center">
                <span className="font-titulo text-6xl text-laranja">M10</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <TrilhaDoItem categoria={item.category} titulo={item.title} />
              <h1 className="mt-2 text-3xl leading-tight">{item.title}</h1>
              {(() => {
                const linha = linhaDoProduto(item.slug);
                return linha ? (
                  <div className="mt-4">
                    <AvisoDaLinha linha={linha} />
                  </div>
                ) : null;
              })()}
            </div>
            <p className="text-texto-secundario">{descricaoDoItem(item)}</p>
            <BotaoFalarComEspecialista item={item} />
            <FolhaDeEspecificacao item={item} />
            {item.kind === "kit" ? <ComposicaoDoKit componentes={item.components} /> : null}
          </div>
        </div>

        {irmaos.length > 0 ? (
          <section aria-labelledby="irmaos" className="mt-20">
            <h2 id="irmaos" className="text-2xl">
              Outras granas da mesma linha
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {irmaos.map((outro) => (
                <CartaoItem key={outro.slug} item={outro} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
