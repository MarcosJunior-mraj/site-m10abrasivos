"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIG_PUBLICA } from "@/lib/config-publica";
import type { Linha } from "@/lib/linhas/esquema";
import { EVENTO_CHAT_ABERTO } from "@/lib/webchat/eventos";
import { temSessaoGuardada } from "@/lib/webchat/sessao-guardada";

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
export function BalaoProativo({
  slug,
  ia,
  esperaMs = 8000,
}: {
  /** Só o necessário (componente de cliente: as props vão serializadas ao navegador). */
  slug: string;
  ia: Linha["ia"];
  esperaMs?: number;
}) {
  const chave = `m10_balao_${slug}`;
  const [visivel, setVisivel] = useState(false);
  const apenasAParecerRef = useRef(true);

  useEffect(() => {
    if (jaMostrado(chave)) return;
    // Quem já tem conversa salva volta a ela pelo botão do chat: a abertura do
    // balão não entraria numa conversa já começada.
    if (temSessaoGuardada(CONFIG_PUBLICA.webchatKey)) return;
    let feitoMostrar = false;
    const mostrar = () => {
      if (feitoMostrar) return;
      feitoMostrar = true;
      apenasAParecerRef.current = false;
      marcarMostrado(chave);
      setVisivel(true);
    };
    const aoAbrirChat = () => {
      if (feitoMostrar) {
        // Chat abriu depois do balão já estar visível: esconda-o.
        marcarMostrado(chave);
        setVisivel(false);
        return;
      }
      // Chat abriu antes do balão aparecer: marca como feito e não mostra.
      feitoMostrar = true;
      marcarMostrado(chave);
    };
    const relogio = setTimeout(mostrar, esperaMs);
    const faixa = document.getElementById("faixa-dos-graos");
    const observador = faixa
      ? new IntersectionObserver((entradas) => {
          if (entradas.some((e) => e.isIntersecting)) mostrar();
        })
      : null;
    if (faixa) observador?.observe(faixa);
    window.addEventListener(EVENTO_CHAT_ABERTO, aoAbrirChat);
    return () => {
      clearTimeout(relogio);
      observador?.disconnect();
      window.removeEventListener(EVENTO_CHAT_ABERTO, aoAbrirChat);
    };
  }, [chave, esperaMs]);

  // A região viva existe sempre (vazia até o balão aparecer): leitor de tela
  // só anuncia mudança numa região já montada. Anuncia sem mover o foco.
  return (
    <div role="status" aria-live="polite">
      {visivel ? (
        <div className="fixed right-4 bottom-24 z-40 flex max-w-[16rem] items-start gap-2 rounded-tecnico rounded-br-none bg-texto p-3 text-azul shadow-2xl md:max-w-xs">
          <button
            type="button"
            data-abrir-chat=""
            data-item={ia.contexto}
            data-abertura={ia.balao}
            onClick={() => setVisivel(false)}
            className="text-left text-sm font-semibold"
          >
            {ia.balao}
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
      ) : null}
    </div>
  );
}
