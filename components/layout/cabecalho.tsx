import Link from "next/link";
import { MenuDeLinhas } from "@/components/layout/menu-de-linhas";
import { Logo } from "@/components/marca/logo";
import { linhasPublicadas } from "@/lib/linhas";

export type LinkDeCategoria = { nome: string; slug: string };

/**
 * O nível principal do menu tem só 3 itens (Linhas, Catálogo, Falar com
 * especialista) — cabem numa linha até no celular, sem precisar rolar.
 * Categorias e linhas publicadas ficam dentro do menu "Linhas" (ver
 * `MenuDeLinhas`), que também é quem cuida de abrir/fechar.
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
        <nav aria-label="Principal">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <MenuDeLinhas
              linhas={linhas.map((linha) => ({ slug: linha.slug, nome: linha.nome }))}
              categorias={semLinha}
            />
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
