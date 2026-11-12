"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoDoItem } from "@/lib/catalog/videos-dos-itens";
import { semMovimento } from "@/lib/midia";

/**
 * Vídeo sem som, em loop, no lugar da foto do cartão. A capa aparece na hora;
 * o vídeo só carrega perto da tela. Menos animação ou economia de dados: só a
 * capa. Botão de pausa acima do link do cartão (WCAG 2.2.2).
 */
export function VideoDoCartao({ video }: { video: VideoDoItem }) {
  const caixa = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [perto, setPerto] = useState(false);
  const [tocando, setTocando] = useState(true);

  useEffect(() => {
    if (semMovimento() || typeof IntersectionObserver === "undefined") return;
    const alvo = caixa.current;
    if (!alvo) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setPerto(true);
          observador.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  function alternar() {
    const elemento = videoRef.current;
    if (!elemento) return;
    if (tocando) {
      elemento.pause();
      setTocando(false);
    } else {
      void elemento.play().catch(() => undefined);
      setTocando(true);
    }
  }

  return (
    <div ref={caixa} className="absolute inset-0 bg-[#1e2b31]">
      {/* biome-ignore lint/performance/noImgElement: capa estática do próprio site, já no tamanho certo. */}
      <img
        src={video.capa}
        alt={video.descricao}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-contain"
      />
      {perto ? (
        <>
          <video
            ref={videoRef}
            src={video.video}
            poster={video.capa}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            aria-hidden
            className="absolute inset-0 h-full w-full object-contain"
          />
          <button
            type="button"
            onClick={alternar}
            aria-label={tocando ? "Pausar vídeo" : "Continuar vídeo"}
            className="absolute right-2 bottom-2 z-10 min-h-9 min-w-9 rounded-tecnico bg-azul/70 text-sm text-white"
          >
            {tocando ? "❚❚" : "▶"}
          </button>
        </>
      ) : null}
    </div>
  );
}
