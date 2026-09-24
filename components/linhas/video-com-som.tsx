"use client";

import { useRef, useState } from "react";
import { urlDaMidia } from "@/lib/midia";

/** Depoimento/vídeo longo: nada é baixado até o clique (tráfego do bucket custa). */
export function VideoComSom({
  arquivo,
  capa,
  titulo,
}: {
  arquivo: string;
  capa: string;
  titulo: string;
}) {
  const [tocando, setTocando] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  if (tocando) {
    return (
      <video
        ref={(el) => {
          video.current = el;
          void el?.play().catch(() => undefined);
        }}
        src={urlDaMidia(arquivo)}
        poster={urlDaMidia(capa)}
        controls
        playsInline
        preload="auto"
        className="aspect-video w-full rounded-tecnico bg-azul"
      >
        <track kind="captions" />
      </video>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTocando(true)}
      aria-label={`Assistir: ${titulo}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-tecnico border border-borda"
    >
      {/* biome-ignore lint/performance/noImgElement: capa vem do bucket de mídia, fora do otimizador. */}
      <img src={urlDaMidia(capa)} alt="" loading="lazy" className="h-full w-full object-cover" />
      <span className="absolute inset-0 flex items-center justify-center bg-azul/40 text-5xl text-laranja group-hover:bg-azul/20">
        ▶
      </span>
    </button>
  );
}
