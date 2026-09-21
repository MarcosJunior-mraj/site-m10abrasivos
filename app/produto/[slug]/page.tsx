import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BotaoFalarComEspecialista } from "@/components/catalogo/botao-falar-com-especialista";
import { CartaoItem } from "@/components/catalogo/cartao-item";
import { ComposicaoDoKit } from "@/components/catalogo/composicao-do-kit";
import { FolhaDeEspecificacao } from "@/components/catalogo/folha-de-especificacao";
import { Cabecalho } from "@/components/layout/cabecalho";
import { descricaoDoItem } from "@/lib/catalog/apresentacao";
import { buscarCategorias, buscarItem, buscarItens } from "@/lib/catalog/client";
import { temImagem, urlDaImagem } from "@/lib/catalog/imagens";
import { lerConfigServidor } from "@/lib/config";
import { dadosEstruturados } from "./dados-estruturados";

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
  return {
    title: item.seoTitle ?? item.title,
    description: item.seoDescription ?? descricaoDoItem(item),
    alternates: { canonical: `/produto/${item.slug}` },
    openGraph: {
      title: item.seoTitle ?? item.title,
      description: item.seoDescription ?? descricaoDoItem(item),
      images: temImagem(item) ? [urlDaImagem(item.slug, 0)] : [],
    },
  };
}

export default async function PaginaDeProduto({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await buscarItem(slug);
  if (!item) notFound();

  const { siteUrl } = lerConfigServidor();
  const [categorias, todos] = await Promise.all([buscarCategorias(), buscarItens()]);
  const irmaos = todos.filter(
    (outro) => outro.slug !== item.slug && outro.category?.slug === item.category?.slug,
  );
  const comItens = categorias.filter((categoria) =>
    todos.some((outro) => outro.category?.slug === categoria.slug),
  );

  return (
    <>
      <Cabecalho categorias={comItens.map((c) => ({ nome: c.name, slug: c.slug }))} />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD é o nosso próprio objeto serializado, não conteúdo de visitante.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados(item, siteUrl)) }}
        />

        <div className="grid gap-10 md:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-tecnico border border-borda bg-superficie">
            {temImagem(item) ? (
              <Image
                src={urlDaImagem(item.slug, 0)}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                className="object-cover"
              />
            ) : (
              <div aria-hidden className="grade-tecnica flex h-full items-center justify-center">
                <span className="font-titulo text-6xl text-laranja">M10</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-laranja">
                {item.category?.name ?? "Catálogo"}
              </p>
              <h1 className="mt-2 text-3xl leading-tight">{item.title}</h1>
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
