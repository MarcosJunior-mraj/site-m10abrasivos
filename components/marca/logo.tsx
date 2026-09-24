import Image from "next/image";
import { DIMENSOES_LOGO } from "@/components/marca/logo-proporcoes.generated";

const ARQUIVOS = {
  negativo: "/logo-m10-negativo.png",
  positivo: "/logo-m10-positivo.png",
} as const;

export function Logo({
  variante = "negativo",
  largura = 160,
  prioridade = false,
}: {
  variante?: keyof typeof ARQUIVOS;
  largura?: number;
  prioridade?: boolean;
}) {
  // Altura calculada pela proporção REAL do arquivo gerado por
  // `scripts/preparar-logos.mjs` (components/marca/logo-proporcoes.generated.ts),
  // não por um número de proporção solto — a caixa reservada pelo
  // width/height sempre bate com a imagem publicada, sem CLS.
  const { largura: larguraOriginal, altura: alturaOriginal } = DIMENSOES_LOGO[variante];
  return (
    <Image
      src={ARQUIVOS[variante]}
      alt="M10 Abrasivos"
      width={largura}
      height={Math.round((largura * alturaOriginal) / larguraOriginal)}
      priority={prioridade}
      fetchPriority={prioridade ? "high" : undefined}
    />
  );
}
