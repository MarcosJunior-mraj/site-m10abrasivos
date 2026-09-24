import Link from "next/link";
import { ordenarPorGrana } from "@/lib/catalog/apresentacao";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

/**
 * A leitura natural da linha: do desbaste (#50) ao brilho (#3000). Com poucos
 * itens ela é o herói da home; com muitos vira o índice da categoria.
 */
export function EscalaDeRugosidade({ itens }: { itens: ItemCatalogo[] }) {
  const comGrana = ordenarPorGrana(itens.filter((item) => item.grit));
  if (comGrana.length === 0) return null;

  return (
    <section aria-labelledby="escala" className="relative mx-auto max-w-6xl px-4 py-16">
      <h2 id="escala" className="text-2xl">
        Do desbaste ao brilho
      </h2>
      <p className="mt-2 max-w-prose text-texto-secundario">
        Cada grana faz um trabalho. Comece pelo corte e termine no lustro — ou fale com um
        especialista e receba a sequência certa para a sua pedra.
      </p>
      <ol className="mt-8 flex gap-2 overflow-x-auto border-t border-borda pt-6">
        {comGrana.map((item) => (
          <li key={item.slug} className="min-w-24 flex-1">
            <Link
              href={`/produto/${item.slug}`}
              className="flex flex-col items-center gap-2 border-t-2 border-laranja pt-3 hover:text-laranja"
            >
              <span className="font-mono text-lg">#{item.grit}</span>
              <span className="text-center text-xs text-texto-secundario">{item.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
