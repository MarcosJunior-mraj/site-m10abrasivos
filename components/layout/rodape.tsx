import Link from "next/link";
import { CONFIG_PUBLICA } from "@/lib/config";

export function Rodape() {
  const whatsapp = `https://wa.me/${CONFIG_PUBLICA.whatsappFallback}`;
  return (
    <footer className="mt-24 border-t border-borda bg-superficie">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-texto-secundario md:flex-row md:justify-between">
        <p>M10 Abrasivos — abrasivos diamantados para marmorarias.</p>
        <nav aria-label="Rodapé" className="flex gap-6">
          <Link href="/privacidade" className="hover:text-texto">
            Política de privacidade
          </Link>
          <a href={whatsapp} className="hover:text-texto" rel="noopener">
            WhatsApp
          </a>
        </nav>
      </div>
    </footer>
  );
}
