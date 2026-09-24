import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  // O CRM falso guarda estado (contagem de requisições, histórico da
  // conversa) num único processo compartilhado por toda a suíte. Rodar em
  // série evita que dois testes em paralelo pisem no estado um do outro.
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3100", trace: "on-first-retry" },
  webServer: [
    { command: "npx tsx tests/e2e/crm-falso.ts", port: 3101, reuseExistingServer: false },
    {
      // `wait-on` garante que o CRM falso já esteja de pé antes do `build`:
      // as páginas leem o catálogo durante o build, então uma corrida aqui
      // faria o build falhar ou congelar esperando uma porta que ainda não
      // abriu.
      command: "npx wait-on tcp:3101 && npm run build && npx next start -p 3100",
      port: 3100,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        CRM_URL: "http://localhost:3101",
        CATALOG_KEY: "m10cat_teste",
        SITE_REVALIDATE_SECRET: "segredo-de-teste-16chars",
        SITE_URL: "http://localhost:3100",
        EMPRESA_RAZAO_SOCIAL: "M10 Abrasivos Ltda",
        EMPRESA_CNPJ: "00.000.000/0001-00",
        EMPRESA_EMAIL_ENCARREGADO: "privacidade@exemplo.com",
        NEXT_PUBLIC_CRM_URL: "http://localhost:3101",
        NEXT_PUBLIC_WEBCHAT_KEY: "m10chat_teste",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
        NEXT_PUBLIC_WHATSAPP_FALLBACK: "5511999999999",
      },
    },
  ],
});
