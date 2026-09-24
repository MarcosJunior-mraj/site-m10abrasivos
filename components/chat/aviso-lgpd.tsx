"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * Aviso de LGPD exibido antes de qualquer conversa, no primeiro uso do chat.
 * Recebe o mesmo tratamento de acessibilidade do painel de conversa: foco
 * inicial dentro do diálogo, Tab/Shift+Tab presos nas suas pontas e Esc
 * fechando pelo mesmo caminho do botão "Agora não" (devolve o foco ao botão
 * flutuante, porque `aoRecusar` já é essa função no `Widget`).
 *
 * Variante "embutido" (chat aberto por uma seção da página): mesmo lugar do
 * painel embutido — uma região dentro da seção, sem prender o foco nem
 * fechar no Esc, como o `Painel` embutido.
 */
export function AvisoLgpd({
  aoAceitar,
  aoRecusar,
  variante = "flutuante",
}: {
  aoAceitar: () => void;
  aoRecusar: () => void;
  variante?: "flutuante" | "embutido";
}) {
  const aviso = useRef<HTMLDivElement>(null);
  const aceitar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    aceitar.current?.focus();
    if (variante === "embutido") return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        aoRecusar();
        return;
      }
      if (evento.key !== "Tab") return;

      const focaveis = aviso.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focaveis || focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoRecusar, variante]);

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role é dinâmico (region/dialog); os dois aceitam aria-label.
    <div
      ref={aviso}
      role={variante === "embutido" ? "region" : "dialog"}
      aria-modal={variante === "embutido" ? undefined : "true"}
      aria-label="Aviso de privacidade"
      className={
        variante === "embutido"
          ? "w-full rounded-tecnico border border-borda bg-superficie p-4"
          : "fixed bottom-24 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-tecnico border border-borda bg-superficie p-4"
      }
    >
      <p className="text-sm">
        Esta conversa é registrada para atendimento. Veja a{" "}
        <Link href="/privacidade" className="text-laranja underline">
          política de privacidade
        </Link>
        .
      </p>
      <div className="mt-4 flex gap-3">
        <button
          ref={aceitar}
          type="button"
          onClick={aoAceitar}
          className="min-h-11 rounded-tecnico bg-laranja px-4 font-semibold text-azul"
        >
          Entendi
        </button>
        <button
          type="button"
          onClick={aoRecusar}
          className="min-h-11 px-2 text-sm text-texto-secundario"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
