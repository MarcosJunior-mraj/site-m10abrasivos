import Link from "next/link";
import { Logo } from "@/components/marca/logo";

export type LinkDeCategoria = { nome: string; slug: string };

export function Cabecalho({ categorias }: { categorias: LinkDeCategoria[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-azul/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4">
        <Link href="/" aria-label="M10 Abrasivos — início">
          <Logo largura={140} prioridade />
        </Link>
        <nav aria-label="Categorias" className="hidden gap-6 md:flex">
          {categorias.map((categoria) => (
            <Link
              key={categoria.slug}
              href={`/${categoria.slug}`}
              className="text-sm uppercase tracking-wide text-texto-secundario hover:text-texto"
            >
              {categoria.nome}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
