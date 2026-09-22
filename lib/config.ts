import { z } from "zod";

const esquemaServidor = z.object({
  CRM_URL: z.url(),
  CATALOG_KEY: z.string().min(1),
  // O segredo é comparado com o que o CRM manda; curto demais não protege nada.
  SITE_REVALIDATE_SECRET: z.string().min(16),
  SITE_URL: z.url(),
  EMPRESA_RAZAO_SOCIAL: z.string().min(1),
  EMPRESA_CNPJ: z.string().min(1),
  EMPRESA_EMAIL_ENCARREGADO: z.email(),
  // Opcional: hosts (só o nome, separados por vírgula) além do Bling de onde a
  // rota de imagem pode buscar foto — ver lib/catalog/origem-de-imagem.ts.
  IMAGENS_HOSTS_EXTRAS: z.string().optional(),
});

export type ConfigServidor = {
  crmUrl: string;
  catalogKey: string;
  revalidateSecret: string;
  siteUrl: string;
  imagensHostsExtras: string[];
  empresa: { razaoSocial: string; cnpj: string; emailEncarregado: string };
};

function semBarraFinal(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Lê a configuração do servidor. Lança com os nomes das variáveis problemáticas
 * — um site no ar sem `CATALOG_KEY` renderiza vitrine vazia em silêncio, o que
 * é pior do que não subir.
 */
export function lerConfigServidor(
  env: Record<string, string | undefined> = process.env,
): ConfigServidor {
  const resultado = esquemaServidor.safeParse(env);
  if (!resultado.success) {
    const nomes = [...new Set(resultado.error.issues.map((problema) => String(problema.path[0])))];
    throw new Error(`Configuração do site incompleta ou inválida: ${nomes.join(", ")}`);
  }
  const dados = resultado.data;
  return {
    crmUrl: semBarraFinal(dados.CRM_URL),
    catalogKey: dados.CATALOG_KEY,
    revalidateSecret: dados.SITE_REVALIDATE_SECRET,
    siteUrl: semBarraFinal(dados.SITE_URL),
    imagensHostsExtras: (dados.IMAGENS_HOSTS_EXTRAS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0),
    empresa: {
      razaoSocial: dados.EMPRESA_RAZAO_SOCIAL,
      cnpj: dados.EMPRESA_CNPJ,
      emailEncarregado: dados.EMPRESA_EMAIL_ENCARREGADO,
    },
  };
}

/**
 * Configuração que pode ir ao navegador. Os nomes precisam estar escritos por
 * extenso: o Next só troca `process.env.NEXT_PUBLIC_X` por valor literal quando
 * a expressão aparece assim no código.
 */
export const CONFIG_PUBLICA = {
  crmUrl: (process.env.NEXT_PUBLIC_CRM_URL ?? "").replace(/\/+$/, ""),
  webchatKey: process.env.NEXT_PUBLIC_WEBCHAT_KEY ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  whatsappFallback: (process.env.NEXT_PUBLIC_WHATSAPP_FALLBACK ?? "").replace(/\D/g, ""),
} as const;
