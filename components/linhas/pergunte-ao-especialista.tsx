import type { Linha } from "@/lib/linhas/esquema";

/**
 * Seção 5. `data-chat-embutido` diz ao widget que os gatilhos daqui abrem o painel
 * DENTRO de `data-chat-alvo` (portal), na mesma conversa do botão flutuante.
 * A prévia some sozinha (CSS) quando o painel é montado no alvo.
 */
export function PergunteAoEspecialista({ linha }: { linha: Linha }) {
  return (
    <section aria-labelledby="especialista" className="mx-auto max-w-3xl px-4 py-20">
      <h2 id="especialista" className="text-3xl">
        {linha.especialista.titulo}
      </h2>
      <div data-chat-embutido="" data-testid="chat-embutido" className="mt-8">
        <div data-chat-alvo="" />
        <div data-chat-previa="" className="rounded-tecnico border border-borda bg-superficie p-6">
          <p className="max-w-[85%] rounded-tecnico border border-borda bg-azul px-3 py-2 text-sm">
            {linha.ia.balao}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {linha.especialista.perguntasProntas.map((pergunta) => (
              <button
                key={pergunta}
                type="button"
                data-abrir-chat=""
                data-item={linha.ia.contexto}
                data-mensagem={pergunta}
                className="min-h-11 rounded-full border border-laranja px-4 text-sm text-laranja hover:bg-laranja hover:text-azul"
              >
                {pergunta}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-abrir-chat=""
            data-item={linha.ia.contexto}
            data-abertura={linha.ia.balao}
            className="mt-6 flex min-h-12 w-full items-center rounded-tecnico border border-borda bg-azul px-4 text-left text-sm text-texto-secundario"
          >
            Escreva sua pergunta…
          </button>
        </div>
      </div>
    </section>
  );
}
