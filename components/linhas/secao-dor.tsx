import type { Linha } from "@/lib/linhas/esquema";

export function SecaoDor({ linha }: { linha: Linha }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h2 className="text-3xl leading-tight md:text-4xl">{linha.dor.titulo}</h2>
      <p className="mt-6 text-lg text-texto-secundario">{linha.dor.texto}</p>
    </section>
  );
}
