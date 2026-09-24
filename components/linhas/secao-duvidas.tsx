import type { Linha } from "@/lib/linhas/esquema";

export function SecaoDuvidas({ linha }: { linha: Linha }) {
  if (linha.duvidas.length === 0) return null;
  return (
    <section aria-labelledby="duvidas" className="mx-auto max-w-3xl px-4 py-20">
      <h2 id="duvidas" className="text-3xl">
        Dúvidas
      </h2>
      <div className="mt-8 divide-y divide-borda border-y border-borda">
        {linha.duvidas.map((d) => (
          <details key={d.pergunta} className="group py-4">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between font-semibold">
              {d.pergunta}
              <span aria-hidden className="text-laranja group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-texto-secundario">{d.resposta}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
