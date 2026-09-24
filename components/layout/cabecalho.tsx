import Link from "next/link";
import { Logo } from "@/components/marca/logo";

export type LinkDeCategoria = { nome: string; slug: string };

/**
 * No celular a navegação desce para uma linha própria, abaixo do logo, e
 * rola na horizontal — antes ela simplesmente sumia abaixo de `md`, e o
 * visitante no celular não tinha como chegar às categorias.
 */
export function Cabecalho({ categorias }: { categorias: LinkDeCategoria[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-azul/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:py-4">
        <Link href="/" aria-label="M10 Abrasivos — início" className="self-start">
          <Logo largura={140} prioridade />
        </Link>
        <nav aria-label="Categorias" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex gap-6 whitespace-nowrap">
            {categorias.map((categoria) => (
              <li key={categoria.slug}>
                <Link
                  href={`/${categoria.slug}`}
                  className="inline-flex min-h-11 items-center text-sm uppercase tracking-wide text-texto-secundario hover:text-texto"
                >
                  {categoria.nome}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
