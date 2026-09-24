"use client";

import { useEffect, useRef, useState } from "react";
import type { Linha } from "@/lib/linhas/esquema";
import { semMovimento, urlDaMidia } from "@/lib/midia";
import { AguardandoMaterial } from "./aguardando-material";

const LIMIARES = Array.from({ length: 21 }, (_, i) => i / 20);

/**
 * Seção 2. A barra acende grão a grão conforme a faixa entra na tela; no último
 * grão a foto REAL do espelhado aparece com um reflexo passando. Nunca geramos
 * uma versão "fosca" da foto (seria mostrar um resultado que não aconteceu).
 * O progresso só avança: rolar para cima não apaga os grãos.
 */
export function FaixaDosGraos({ linha }: { linha: Linha }) {
  const { graos, fotoEspelhado, titulo } = linha.faixa;
  const raiz = useRef<HTMLElement>(null);
  const [acesos, setAcesos] = useState(0);

  useEffect(() => {
    if (semMovimento()) {
      setAcesos(graos.length);
      return;
    }
    const alvo = raiz.current;
    if (!alvo) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        const razao = Math.max(...entradas.map((e) => e.intersectionRatio));
        const agora = Math.min(graos.length, Math.ceil(razao * graos.length - 0.001));
        setAcesos((antes) => Math.max(antes, agora));
      },
      { threshold: LIMIARES },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [graos.length]);

  const revelada = acesos >= graos.length;

  return (
    <section
      id="faixa-dos-graos"
      ref={raiz}
      aria-labelledby="titulo-faixa"
      className="mx-auto max-w-6xl px-4 py-20"
    >
      <h2 id="titulo-faixa" className="text-3xl">
        {titulo}
      </h2>
      <ol className="mt-8 flex overflow-hidden rounded-tecnico font-mono text-xs md:text-sm">
        {graos.map((grao, i) => (
          <li
            key={grao}
            data-testid="grao"
            data-aceso={String(i < acesos)}
            className={`flex-1 py-3 text-center transition-colors duration-500 ${
              i < acesos ? "bg-laranja text-azul" : "bg-superficie text-texto-secundario"
            }`}
          >
            {grao}
          </li>
        ))}
      </ol>
      {fotoEspelhado ? (
        <div
          data-testid="foto-espelhado"
          data-revelada={String(revelada)}
          className={`relative mt-8 overflow-hidden rounded-tecnico border border-borda transition-opacity duration-700 ${
            revelada ? "reflexo opacity-100" : "opacity-0"
          }`}
        >
          {/* biome-ignore lint/performance/noImgElement: foto vem do bucket de mídia, fora do otimizador. */}
          <img
            src={urlDaMidia(fotoEspelhado.caminho)}
            alt={fotoEspelhado.alt}
            width={fotoEspelhado.largura}
            height={fotoEspelhado.altura}
            loading="lazy"
            className="h-auto w-full"
          />
        </div>
      ) : linha.rascunho ? (
        <div className="mt-8">
          <AguardandoMaterial oque="foto do brilho espelhado" />
        </div>
      ) : null}
    </section>
  );
}
