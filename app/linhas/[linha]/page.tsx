import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/layout/cabecalho";
import { BalaoProativo } from "@/components/linhas/balao-proativo";
import { FaixaDosGraos } from "@/components/linhas/faixa-dos-graos";
import { PergunteAoEspecialista } from "@/components/linhas/pergunte-ao-especialista";
import { SecaoDepoimentos } from "@/components/linhas/secao-depoimentos";
import { SecaoDor } from "@/components/linhas/secao-dor";
import { SecaoDuvidas } from "@/components/linhas/secao-duvidas";
import { SecaoFechamento } from "@/components/linhas/secao-fechamento";
import { SecaoNumeros } from "@/components/linhas/secao-numeros";
import { SecaoOferta } from "@/components/linhas/secao-oferta";
import { SecaoRazoes } from "@/components/linhas/secao-razoes";
import { SecaoTopo } from "@/components/linhas/secao-topo";
import { buscarCategorias, buscarItens } from "@/lib/catalog/client";
import { lerConfigServidor } from "@/lib/config";
import { buscarLinha, linhasVisiveis, podeMostrar } from "@/lib/linhas";
import { urlDaMidia } from "@/lib/midia";
import { dadosEstruturadosDaLinhaJson } from "./dados-estruturados";

type Props = { params: Promise<{ linha: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return linhasVisiveis().map((linha) => ({ linha: linha.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const linha = buscarLinha((await params).linha);
  if (!linha || !podeMostrar(linha)) return {};
  return {
    title: linha.seo.titulo,
    description: linha.seo.descricao,
    alternates: { canonical: `/linhas/${linha.slug}` },
    robots: linha.rascunho ? { index: false, follow: false } : undefined,
    openGraph: linha.seo.imagem
      ? {
          images: [
            {
              url: urlDaMidia(linha.seo.imagem.caminho),
              width: linha.seo.imagem.largura,
              height: linha.seo.imagem.altura,
            },
          ],
        }
      : undefined,
  };
}

export default async function PaginaDaLinha({ params }: Props) {
  const linha = buscarLinha((await params).linha);
  if (!linha || !podeMostrar(linha)) notFound();

  const { siteUrl } = lerConfigServidor();
  // `SecaoOferta` é um componente de servidor assíncrono: chamamos direto (em vez
  // de escrever `<SecaoOferta ... />`) para o resultado poder ser renderizado com
  // React Testing Library/jsdom, que não sabe renderizar um componente async aninhado.
  const [itens, categorias, oferta] = await Promise.all([
    buscarItens(),
    buscarCategorias(),
    SecaoOferta({ linha }),
  ]);
  const daOferta = linha.oferta.avulsosSlugs.flatMap(
    (slug) => itens.find((i) => i.slug === slug) ?? [],
  );
  const comItens = categorias.filter((c) => itens.some((i) => i.category?.slug === c.slug));

  return (
    <>
      <Cabecalho categorias={comItens.map((c) => ({ nome: c.name, slug: c.slug }))} />
      <main>
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD é o nosso próprio objeto serializado (com `<` escapado).
          dangerouslySetInnerHTML={{
            __html: dadosEstruturadosDaLinhaJson(linha, daOferta, siteUrl),
          }}
        />
        <SecaoTopo linha={linha} />
        <FaixaDosGraos linha={linha} />
        <SecaoDor linha={linha} />
        <SecaoRazoes linha={linha} />
        <PergunteAoEspecialista linha={linha} />
        <SecaoDepoimentos linha={linha} />
        <SecaoNumeros linha={linha} />
        {oferta}
        <SecaoDuvidas linha={linha} />
        <SecaoFechamento linha={linha} />
      </main>
      <BalaoProativo linha={linha} />
    </>
  );
}
