import Link from "next/link";
import { VideoCurto } from "@/components/linhas/video-curto";
import type { Linha } from "@/lib/linhas/esquema";

/** Topo da home quando há linha publicada: a linha em destaque, com o vídeo do topo dela. */
export function DestaqueDaLinha({ linha }: { linha: Linha }) {
  return (
    <section className="relative isolate flex min-h-[70svh] items-end overflow-hidden border-b border-borda">
      {linha.topo.video ? (
        <VideoCurto video={linha.topo.video} prioridade className="absolute inset-0 -z-10" />
      ) : (
        <div className="grade-tecnica absolute inset-0 -z-10" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-azul/20 via-azul/60 to-azul" />
      <div className="mx-auto w-full max-w-6xl px-4 pb-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-laranja">
          {linha.topo.selo}
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] md:text-6xl">{linha.topo.titulo}</h1>
        <Link
          href={`/linhas/${linha.slug}`}
          className="mt-8 inline-flex min-h-12 items-center rounded-tecnico bg-laranja px-6 font-semibold text-azul hover:brightness-110"
        >
          Conheça a linha {linha.nome}
        </Link>
      </div>
    </section>
  );
}
