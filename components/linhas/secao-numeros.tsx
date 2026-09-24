import type { Linha } from "@/lib/linhas/esquema";
import { AguardandoMaterial } from "./aguardando-material";

/** Seção 7: cada número leva a fonte junto — nada inventado. */
export function SecaoNumeros({ linha }: { linha: Linha }) {
  if (linha.numeros.length === 0) {
    return linha.rascunho ? (
      <section className="mx-auto max-w-6xl px-4 py-20">
        <AguardandoMaterial oque="dados técnicos e comparativos (com fonte)" />
      </section>
    ) : null;
  }
  return (
    <section aria-labelledby="numeros" className="bg-superficie py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="numeros" className="text-3xl">
          Os números
        </h2>
        <dl className="mt-10 grid gap-6 md:grid-cols-3">
          {linha.numeros.map((n) => (
            <div key={n.rotulo} className="rounded-tecnico border border-borda bg-azul p-6">
              <dd className="font-titulo text-4xl text-laranja">{n.valor}</dd>
              <dt className="mt-2">{n.rotulo}</dt>
              <p className="mt-3 font-mono text-xs text-texto-secundario">Fonte: {n.fonte}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
