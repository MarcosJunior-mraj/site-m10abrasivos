import type { Metadata } from "next";
import Link from "next/link";
import { GradeTecnica } from "@/components/marca/grade-tecnica";

export const metadata: Metadata = {
  title: "Página não encontrada",
};

export default function NaoEncontrada() {
  return (
    <main className="relative isolate flex min-h-[60svh] items-center overflow-hidden">
      <GradeTecnica />
      <div className="relative mx-auto flex max-w-2xl flex-col gap-6 px-4">
        <p className="font-mono text-sm text-laranja">404</p>
        <h1 className="text-3xl">Esta página saiu de linha</h1>
        <p className="text-texto-secundario">
          O item pode ter sido despublicado. Volte ao catálogo ou fale com um especialista — a gente
          acha o abrasivo certo para o seu serviço.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/"
            className="rounded-tecnico border border-borda px-6 py-3 hover:border-laranja"
          >
            Voltar ao início
          </Link>
          <button
            type="button"
            data-abrir-chat=""
            className="rounded-tecnico bg-laranja px-6 py-3 font-semibold text-azul hover:brightness-110"
          >
            Falar com especialista
          </button>
        </div>
      </div>
    </main>
  );
}
