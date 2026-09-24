import type { Linha } from "@/lib/linhas/esquema";
import { AguardandoMaterial } from "./aguardando-material";
import { VideoCurto } from "./video-curto";

/** Seção 1 · Cinema: vídeo em tela cheia, degradê para o texto ser legível sobre qualquer quadro. */
export function SecaoTopo({ linha }: { linha: Linha }) {
  const { topo } = linha;
  return (
    <section className="relative isolate flex min-h-[88svh] items-end overflow-hidden border-b border-borda">
      {topo.video ? (
        <VideoCurto video={topo.video} prioridade className="absolute inset-0 -z-10" />
      ) : linha.rascunho ? (
        <div className="absolute inset-0 -z-10 p-4 pt-24">
          <AguardandoMaterial oque="vídeo do topo" />
        </div>
      ) : (
        <div className="grade-tecnica absolute inset-0 -z-10" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-azul/20 via-azul/50 to-azul" />
      <div className="mx-auto w-full max-w-6xl px-4 pb-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-laranja">{topo.selo}</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] md:text-6xl">{topo.titulo}</h1>
        <p className="mt-4 max-w-prose text-lg text-texto-secundario">{topo.subtitulo}</p>
        <button
          type="button"
          data-abrir-chat=""
          data-item={linha.ia.contexto}
          className="mt-8 min-h-12 rounded-tecnico bg-laranja px-6 py-3 font-semibold text-azul hover:brightness-110"
        >
          {topo.cta}
        </button>
      </div>
    </section>
  );
}
