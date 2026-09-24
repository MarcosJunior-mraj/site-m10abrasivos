"use client";

import { useEffect, useState } from "react";
import type { Linha } from "@/lib/linhas/esquema";

function jaMostrado(chave: string): boolean {
  try {
    return sessionStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}

function marcarMostrado(chave: string): void {
  try {
    sessionStorage.setItem(chave, "1");
  } catch {
    // Sem armazenamento: pode reaparecer na próxima página. Aceitável.
  }
}

/**
 * Balão da IA: após `esperaMs` ou quando a faixa dos grãos entra na tela, o que
 * vier primeiro. Uma vez por visita (sessionStorage). O clique é tratado pelo
 * widget via `data-abrir-chat` + `data-abertura` — este componente não importa o chat.
 */
export function BalaoProativo({ linha, esperaMs = 8000 }: { linha: Linha; esperaMs?: number }) {
  const chave = `m10_balao_${linha.slug}`;
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (jaMostrado(chave)) return;
    let feito = false;
    const mostrar = () => {
      if (feito) return;
      feito = true;
      marcarMostrado(chave);
      setVisivel(true);
    };
    const relogio = setTimeout(mostrar, esperaMs);
    const faixa = document.getElementById("faixa-dos-graos");
    const observador = faixa
      ? new IntersectionObserver((entradas) => {
          if (entradas.some((e) => e.isIntersecting)) mostrar();
        })
      : null;
    if (faixa) observador?.observe(faixa);
    return () => {
      clearTimeout(relogio);
      observador?.disconnect();
    };
  }, [chave, esperaMs]);

  if (!visivel) return null;

  return (
    <div className="fixed right-4 bottom-24 z-40 flex max-w-[16rem] items-start gap-2 rounded-tecnico rounded-br-none bg-texto p-3 text-azul shadow-2xl md:max-w-xs">
      <button
        type="button"
        data-abrir-chat=""
        data-item={linha.ia.contexto}
        data-abertura={linha.ia.balao}
        onClick={() => setVisivel(false)}
        className="text-left text-sm font-semibold"
      >
        {linha.ia.balao}
      </button>
      <button
        type="button"
        aria-label="Fechar sugestão"
        onClick={() => setVisivel(false)}
        className="min-h-6 min-w-6 text-azul/60"
      >
        ✕
      </button>
    </div>
  );
}
