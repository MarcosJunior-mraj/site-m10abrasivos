import Link from "next/link";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

export function ComposicaoDoKit({ componentes }: { componentes: ItemCatalogo["components"] }) {
  if (componentes.length === 0) return null;

  return (
    <section
      aria-labelledby="composicao"
      className="rounded-tecnico border border-borda bg-superficie"
    >
      <h2 id="composicao" className="border-b border-borda px-5 py-3 text-sm">
        O que vem no kit
      </h2>
      <ul className="divide-y divide-borda">
        {componentes.map((componente) => (
          <li
            key={`${componente.slug ?? componente.title}`}
            className="flex items-center gap-4 px-5 py-3"
          >
            <span className="font-mono text-laranja">{componente.quantity}×</span>
            {componente.slug ? (
              <Link href={`/produto/${componente.slug}`} className="hover:text-laranja">
                {componente.title}
              </Link>
            ) : (
              <span>{componente.title}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
