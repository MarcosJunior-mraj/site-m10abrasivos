import Link from "next/link";
import type { Linha } from "@/lib/linhas/esquema";

export function AvisoDaLinha({ linha }: { linha: Linha }) {
  return (
    <Link
      href={`/linhas/${linha.slug}`}
      className="block rounded-tecnico border border-laranja px-4 py-3 text-sm text-laranja hover:bg-laranja hover:text-azul"
    >
      Conheça a linha {linha.nome} →
    </Link>
  );
}
