import { GradeTecnica } from "@/components/marca/grade-tecnica";
import { Logo } from "@/components/marca/logo";
import { Veios } from "@/components/marca/veios";

export function Hero() {
  return (
    <section className="relative isolate min-h-[70svh] overflow-hidden border-b border-borda">
      <GradeTecnica />
      <Veios />
      <div className="relative mx-auto flex max-w-6xl flex-col justify-center gap-6 px-4 py-24">
        <Logo largura={220} prioridade />
        <h1 className="max-w-3xl text-4xl leading-tight md:text-6xl">
          Abrasivos diamantados para quem vive de acabamento
        </h1>
        <p className="max-w-prose text-lg text-texto-secundario">
          Diga a pedra, a máquina e o acabamento que você precisa. Um especialista indica a
          sequência certa e monta o seu pedido.
        </p>
        <div>
          <button
            type="button"
            data-abrir-chat
            className="rounded-tecnico bg-laranja px-6 py-3 font-semibold text-azul hover:brightness-110"
          >
            Falar com especialista
          </button>
        </div>
      </div>
    </section>
  );
}
