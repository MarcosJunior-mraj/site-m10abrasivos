"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoCurto as Video } from "@/lib/linhas/esquema";
import { semMovimento, urlDaMidia } from "@/lib/midia";

/**
 * Trecho curto sem som, em loop. A capa aparece na hora (é ela o LCP do topo);
 * o vídeo só entra quando o bloco chega a 300 px da tela — seção lá embaixo não
 * gasta dados de quem nem rolou até ela. Menos animação ou economia de dados: só a capa.
 * Botão pausável no canto (WCAG 2.2.2).
 */
export function VideoCurto({
  video,
  prioridade = false,
  className = "",
}: {
  video: Video;
  prioridade?: boolean;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [perto, setPerto] = useState(false);
  const [tocando, setTocando] = useState(true);

  useEffect(() => {
    if (semMovimento()) return;
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !perto) return;

    const handlePlay = () => setTocando(true);
    const handlePause = () => setTocando(false);

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [perto]);

  const togglePause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (tocando) {
      video.pause();
      setTocando(false);
    } else {
      void video.play().catch(() => undefined);
      setTocando(true);
    }
  };

  return (
    <div ref={caixa} className={`relative overflow-hidden ${className}`}>
      {/* biome-ignore lint/performance/noImgElement: capa vem do bucket de mídia, fora do otimizador. */}
      <img
        src={urlDaMidia(video.capa)}
        alt={video.descricao}
        fetchPriority={prioridade ? "high" : "auto"}
        loading={prioridade ? "eager" : "lazy"}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {perto ? (
        <>
          <video
            ref={videoRef}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            poster={urlDaMidia(video.capa)}
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src={urlDaMidia(video.celular)} type="video/mp4" media="(max-width: 767px)" />
            <source src={urlDaMidia(video.computador)} type="video/mp4" />
          </video>
          <button
            type="button"
            onClick={togglePause}
            aria-label={tocando ? "Pausar vídeo" : "Retomar vídeo"}
            className="absolute bottom-3 right-3 min-h-11 min-w-11 rounded-tecnico bg-azul/70 text-texto"
          >
            {tocando ? "⏸" : "▶"}
          </button>
        </>
      ) : null}
    </div>
  );
}
