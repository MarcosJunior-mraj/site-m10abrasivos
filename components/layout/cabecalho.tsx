import Link from "next/link";
import { Logo } from "@/components/marca/logo";
import { linhasPublicadas } from "@/lib/linhas";

export type LinkDeCategoria = { nome: string; slug: string };

/**
 * No celular a navegação desce para uma linha própria, abaixo do logo, e
 * rola na horizontal — antes ela simplesmente sumia abaixo de `md`, e o
 * visitante no celular não tinha como chegar às categorias.
 */
export function Cabecalho({ categorias }: { categorias: LinkDeCategoria[] }) {
  const linhas = linhasPublicadas();
  const categoriasComLinha = new Set(linhas.map((l) => l.categoriaSlug));
  const semLinha = categorias.filter((c) => !categoriasComLinha.has(c.slug));

  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-azul/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:py-4">
        <Link href="/" aria-label="M10 Abrasivos — início" className="self-start">
          <Logo largura={140} prioridade />
        </Link>
        <nav aria-label="Principal" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex items-center gap-6 whitespace-nowrap">
            <li className="relative">
              <details className="group">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm uppercase tracking-wide text-texto-secundario hover:text-texto">
                  Linhas <span aria-hidden>▾</span>
                </summary>
                <ul className="absolute left-0 z-50 mt-2 min-w-56 rounded-tecnico border border-borda bg-azul p-2 shadow-xl">
                  {linhas.map((linha) => (
                    <li key={linha.slug}>
                      <Link
                        href={`/linhas/${linha.slug}`}
                        className="block min-h-11 px-3 py-2 text-sm text-laranja hover:bg-superficie"
                      >
                        {linha.nome}
                      </Link>
                    </li>
                  ))}
                  {semLinha.map((categoria) => (
                    <li key={categoria.slug}>
                      <Link
                        href={`/${categoria.slug}`}
                        className="block min-h-11 px-3 py-2 text-sm hover:bg-superficie"
                      >
                        {categoria.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
            <li>
              <Link
                href="/catalogo"
                className="inline-flex min-h-11 items-center text-sm uppercase tracking-wide text-texto-secundario hover:text-texto"
              >
                Catálogo
              </Link>
            </li>
            <li>
              <button
                type="button"
                data-abrir-chat=""
                className="min-h-11 rounded-tecnico bg-laranja px-4 text-sm font-semibold text-azul"
              >
                Falar com especialista
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
