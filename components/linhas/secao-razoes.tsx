import type { Linha } from "@/lib/linhas/esquema";
import { AguardandoMaterial } from "./aguardando-material";
import { VideoCurto } from "./video-curto";

export function SecaoRazoes({ linha }: { linha: Linha }) {
  return (
    <section aria-labelledby="razoes" className="bg-superficie py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="razoes" className="text-3xl">
          {linha.razoes.titulo}
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {linha.razoes.itens.map((razao) => (
            <article
              key={razao.titulo}
              className="overflow-hidden rounded-tecnico border border-borda bg-azul"
            >
              {razao.video ? (
                <VideoCurto video={razao.video} className="aspect-video" />
              ) : linha.rascunho ? (
                <AguardandoMaterial oque={`vídeo — ${razao.titulo}`} />
              ) : null}
              <div className="p-6">
                <h3 className="text-xl">{razao.titulo}</h3>
                <p className="mt-2 text-texto-secundario">{razao.texto}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
