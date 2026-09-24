import Link from "next/link";
import type { ItemCatalogo } from "@/lib/catalog/schemas";
import { ehSlugReservado } from "@/lib/rotas";

/**
 * Caminho de volta da página de produto: Início › categoria › item. No
 * celular é o jeito de subir para a categoria sem depender do menu.
 */
export function TrilhaDoItem({
  categoria,
  titulo,
}: {
  categoria: ItemCatalogo["category"];
  titulo: string;
}) {
  const comLink = categoria && !ehSlugReservado(categoria.slug) ? categoria : null;
  return (
    <nav aria-label="Trilha de navegação" className="text-xs text-texto-secundario">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-texto">
            Início
          </Link>
        </li>
        {comLink ? (
          <li className="flex items-center gap-2">
            <span aria-hidden>›</span>
            <Link
              href={`/${comLink.slug}`}
              className="inline-flex min-h-11 items-center font-mono uppercase tracking-wider text-laranja hover:brightness-110"
            >
              {comLink.name}
            </Link>
          </li>
        ) : null}
        <li className="flex items-center gap-2">
          <span aria-hidden>›</span>
          <span aria-current="page">{titulo}</span>
        </li>
      </ol>
    </nav>
  );
}
