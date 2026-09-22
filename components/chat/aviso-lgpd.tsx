"use client";

import Link from "next/link";

/** Aviso de LGPD exibido antes de qualquer conversa, no primeiro uso do chat. */
export function AvisoLgpd({
  aoAceitar,
  aoRecusar,
}: {
  aoAceitar: () => void;
  aoRecusar: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Aviso de privacidade"
      className="fixed bottom-24 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-tecnico border border-borda bg-superficie p-4"
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
