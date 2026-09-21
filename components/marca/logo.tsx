import Image from "next/image";

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
  return (
    <Image
      src={ARQUIVOS[variante]}
      alt="M10 Abrasivos"
      width={largura}
      height={Math.round(largura * 0.32)}
      priority={prioridade}
    />
  );
}
