import Image from "next/image";
import Link from "next/link";
import { descricaoDoItem } from "@/lib/catalog/apresentacao";
import { temImagem, urlDaImagem } from "@/lib/catalog/imagens";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

/**
 * `nivelTitulo`: nível do título do cartão na hierarquia da página — 3 na
 * grade do catálogo (abaixo do h2 da seção); 4 quando a grade já fica sob um
 * h3 (ex.: "Reposição: grãos avulsos" na página de vendas).
 */
export function CartaoItem({ item, nivelTitulo = 3 }: { item: ItemCatalogo; nivelTitulo?: 3 | 4 }) {
  const Titulo = nivelTitulo === 4 ? "h4" : "h3";
  return (
    <article className="group relative rounded-tecnico border border-borda bg-superficie transition-colors hover:border-laranja">
      <div className="relative aspect-4/3 overflow-hidden border-b border-borda">
        {temImagem(item) ? (
          // Fundo branco: as fotos do Bling são produto recortado no branco; a
          // foto aparece inteira (contain) em vez de cortada pelo card 4:3.
          <div className="absolute inset-0 bg-white">
            <Image
              src={urlDaImagem(item)}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-contain p-3"
            />
          </div>
        ) : (
          <div
            data-testid="marcador-sem-foto"
            aria-hidden
            className="grade-tecnica flex h-full items-center justify-center"
          >
            <span className="font-titulo text-4xl text-laranja">M10</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <Titulo className="text-base leading-tight">
          <Link href={`/produto/${item.slug}`} className="after:absolute after:inset-0">
            {item.title}
          </Link>
        </Titulo>
        <p className="line-clamp-2 text-sm text-texto-secundario">{descricaoDoItem(item)}</p>
        <div className="flex gap-3 font-mono text-xs text-texto-secundario">
          {item.grit ? <span>#{item.grit}</span> : null}
          {item.diameterMm ? <span>Ø {item.diameterMm} mm</span> : null}
        </div>
      </div>
    </article>
  );
}
