"use client";

/**
 * Casca leve do painel, mostrada enquanto o código do chat ainda está
 * chegando (primeiro clique) ou quando ele não conseguiu carregar. Vai na
 * carga de toda página junto com o botão, por isso não importa nada além do
 * React: é o que garante que o clique em "Falar com especialista" sempre
 * mostra alguma coisa — no mínimo, a saída pelo WhatsApp.
 */
export function PainelProvisorio({
  linkDoWhatsapp,
  falhou,
  aoFechar,
}: {
  linkDoWhatsapp: string;
  falhou: boolean;
  aoFechar: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Conversa com o especialista"
      aria-modal="true"
      onKeyDown={(evento) => {
        if (evento.key === "Escape") aoFechar();
      }}
      className="fixed bottom-24 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 rounded-tecnico border border-borda bg-superficie p-4 shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Especialista M10</p>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar conversa"
          className="min-h-11 min-w-11 text-texto-secundario"
        >
          ✕
        </button>
      </div>
      <p role="status" className="text-sm text-texto-secundario">
        {falhou
          ? "Não consegui abrir o chat agora. Continue pelo WhatsApp."
          : "Abrindo a conversa…"}
      </p>
      <a
        href={linkDoWhatsapp}
        rel="noopener"
        className="min-h-11 rounded-tecnico bg-laranja px-4 py-2 text-center text-sm font-semibold text-azul"
      >
        {falhou ? "Continuar no WhatsApp" : "Prefiro falar pelo WhatsApp"}
      </a>
    </div>
  );
}
