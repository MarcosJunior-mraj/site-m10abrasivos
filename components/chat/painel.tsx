"use client";

import { useEffect, useRef, useState } from "react";
import { Bolhas } from "@/components/chat/bolhas";
import type { EstadoDoChat } from "@/lib/webchat/tipos";

/**
 * Componente de apresentação puro: recebe o estado do chat e devolve eventos
 * (`aoEnviar`, `aoFechar`). Não conhece rede — quem fala com o CRM é o
 * `ClienteWebchat`, montado pelo `Widget`. É essa divisão que torna o painel
 * testável sem simular `fetch` nem `EventSource`.
 */
export function Painel({
  estado,
  aoEnviar,
  aoFechar,
}: {
  estado: EstadoDoChat;
  aoEnviar: (texto: string) => void;
  aoFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const painel = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    campo.current?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        aoFechar();
        return;
      }
      if (evento.key !== "Tab") return;

      // Foco preso no painel: Tab e Shift+Tab dão a volta entre o primeiro e
      // o último elemento focável, sem escapar para o resto da página.
      const raiz = painel.current;
      const focaveis = raiz?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  }, [aoFechar]);

  const degradado = estado.fase === "degradado";

  return (
    <div
      ref={painel}
      role="dialog"
      aria-label="Conversa com o especialista"
      aria-modal="true"
      className="fixed bottom-24 right-4 z-50 flex h-[32rem] w-[min(24rem,calc(100vw-2rem))] flex-col rounded-tecnico border border-borda bg-superficie shadow-2xl"
    >
      <header className="flex items-center justify-between border-b border-borda px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Especialista M10</p>
          <p className="text-xs text-texto-secundario">
            {estado.vendedorEntrou ? "on-line" : "responde em minutos"}
          </p>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar conversa"
          className="min-h-11 min-w-11 text-texto-secundario"
        >
          ✕
        </button>
      </header>

      <Bolhas
        bolhas={estado.bolhas}
        digitando={estado.digitando}
        vendedorEntrou={estado.vendedorEntrou}
      />

      {estado.aviso ? <p className="px-4 pb-2 text-xs text-laranja">{estado.aviso}</p> : null}

      {estado.ofereceuWhatsapp || degradado ? (
        <a
          href={estado.linkDoWhatsapp}
          rel="noopener"
          className="mx-4 mb-3 min-h-11 rounded-tecnico bg-laranja px-4 py-2 text-center text-sm font-semibold text-azul"
        >
          Continuar no WhatsApp
        </a>
      ) : null}

      {degradado ? null : (
        <form
          className="flex gap-2 border-t border-borda p-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            const limpo = texto.trim();
            if (!limpo) return;
            aoEnviar(limpo);
            setTexto("");
          }}
        >
          <textarea
            ref={campo}
            aria-label="Sua mensagem"
            rows={2}
            maxLength={1000}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter" && !evento.shiftKey) {
                evento.preventDefault();
                evento.currentTarget.form?.requestSubmit();
              }
            }}
            className="min-h-11 flex-1 resize-none rounded-tecnico border border-borda bg-azul px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="min-h-11 rounded-tecnico bg-laranja px-4 text-sm font-semibold text-azul"
          >
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
