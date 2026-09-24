import { CONFIG_PUBLICA } from "@/lib/config-publica";
import type { Linha } from "@/lib/linhas/esquema";
import { linkDoWhatsapp } from "@/lib/webchat/whatsapp";

export function SecaoFechamento({ linha }: { linha: Linha }) {
  return (
    <section className="border-t border-borda bg-superficie py-24 text-center">
      <h2 className="mx-auto max-w-3xl px-4 text-3xl md:text-5xl">{linha.fechamento.titulo}</h2>
      <div className="mt-10 flex flex-wrap justify-center gap-4 px-4">
        <button
          type="button"
          data-abrir-chat=""
          data-item={linha.ia.contexto}
          className="min-h-12 rounded-tecnico bg-laranja px-6 py-3 font-semibold text-azul hover:brightness-110"
        >
          {linha.fechamento.cta}
        </button>
        <a
          href={linkDoWhatsapp(CONFIG_PUBLICA.whatsappFallback)}
          rel="noopener"
          className="inline-flex min-h-12 items-center rounded-tecnico border border-laranja px-6 font-semibold text-laranja"
        >
          ou pelo WhatsApp
        </a>
      </div>
    </section>
  );
}
