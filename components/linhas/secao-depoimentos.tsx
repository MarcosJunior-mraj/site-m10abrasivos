import type { Linha } from "@/lib/linhas/esquema";
import { AguardandoMaterial } from "./aguardando-material";
import { VideoComSom } from "./video-com-som";

export function SecaoDepoimentos({ linha }: { linha: Linha }) {
  if (linha.depoimentos.length === 0) {
    return linha.rascunho ? (
      <section className="mx-auto max-w-6xl px-4 py-20">
        <AguardandoMaterial oque="depoimentos (vídeo + autorização)" />
      </section>
    ) : null;
  }
  return (
    <section aria-labelledby="quem-usa" className="mx-auto max-w-6xl px-4 py-20">
      <h2 id="quem-usa" className="text-3xl">
        Quem usa
      </h2>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {linha.depoimentos.map((d) => (
          <figure key={d.video.arquivo}>
            <VideoComSom
              arquivo={d.video.arquivo}
              capa={d.video.capa}
              titulo={`depoimento de ${d.nome}`}
            />
            <figcaption className="mt-3 text-sm">
              <strong>{d.nome}</strong>
              <span className="block text-texto-secundario">
                {d.marmoraria} · {d.cidade}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
