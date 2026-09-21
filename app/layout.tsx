import type { Metadata } from "next";
import { Rodape } from "@/components/layout/rodape";
import { lerConfigServidor } from "@/lib/config";
import { fonteMono, fonteTexto, fonteTitulo } from "./fontes";
import "./globals.css";

export function generateMetadata(): Metadata {
  const { siteUrl } = lerConfigServidor();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: "M10 Abrasivos — abrasivos diamantados para marmorarias",
      template: "%s | M10 Abrasivos",
    },
    description:
      "Discos, lixas e abrasivos diamantados para marmorarias. Fale com um especialista e receba a indicação certa para a sua pedra.",
  };
}

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${fonteTitulo.variable} ${fonteTexto.variable} ${fonteMono.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {children}
        <Rodape />
      </body>
    </html>
  );
}
