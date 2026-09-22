import "server-only";
import { z } from "zod";

/**
 * Configuração de SERVIDOR. `server-only` faz o build falhar se algum
 * componente de cliente importar este arquivo — o esquema carrega os nomes
 * dos segredos e o Zod inteiro. O que vai ao navegador está em
 * `lib/config-publica.ts`.
 */

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
