# Etapa 1 — CRM: Catálogo, Bling e Kits — Plano de Implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** Espelhar os produtos do Bling no CRM, permitir que o admin publique e enriqueça produtos, monte kits com preço calculado e exponha um catálogo público **sem preço** para o futuro site.

**Arquitetura:** Integração OAuth2 com a API v3 do Bling guardando tokens em tabela acessível só pelo service role; sincronização a cada 15 min pelo agendador de jobs que já existe (`lib/jobs/index.ts`, via `instrumentation.ts`), com botão manual. Tabelas de catálogo com RLS por organização. Regras de preço/disponibilidade/integridade de kits como funções puras testadas. API pública somente leitura autenticada por chave por organização, consultando apenas colunas públicas.

**Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript estrito, Supabase (Postgres + RLS), Zod 4, Vitest 4, Biome, shadcn/base-ui (`components/ui`), lucide-react.

**Spec:** `ias/site/docs/superpowers/specs/2026-09-16-site-abrasivos-ia-vendedora-design.md` (seção 4)

**Repositório-alvo:** `C:\Users\Marcos Junior\ias\CRM\a716fb05-c23a-4715-819a-aa4f4e833115-template_crm_agentes-main\template_crm_agentes-main` (chamado de `<crm>` abaixo). **Todos os caminhos de arquivo deste plano são relativos a `<crm>`.**

## Restrições Globais

- UI, mensagens de erro, docs e comentários em **PT-BR**; código (variáveis, funções, arquivos, tabelas, colunas) em **inglês**. Arquivos kebab-case.
- Server Actions retornam `{ ok: true; data?: T } | { ok: false; error: string }`; nunca retornam `error.message` cru — logam com `logError(scope, err)` e devolvem mensagem leiga.
- Toda página em `/app/[orgSlug]/` começa com `requireOrgMember` ou `requireOrgRole`. Todo o catálogo e a integração são **somente owner/admin** (`requireOrgRole({ orgSlug, roles: ["owner", "admin"] })`).
- Toda tabela nova: `organization_id` + `enable row level security` + policies com `public.is_org_member` / `public.has_org_role`. **Nunca** `force row level security` (o arquivo `_TEMPLATE_org_scoped_table.sql.example` tem essa linha — não copiar).
- Recentes usam `text ... check (x in (...))`, não enums. Índices: `<tabela>_<coluna>_idx`. Migrations terminam com `comment on table ...` em PT-BR.
- Proibido `any`. Schemas Zod sem `.default()`. Tipos do banco em `types/supabase.ts` (regenerar com `npm run types`).
- `SUPABASE_SERVICE_ROLE_KEY` / `createServiceClient()` só em código server-side.
- Tokens do Bling **nunca** chegam ao browser nem ficam legíveis por membros (a tabela `channels` é legível por membros — por isso os tokens ficam em tabela separada sem policies).
- Limites do Bling: **3 requisições/s**, 120.000/dia; 429 quando excede; `/oauth/token` bloqueia IP após 20 chamadas em 60 s.
- Preço do kit = Σ(preço Bling × quantidade) × (1 − desconto/100), 2 casas. Disponibilidade = mín(⌊estoque ÷ quantidade⌋).
- Nada de preço ou estoque em qualquer resposta de `/api/public/*`.
- Antes de declarar pronto: `npx tsc --noEmit`, `npm run build`, `npm run test`, `npm run check`.
- Trabalhar na branch `feat/catalogo-bling`. **Nunca** push para `main` sem permissão explícita do usuário.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019DRxYuxg1Mdn1521ZLkkZt
  ```

## Ajustes em relação à spec (descobertos ao ler o CRM)

1. **Agendamento:** a spec previa `pg_cron` + `pg_net`. O CRM já roda jobs com `setInterval` iniciados por `instrumentation.ts` (feito para Easypanel), e a migration `20260525000018_drop_pgnet_dblink.sql` removeu `pg_net` por segurança. O sync do Bling entra como **mais um job em `lib/jobs/index.ts`**; nenhum `pg_cron`/`pg_net` é instalado e nenhuma rota `/api/cron/bling-sync` é criada. `vercel.json` fica como está.
2. **Aviso para admins:** não existe tabela de notificações; o precedente (`lib/agent/recovery.ts`) é criar **tarefa com prioridade alta**. Kit retirado do ar e falha de token geram tarefa.
3. **API pública:** em vez de uma view SQL, as rotas usam `createServiceClient()` com **lista fixa de colunas públicas** em `lib/catalog/public-queries.ts`, coberta por teste que garante ausência de preço/estoque.
4. **`bling_category`:** a listagem de produtos do Bling não traz categoria; o campo sai do modelo (as categorias do site são as do CRM).
5. **Limites da IA (R$ 2.000 / 20 un.):** ficam para a Etapa 3, junto do agente.

## Mapa de arquivos

**Criar**
- `supabase/migrations/20260917000001_catalog_bling.sql` — todas as tabelas da etapa
- `lib/bling/constants.ts` — URLs e limites da API
- `lib/bling/errors.ts` — `BlingError`
- `lib/bling/error-map.ts` — HTTP/payload → `BlingError`
- `lib/bling/client.ts` — `createBlingClient` com limitador 3 req/s e retry 429
- `lib/bling/oauth.ts` — URL de autorização, troca de código, refresh
- `lib/bling/oauth-state.ts` — state do OAuth guardado em cookie
- `lib/bling/tokens.ts` — leitura/gravação de tokens, `getValidAccessToken`
- `lib/bling/map-product.ts` — produto Bling → linha `bling_products`
- `lib/bling/sync.ts` — `syncOrganizationProducts`, `syncAllConnectedOrganizations`
- `lib/bling/queries.ts` — status seguro da integração para a UI
- `lib/bling/actions.ts` — sincronizar agora, desconectar
- `lib/bling/CLAUDE.md` — documentação do módulo
- `app/api/integrations/bling/connect/route.ts` — inicia OAuth
- `app/api/integrations/bling/callback/route.ts` — recebe código
- `app/(app)/app/[orgSlug]/settings/integracoes/bling/page.tsx`
- `app/(app)/app/[orgSlug]/settings/integracoes/bling/_components/bling-connection-card.tsx`
- `lib/catalog/kit-pricing.ts` — preço, disponibilidade, problemas de kit (puro)
- `lib/catalog/kit-rows.ts` — select e conversão das linhas de kit
- `lib/catalog/kit-guard.ts` — `planKitUnpublish` (puro) + `enforceKitIntegrity` (I/O)
- `lib/catalog/kit-queries.ts` — consultas das telas de kit
- `lib/catalog/format.ts` — `formatBRL`
- `lib/catalog/slug.ts` — `slugifyCatalog`, `isValidCatalogSlug`
- `lib/catalog/options.ts` — pedras e aplicações
- `lib/catalog/schemas.ts` — Zod das actions
- `lib/catalog/queries.ts` — consultas das telas
- `lib/catalog/actions.ts` — produtos publicados e categorias
- `lib/catalog/kit-actions.ts` — kits
- `lib/catalog/public-key.ts` — gerar/validar chave pública (hash SHA-256)
- `lib/catalog/settings-actions.ts` — gerar chave
- `lib/catalog/public-queries.ts` — consultas públicas sem preço
- `lib/catalog/notify-site.ts` — aviso de revalidação ao site
- `lib/catalog/CLAUDE.md`
- `app/api/public/catalog/_lib/auth.ts`
- `app/api/public/catalog/categories/route.ts`
- `app/api/public/catalog/items/route.ts`
- `app/api/public/catalog/items/[slug]/route.ts`
- `app/(app)/app/[orgSlug]/catalogo/_components/catalog-nav.tsx`
- `app/(app)/app/[orgSlug]/catalogo/page.tsx`
- `app/(app)/app/[orgSlug]/catalogo/_components/products-table.tsx`
- `app/(app)/app/[orgSlug]/catalogo/_components/product-publish-dialog.tsx`
- `app/(app)/app/[orgSlug]/catalogo/categorias/page.tsx`
- `app/(app)/app/[orgSlug]/catalogo/categorias/_components/categories-manager.tsx`
- `app/(app)/app/[orgSlug]/catalogo/kits/page.tsx`
- `app/(app)/app/[orgSlug]/catalogo/kits/novo/page.tsx`
- `app/(app)/app/[orgSlug]/catalogo/kits/[kitId]/page.tsx`
- `app/(app)/app/[orgSlug]/catalogo/kits/_components/kit-form.tsx`
- `app/(app)/app/[orgSlug]/catalogo/kits/_components/kit-publish-switch.tsx`
- `app/(app)/app/[orgSlug]/catalogo/api-do-site/page.tsx`
- `app/(app)/app/[orgSlug]/catalogo/api-do-site/_components/public-key-card.tsx`
- Testes em `tests/` (arquivos planos, padrão do repo): `catalog-migration-rls.test.ts`, `catalog-kit-pricing.test.ts`, `catalog-kit-guard.test.ts`, `catalog-slug.test.ts`, `catalog-schemas.test.ts`, `catalog-actions-permissions.test.ts`, `catalog-kit-actions.test.ts`, `catalog-public-key.test.ts`, `catalog-public-queries.test.ts`, `catalog-notify-site.test.ts`, `bling-error-map.test.ts`, `bling-client.test.ts`, `bling-oauth.test.ts`, `bling-tokens.test.ts`, `bling-map-product.test.ts`, `bling-sync.test.ts`, `bling-callback-state.test.ts`, `bling-actions.test.ts`

**Modificar**
- `lib/jobs/index.ts` — novo job de sync
- `config/nav.config.ts` — itens "Catálogo" e "Bling"
- `middleware.ts` — `/api/public/` como rota pública
- `types/supabase.ts` — regenerado

---

### Tarefa 1: Branch, migration e tipos

**Arquivos:**
- Criar: `supabase/migrations/20260917000001_catalog_bling.sql`
- Criar: `tests/catalog-migration-rls.test.ts`
- Modificar: `types/supabase.ts` (regenerado)

**Interfaces:**
- Produz tabelas: `bling_integrations`, `bling_products`, `product_categories`, `kits`, `kit_items`, `catalog_items`, `catalog_settings` (colunas exatas no SQL abaixo).

- [ ] **Passo 1: Criar a branch**

```bash
cd "<crm>"
git checkout main && git pull
git checkout -b feat/catalogo-bling
```

- [ ] **Passo 2: Escrever o teste que falha**

`tests/catalog-migration-rls.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260917000001_catalog_bling.sql"),
  "utf8",
).toLowerCase();

const TABLES = [
  "bling_integrations",
  "bling_products",
  "product_categories",
  "kits",
  "kit_items",
  "catalog_items",
  "catalog_settings",
];

describe("migration catalog_bling", () => {
  it.each(TABLES)("habilita RLS em %s", (table) => {
    expect(SQL).toContain(`alter table public.${table} enable row level security;`);
  });

  it("nunca usa force row level security", () => {
    expect(SQL).not.toContain("force row level security");
  });

  it("não cria policy nenhuma em bling_integrations (tokens só via service role)", () => {
    expect(SQL).not.toMatch(/create policy[^;]*on public\.bling_integrations/);
  });

  it("não instala pg_net nem pg_cron", () => {
    expect(SQL).not.toContain("pg_net");
    expect(SQL).not.toContain("pg_cron");
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

Run: `npx vitest run tests/catalog-migration-rls.test.ts`
Esperado: FAIL com `ENOENT: no such file or directory` (migration não existe).

- [ ] **Passo 4: Escrever a migration**

`supabase/migrations/20260917000001_catalog_bling.sql`:

```sql
-- Etapa 1 do site M10 Abrasivos: integração Bling + catálogo + kits.

-- ---------------------------------------------------------------------------
-- bling_integrations: tokens OAuth. SEM policies: só service role lê/escreve.
-- ---------------------------------------------------------------------------
create table if not exists public.bling_integrations (
  organization_id  uuid primary key references public.organizations(id) on delete cascade,
  access_token     text not null,
  refresh_token    text not null,
  expires_at       timestamptz not null,
  status           text not null default 'connected' check (status in ('connected', 'error')),
  connected_by     uuid references auth.users(id) on delete set null,
  last_sync_at     timestamptz,
  last_sync_error  text,
  last_sync_stats  jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.bling_integrations enable row level security;
revoke all on public.bling_integrations from anon, authenticated;

drop trigger if exists bling_integrations_set_updated_at on public.bling_integrations;
create trigger bling_integrations_set_updated_at
  before update on public.bling_integrations
  for each row execute function public.set_updated_at();

comment on table public.bling_integrations is
  'Conexão OAuth com o Bling por organização. Tokens acessíveis apenas pelo service role.';

-- ---------------------------------------------------------------------------
-- bling_products: espelho dos produtos do Bling (escrito só pelo sync).
-- ---------------------------------------------------------------------------
create table if not exists public.bling_products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  bling_id         bigint not null,
  sku              text,
  name             text not null,
  description      text,
  price            numeric(12, 2) not null default 0,
  stock            numeric(12, 2) not null default 0,
  images           jsonb not null default '[]'::jsonb,
  bling_status     text not null default 'active' check (bling_status in ('active', 'inactive')),
  synced_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, bling_id)
);
create index if not exists bling_products_organization_id_idx on public.bling_products(organization_id);
create index if not exists bling_products_synced_at_idx on public.bling_products(organization_id, synced_at);
alter table public.bling_products enable row level security;

drop policy if exists "members read bling products" on public.bling_products;
create policy "members read bling products"
  on public.bling_products for select
  using (public.is_org_member(organization_id));

drop trigger if exists bling_products_set_updated_at on public.bling_products;
create trigger bling_products_set_updated_at
  before update on public.bling_products
  for each row execute function public.set_updated_at();

comment on table public.bling_products is
  'Espelho dos produtos do Bling. Escrita somente pela sincronização (service role).';

-- ---------------------------------------------------------------------------
-- product_categories: categorias do site.
-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  slug             text not null,
  description      text,
  image_url        text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists product_categories_organization_id_idx on public.product_categories(organization_id);
alter table public.product_categories enable row level security;

drop policy if exists "members read product categories" on public.product_categories;
create policy "members read product categories"
  on public.product_categories for select
  using (public.is_org_member(organization_id));
drop policy if exists "admins insert product categories" on public.product_categories;
create policy "admins insert product categories"
  on public.product_categories for insert
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins update product categories" on public.product_categories;
create policy "admins update product categories"
  on public.product_categories for update
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]))
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins delete product categories" on public.product_categories;
create policy "admins delete product categories"
  on public.product_categories for delete
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));

drop trigger if exists product_categories_set_updated_at on public.product_categories;
create trigger product_categories_set_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

comment on table public.product_categories is 'Categorias do catálogo do site (Discos, Lixas, Abrasivos...).';

-- ---------------------------------------------------------------------------
-- kits + kit_items
-- ---------------------------------------------------------------------------
create table if not exists public.kits (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 120),
  description      text,
  image_url        text,
  discount_pct     numeric(5, 2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  hidden_reason    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists kits_organization_id_idx on public.kits(organization_id);
alter table public.kits enable row level security;

drop policy if exists "members read kits" on public.kits;
create policy "members read kits"
  on public.kits for select
  using (public.is_org_member(organization_id));
drop policy if exists "admins insert kits" on public.kits;
create policy "admins insert kits"
  on public.kits for insert
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins update kits" on public.kits;
create policy "admins update kits"
  on public.kits for update
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]))
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins delete kits" on public.kits;
create policy "admins delete kits"
  on public.kits for delete
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));

drop trigger if exists kits_set_updated_at on public.kits;
create trigger kits_set_updated_at
  before update on public.kits
  for each row execute function public.set_updated_at();

comment on table public.kits is 'Kits montados no CRM; preço = soma dos itens do Bling com desconto.';

create table if not exists public.kit_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  kit_id            uuid not null references public.kits(id) on delete cascade,
  bling_product_id  uuid not null references public.bling_products(id) on delete restrict,
  quantity          integer not null check (quantity > 0 and quantity <= 1000),
  created_at        timestamptz not null default now(),
  unique (kit_id, bling_product_id)
);
create index if not exists kit_items_kit_id_idx on public.kit_items(kit_id);
create index if not exists kit_items_organization_id_idx on public.kit_items(organization_id);
alter table public.kit_items enable row level security;

drop policy if exists "members read kit items" on public.kit_items;
create policy "members read kit items"
  on public.kit_items for select
  using (public.is_org_member(organization_id));
drop policy if exists "admins insert kit items" on public.kit_items;
create policy "admins insert kit items"
  on public.kit_items for insert
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins update kit items" on public.kit_items;
create policy "admins update kit items"
  on public.kit_items for update
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]))
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins delete kit items" on public.kit_items;
create policy "admins delete kit items"
  on public.kit_items for delete
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));

comment on table public.kit_items is 'Produtos do Bling (com quantidade) que compõem cada kit.';

-- ---------------------------------------------------------------------------
-- catalog_items: o que aparece no site (produto avulso ou kit).
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  kind              text not null check (kind in ('product', 'kit')),
  bling_product_id  uuid references public.bling_products(id) on delete cascade,
  kit_id            uuid references public.kits(id) on delete cascade,
  is_published      boolean not null default false,
  slug              text not null,
  category_id       uuid references public.product_categories(id) on delete set null,
  title             text,
  description       text,
  stones            text[] not null default '{}',
  applications      text[] not null default '{}',
  grit              text,
  diameter_mm       integer check (diameter_mm is null or (diameter_mm > 0 and diameter_mm <= 2000)),
  machines          text[] not null default '{}',
  specs             jsonb not null default '{}'::jsonb,
  is_featured       boolean not null default false,
  sort_order        integer not null default 0,
  seo_title         text,
  seo_description   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, slug),
  constraint catalog_items_kind_target_check check (
    (kind = 'product' and bling_product_id is not null and kit_id is null)
    or (kind = 'kit' and kit_id is not null and bling_product_id is null)
  )
);
create unique index if not exists catalog_items_bling_product_id_idx
  on public.catalog_items(bling_product_id) where bling_product_id is not null;
create unique index if not exists catalog_items_kit_id_idx
  on public.catalog_items(kit_id) where kit_id is not null;
create index if not exists catalog_items_published_idx
  on public.catalog_items(organization_id, is_published);
alter table public.catalog_items enable row level security;

drop policy if exists "members read catalog items" on public.catalog_items;
create policy "members read catalog items"
  on public.catalog_items for select
  using (public.is_org_member(organization_id));
drop policy if exists "admins insert catalog items" on public.catalog_items;
create policy "admins insert catalog items"
  on public.catalog_items for insert
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins update catalog items" on public.catalog_items;
create policy "admins update catalog items"
  on public.catalog_items for update
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]))
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins delete catalog items" on public.catalog_items;
create policy "admins delete catalog items"
  on public.catalog_items for delete
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));

drop trigger if exists catalog_items_set_updated_at on public.catalog_items;
create trigger catalog_items_set_updated_at
  before update on public.catalog_items
  for each row execute function public.set_updated_at();

comment on table public.catalog_items is
  'Itens do catálogo do site (produtos publicados e kits) com ficha técnica. Sem preço.';

-- ---------------------------------------------------------------------------
-- catalog_settings: chave da API pública do catálogo (guardada como hash).
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_settings (
  organization_id       uuid primary key references public.organizations(id) on delete cascade,
  public_key_hash       text unique,
  public_key_prefix     text,
  public_key_created_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.catalog_settings enable row level security;

drop policy if exists "admins read catalog settings" on public.catalog_settings;
create policy "admins read catalog settings"
  on public.catalog_settings for select
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins insert catalog settings" on public.catalog_settings;
create policy "admins insert catalog settings"
  on public.catalog_settings for insert
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));
drop policy if exists "admins update catalog settings" on public.catalog_settings;
create policy "admins update catalog settings"
  on public.catalog_settings for update
  using (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]))
  with check (public.has_org_role(organization_id, '{owner,admin}'::public.org_role[]));

drop trigger if exists catalog_settings_set_updated_at on public.catalog_settings;
create trigger catalog_settings_set_updated_at
  before update on public.catalog_settings
  for each row execute function public.set_updated_at();

comment on table public.catalog_settings is 'Configurações do catálogo público (hash da chave da API do site).';
```

- [ ] **Passo 5: Rodar o teste e ver passar**

Run: `npx vitest run tests/catalog-migration-rls.test.ts`
Esperado: PASS (10 testes).

- [ ] **Passo 6: Aplicar a migration e regenerar os tipos**

**Pedir aprovação do usuário antes de aplicar** (regra do CLAUDE.md para migrations). Aplicar por um dos caminhos documentados em `docs/01-comecando/03-rodando-pela-primeira-vez.md`:
- Caminho A: `npx supabase db push`
- Caminho B: colar o SQL no SQL Editor do Supabase.

Depois:

```bash
npm run types
npx tsc --noEmit
```
Esperado: `types/supabase.ts` passa a conter `bling_products`, `catalog_items` etc.; `tsc` sem erros.

- [ ] **Passo 7: Commit**

```bash
git add supabase/migrations/20260917000001_catalog_bling.sql tests/catalog-migration-rls.test.ts types/supabase.ts
git commit -m "feat(catalogo): tabelas de integração Bling, catálogo e kits com RLS"
```

---

### Tarefa 2: Regras de kit e slug (funções puras)

**Arquivos:**
- Criar: `lib/catalog/kit-pricing.ts`
- Criar: `lib/catalog/slug.ts`
- Teste: `tests/catalog-kit-pricing.test.ts`, `tests/catalog-slug.test.ts`

**Interfaces:**
- Produz:
  ```ts
  export type KitComponent = {
    blingProductId: string;
    name: string;
    quantity: number;
    price: number;
    stock: number;
    blingStatus: "active" | "inactive";
    productPublished: boolean;
  };
  export type KitProblem = { blingProductId: string; name: string; reason: "inactive" | "not_published" | "empty" };
  export function computeKitPrice(components: KitComponent[], discountPct: number): number;
  export function computeKitAvailability(components: KitComponent[]): number;
  export function findKitProblems(components: KitComponent[]): KitProblem[];
  export function describeKitProblems(problems: KitProblem[]): string;
  export function slugifyCatalog(input: string): string;
  export function isValidCatalogSlug(slug: string): boolean;
  ```

- [ ] **Passo 1: Escrever os testes que falham**

`tests/catalog-kit-pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  computeKitAvailability,
  computeKitPrice,
  describeKitProblems,
  findKitProblems,
  type KitComponent,
} from "@/lib/catalog/kit-pricing";

function comp(overrides: Partial<KitComponent>): KitComponent {
  return {
    blingProductId: "p1",
    name: "Disco Turbo 350",
    quantity: 1,
    price: 100,
    stock: 10,
    blingStatus: "active",
    productPublished: true,
    ...overrides,
  };
}

describe("computeKitPrice", () => {
  it("soma preço × quantidade e aplica o desconto", () => {
    const components = [
      comp({ blingProductId: "a", price: 120.5, quantity: 1 }),
      comp({ blingProductId: "b", price: 9.9, quantity: 7 }),
    ];
    // (120.50 + 69.30) = 189.80 × 0.9 = 170.82
    expect(computeKitPrice(components, 10)).toBe(170.82);
  });

  it("arredonda para 2 casas sem erro de ponto flutuante", () => {
    expect(computeKitPrice([comp({ price: 0.1, quantity: 3 })], 0)).toBe(0.3);
    expect(computeKitPrice([comp({ price: 33.33, quantity: 1 })], 15)).toBe(28.33);
  });

  it("desconto 0 devolve a soma e kit vazio custa 0", () => {
    expect(computeKitPrice([comp({ price: 50, quantity: 2 })], 0)).toBe(100);
    expect(computeKitPrice([], 10)).toBe(0);
  });
});

describe("computeKitAvailability", () => {
  it("é limitada pelo item com menos kits possíveis", () => {
    const components = [
      comp({ blingProductId: "a", stock: 10, quantity: 1 }),
      comp({ blingProductId: "b", stock: 21, quantity: 7 }),
    ];
    expect(computeKitAvailability(components)).toBe(3);
  });

  it("estoque negativo ou kit vazio vira 0", () => {
    expect(computeKitAvailability([comp({ stock: -2 })])).toBe(0);
    expect(computeKitAvailability([])).toBe(0);
  });
});

describe("findKitProblems / describeKitProblems", () => {
  it("aponta item inativo no Bling e item não publicado", () => {
    const problems = findKitProblems([
      comp({ blingProductId: "a", name: "Lixa 50", blingStatus: "inactive" }),
      comp({ blingProductId: "b", name: "Lixa 100", productPublished: false }),
      comp({ blingProductId: "c", name: "Lixa 200" }),
    ]);
    expect(problems).toEqual([
      { blingProductId: "a", name: "Lixa 50", reason: "inactive" },
      { blingProductId: "b", name: "Lixa 100", reason: "not_published" },
    ]);
    expect(describeKitProblems(problems)).toBe(
      "Lixa 50 está inativo no Bling; Lixa 100 não está publicado no catálogo",
    );
  });

  it("kit sem itens é um problema", () => {
    expect(describeKitProblems(findKitProblems([]))).toBe("O kit não tem itens");
  });
});
```

`tests/catalog-slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isValidCatalogSlug, slugifyCatalog } from "@/lib/catalog/slug";

describe("slugifyCatalog", () => {
  it("remove acentos, símbolos e espaços", () => {
    expect(slugifyCatalog("Disco Diamantado Ø350 — Turbo")).toBe("disco-diamantado-350-turbo");
    expect(slugifyCatalog("  Lixa d'água nº 3000 ")).toBe("lixa-dagua-n-3000");
  });

  it("limita a 80 caracteres sem hífen no fim", () => {
    const slug = slugifyCatalog(`${"a".repeat(79)} bbbb`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("isValidCatalogSlug", () => {
  it("aceita slugs válidos e recusa inválidos", () => {
    expect(isValidCatalogSlug("kit-polimento-granito")).toBe(true);
    expect(isValidCatalogSlug("Kit Polimento")).toBe(false);
    expect(isValidCatalogSlug("-kit")).toBe(false);
    expect(isValidCatalogSlug("")).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/catalog-kit-pricing.test.ts tests/catalog-slug.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/catalog/kit-pricing"`.

- [ ] **Passo 3: Implementar**

`lib/catalog/kit-pricing.ts`:

```ts
/**
 * Regras puras de kits (spec §4.3). Sem I/O — testadas em tests/catalog-kit-pricing.test.ts.
 */

export type KitComponent = {
  blingProductId: string;
  name: string;
  quantity: number;
  price: number;
  stock: number;
  blingStatus: "active" | "inactive";
  productPublished: boolean;
};

export type KitProblem = {
  blingProductId: string;
  name: string;
  reason: "inactive" | "not_published" | "empty";
};

/** Preço = Σ(preço × quantidade) × (1 − desconto/100), calculado em centavos. */
export function computeKitPrice(components: KitComponent[], discountPct: number): number {
  const totalCents = components.reduce(
    (sum, c) => sum + Math.round(c.price * 100) * c.quantity,
    0,
  );
  const discountedCents = Math.round((totalCents * (100 - discountPct)) / 100);
  return discountedCents / 100;
}

/** Quantos kits completos o estoque atual permite montar. */
export function computeKitAvailability(components: KitComponent[]): number {
  if (components.length === 0) return 0;
  const perItem = components.map((c) => Math.max(0, Math.floor(c.stock / c.quantity)));
  return Math.min(...perItem);
}

export function findKitProblems(components: KitComponent[]): KitProblem[] {
  const problems: KitProblem[] = [];
  for (const c of components) {
    if (c.blingStatus === "inactive") {
      problems.push({ blingProductId: c.blingProductId, name: c.name, reason: "inactive" });
    } else if (!c.productPublished) {
      problems.push({ blingProductId: c.blingProductId, name: c.name, reason: "not_published" });
    }
  }
  if (components.length === 0) {
    problems.push({ blingProductId: "", name: "", reason: "empty" });
  }
  return problems;
}

export function describeKitProblems(problems: KitProblem[]): string {
  return problems
    .map((p) => {
      if (p.reason === "empty") return "O kit não tem itens";
      if (p.reason === "inactive") return `${p.name} está inativo no Bling`;
      return `${p.name} não está publicado no catálogo`;
    })
    .join("; ");
}
```

`lib/catalog/slug.ts`:

```ts
const MAX_SLUG_LENGTH = 80;

export function slugifyCatalog(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
}

export function isValidCatalogSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(slug) && !slug.includes("--");
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run tests/catalog-kit-pricing.test.ts tests/catalog-slug.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add lib/catalog/kit-pricing.ts lib/catalog/slug.ts tests/catalog-kit-pricing.test.ts tests/catalog-slug.test.ts
git commit -m "feat(catalogo): regras de preço, disponibilidade e integridade de kits"
```

---

### Tarefa 3: Cliente HTTP do Bling (erros, limite de 3 req/s, retry 429)

**Arquivos:**
- Criar: `lib/bling/constants.ts`, `lib/bling/errors.ts`, `lib/bling/error-map.ts`, `lib/bling/client.ts`
- Teste: `tests/bling-error-map.test.ts`, `tests/bling-client.test.ts`

**Interfaces:**
- Produz:
  ```ts
  // constants.ts
  export const BLING_API_BASE_URL: string;           // "https://api.bling.com.br/Api/v3"
  export const BLING_OAUTH_AUTHORIZE_URL: string;    // "https://www.bling.com.br/Api/v3/oauth/authorize"
  export const BLING_OAUTH_TOKEN_URL: string;        // "https://api.bling.com.br/Api/v3/oauth/token"
  export const BLING_MIN_REQUEST_INTERVAL_MS: number; // 350
  export const BLING_MAX_RETRIES: number;             // 3
  export const BLING_PAGE_LIMIT: number;              // 100
  export const BLING_MAX_PAGES: number;               // 50
  export const BLING_SYNC_INTERVAL_MS: number;        // 900_000
  export const BLING_TOKEN_REFRESH_MARGIN_MS: number; // 300_000
  // errors.ts
  export type BlingErrorCode = "token_invalid" | "forbidden" | "rate_limit" | "unavailable" | "bad_request" | "not_configured" | "unknown";
  export class BlingError extends Error { code; publicMessage; retriable; status }
  // error-map.ts
  export function mapBlingError(status: number, payload: unknown): BlingError;
  // client.ts
  export type BlingClientDeps = { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number };
  export type BlingClient = { get<T>(path: string, query?: Record<string, string | number>): Promise<T> };
  export function createBlingClient(accessToken: string, deps?: BlingClientDeps): BlingClient;
  ```

- [ ] **Passo 1: Escrever os testes que falham**

`tests/bling-error-map.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapBlingError } from "@/lib/bling/error-map";

describe("mapBlingError", () => {
  it("401 vira token_invalid, não retentável", () => {
    const err = mapBlingError(401, { error: { type: "invalid_token", message: "x" } });
    expect(err.code).toBe("token_invalid");
    expect(err.retriable).toBe(false);
    expect(err.publicMessage).toBe("A conexão com o Bling expirou. Reconecte a integração.");
  });

  it("429 vira rate_limit retentável", () => {
    const err = mapBlingError(429, null);
    expect(err.code).toBe("rate_limit");
    expect(err.retriable).toBe(true);
  });

  it("5xx vira unavailable retentável", () => {
    expect(mapBlingError(503, null).code).toBe("unavailable");
    expect(mapBlingError(503, null).retriable).toBe(true);
  });

  it("403 e 400 têm mensagens próprias; demais viram unknown", () => {
    expect(mapBlingError(403, null).code).toBe("forbidden");
    expect(mapBlingError(400, { error: { description: "campo" } }).code).toBe("bad_request");
    expect(mapBlingError(418, null).code).toBe("unknown");
  });

  it("não expõe a mensagem técnica do Bling na publicMessage", () => {
    const err = mapBlingError(400, { error: { message: "SQLSTATE detalhe interno" } });
    expect(err.publicMessage).not.toContain("SQLSTATE");
    expect(err.message).toContain("SQLSTATE");
  });
});
```

`tests/bling-client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createBlingClient } from "@/lib/bling/client";
import { BlingError } from "@/lib/bling/errors";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createBlingClient", () => {
  it("monta URL com query, envia Bearer e devolve o JSON", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { data: [{ id: 1 }] }));
    const client = createBlingClient("tok-123", { fetchImpl, sleep: async () => {}, now: () => 0 });

    const result = await client.get<{ data: { id: number }[] }>("/produtos", { pagina: 2, limite: 100 });

    expect(result.data[0]?.id).toBe(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.bling.com.br/Api/v3/produtos?pagina=2&limite=100");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("espera o intervalo mínimo entre requisições (3 req/s)", async () => {
    let clock = 1_000;
    const sleeps: number[] = [];
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    const client = createBlingClient("t", {
      fetchImpl,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    await client.get("/a");
    clock += 100;
    await client.get("/b");

    expect(sleeps).toEqual([250]);
  });

  it("retenta 429 com backoff e depois tem sucesso", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const sleeps: number[] = [];
    let clock = 0;
    const client = createBlingClient("t", {
      fetchImpl,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    await expect(client.get("/x")).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleeps.filter((ms) => ms >= 1000)).toEqual([1000, 2000]);
  });

  it("não retenta 401 e lança BlingError token_invalid", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: { type: "invalid_token" } }));
    const client = createBlingClient("t", { fetchImpl, sleep: async () => {}, now: () => 0 });

    const error = await client.get("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BlingError);
    expect((error as BlingError).code).toBe("token_invalid");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falha de rede vira BlingError unavailable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const client = createBlingClient("t", { fetchImpl, sleep: async () => {}, now: () => 0 });

    const error = await client.get("/x").catch((e: unknown) => e);
    expect((error as BlingError).code).toBe("unavailable");
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/bling-error-map.test.ts tests/bling-client.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/bling/error-map"`.

- [ ] **Passo 3: Implementar**

`lib/bling/constants.ts`:

```ts
/** Endpoints e limites da API v3 do Bling (https://developer.bling.com.br). */
export const BLING_API_BASE_URL = "https://api.bling.com.br/Api/v3";
export const BLING_OAUTH_AUTHORIZE_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";
export const BLING_OAUTH_TOKEN_URL = "https://api.bling.com.br/Api/v3/oauth/token";

/** Limite oficial: 3 req/s. 350 ms dá folga. */
export const BLING_MIN_REQUEST_INTERVAL_MS = 350;
export const BLING_MAX_RETRIES = 3;
export const BLING_PAGE_LIMIT = 100;
/** 50 páginas × 100 = 5.000 produtos; a M10 tem até 1.000. */
export const BLING_MAX_PAGES = 50;
export const BLING_SYNC_INTERVAL_MS = 15 * 60_000;
export const BLING_TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;
```

`lib/bling/errors.ts`:

```ts
export type BlingErrorCode =
  | "token_invalid"
  | "forbidden"
  | "rate_limit"
  | "unavailable"
  | "bad_request"
  | "not_configured"
  | "unknown";

export class BlingError extends Error {
  readonly code: BlingErrorCode;
  readonly publicMessage: string;
  readonly retriable: boolean;
  readonly status: number | null;

  constructor(opts: {
    code: BlingErrorCode;
    message: string;
    publicMessage: string;
    retriable: boolean;
    status: number | null;
  }) {
    super(opts.message);
    this.name = "BlingError";
    this.code = opts.code;
    this.publicMessage = opts.publicMessage;
    this.retriable = opts.retriable;
    this.status = opts.status;
  }
}
```

`lib/bling/error-map.ts`:

```ts
import { BlingError, type BlingErrorCode } from "./errors";

const PUBLIC_MESSAGES: Record<BlingErrorCode, string> = {
  token_invalid: "A conexão com o Bling expirou. Reconecte a integração.",
  forbidden: "O Bling recusou o acesso. Confira as permissões do aplicativo.",
  rate_limit: "O Bling está limitando as requisições. Tentaremos de novo em instantes.",
  unavailable: "O Bling está indisponível no momento. Tentaremos de novo em instantes.",
  bad_request: "O Bling recusou a requisição. Tente novamente ou fale com o suporte.",
  not_configured: "Integração com o Bling não configurada no servidor.",
  unknown: "Erro inesperado ao falar com o Bling.",
};

function extractTechnicalMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const inner = (payload as { error: unknown }).error;
    if (inner && typeof inner === "object") {
      const { message, description, type } = inner as Record<string, unknown>;
      return [type, message, description].filter((v) => typeof v === "string").join(" | ");
    }
  }
  return "";
}

function codeForStatus(status: number): BlingErrorCode {
  if (status === 401) return "token_invalid";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "unavailable";
  if (status === 400 || status === 422) return "bad_request";
  return "unknown";
}

export function mapBlingError(status: number, payload: unknown): BlingError {
  const code = codeForStatus(status);
  const technical = extractTechnicalMessage(payload);
  return new BlingError({
    code,
    status,
    message: `Bling HTTP ${status}${technical ? `: ${technical}` : ""}`,
    publicMessage: PUBLIC_MESSAGES[code],
    retriable: code === "rate_limit" || code === "unavailable",
  });
}

export function blingNotConfiguredError(detail: string): BlingError {
  return new BlingError({
    code: "not_configured",
    status: null,
    message: detail,
    publicMessage: PUBLIC_MESSAGES.not_configured,
    retriable: false,
  });
}

export function blingNetworkError(err: unknown): BlingError {
  return new BlingError({
    code: "unavailable",
    status: null,
    message: `Falha de rede com o Bling: ${err instanceof Error ? err.message : String(err)}`,
    publicMessage: PUBLIC_MESSAGES.unavailable,
    retriable: true,
  });
}
```

`lib/bling/client.ts`:

```ts
import {
  BLING_API_BASE_URL,
  BLING_MAX_RETRIES,
  BLING_MIN_REQUEST_INTERVAL_MS,
} from "./constants";
import { blingNetworkError, mapBlingError } from "./error-map";
import type { BlingError } from "./errors";

export type BlingClientDeps = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export type BlingClient = {
  get<T>(path: string, query?: Record<string, string | number>): Promise<T>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createBlingClient(accessToken: string, deps: BlingClientDeps = {}): BlingClient {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  let lastRequestAt: number | null = null;

  async function throttle(): Promise<void> {
    if (lastRequestAt !== null) {
      const wait = BLING_MIN_REQUEST_INTERVAL_MS - (now() - lastRequestAt);
      if (wait > 0) await sleep(wait);
    }
    lastRequestAt = now();
  }

  async function get<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) params.set(key, String(value));
    const qs = params.toString();
    const url = `${BLING_API_BASE_URL}${path}${qs ? `?${qs}` : ""}`;

    let attempt = 0;
    while (true) {
      await throttle();
      let res: Response;
      try {
        res = await fetchImpl(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
      } catch (err) {
        throw blingNetworkError(err);
      }

      if (res.ok) return (await res.json()) as T;

      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      const error: BlingError = mapBlingError(res.status, payload);
      if (error.code === "rate_limit" && attempt < BLING_MAX_RETRIES - 1) {
        await sleep(1000 * 2 ** attempt);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }

  return { get };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run tests/bling-error-map.test.ts tests/bling-client.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add lib/bling/constants.ts lib/bling/errors.ts lib/bling/error-map.ts lib/bling/client.ts tests/bling-error-map.test.ts tests/bling-client.test.ts
git commit -m "feat(bling): cliente HTTP com limite de 3 req/s, retry de 429 e mapa de erros"
```

---

### Tarefa 4: OAuth e tokens do Bling

**Arquivos:**
- Criar: `lib/bling/oauth.ts`, `lib/bling/tokens.ts`
- Teste: `tests/bling-oauth.test.ts`, `tests/bling-tokens.test.ts`

**Interfaces:**
- Consome (Tarefa 3): `BLING_OAUTH_AUTHORIZE_URL`, `BLING_OAUTH_TOKEN_URL`, `BLING_TOKEN_REFRESH_MARGIN_MS`, `BlingError`, `mapBlingError`, `blingNetworkError`, `blingNotConfiguredError`.
- Produz:
  ```ts
  // oauth.ts
  export type BlingTokenSet = { accessToken: string; refreshToken: string; expiresAt: Date };
  export type BlingOAuthDeps = { fetchImpl?: typeof fetch; now?: () => number; env?: Record<string, string | undefined> };
  export function getBlingCredentials(env?: Record<string, string | undefined>): { clientId: string; clientSecret: string };
  export function buildAuthorizeUrl(state: string, env?: Record<string, string | undefined>): string;
  export function exchangeAuthorizationCode(code: string, deps?: BlingOAuthDeps): Promise<BlingTokenSet>;
  export function refreshAccessToken(refreshToken: string, deps?: BlingOAuthDeps): Promise<BlingTokenSet>;
  // tokens.ts
  export type ServiceClient = ReturnType<typeof createServiceClient>;
  export function saveBlingTokens(orgId: string, tokens: BlingTokenSet, connectedBy: string, supabase?: ServiceClient): Promise<void>;
  export function getValidAccessToken(orgId: string, deps?: { supabase?: ServiceClient; now?: () => number; refresh?: (refreshToken: string) => Promise<BlingTokenSet> }): Promise<string>;
  export function markBlingIntegrationError(orgId: string, publicMessage: string, supabase?: ServiceClient): Promise<void>;
  export function deleteBlingIntegration(orgId: string, supabase?: ServiceClient): Promise<void>;
  ```
- Variáveis de ambiente novas: `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`. A URL de callback cadastrada no app do Bling é `${NEXT_PUBLIC_APP_URL}/api/integrations/bling/callback`.

- [ ] **Passo 1: Escrever os testes que falham**

`tests/bling-oauth.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { BlingError } from "@/lib/bling/errors";
import {
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  getBlingCredentials,
  refreshAccessToken,
} from "@/lib/bling/oauth";

const env = { BLING_CLIENT_ID: "cid", BLING_CLIENT_SECRET: "secret" };

function tokenResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("getBlingCredentials", () => {
  it("lança not_configured quando falta variável de ambiente", () => {
    expect(() => getBlingCredentials({})).toThrow(BlingError);
  });
});

describe("buildAuthorizeUrl", () => {
  it("usa response_type=code, client_id e state", () => {
    const url = new URL(buildAuthorizeUrl("abc123", env));
    expect(url.origin + url.pathname).toBe("https://www.bling.com.br/Api/v3/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("state")).toBe("abc123");
  });
});

describe("exchangeAuthorizationCode", () => {
  it("envia Basic auth + form e calcula expiresAt", async () => {
    const fetchImpl = vi.fn(async () =>
      tokenResponse(200, {
        access_token: "at",
        refresh_token: "rt",
        expires_in: 21600,
        token_type: "Bearer",
        scope: "x",
      }),
    );
    const tokens = await exchangeAuthorizationCode("code-1", { fetchImpl, env, now: () => 1_000_000 });

    expect(tokens).toEqual({ accessToken: "at", refreshToken: "rt", expiresAt: new Date(1_000_000 + 21_600_000) });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.bling.com.br/Api/v3/oauth/token");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("cid:secret").toString("base64")}`);
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(String(init.body)).toBe("grant_type=authorization_code&code=code-1");
  });

  it("400 do endpoint de token vira token_invalid", async () => {
    const fetchImpl = vi.fn(async () => tokenResponse(400, { error: { type: "invalid_grant" } }));
    const error = await exchangeAuthorizationCode("bad", { fetchImpl, env }).catch((e: unknown) => e);
    expect((error as BlingError).code).toBe("token_invalid");
  });

  it("resposta sem refresh_token é rejeitada", async () => {
    const fetchImpl = vi.fn(async () => tokenResponse(200, { access_token: "at", expires_in: 10 }));
    const error = await exchangeAuthorizationCode("c", { fetchImpl, env }).catch((e: unknown) => e);
    expect((error as BlingError).code).toBe("unknown");
  });
});

describe("refreshAccessToken", () => {
  it("usa grant_type=refresh_token", async () => {
    const fetchImpl = vi.fn(async () =>
      tokenResponse(200, { access_token: "at2", refresh_token: "rt2", expires_in: 100 }),
    );
    await refreshAccessToken("rt1", { fetchImpl, env, now: () => 0 });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toBe("grant_type=refresh_token&refresh_token=rt1");
  });
});
```

`tests/bling-tokens.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { BlingError } from "@/lib/bling/errors";
import type { BlingTokenSet } from "@/lib/bling/oauth";
import { getValidAccessToken, markBlingIntegrationError, type ServiceClient } from "@/lib/bling/tokens";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

type Row = { access_token: string; refresh_token: string; expires_at: string; status: string } | null;

function fakeSupabase(row: Row) {
  const updates: Record<string, unknown>[] = [];
  const inserts: { table: string; values: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
        update: (values: Record<string, unknown>) => ({
          eq: async () => {
            updates.push(values);
            return { error: null };
          },
        }),
        insert: async (values: Record<string, unknown>) => {
          inserts.push({ table, values });
          return { error: null };
        },
      };
    },
  };
  return { updates, inserts, client: client as unknown as ServiceClient };
}

const NOW = Date.parse("2026-09-17T12:00:00Z");

describe("getValidAccessToken", () => {
  it("devolve o token atual quando falta mais que a margem para expirar", async () => {
    const { client, updates } = fakeSupabase({
      access_token: "at",
      refresh_token: "rt",
      expires_at: new Date(NOW + 60 * 60_000).toISOString(),
      status: "connected",
    });
    const refresh = vi.fn();
    await expect(getValidAccessToken("org", { supabase: client, now: () => NOW, refresh })).resolves.toBe("at");
    expect(refresh).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("renova quando está perto de expirar e grava o novo refresh token", async () => {
    const { client, updates } = fakeSupabase({
      access_token: "old",
      refresh_token: "rt-old",
      expires_at: new Date(NOW + 60_000).toISOString(),
      status: "connected",
    });
    const fresh: BlingTokenSet = { accessToken: "new", refreshToken: "rt-new", expiresAt: new Date(NOW + 6 * 3_600_000) };
    const refresh = vi.fn(async () => fresh);

    await expect(getValidAccessToken("org", { supabase: client, now: () => NOW, refresh })).resolves.toBe("new");
    expect(refresh).toHaveBeenCalledWith("rt-old");
    expect(updates[0]).toEqual({
      access_token: "new",
      refresh_token: "rt-new",
      expires_at: fresh.expiresAt.toISOString(),
      status: "connected",
    });
  });

  it("sem integração lança token_invalid", async () => {
    const { client } = fakeSupabase(null);
    const error = await getValidAccessToken("org", { supabase: client, now: () => NOW }).catch((e: unknown) => e);
    expect((error as BlingError).code).toBe("token_invalid");
  });
});

describe("markBlingIntegrationError", () => {
  it("marca erro e cria tarefa só na primeira falha", async () => {
    const first = fakeSupabase({ access_token: "a", refresh_token: "r", expires_at: "", status: "connected" });
    await markBlingIntegrationError("org", "Reconecte", first.client);
    expect(first.updates[0]).toEqual({ status: "error", last_sync_error: "Reconecte" });
    expect(first.inserts).toHaveLength(1);
    expect(first.inserts[0]?.table).toBe("tasks");
    expect(first.inserts[0]?.values.priority).toBe("high");

    const again = fakeSupabase({ access_token: "a", refresh_token: "r", expires_at: "", status: "error" });
    await markBlingIntegrationError("org", "Reconecte", again.client);
    expect(again.inserts).toHaveLength(0);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/bling-oauth.test.ts tests/bling-tokens.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/bling/oauth"`.

- [ ] **Passo 3: Implementar**

`lib/bling/oauth.ts`:

```ts
import { z } from "zod";
import { BLING_OAUTH_AUTHORIZE_URL, BLING_OAUTH_TOKEN_URL } from "./constants";
import { blingNetworkError, blingNotConfiguredError, mapBlingError } from "./error-map";
import { BlingError } from "./errors";

export type BlingTokenSet = { accessToken: string; refreshToken: string; expiresAt: Date };

export type BlingOAuthDeps = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  env?: Record<string, string | undefined>;
};

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
});

export function getBlingCredentials(env: Record<string, string | undefined> = process.env): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = env.BLING_CLIENT_ID;
  const clientSecret = env.BLING_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw blingNotConfiguredError("BLING_CLIENT_ID/BLING_CLIENT_SECRET ausentes");
  }
  return { clientId, clientSecret };
}

export function buildAuthorizeUrl(
  state: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const { clientId } = getBlingCredentials(env);
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, state });
  return `${BLING_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

async function postToken(body: URLSearchParams, deps: BlingOAuthDeps): Promise<BlingTokenSet> {
  const { clientId, clientSecret } = getBlingCredentials(deps.env ?? process.env);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;

  let res: Response;
  try {
    res = await fetchImpl(BLING_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "1.0",
      },
      body: body.toString(),
    });
  } catch (err) {
    throw blingNetworkError(err);
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    // No endpoint de token, 400/401 significam código ou refresh token inválido.
    const status = res.status === 400 ? 401 : res.status;
    throw mapBlingError(status, payload);
  }

  const parsed = tokenResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new BlingError({
      code: "unknown",
      status: res.status,
      message: "Resposta de token do Bling em formato inesperado",
      publicMessage: "Erro inesperado ao falar com o Bling.",
      retriable: false,
    });
  }

  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresAt: new Date(now() + parsed.data.expires_in * 1000),
  };
}

export function exchangeAuthorizationCode(code: string, deps: BlingOAuthDeps = {}): Promise<BlingTokenSet> {
  return postToken(new URLSearchParams({ grant_type: "authorization_code", code }), deps);
}

export function refreshAccessToken(refreshToken: string, deps: BlingOAuthDeps = {}): Promise<BlingTokenSet> {
  return postToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }), deps);
}
```

`lib/bling/tokens.ts`:

```ts
import { logError } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import { BLING_TOKEN_REFRESH_MARGIN_MS } from "./constants";
import { BlingError } from "./errors";
import { type BlingTokenSet, refreshAccessToken } from "./oauth";

export type ServiceClient = ReturnType<typeof createServiceClient>;

function notConnectedError(): BlingError {
  return new BlingError({
    code: "token_invalid",
    status: null,
    message: "Organização sem integração Bling",
    publicMessage: "Conecte o Bling em Configurações → Bling.",
    retriable: false,
  });
}

export async function saveBlingTokens(
  orgId: string,
  tokens: BlingTokenSet,
  connectedBy: string,
  supabase: ServiceClient = createServiceClient(),
): Promise<void> {
  const { error } = await supabase.from("bling_integrations").upsert(
    {
      organization_id: orgId,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt.toISOString(),
      status: "connected",
      connected_by: connectedBy,
      last_sync_error: null,
    },
    { onConflict: "organization_id" },
  );
  if (error) {
    logError("bling.tokens.save", error);
    throw new Error("Falha ao salvar tokens do Bling");
  }
}

export async function getValidAccessToken(
  orgId: string,
  deps: {
    supabase?: ServiceClient;
    now?: () => number;
    refresh?: (refreshToken: string) => Promise<BlingTokenSet>;
  } = {},
): Promise<string> {
  const supabase = deps.supabase ?? createServiceClient();
  const now = deps.now ?? Date.now;
  const refresh = deps.refresh ?? ((rt: string) => refreshAccessToken(rt));

  const { data, error } = await supabase
    .from("bling_integrations")
    .select("access_token, refresh_token, expires_at, status")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) {
    logError("bling.tokens.read", error);
    throw new Error("Falha ao ler integração do Bling");
  }
  if (!data) throw notConnectedError();

  const expiresAt = Date.parse(data.expires_at);
  if (expiresAt - now() > BLING_TOKEN_REFRESH_MARGIN_MS) return data.access_token;

  const fresh = await refresh(data.refresh_token);
  const { error: updateError } = await supabase
    .from("bling_integrations")
    .update({
      access_token: fresh.accessToken,
      refresh_token: fresh.refreshToken,
      expires_at: fresh.expiresAt.toISOString(),
      status: "connected",
    })
    .eq("organization_id", orgId);
  if (updateError) {
    // O Bling já invalidou o refresh token antigo: se não gravar o novo, a conexão se perde.
    logError("bling.tokens.refresh-save", updateError);
    throw new Error("Falha ao salvar tokens renovados do Bling");
  }
  return fresh.accessToken;
}

export async function markBlingIntegrationError(
  orgId: string,
  publicMessage: string,
  supabase: ServiceClient = createServiceClient(),
): Promise<void> {
  const { data } = await supabase
    .from("bling_integrations")
    .select("status")
    .eq("organization_id", orgId)
    .maybeSingle();

  await supabase
    .from("bling_integrations")
    .update({ status: "error", last_sync_error: publicMessage })
    .eq("organization_id", orgId);

  if (data && data.status !== "error") {
    const { error } = await supabase.from("tasks").insert({
      organization_id: orgId,
      title: "Reconectar integração com o Bling",
      description: `A sincronização de produtos parou: ${publicMessage} Acesse Configurações → Bling e conecte de novo.`,
      priority: "high",
      status: "pending",
    });
    if (error) logError("bling.tokens.task", error);
  }
}

export async function deleteBlingIntegration(
  orgId: string,
  supabase: ServiceClient = createServiceClient(),
): Promise<void> {
  const { error } = await supabase.from("bling_integrations").delete().eq("organization_id", orgId);
  if (error) {
    logError("bling.tokens.delete", error);
    throw new Error("Falha ao remover integração do Bling");
  }
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run tests/bling-oauth.test.ts tests/bling-tokens.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add lib/bling/oauth.ts lib/bling/tokens.ts tests/bling-oauth.test.ts tests/bling-tokens.test.ts
git commit -m "feat(bling): OAuth2 (troca de código e refresh) e guarda segura de tokens"
```

---

### Tarefa 5: Leitura de kits e guarda de integridade

**Arquivos:**
- Criar: `lib/catalog/kit-rows.ts`, `lib/catalog/kit-guard.ts`
- Teste: `tests/catalog-kit-guard.test.ts`

**Interfaces:**
- Consome (Tarefa 2): `KitComponent`, `findKitProblems`, `describeKitProblems`. (Tarefa 4): `ServiceClient`.
- Produz:
  ```ts
  // kit-rows.ts
  export const KIT_SELECT: string;
  export type KitRow = {
    id: string; name: string; description: string | null; image_url: string | null;
    discount_pct: number; hidden_reason: string | null;
    catalog_items: { id: string; slug: string; is_published: boolean; category_id: string | null }[];
    kit_items: {
      quantity: number;
      bling_products: { id: string; name: string; sku: string | null; price: number; stock: number;
        bling_status: "active" | "inactive"; catalog_items: { is_published: boolean }[] } | null;
    }[];
  };
  export function toKitComponents(row: KitRow): KitComponent[];
  // kit-guard.ts
  export type KitUnpublishPlan = { catalogItemId: string; kitId: string; kitName: string; reason: string };
  export function planKitUnpublish(rows: KitRow[]): KitUnpublishPlan[];
  export function enforceKitIntegrity(orgId: string, supabase?: ServiceClient): Promise<{ unpublished: number }>;
  ```

- [ ] **Passo 1: Escrever o teste que falha**

`tests/catalog-kit-guard.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { planKitUnpublish } from "@/lib/catalog/kit-guard";
import { type KitRow, toKitComponents } from "@/lib/catalog/kit-rows";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

function product(overrides: Partial<NonNullable<KitRow["kit_items"][number]["bling_products"]>> = {}) {
  return {
    id: "p1",
    name: "Lixa 50",
    sku: "LX50",
    price: 12.5,
    stock: 40,
    bling_status: "active" as const,
    catalog_items: [{ is_published: true }],
    ...overrides,
  };
}

function kit(overrides: Partial<KitRow> = {}): KitRow {
  return {
    id: "k1",
    name: "Kit Polimento Granito",
    description: null,
    image_url: null,
    discount_pct: 10,
    hidden_reason: null,
    catalog_items: [{ id: "ci1", slug: "kit-polimento-granito", is_published: true, category_id: null }],
    kit_items: [{ quantity: 2, bling_products: product() }],
    ...overrides,
  };
}

describe("toKitComponents", () => {
  it("converte linhas do banco em componentes", () => {
    expect(toKitComponents(kit())).toEqual([
      {
        blingProductId: "p1",
        name: "Lixa 50",
        quantity: 2,
        price: 12.5,
        stock: 40,
        blingStatus: "active",
        productPublished: true,
      },
    ]);
  });

  it("produto sem catalog_item conta como não publicado", () => {
    const row = kit({ kit_items: [{ quantity: 1, bling_products: product({ catalog_items: [] }) }] });
    expect(toKitComponents(row)[0]?.productPublished).toBe(false);
  });
});

describe("planKitUnpublish", () => {
  it("ignora kits saudáveis e kits já despublicados", () => {
    const unpublished = kit({
      id: "k2",
      catalog_items: [{ id: "ci2", slug: "x", is_published: false, category_id: null }],
      kit_items: [{ quantity: 1, bling_products: product({ bling_status: "inactive" }) }],
    });
    expect(planKitUnpublish([kit(), unpublished])).toEqual([]);
  });

  it("planeja retirar do ar o kit publicado com item inativo", () => {
    const broken = kit({ kit_items: [{ quantity: 1, bling_products: product({ bling_status: "inactive" }) }] });
    expect(planKitUnpublish([broken])).toEqual([
      {
        catalogItemId: "ci1",
        kitId: "k1",
        kitName: "Kit Polimento Granito",
        reason: "Lixa 50 está inativo no Bling",
      },
    ]);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/catalog-kit-guard.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/catalog/kit-guard"`.

- [ ] **Passo 3: Implementar**

`lib/catalog/kit-rows.ts`:

```ts
import type { KitComponent } from "./kit-pricing";

/** Select do PostgREST usado por guarda, telas e actions de kit. */
export const KIT_SELECT =
  "id, name, description, image_url, discount_pct, hidden_reason, " +
  "catalog_items(id, slug, is_published, category_id), " +
  "kit_items(quantity, bling_products(id, name, sku, price, stock, bling_status, catalog_items(is_published)))";

export type KitRow = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  discount_pct: number;
  hidden_reason: string | null;
  catalog_items: { id: string; slug: string; is_published: boolean; category_id: string | null }[];
  kit_items: {
    quantity: number;
    bling_products: {
      id: string;
      name: string;
      sku: string | null;
      price: number;
      stock: number;
      bling_status: "active" | "inactive";
      catalog_items: { is_published: boolean }[];
    } | null;
  }[];
};

export function toKitComponents(row: KitRow): KitComponent[] {
  return row.kit_items.flatMap((item) => {
    const p = item.bling_products;
    if (!p) return [];
    return [
      {
        blingProductId: p.id,
        name: p.name,
        quantity: item.quantity,
        price: Number(p.price),
        stock: Number(p.stock),
        blingStatus: p.bling_status,
        productPublished: p.catalog_items.some((ci) => ci.is_published),
      },
    ];
  });
}
```

`lib/catalog/kit-guard.ts`:

```ts
import { logError } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import type { ServiceClient } from "@/lib/bling/tokens";
import { describeKitProblems, findKitProblems } from "./kit-pricing";
import { KIT_SELECT, type KitRow, toKitComponents } from "./kit-rows";

export type KitUnpublishPlan = { catalogItemId: string; kitId: string; kitName: string; reason: string };

export function planKitUnpublish(rows: KitRow[]): KitUnpublishPlan[] {
  const plans: KitUnpublishPlan[] = [];
  for (const row of rows) {
    const catalogItem = row.catalog_items[0];
    if (!catalogItem?.is_published) continue;
    const problems = findKitProblems(toKitComponents(row));
    if (problems.length === 0) continue;
    plans.push({
      catalogItemId: catalogItem.id,
      kitId: row.id,
      kitName: row.name,
      reason: describeKitProblems(problems),
    });
  }
  return plans;
}

/** Retira do ar kits publicados com item inválido e avisa os admins com uma tarefa. */
export async function enforceKitIntegrity(
  orgId: string,
  supabase: ServiceClient = createServiceClient(),
): Promise<{ unpublished: number }> {
  const { data, error } = await supabase.from("kits").select(KIT_SELECT).eq("organization_id", orgId);
  if (error) {
    logError("catalog.kit-guard.load", error);
    return { unpublished: 0 };
  }

  const plans = planKitUnpublish((data ?? []) as unknown as KitRow[]);
  for (const plan of plans) {
    await supabase.from("catalog_items").update({ is_published: false }).eq("id", plan.catalogItemId);
    await supabase.from("kits").update({ hidden_reason: plan.reason }).eq("id", plan.kitId);
    const { error: taskError } = await supabase.from("tasks").insert({
      organization_id: orgId,
      title: `Kit retirado do site: ${plan.kitName}`,
      description: `O kit saiu do ar automaticamente porque ${plan.reason}. Corrija os itens e publique de novo em Catálogo → Kits.`,
      priority: "high",
      status: "pending",
    });
    if (taskError) logError("catalog.kit-guard.task", taskError);
  }
  return { unpublished: plans.length };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run tests/catalog-kit-guard.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add lib/catalog/kit-rows.ts lib/catalog/kit-guard.ts tests/catalog-kit-guard.test.ts
git commit -m "feat(catalogo): guarda que retira do ar kits com item inválido e avisa admins"
```

---

### Tarefa 6: Mapeamento de produtos e sincronização

**Arquivos:**
- Criar: `lib/bling/map-product.ts`, `lib/bling/sync.ts`
- Teste: `tests/bling-map-product.test.ts`, `tests/bling-sync.test.ts`

**Interfaces:**
- Consome: `createBlingClient`, `BlingClient`, `BlingError`, `BLING_PAGE_LIMIT`, `BLING_MAX_PAGES` (Tarefa 3); `getValidAccessToken`, `markBlingIntegrationError`, `ServiceClient` (Tarefa 4); `enforceKitIntegrity` (Tarefa 5).
- Produz:
  ```ts
  // map-product.ts
  export type BlingProductListItem = {
    id: number; nome: string; codigo?: string; preco?: number; situacao?: "A" | "I";
    descricaoCurta?: string; imagemURL?: string; estoque?: { saldoVirtualTotal?: number };
  };
  export type BlingProductUpsert = {
    organization_id: string; bling_id: number; sku: string | null; name: string; description: string | null;
    price: number; stock: number; images: string[]; bling_status: "active" | "inactive"; synced_at: string;
  };
  export function stripHtml(input: string): string;
  export function mapBlingProduct(orgId: string, item: BlingProductListItem, syncedAt: Date): BlingProductUpsert;
  // sync.ts
  export type SyncStats = { fetched: number; deactivated: number; kitsUnpublished: number; durationMs: number };
  export type SyncResult =
    | { ok: true; stats: SyncStats }
    | { ok: false; error: string; code: BlingErrorCode | "already_running" };
  export type SyncDeps = {
    supabase?: ServiceClient;
    getToken?: (orgId: string) => Promise<string>;
    clientFactory?: (token: string) => BlingClient;
    enforceKits?: (orgId: string) => Promise<{ unpublished: number }>;
    markError?: (orgId: string, publicMessage: string) => Promise<void>;
    now?: () => Date;
  };
  export function syncOrganizationProducts(orgId: string, deps?: SyncDeps): Promise<SyncResult>;
  export function syncAllConnectedOrganizations(deps?: SyncDeps): Promise<{ organizations: number; failures: number }>;
  ```

- [ ] **Passo 1: Escrever os testes que falham**

`tests/bling-map-product.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapBlingProduct, stripHtml } from "@/lib/bling/map-product";

const SYNCED = new Date("2026-09-17T12:00:00Z");

describe("stripHtml", () => {
  it("remove tags e decodifica entidades básicas", () => {
    expect(stripHtml("<p>Disco&nbsp;<b>turbo</b> &amp; segmentado</p>")).toBe("Disco turbo & segmentado");
  });
});

describe("mapBlingProduct", () => {
  it("mapeia os campos do Bling", () => {
    expect(
      mapBlingProduct(
        "org",
        {
          id: 987654321,
          nome: " Disco Diamantado Turbo 350mm ",
          codigo: "DT350",
          preco: 289.9,
          situacao: "A",
          descricaoCurta: "<p>Corte de granito</p>",
          imagemURL: "https://cdn.bling/img.jpg",
          estoque: { saldoVirtualTotal: 4 },
        },
        SYNCED,
      ),
    ).toEqual({
      organization_id: "org",
      bling_id: 987654321,
      sku: "DT350",
      name: "Disco Diamantado Turbo 350mm",
      description: "Corte de granito",
      price: 289.9,
      stock: 4,
      images: ["https://cdn.bling/img.jpg"],
      bling_status: "active",
      synced_at: "2026-09-17T12:00:00.000Z",
    });
  });

  it("usa valores seguros quando faltam campos", () => {
    const row = mapBlingProduct("org", { id: 1, nome: "Lixa", situacao: "I", codigo: "" }, SYNCED);
    expect(row).toMatchObject({
      sku: null,
      description: null,
      price: 0,
      stock: 0,
      images: [],
      bling_status: "inactive",
    });
  });
});
```

`tests/bling-sync.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlingClient } from "@/lib/bling/client";
import { BlingError } from "@/lib/bling/errors";
import type { BlingProductListItem } from "@/lib/bling/map-product";
import { syncOrganizationProducts } from "@/lib/bling/sync";
import type { ServiceClient } from "@/lib/bling/tokens";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

function fakeSupabase() {
  const calls = {
    upserts: [] as unknown[][],
    deactivateBefore: [] as string[],
    integrationUpdates: [] as Record<string, unknown>[],
  };
  const client = {
    from(table: string) {
      if (table === "bling_products") {
        return {
          upsert: async (rows: unknown[]) => {
            calls.upserts.push(rows);
            return { error: null };
          },
          update: () => {
            const chain = {
              eq: () => chain,
              lt: (_column: string, value: string) => {
                calls.deactivateBefore.push(value);
                return chain;
              },
              select: async () => ({ data: [{ id: "gone" }], error: null }),
            };
            return chain;
          },
        };
      }
      if (table === "bling_integrations") {
        return {
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              calls.integrationUpdates.push(values);
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
  return { calls, client: client as unknown as ServiceClient };
}

function items(count: number, offset = 0): BlingProductListItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: offset + i + 1, nome: `P${offset + i + 1}`, situacao: "A" as const }));
}

function pagedClient(pages: BlingProductListItem[][]): BlingClient & { get: ReturnType<typeof vi.fn> } {
  const get = vi.fn(async (_path: string, query?: Record<string, string | number>) => ({
    data: pages[Number(query?.pagina) - 1] ?? [],
  }));
  return { get } as unknown as BlingClient & { get: ReturnType<typeof vi.fn> };
}

const NOW = new Date("2026-09-17T12:00:00Z");

describe("syncOrganizationProducts", () => {
  let enforceKits: ReturnType<typeof vi.fn>;
  let markError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    enforceKits = vi.fn(async () => ({ unpublished: 1 }));
    markError = vi.fn(async () => {});
  });

  it("pagina até a última página, desativa não vistos e verifica kits", async () => {
    const { calls, client } = fakeSupabase();
    const bling = pagedClient([items(100), items(3, 100)]);

    const result = await syncOrganizationProducts("org", {
      supabase: client,
      getToken: async () => "tok",
      clientFactory: () => bling,
      enforceKits,
      markError,
      now: () => NOW,
    });

    expect(result).toMatchObject({ ok: true, stats: { fetched: 103, deactivated: 1, kitsUnpublished: 1 } });
    expect(bling.get).toHaveBeenCalledTimes(2);
    expect(bling.get).toHaveBeenCalledWith("/produtos", { pagina: 2, limite: 100 });
    expect(calls.upserts).toHaveLength(2);
    expect(calls.deactivateBefore).toEqual([NOW.toISOString()]);
    expect(enforceKits).toHaveBeenCalledWith("org");
    expect(calls.integrationUpdates.at(-1)).toMatchObject({
      last_sync_at: NOW.toISOString(),
      last_sync_error: null,
      status: "connected",
    });
  });

  it("não desativa nada quando o Bling devolve zero produtos", async () => {
    const { calls, client } = fakeSupabase();
    const result = await syncOrganizationProducts("org", {
      supabase: client,
      getToken: async () => "tok",
      clientFactory: () => pagedClient([[]]),
      enforceKits,
      markError,
      now: () => NOW,
    });
    expect(result).toMatchObject({ ok: true, stats: { fetched: 0, deactivated: 0 } });
    expect(calls.deactivateBefore).toEqual([]);
  });

  it("token inválido marca a integração com erro e devolve a mensagem pública", async () => {
    const { client } = fakeSupabase();
    const tokenError = new BlingError({
      code: "token_invalid",
      status: 401,
      message: "x",
      publicMessage: "A conexão com o Bling expirou. Reconecte a integração.",
      retriable: false,
    });
    const result = await syncOrganizationProducts("org", {
      supabase: client,
      getToken: async () => {
        throw tokenError;
      },
      enforceKits,
      markError,
      now: () => NOW,
    });
    expect(result).toEqual({ ok: false, code: "token_invalid", error: tokenError.publicMessage });
    expect(markError).toHaveBeenCalledWith("org", tokenError.publicMessage);
  });

  it("erro temporário só registra last_sync_error, sem marcar status de erro", async () => {
    const { calls, client } = fakeSupabase();
    const bling = { get: vi.fn(async () => {
      throw new BlingError({ code: "unavailable", status: 503, message: "x", publicMessage: "Fora do ar", retriable: true });
    }) } as unknown as BlingClient;
    const result = await syncOrganizationProducts("org", {
      supabase: client,
      getToken: async () => "tok",
      clientFactory: () => bling,
      enforceKits,
      markError,
      now: () => NOW,
    });
    expect(result).toEqual({ ok: false, code: "unavailable", error: "Fora do ar" });
    expect(markError).not.toHaveBeenCalled();
    expect(calls.integrationUpdates.at(-1)).toEqual({ last_sync_error: "Fora do ar" });
  });

  it("recusa sincronização simultânea da mesma organização", async () => {
    const { client } = fakeSupabase();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deps = {
      supabase: client,
      getToken: async () => {
        await gate;
        return "tok";
      },
      clientFactory: () => pagedClient([[]]),
      enforceKits,
      markError,
      now: () => NOW,
    };
    const first = syncOrganizationProducts("org-lock", deps);
    const second = await syncOrganizationProducts("org-lock", deps);
    expect(second).toMatchObject({ ok: false, code: "already_running" });
    release();
    await expect(first).resolves.toMatchObject({ ok: true });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/bling-map-product.test.ts tests/bling-sync.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/bling/map-product"`.

- [ ] **Passo 3: Implementar**

`lib/bling/map-product.ts`:

```ts
export type BlingProductListItem = {
  id: number;
  nome: string;
  codigo?: string;
  preco?: number;
  situacao?: "A" | "I";
  descricaoCurta?: string;
  imagemURL?: string;
  estoque?: { saldoVirtualTotal?: number };
};

export type BlingProductUpsert = {
  organization_id: string;
  bling_id: number;
  sku: string | null;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  images: string[];
  bling_status: "active" | "inactive";
  synced_at: string;
};

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function mapBlingProduct(orgId: string, item: BlingProductListItem, syncedAt: Date): BlingProductUpsert {
  const description = item.descricaoCurta ? stripHtml(item.descricaoCurta) : "";
  return {
    organization_id: orgId,
    bling_id: item.id,
    sku: item.codigo?.trim() ? item.codigo.trim() : null,
    name: item.nome.trim(),
    description: description || null,
    price: finiteOr(item.preco, 0),
    stock: finiteOr(item.estoque?.saldoVirtualTotal, 0),
    images: item.imagemURL ? [item.imagemURL] : [],
    bling_status: item.situacao === "I" ? "inactive" : "active",
    synced_at: syncedAt.toISOString(),
  };
}
```

`lib/bling/sync.ts`:

```ts
import { enforceKitIntegrity } from "@/lib/catalog/kit-guard";
import { logError } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import { type BlingClient, createBlingClient } from "./client";
import { BLING_MAX_PAGES, BLING_PAGE_LIMIT } from "./constants";
import { BlingError, type BlingErrorCode } from "./errors";
import { type BlingProductListItem, mapBlingProduct } from "./map-product";
import { getValidAccessToken, markBlingIntegrationError, type ServiceClient } from "./tokens";

export type SyncStats = { fetched: number; deactivated: number; kitsUnpublished: number; durationMs: number };

export type SyncResult =
  | { ok: true; stats: SyncStats }
  | { ok: false; error: string; code: BlingErrorCode | "already_running" };

export type SyncDeps = {
  supabase?: ServiceClient;
  getToken?: (orgId: string) => Promise<string>;
  clientFactory?: (token: string) => BlingClient;
  enforceKits?: (orgId: string) => Promise<{ unpublished: number }>;
  markError?: (orgId: string, publicMessage: string) => Promise<void>;
  now?: () => Date;
};

const running = new Set<string>();

export async function syncOrganizationProducts(orgId: string, deps: SyncDeps = {}): Promise<SyncResult> {
  if (running.has(orgId)) {
    return { ok: false, code: "already_running", error: "Já existe uma sincronização em andamento." };
  }
  running.add(orgId);

  const supabase = deps.supabase ?? createServiceClient();
  const getToken = deps.getToken ?? ((id: string) => getValidAccessToken(id, { supabase }));
  const clientFactory = deps.clientFactory ?? ((token: string) => createBlingClient(token));
  const enforceKits = deps.enforceKits ?? ((id: string) => enforceKitIntegrity(id, supabase));
  const markError = deps.markError ?? ((id: string, msg: string) => markBlingIntegrationError(id, msg, supabase));
  const now = deps.now ?? (() => new Date());

  const startedAt = now();
  const syncedAtIso = startedAt.toISOString();

  try {
    const token = await getToken(orgId);
    const bling = clientFactory(token);

    let fetched = 0;
    for (let pagina = 1; pagina <= BLING_MAX_PAGES; pagina++) {
      const page = await bling.get<{ data?: BlingProductListItem[] }>("/produtos", {
        pagina,
        limite: BLING_PAGE_LIMIT,
      });
      const data = page.data ?? [];
      if (data.length > 0) {
        const rows = data.map((item) => mapBlingProduct(orgId, item, startedAt));
        const { error } = await supabase
          .from("bling_products")
          .upsert(rows, { onConflict: "organization_id,bling_id" });
        if (error) throw error;
        fetched += data.length;
      }
      if (data.length < BLING_PAGE_LIMIT) break;
    }

    let deactivated = 0;
    // Proteção: se o Bling devolveu zero produtos, não desativa o catálogo inteiro.
    if (fetched > 0) {
      const { data, error } = await supabase
        .from("bling_products")
        .update({ bling_status: "inactive" })
        .eq("organization_id", orgId)
        .eq("bling_status", "active")
        .lt("synced_at", syncedAtIso)
        .select("id");
      if (error) throw error;
      deactivated = data?.length ?? 0;
    }

    const kits = await enforceKits(orgId);
    const stats: SyncStats = {
      fetched,
      deactivated,
      kitsUnpublished: kits.unpublished,
      durationMs: now().getTime() - startedAt.getTime(),
    };

    await supabase
      .from("bling_integrations")
      .update({ last_sync_at: syncedAtIso, last_sync_error: null, last_sync_stats: stats, status: "connected" })
      .eq("organization_id", orgId);

    return { ok: true, stats };
  } catch (err) {
    if (err instanceof BlingError) {
      if (err.code === "token_invalid" || err.code === "forbidden") {
        await markError(orgId, err.publicMessage);
      } else {
        await supabase
          .from("bling_integrations")
          .update({ last_sync_error: err.publicMessage })
          .eq("organization_id", orgId);
      }
      return { ok: false, code: err.code, error: err.publicMessage };
    }
    logError("bling.sync", err);
    const message = "Erro inesperado na sincronização com o Bling.";
    await supabase.from("bling_integrations").update({ last_sync_error: message }).eq("organization_id", orgId);
    return { ok: false, code: "unknown", error: message };
  } finally {
    running.delete(orgId);
  }
}

export async function syncAllConnectedOrganizations(
  deps: SyncDeps = {},
): Promise<{ organizations: number; failures: number }> {
  const supabase = deps.supabase ?? createServiceClient();
  const { data, error } = await supabase
    .from("bling_integrations")
    .select("organization_id")
    .eq("status", "connected");
  if (error) {
    logError("bling.sync-all", error);
    return { organizations: 0, failures: 0 };
  }
  let failures = 0;
  for (const row of data ?? []) {
    const result = await syncOrganizationProducts(row.organization_id, { ...deps, supabase });
    if (!result.ok && result.code !== "already_running") failures += 1;
  }
  return { organizations: data?.length ?? 0, failures };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run tests/bling-map-product.test.ts tests/bling-sync.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Commit**

```bash
git add lib/bling/map-product.ts lib/bling/sync.ts tests/bling-map-product.test.ts tests/bling-sync.test.ts
git commit -m "feat(bling): sincronização paginada de produtos com proteção e verificação de kits"
```

---

### Tarefa 7: Conexão com o Bling na interface, sync manual e job de 15 min

**Arquivos:**
- Criar: `lib/bling/oauth-state.ts`, `lib/bling/queries.ts`, `lib/bling/actions.ts`
- Criar: `app/api/integrations/bling/connect/route.ts`, `app/api/integrations/bling/callback/route.ts`
- Criar: `app/(app)/app/[orgSlug]/settings/integracoes/bling/page.tsx`
- Criar: `app/(app)/app/[orgSlug]/settings/integracoes/bling/_components/bling-connection-card.tsx`
- Modificar: `lib/jobs/index.ts`, `config/nav.config.ts`
- Teste: `tests/bling-callback-state.test.ts`, `tests/bling-actions.test.ts`

**Interfaces:**
- Consome: `buildAuthorizeUrl`, `exchangeAuthorizationCode`, `saveBlingTokens`, `deleteBlingIntegration` (Tarefa 4); `syncOrganizationProducts`, `syncAllConnectedOrganizations`, `SyncStats` (Tarefa 6); `BLING_SYNC_INTERVAL_MS` (Tarefa 3).
- Produz:
  ```ts
  // oauth-state.ts
  export const BLING_STATE_COOKIE = "bling_oauth_state";
  export function createOAuthState(orgSlug: string): { state: string; cookieValue: string };
  export function readOAuthState(cookieValue: string | undefined, stateParam: string | null): string | null; // devolve orgSlug
  // queries.ts
  export type BlingIntegrationStatus = {
    connected: boolean; status: "connected" | "error" | null; lastSyncAt: string | null;
    lastSyncError: string | null; lastSyncStats: SyncStats | null;
  };
  export function getBlingIntegrationStatus(orgId: string): Promise<BlingIntegrationStatus>;
  export function isBlingConfigured(): boolean;
  // actions.ts
  export function syncBlingNowAction(input: { orgSlug: string }): Promise<ActionResult<SyncStats>>;
  export function disconnectBlingAction(input: { orgSlug: string }): Promise<ActionResult>;
  ```

- [ ] **Passo 1: Escrever os testes que falham**

`tests/bling-callback-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createOAuthState, readOAuthState } from "@/lib/bling/oauth-state";

describe("OAuth state do Bling", () => {
  it("gera state aleatório e recupera o orgSlug com o mesmo state", () => {
    const a = createOAuthState("m10");
    const b = createOAuthState("m10");
    expect(a.state).toMatch(/^[a-f0-9]{48}$/);
    expect(a.state).not.toBe(b.state);
    expect(readOAuthState(a.cookieValue, a.state)).toBe("m10");
  });

  it("recusa state diferente, ausente ou cookie adulterado", () => {
    const { cookieValue, state } = createOAuthState("m10");
    expect(readOAuthState(cookieValue, `${state.slice(0, -1)}0`)).toBeNull();
    expect(readOAuthState(cookieValue, null)).toBeNull();
    expect(readOAuthState(undefined, state)).toBeNull();
    expect(readOAuthState("lixo", state)).toBeNull();
  });
});
```

`tests/bling-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({ requireOrgRole: vi.fn() }));
vi.mock("@/lib/bling/sync", () => ({ syncOrganizationProducts: vi.fn() }));
vi.mock("@/lib/bling/tokens", () => ({ deleteBlingIntegration: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireOrgRole } from "@/lib/auth/guards";
import { disconnectBlingAction, syncBlingNowAction } from "@/lib/bling/actions";
import { syncOrganizationProducts } from "@/lib/bling/sync";
import { deleteBlingIntegration } from "@/lib/bling/tokens";

const mockedRole = requireOrgRole as unknown as ReturnType<typeof vi.fn>;
const mockedSync = syncOrganizationProducts as unknown as ReturnType<typeof vi.fn>;
const mockedDelete = deleteBlingIntegration as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedRole.mockResolvedValue({ user: { id: "u1" }, org: { id: "org-1", slug: "m10" }, role: "owner" });
});

describe("syncBlingNowAction", () => {
  it("exige owner/admin e sincroniza a organização do usuário", async () => {
    const stats = { fetched: 3, deactivated: 0, kitsUnpublished: 0, durationMs: 10 };
    mockedSync.mockResolvedValue({ ok: true, stats });

    await expect(syncBlingNowAction({ orgSlug: "m10" })).resolves.toEqual({ ok: true, data: stats });
    expect(mockedRole).toHaveBeenCalledWith({ orgSlug: "m10", roles: ["owner", "admin"] });
    expect(mockedSync).toHaveBeenCalledWith("org-1");
  });

  it("devolve a mensagem pública quando o sync falha", async () => {
    mockedSync.mockResolvedValue({ ok: false, code: "unavailable", error: "Bling fora do ar" });
    await expect(syncBlingNowAction({ orgSlug: "m10" })).resolves.toEqual({ ok: false, error: "Bling fora do ar" });
  });

  it("valida a entrada antes de tudo", async () => {
    await expect(syncBlingNowAction({ orgSlug: "" })).resolves.toMatchObject({ ok: false });
    expect(mockedRole).not.toHaveBeenCalled();
  });
});

describe("disconnectBlingAction", () => {
  it("remove a integração da organização", async () => {
    mockedDelete.mockResolvedValue(undefined);
    await expect(disconnectBlingAction({ orgSlug: "m10" })).resolves.toEqual({ ok: true });
    expect(mockedDelete).toHaveBeenCalledWith("org-1");
  });

  it("erro vira mensagem leiga", async () => {
    mockedDelete.mockRejectedValue(new Error("db down"));
    await expect(disconnectBlingAction({ orgSlug: "m10" })).resolves.toEqual({
      ok: false,
      error: "Não foi possível desconectar o Bling. Tente novamente.",
    });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/bling-callback-state.test.ts tests/bling-actions.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/bling/oauth-state"`.

- [ ] **Passo 3: Implementar a lógica**

`lib/bling/oauth-state.ts`:

```ts
import { randomBytes, timingSafeEqual } from "node:crypto";

export const BLING_STATE_COOKIE = "bling_oauth_state";

export function createOAuthState(orgSlug: string): { state: string; cookieValue: string } {
  const state = randomBytes(24).toString("hex");
  return { state, cookieValue: `${state}.${orgSlug}` };
}

/** Devolve o orgSlug guardado no cookie se o state do callback bater; senão null. */
export function readOAuthState(cookieValue: string | undefined, stateParam: string | null): string | null {
  if (!cookieValue || !stateParam) return null;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  const expected = Buffer.from(cookieValue.slice(0, dot));
  const received = Buffer.from(stateParam);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  const orgSlug = cookieValue.slice(dot + 1);
  return orgSlug.length > 0 ? orgSlug : null;
}
```

`lib/bling/queries.ts`:

```ts
import { logError } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import type { SyncStats } from "./sync";

export type BlingIntegrationStatus = {
  connected: boolean;
  status: "connected" | "error" | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncStats: SyncStats | null;
};

export function isBlingConfigured(): boolean {
  return Boolean(process.env.BLING_CLIENT_ID && process.env.BLING_CLIENT_SECRET);
}

/** Lê só campos seguros (nunca tokens). Chamar apenas depois de requireOrgRole. */
export async function getBlingIntegrationStatus(orgId: string): Promise<BlingIntegrationStatus> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("bling_integrations")
    .select("status, last_sync_at, last_sync_error, last_sync_stats")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) logError("bling.queries.status", error);
  if (!data) {
    return { connected: false, status: null, lastSyncAt: null, lastSyncError: null, lastSyncStats: null };
  }
  return {
    connected: true,
    status: data.status === "error" ? "error" : "connected",
    lastSyncAt: data.last_sync_at,
    lastSyncError: data.last_sync_error,
    lastSyncStats: (data.last_sync_stats as SyncStats | null) ?? null,
  };
}
```

`lib/bling/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth/guards";
import { logError } from "@/lib/logger";
import { type SyncStats, syncOrganizationProducts } from "./sync";
import { deleteBlingIntegration } from "./tokens";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const orgInputSchema = z.object({ orgSlug: z.string().min(1).max(80) });

function revalidateBling(orgSlug: string) {
  revalidatePath(`/app/${orgSlug}/settings/integracoes/bling`);
  revalidatePath(`/app/${orgSlug}/catalogo`);
}

export async function syncBlingNowAction(input: { orgSlug: string }): Promise<ActionResult<SyncStats>> {
  const parsed = orgInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { org } = await requireOrgRole({ orgSlug: parsed.data.orgSlug, roles: ["owner", "admin"] });

  const result = await syncOrganizationProducts(org.id);
  revalidateBling(parsed.data.orgSlug);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.stats };
}

export async function disconnectBlingAction(input: { orgSlug: string }): Promise<ActionResult> {
  const parsed = orgInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { org } = await requireOrgRole({ orgSlug: parsed.data.orgSlug, roles: ["owner", "admin"] });

  try {
    await deleteBlingIntegration(org.id);
  } catch (err) {
    logError("bling.actions.disconnect", err);
    return { ok: false, error: "Não foi possível desconectar o Bling. Tente novamente." };
  }
  revalidateBling(parsed.data.orgSlug);
  return { ok: true };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run tests/bling-callback-state.test.ts tests/bling-actions.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Rotas de OAuth**

`app/api/integrations/bling/connect/route.ts`:

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/auth/guards";
import { buildAuthorizeUrl } from "@/lib/bling/oauth";
import { BLING_STATE_COOKIE, createOAuthState } from "@/lib/bling/oauth-state";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get("org") ?? "";
  await requireOrgRole({ orgSlug, roles: ["owner", "admin"] });

  const { state, cookieValue } = createOAuthState(orgSlug);
  const back = new URL(`/app/${orgSlug}/settings/integracoes/bling`, req.url);

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (err) {
    logError("bling.connect", err);
    back.searchParams.set("erro", "not_configured");
    return NextResponse.redirect(back);
  }

  const cookieStore = await cookies();
  cookieStore.set(BLING_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/bling",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl);
}
```

`app/api/integrations/bling/callback/route.ts`:

```ts
import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { requireOrgRole } from "@/lib/auth/guards";
import { BlingError } from "@/lib/bling/errors";
import { exchangeAuthorizationCode } from "@/lib/bling/oauth";
import { BLING_STATE_COOKIE, readOAuthState } from "@/lib/bling/oauth-state";
import { syncOrganizationProducts } from "@/lib/bling/sync";
import { saveBlingTokens } from "@/lib/bling/tokens";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cookieStore = await cookies();
  const orgSlug = readOAuthState(cookieStore.get(BLING_STATE_COOKIE)?.value, url.searchParams.get("state"));
  cookieStore.delete({ name: BLING_STATE_COOKIE, path: "/api/integrations/bling" });

  if (!orgSlug) {
    return NextResponse.redirect(new URL("/?erro=bling_state", req.url));
  }

  const { user, org } = await requireOrgRole({ orgSlug, roles: ["owner", "admin"] });
  const back = new URL(`/app/${orgSlug}/settings/integracoes/bling`, req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    back.searchParams.set("erro", "sem_codigo");
    return NextResponse.redirect(back);
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    await saveBlingTokens(org.id, tokens, user.id);
  } catch (err) {
    logError("bling.callback", err);
    back.searchParams.set("erro", err instanceof BlingError ? err.code : "unknown");
    return NextResponse.redirect(back);
  }

  after(async () => {
    await syncOrganizationProducts(org.id);
  });
  back.searchParams.set("conectado", "1");
  return NextResponse.redirect(back);
}
```

- [ ] **Passo 6: Tela de configuração**

`app/(app)/app/[orgSlug]/settings/integracoes/bling/page.tsx`:

```tsx
import { requireOrgRole } from "@/lib/auth/guards";
import { getBlingIntegrationStatus, isBlingConfigured } from "@/lib/bling/queries";
import { BlingConnectionCard } from "./_components/bling-connection-card";

type Props = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ conectado?: string; erro?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "O servidor ainda não tem as credenciais do aplicativo Bling (BLING_CLIENT_ID e BLING_CLIENT_SECRET).",
  token_invalid: "O Bling recusou a autorização. Tente conectar de novo.",
  sem_codigo: "O Bling não devolveu a autorização. Tente conectar de novo.",
  unavailable: "O Bling não respondeu. Tente de novo em alguns minutos.",
};

export default async function BlingSettingsPage({ params, searchParams }: Props) {
  const { orgSlug } = await params;
  const { conectado, erro } = await searchParams;
  const { org } = await requireOrgRole({ orgSlug, roles: ["owner", "admin"] });
  const status = await getBlingIntegrationStatus(org.id);

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <span className="label-mono">/ integrações / bling</span>
        <h1 className="font-semibold text-3xl tracking-tight">Bling</h1>
        <p className="text-muted-foreground text-sm">
          Conecte o ERP para trazer produtos, preços e estoque para o catálogo. A sincronização roda a cada 15 minutos.
        </p>
      </div>
      <BlingConnectionCard
        orgSlug={orgSlug}
        configured={isBlingConfigured()}
        status={status}
        justConnected={conectado === "1"}
        errorMessage={erro ? (ERROR_MESSAGES[erro] ?? "Não foi possível conectar ao Bling. Tente novamente.") : null}
      />
    </div>
  );
}
```

`app/(app)/app/[orgSlug]/settings/integracoes/bling/_components/bling-connection-card.tsx`:

```tsx
"use client";

import { Loader2Icon, RefreshCwIcon, UnplugIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { disconnectBlingAction, syncBlingNowAction } from "@/lib/bling/actions";
import type { BlingIntegrationStatus } from "@/lib/bling/queries";

type Props = {
  orgSlug: string;
  configured: boolean;
  status: BlingIntegrationStatus;
  justConnected: boolean;
  errorMessage: string | null;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function BlingConnectionCard({ orgSlug, configured, status, justConnected, errorMessage }: Props) {
  const [isSyncing, startSync] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const connectHref = `/api/integrations/bling/connect?org=${encodeURIComponent(orgSlug)}`;

  function handleSync() {
    startSync(async () => {
      const result = await syncBlingNowAction({ orgSlug });
      if (result.ok) toast.success(`Sincronizado: ${result.data?.fetched ?? 0} produtos lidos do Bling.`);
      else toast.error(result.error);
    });
  }

  function handleDisconnect() {
    startDisconnect(async () => {
      const result = await disconnectBlingAction({ orgSlug });
      setConfirmOpen(false);
      if (result.ok) toast.success("Bling desconectado.");
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Conexão</CardTitle>
        {!status.connected && <Badge variant="outline">Desconectado</Badge>}
        {status.status === "connected" && <Badge>Conectado</Badge>}
        {status.status === "error" && <Badge variant="destructive">Precisa reconectar</Badge>}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {justConnected && <p className="text-primary">Bling conectado! A primeira sincronização já começou.</p>}
        {errorMessage && <p className="text-destructive">{errorMessage}</p>}
        {!configured && (
          <p className="text-muted-foreground">
            Peça ao responsável técnico para configurar BLING_CLIENT_ID e BLING_CLIENT_SECRET no servidor.
          </p>
        )}

        {status.connected && (
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Última sincronização</dt>
              <dd>{status.lastSyncAt ? dateTime.format(new Date(status.lastSyncAt)) : "Ainda não sincronizou"}</dd>
            </div>
            {status.lastSyncStats && (
              <div>
                <dt className="text-muted-foreground">Resultado</dt>
                <dd>
                  {status.lastSyncStats.fetched} produtos lidos · {status.lastSyncStats.deactivated} inativados ·{" "}
                  {status.lastSyncStats.kitsUnpublished} kits retirados
                </dd>
              </div>
            )}
            {status.lastSyncError && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Último erro</dt>
                <dd className="text-destructive">{status.lastSyncError}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="flex flex-wrap gap-2">
          {(!status.connected || status.status === "error") && configured && (
            <Button nativeButton={false} render={<a href={connectHref} />}>
              {status.connected ? "Reconectar Bling" : "Conectar Bling"}
            </Button>
          )}
          {status.connected && (
            <>
              <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
                {isSyncing ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
                Sincronizar agora
              </Button>
              <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
                <UnplugIcon />
                Desconectar
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar o Bling?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Os produtos já sincronizados continuam no catálogo, mas preço e estoque param de atualizar.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
              {isDisconnecting && <Loader2Icon className="animate-spin" />}
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
```

- [ ] **Passo 7: Job de 15 minutos**

Em `lib/jobs/index.ts`:

1. Adicionar aos imports:
```ts
import { BLING_SYNC_INTERVAL_MS } from "@/lib/bling/constants";
import { syncAllConnectedOrganizations } from "@/lib/bling/sync";
```
2. Junto das outras flags de re-entrância:
```ts
let blingSyncRunning = false;
```
3. Antes do `console.log("[jobs] started ...")`:
```ts
  // Sincroniza produtos do Bling de todas as organizações conectadas (spec §4.1)
  intervals.push(
    setInterval(async () => {
      if (blingSyncRunning) return;
      blingSyncRunning = true;
      try {
        await syncAllConnectedOrganizations();
      } catch (err) {
        console.error("[jobs/bling-sync]", err);
      } finally {
        blingSyncRunning = false;
      }
    }, BLING_SYNC_INTERVAL_MS),
  );
```
4. Trocar a mensagem do log para:
```ts
  console.log(
    "[jobs] started 8 background intervals (4 recoveries + scheduled messages + automations worker + recovery + bling sync)",
  );
```

- [ ] **Passo 8: Itens de navegação**

Em `config/nav.config.ts`:
1. Adicionar `PackageIcon` e `PlugIcon` ao import de `lucide-react` (ordem alfabética).
2. No bloco `// CRM — entidades de negócio`, depois de Pipelines:
```ts
  { path: "/catalogo", label: "Catálogo", icon: PackageIcon, group: "crm", roles: ["owner", "admin"] },
```
3. Logo depois do item `/settings/channels`:
```ts
  {
    path: "/settings/integracoes/bling",
    label: "Bling",
    icon: PlugIcon,
    group: "automacao",
    roles: ["owner", "admin"],
  },
```

- [ ] **Passo 9: Verificar tipos, lint e testes**

Run: `npx tsc --noEmit && npm run check && npx vitest run tests/bling-*.test.ts`
Esperado: sem erros; testes PASS.

- [ ] **Passo 10: Teste manual (precisa de app no Bling)**

1. Em https://developer.bling.com.br/aplicativos, criar app com URL de redirecionamento `http://localhost:3000/api/integrations/bling/callback` e escopo de **Produtos (leitura)** e **Estoques (leitura)**.
2. Colocar `BLING_CLIENT_ID` e `BLING_CLIENT_SECRET` em `.env.local`; `npm run dev`.
3. Logar como owner → menu **Bling** → **Conectar Bling** → autorizar.
4. Esperado: volta com "Bling conectado!"; em até 1 min, recarregar e ver "Última sincronização" e "N produtos lidos"; no Supabase, `select count(*) from bling_products` > 0 e `bling_integrations` com `last_sync_error` nulo.
5. **Sincronizar agora** → toast de sucesso.

- [ ] **Passo 11: Commit**

```bash
git add lib/bling/oauth-state.ts lib/bling/queries.ts lib/bling/actions.ts app/api/integrations/bling "app/(app)/app/[orgSlug]/settings/integracoes" lib/jobs/index.ts config/nav.config.ts tests/bling-callback-state.test.ts tests/bling-actions.test.ts
git commit -m "feat(bling): tela de conexão OAuth, sincronizar agora e job de 15 minutos"
```

---

### Tarefa 8: Catálogo — schemas, consultas e actions de produtos e categorias

**Arquivos:**
- Criar: `lib/catalog/options.ts`, `lib/catalog/schemas.ts`, `lib/catalog/queries.ts`, `lib/catalog/actions.ts`
- Teste: `tests/catalog-schemas.test.ts`, `tests/catalog-actions-permissions.test.ts`

**Interfaces:**
- Consome: `isValidCatalogSlug` (Tarefa 2); `enforceKitIntegrity`, `KIT_SELECT`, `KitRow`, `toKitComponents` (Tarefa 5); `findKitProblems`, `describeKitProblems` (Tarefa 2).
- Produz:
  ```ts
  // options.ts
  export const STONE_OPTIONS: readonly { value: StoneValue; label: string }[];
  export const APPLICATION_OPTIONS: readonly { value: ApplicationValue; label: string }[];
  export const STONE_VALUES: readonly [StoneValue, ...StoneValue[]];
  export const APPLICATION_VALUES: readonly [ApplicationValue, ...ApplicationValue[]];
  // schemas.ts
  export const saveCatalogProductSchema; export type SaveCatalogProductInput;
  export const setCatalogItemPublishedSchema; export type SetCatalogItemPublishedInput;
  export const createCategorySchema; export type CreateCategoryInput;
  export const updateCategorySchema; export type UpdateCategoryInput;
  export const deleteCategorySchema; export type DeleteCategoryInput;
  // queries.ts
  export type CatalogItemFields = {
    id: string; slug: string; isPublished: boolean; categoryId: string | null; title: string | null;
    description: string | null; stones: string[]; applications: string[]; grit: string | null;
    diameterMm: number | null; machines: string[]; isFeatured: boolean; seoTitle: string | null; seoDescription: string | null;
  };
  export type CatalogProductRow = {
    blingProductId: string; blingId: number; sku: string | null; name: string; description: string | null;
    price: number; stock: number; images: string[]; blingStatus: "active" | "inactive"; syncedAt: string;
    catalogItem: CatalogItemFields | null;
  };
  export type CategoryRow = { id: string; name: string; slug: string; description: string | null; sortOrder: number };
  export function getCatalogProducts(orgId: string): Promise<CatalogProductRow[]>;
  export function getCategories(orgId: string): Promise<CategoryRow[]>;
  // actions.ts
  export function saveCatalogProductAction(input: SaveCatalogProductInput): Promise<ActionResult<{ catalogItemId: string }>>;
  export function setCatalogItemPublishedAction(input: SetCatalogItemPublishedInput): Promise<ActionResult>;
  export function createCategoryAction(input: CreateCategoryInput): Promise<ActionResult<{ id: string }>>;
  export function updateCategoryAction(input: UpdateCategoryInput): Promise<ActionResult>;
  export function deleteCategoryAction(input: DeleteCategoryInput): Promise<ActionResult>;
  ```

- [ ] **Passo 1: Escrever os testes que falham**

`tests/catalog-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCategorySchema, saveCatalogProductSchema } from "@/lib/catalog/schemas";

const validProduct = {
  orgSlug: "m10",
  blingProductId: "0b8e7c1e-3a54-4a57-9a0b-6f6b6c6d6e6f",
  slug: "disco-turbo-350",
  categoryId: null,
  title: "Disco Turbo 350 mm",
  description: null,
  stones: ["granito", "quartzito"],
  applications: ["corte"],
  grit: null,
  diameterMm: 350,
  machines: ["Serra ponte"],
  isFeatured: false,
  isPublished: true,
  seoTitle: null,
  seoDescription: null,
};

describe("saveCatalogProductSchema", () => {
  it("aceita um produto válido", () => {
    expect(saveCatalogProductSchema.safeParse(validProduct).success).toBe(true);
  });

  it("recusa slug inválido com mensagem em PT-BR", () => {
    const result = saveCatalogProductSchema.safeParse({ ...validProduct, slug: "Disco Turbo" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Use só letras minúsculas, números e hífens");
  });

  it("recusa pedra fora da lista e diâmetro absurdo", () => {
    expect(saveCatalogProductSchema.safeParse({ ...validProduct, stones: ["madeira"] }).success).toBe(false);
    expect(saveCatalogProductSchema.safeParse({ ...validProduct, diameterMm: 99999 }).success).toBe(false);
  });
});

describe("createCategorySchema", () => {
  it("exige nome", () => {
    const result = createCategorySchema.safeParse({
      orgSlug: "m10",
      name: "  ",
      slug: "discos",
      description: null,
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Informe o nome");
  });
});
```

`tests/catalog-actions-permissions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({ requireOrgRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/catalog/kit-guard", () => ({ enforceKitIntegrity: vi.fn(async () => ({ unpublished: 0 })) }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireOrgRole } from "@/lib/auth/guards";
import { createCategoryAction, saveCatalogProductAction } from "@/lib/catalog/actions";
import { enforceKitIntegrity } from "@/lib/catalog/kit-guard";
import { createClient } from "@/lib/supabase/server";

const mockedRole = requireOrgRole as unknown as ReturnType<typeof vi.fn>;
const mockedCreate = createClient as unknown as ReturnType<typeof vi.fn>;
const mockedGuard = enforceKitIntegrity as unknown as ReturnType<typeof vi.fn>;

const PRODUCT_ID = "0b8e7c1e-3a54-4a57-9a0b-6f6b6c6d6e6f";
const input = {
  orgSlug: "m10",
  blingProductId: PRODUCT_ID,
  slug: "disco-turbo-350",
  categoryId: null,
  title: null,
  description: null,
  stones: [],
  applications: [],
  grit: null,
  diameterMm: null,
  machines: [],
  isFeatured: false,
  isPublished: false,
  seoTitle: null,
  seoDescription: null,
};

type Result = { data: unknown; error: { code?: string } | null };

function fakeClient(opts: { product: Result; existing: Result; write: Result }) {
  const chain = (final: Result) => {
    const c = {
      eq: () => c,
      select: () => c,
      maybeSingle: async () => final,
      single: async () => final,
    };
    return c;
  };
  return {
    from(table: string) {
      if (table === "bling_products") return { select: () => chain(opts.product) };
      return {
        select: () => chain(opts.existing),
        insert: () => chain(opts.write),
        update: () => chain(opts.write),
      };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRole.mockResolvedValue({ user: { id: "u1" }, org: { id: "org-1", slug: "m10" }, role: "admin" });
});

describe("saveCatalogProductAction", () => {
  it("exige owner/admin", async () => {
    mockedCreate.mockResolvedValue(
      fakeClient({
        product: { data: { id: PRODUCT_ID }, error: null },
        existing: { data: null, error: null },
        write: { data: { id: "ci-1" }, error: null },
      }),
    );
    await expect(saveCatalogProductAction(input)).resolves.toEqual({ ok: true, data: { catalogItemId: "ci-1" } });
    expect(mockedRole).toHaveBeenCalledWith({ orgSlug: "m10", roles: ["owner", "admin"] });
  });

  it("produto de outra organização não é encontrado", async () => {
    mockedCreate.mockResolvedValue(
      fakeClient({
        product: { data: null, error: null },
        existing: { data: null, error: null },
        write: { data: null, error: null },
      }),
    );
    await expect(saveCatalogProductAction(input)).resolves.toEqual({ ok: false, error: "Produto não encontrado." });
  });

  it("slug repetido vira mensagem amigável", async () => {
    mockedCreate.mockResolvedValue(
      fakeClient({
        product: { data: { id: PRODUCT_ID }, error: null },
        existing: { data: null, error: null },
        write: { data: null, error: { code: "23505" } },
      }),
    );
    await expect(saveCatalogProductAction(input)).resolves.toEqual({
      ok: false,
      error: "Já existe um item com esse endereço (slug). Escolha outro.",
    });
  });

  it("despublicar produto verifica os kits", async () => {
    mockedCreate.mockResolvedValue(
      fakeClient({
        product: { data: { id: PRODUCT_ID }, error: null },
        existing: { data: { id: "ci-1" }, error: null },
        write: { data: { id: "ci-1" }, error: null },
      }),
    );
    await saveCatalogProductAction({ ...input, isPublished: false });
    expect(mockedGuard).toHaveBeenCalledWith("org-1");
  });
});

describe("createCategoryAction", () => {
  it("recusa entrada inválida sem consultar o banco", async () => {
    const result = await createCategoryAction({ orgSlug: "m10", name: "", slug: "x", description: null, sortOrder: 0 });
    expect(result.ok).toBe(false);
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/catalog-schemas.test.ts tests/catalog-actions-permissions.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/catalog/schemas"`.

- [ ] **Passo 3: Implementar**

`lib/catalog/options.ts`:

```ts
export type StoneValue =
  | "granito"
  | "marmore"
  | "quartzito"
  | "porcelanato"
  | "travertino"
  | "quartzo"
  | "ardosia";

export type ApplicationValue = "corte" | "desbaste" | "polimento" | "lustro" | "acabamento-borda" | "furacao";

export const STONE_OPTIONS: readonly { value: StoneValue; label: string }[] = [
  { value: "granito", label: "Granito" },
  { value: "marmore", label: "Mármore" },
  { value: "quartzito", label: "Quartzito" },
  { value: "porcelanato", label: "Porcelanato" },
  { value: "travertino", label: "Travertino" },
  { value: "quartzo", label: "Quartzo / Silestone" },
  { value: "ardosia", label: "Ardósia" },
];

export const APPLICATION_OPTIONS: readonly { value: ApplicationValue; label: string }[] = [
  { value: "corte", label: "Corte" },
  { value: "desbaste", label: "Desbaste" },
  { value: "polimento", label: "Polimento" },
  { value: "lustro", label: "Lustro / brilho" },
  { value: "acabamento-borda", label: "Acabamento de borda" },
  { value: "furacao", label: "Furação" },
];

export const STONE_VALUES = ["granito", "marmore", "quartzito", "porcelanato", "travertino", "quartzo", "ardosia"] as const;
export const APPLICATION_VALUES = ["corte", "desbaste", "polimento", "lustro", "acabamento-borda", "furacao"] as const;
```

`lib/catalog/schemas.ts`:

```ts
import { z } from "zod";
import { APPLICATION_VALUES, STONE_VALUES } from "./options";
import { isValidCatalogSlug } from "./slug";

const orgSlug = z.string().min(1).max(80);
const uuid = z.string().uuid();
const catalogSlug = z
  .string()
  .min(1, "Informe o endereço (slug)")
  .max(80)
  .refine(isValidCatalogSlug, "Use só letras minúsculas, números e hífens");
const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const saveCatalogProductSchema = z.object({
  orgSlug,
  blingProductId: uuid,
  slug: catalogSlug,
  categoryId: uuid.nullable(),
  title: optionalText(120),
  description: optionalText(4000),
  stones: z.array(z.enum(STONE_VALUES)).max(10),
  applications: z.array(z.enum(APPLICATION_VALUES)).max(10),
  grit: optionalText(40),
  diameterMm: z.number().int().positive().max(2000).nullable(),
  machines: z.array(z.string().trim().min(1).max(60)).max(10),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});
export type SaveCatalogProductInput = z.infer<typeof saveCatalogProductSchema>;

export const setCatalogItemPublishedSchema = z.object({
  orgSlug,
  catalogItemId: uuid,
  isPublished: z.boolean(),
});
export type SetCatalogItemPublishedInput = z.infer<typeof setCatalogItemPublishedSchema>;

export const createCategorySchema = z.object({
  orgSlug,
  name: z.string().trim().min(1, "Informe o nome").max(80),
  slug: catalogSlug,
  description: optionalText(500),
  sortOrder: z.number().int().min(0).max(9999),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.extend({ categoryId: uuid });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const deleteCategorySchema = z.object({ orgSlug, categoryId: uuid });
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
```

`lib/catalog/queries.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type CatalogItemFields = {
  id: string;
  slug: string;
  isPublished: boolean;
  categoryId: string | null;
  title: string | null;
  description: string | null;
  stones: string[];
  applications: string[];
  grit: string | null;
  diameterMm: number | null;
  machines: string[];
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type CatalogProductRow = {
  blingProductId: string;
  blingId: number;
  sku: string | null;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  images: string[];
  blingStatus: "active" | "inactive";
  syncedAt: string;
  catalogItem: CatalogItemFields | null;
};

export type CategoryRow = { id: string; name: string; slug: string; description: string | null; sortOrder: number };

type CatalogItemDb = {
  id: string;
  slug: string;
  is_published: boolean;
  category_id: string | null;
  title: string | null;
  description: string | null;
  stones: string[];
  applications: string[];
  grit: string | null;
  diameter_mm: number | null;
  machines: string[];
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
};

export function toCatalogItemFields(row: CatalogItemDb): CatalogItemFields {
  return {
    id: row.id,
    slug: row.slug,
    isPublished: row.is_published,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    stones: row.stones,
    applications: row.applications,
    grit: row.grit,
    diameterMm: row.diameter_mm,
    machines: row.machines,
    isFeatured: row.is_featured,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  };
}

export function toImageList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

const CATALOG_ITEM_COLUMNS =
  "id, slug, is_published, category_id, title, description, stones, applications, grit, diameter_mm, machines, is_featured, seo_title, seo_description";

export async function getCatalogProducts(orgId: string): Promise<CatalogProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bling_products")
    .select(`id, bling_id, sku, name, description, price, stock, images, bling_status, synced_at, catalog_items(${CATALOG_ITEM_COLUMNS})`)
    .eq("organization_id", orgId)
    .order("name");
  if (error) throw error;

  type Row = {
    id: string;
    bling_id: number;
    sku: string | null;
    name: string;
    description: string | null;
    price: number;
    stock: number;
    images: unknown;
    bling_status: "active" | "inactive";
    synced_at: string;
    catalog_items: CatalogItemDb[];
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    blingProductId: row.id,
    blingId: row.bling_id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    stock: Number(row.stock),
    images: toImageList(row.images),
    blingStatus: row.bling_status,
    syncedAt: row.synced_at,
    catalogItem: row.catalog_items[0] ? toCatalogItemFields(row.catalog_items[0]) : null,
  }));
}

export async function getCategories(orgId: string): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, slug, description, sort_order")
    .eq("organization_id", orgId)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    sortOrder: c.sort_order,
  }));
}
```

`lib/catalog/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireOrgRole } from "@/lib/auth/guards";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { enforceKitIntegrity } from "./kit-guard";
import { describeKitProblems, findKitProblems } from "./kit-pricing";
import { KIT_SELECT, type KitRow, toKitComponents } from "./kit-rows";
import {
  type CreateCategoryInput,
  createCategorySchema,
  type DeleteCategoryInput,
  deleteCategorySchema,
  type SaveCatalogProductInput,
  type SetCatalogItemPublishedInput,
  saveCatalogProductSchema,
  setCatalogItemPublishedSchema,
  type UpdateCategoryInput,
  updateCategorySchema,
} from "./schemas";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const SLUG_TAKEN = "Já existe um item com esse endereço (slug). Escolha outro.";
const ADMIN_ROLES: ("owner" | "admin")[] = ["owner", "admin"];

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

function revalidateCatalog(orgSlug: string) {
  revalidatePath(`/app/${orgSlug}/catalogo`, "layout");
}

export async function saveCatalogProductAction(
  input: SaveCatalogProductInput,
): Promise<ActionResult<{ catalogItemId: string }>> {
  const parsed = saveCatalogProductSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const v = parsed.data;
  const { org } = await requireOrgRole({ orgSlug: v.orgSlug, roles: ADMIN_ROLES });
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("bling_products")
    .select("id")
    .eq("id", v.blingProductId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!product) return { ok: false, error: "Produto não encontrado." };

  const values = {
    organization_id: org.id,
    kind: "product" as const,
    bling_product_id: v.blingProductId,
    slug: v.slug,
    category_id: v.categoryId,
    title: v.title || null,
    description: v.description || null,
    stones: v.stones,
    applications: v.applications,
    grit: v.grit || null,
    diameter_mm: v.diameterMm,
    machines: v.machines,
    is_featured: v.isFeatured,
    is_published: v.isPublished,
    seo_title: v.seoTitle || null,
    seo_description: v.seoDescription || null,
  };

  const { data: existing } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("organization_id", org.id)
    .eq("bling_product_id", v.blingProductId)
    .maybeSingle();

  const { data, error } = existing
    ? await supabase.from("catalog_items").update(values).eq("id", existing.id).select("id").single()
    : await supabase.from("catalog_items").insert(values).select("id").single();

  if (isUniqueViolation(error)) return { ok: false, error: SLUG_TAKEN };
  if (error || !data) {
    logError("catalog.save-product", error);
    return { ok: false, error: "Erro ao salvar o produto no catálogo. Tente novamente." };
  }

  if (!v.isPublished) await enforceKitIntegrity(org.id);
  revalidateCatalog(v.orgSlug);
  return { ok: true, data: { catalogItemId: data.id } };
}

export async function setCatalogItemPublishedAction(input: SetCatalogItemPublishedInput): Promise<ActionResult> {
  const parsed = setCatalogItemPublishedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { orgSlug, catalogItemId, isPublished } = parsed.data;
  const { org } = await requireOrgRole({ orgSlug, roles: ADMIN_ROLES });
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("catalog_items")
    .select("id, kind, kit_id")
    .eq("id", catalogItemId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!item) return { ok: false, error: "Item não encontrado." };

  if (isPublished && item.kind === "kit" && item.kit_id) {
    const { data: kit } = await supabase.from("kits").select(KIT_SELECT).eq("id", item.kit_id).maybeSingle();
    const problems = kit ? findKitProblems(toKitComponents(kit as unknown as KitRow)) : [];
    if (problems.length > 0) {
      return { ok: false, error: `Não dá para publicar: ${describeKitProblems(problems)}.` };
    }
    await supabase.from("kits").update({ hidden_reason: null }).eq("id", item.kit_id);
  }

  const { error } = await supabase.from("catalog_items").update({ is_published: isPublished }).eq("id", item.id);
  if (error) {
    logError("catalog.set-published", error);
    return { ok: false, error: "Erro ao alterar a publicação. Tente novamente." };
  }

  if (!isPublished) await enforceKitIntegrity(org.id);
  revalidateCatalog(orgSlug);
  return { ok: true };
}

export async function createCategoryAction(input: CreateCategoryInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const v = parsed.data;
  const { org } = await requireOrgRole({ orgSlug: v.orgSlug, roles: ADMIN_ROLES });
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_categories")
    .insert({ organization_id: org.id, name: v.name, slug: v.slug, description: v.description || null, sort_order: v.sortOrder })
    .select("id")
    .single();
  if (isUniqueViolation(error)) return { ok: false, error: "Já existe uma categoria com esse endereço (slug)." };
  if (error || !data) {
    logError("catalog.create-category", error);
    return { ok: false, error: "Erro ao criar categoria. Tente novamente." };
  }
  revalidateCatalog(v.orgSlug);
  return { ok: true, data: { id: data.id } };
}

export async function updateCategoryAction(input: UpdateCategoryInput): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const v = parsed.data;
  const { org } = await requireOrgRole({ orgSlug: v.orgSlug, roles: ADMIN_ROLES });
  const supabase = await createClient();

  const { error } = await supabase
    .from("product_categories")
    .update({ name: v.name, slug: v.slug, description: v.description || null, sort_order: v.sortOrder })
    .eq("id", v.categoryId)
    .eq("organization_id", org.id);
  if (isUniqueViolation(error)) return { ok: false, error: "Já existe uma categoria com esse endereço (slug)." };
  if (error) {
    logError("catalog.update-category", error);
    return { ok: false, error: "Erro ao salvar categoria. Tente novamente." };
  }
  revalidateCatalog(v.orgSlug);
  return { ok: true };
}

export async function deleteCategoryAction(input: DeleteCategoryInput): Promise<ActionResult> {
  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { org } = await requireOrgRole({ orgSlug: parsed.data.orgSlug, roles: ADMIN_ROLES });
  const supabase = await createClient();

  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", parsed.data.categoryId)
    .eq("organization_id", org.id);
  if (error) {
    logError("catalog.delete-category", error);
    return { ok: false, error: "Erro ao excluir categoria. Tente novamente." };
  }
  revalidateCatalog(parsed.data.orgSlug);
  return { ok: true };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run tests/catalog-schemas.test.ts tests/catalog-actions-permissions.test.ts && npx tsc --noEmit`
Esperado: PASS; `tsc` sem erros.

- [ ] **Passo 5: Commit**

```bash
git add lib/catalog/options.ts lib/catalog/schemas.ts lib/catalog/queries.ts lib/catalog/actions.ts tests/catalog-schemas.test.ts tests/catalog-actions-permissions.test.ts
git commit -m "feat(catalogo): publicar e enriquecer produtos do Bling e gerenciar categorias"
```

---

### Tarefa 9: Telas do catálogo — produtos e categorias

**Arquivos:**
- Criar: `lib/catalog/format.ts`
- Criar: `app/(app)/app/[orgSlug]/catalogo/_components/catalog-nav.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/page.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/_components/products-table.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/_components/product-publish-dialog.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/categorias/page.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/categorias/_components/categories-manager.tsx`

**Interfaces:**
- Consome (Tarefa 8): `getCatalogProducts`, `getCategories`, `CatalogProductRow`, `CategoryRow`, `saveCatalogProductAction`, `setCatalogItemPublishedAction`, `createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`, `STONE_OPTIONS`, `APPLICATION_OPTIONS`, `StoneValue`, `ApplicationValue`; (Tarefa 2) `slugifyCatalog`.
- Produz: `CatalogNav` (`{ orgSlug: string }`), usado também nas Tarefas 10 e 11; `formatBRL(value: number): string` em `lib/catalog/format.ts` (arquivo sem `"use client"`, para poder ser usado por Server e Client Components), reutilizado na Tarefa 10.
- Componentes existentes usados: `DataTable` (`@/components/app/data-table`, props `columns, data, searchColumn, searchPlaceholder, toolbar, empty, stateKey`), `EmptyState` (`@/components/app/empty-state`, props `icon, title, description, action`), `Badge` (variants `default | secondary | destructive | outline | ghost | link`), `Button`, `Checkbox`, `Switch`, `Dialog*`, `Input`, `Label`, `Textarea`, `Card*`.

> Esta tarefa é de interface; a lógica já está coberta pelos testes das Tarefas 2 e 8. A verificação é `tsc`, `check`, `build` e o roteiro manual do Passo 7.

- [ ] **Passo 1: Formatação de moeda e navegação interna do catálogo**

`lib/catalog/format.ts`:

```ts
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number): string {
  return brl.format(value);
}
```

`app/(app)/app/[orgSlug]/catalogo/_components/catalog-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "", label: "Produtos" },
  { href: "/kits", label: "Kits" },
  { href: "/categorias", label: "Categorias" },
  { href: "/api-do-site", label: "API do site" },
];

export function CatalogNav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const base = `/app/${orgSlug}/catalogo`;

  return (
    <nav className="flex flex-wrap gap-1 border-b" aria-label="Seções do catálogo">
      {LINKS.map((link) => {
        const href = `${base}${link.href}`;
        const active = link.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={link.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Passo 2: Página de produtos**

`app/(app)/app/[orgSlug]/catalogo/page.tsx`:

```tsx
import { requireOrgRole } from "@/lib/auth/guards";
import { getCatalogProducts, getCategories } from "@/lib/catalog/queries";
import { CatalogNav } from "./_components/catalog-nav";
import { ProductsTable } from "./_components/products-table";

type Props = { params: Promise<{ orgSlug: string }> };

export default async function CatalogProductsPage({ params }: Props) {
  const { orgSlug } = await params;
  const { org } = await requireOrgRole({ orgSlug, roles: ["owner", "admin"] });
  const [products, categories] = await Promise.all([getCatalogProducts(org.id), getCategories(org.id)]);
  const publishedCount = products.filter((p) => p.catalogItem?.isPublished).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="label-mono">/ catálogo</span>
        <h1 className="font-semibold text-3xl tracking-tight">Catálogo</h1>
        <p className="text-muted-foreground text-sm">
          {products.length} produtos vindos do Bling · {publishedCount} publicados no site. Preço e estoque aparecem só
          aqui dentro do CRM.
        </p>
      </div>
      <CatalogNav orgSlug={orgSlug} />
      <ProductsTable orgSlug={orgSlug} products={products} categories={categories} />
    </div>
  );
}
```

- [ ] **Passo 3: Tabela de produtos**

`app/(app)/app/[orgSlug]/catalogo/_components/products-table.tsx`:

```tsx
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PackageIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { setCatalogItemPublishedAction } from "@/lib/catalog/actions";
import { formatBRL } from "@/lib/catalog/format";
import type { CatalogProductRow, CategoryRow } from "@/lib/catalog/queries";
import { ProductPublishDialog } from "./product-publish-dialog";

type Props = { orgSlug: string; products: CatalogProductRow[]; categories: CategoryRow[] };

function PublishSwitch({ orgSlug, product }: { orgSlug: string; product: CatalogProductRow }) {
  const [isPending, startTransition] = useTransition();
  const item = product.catalogItem;
  if (!item) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <Switch
      checked={item.isPublished}
      disabled={isPending || product.blingStatus === "inactive"}
      aria-label={item.isPublished ? "Despublicar do site" : "Publicar no site"}
      onCheckedChange={(checked: boolean) =>
        startTransition(async () => {
          const result = await setCatalogItemPublishedAction({ orgSlug, catalogItemId: item.id, isPublished: checked });
          if (!result.ok) toast.error(result.error);
        })
      }
    />
  );
}

export function ProductsTable({ orgSlug, products, categories }: Props) {
  const [editing, setEditing] = useState<CatalogProductRow | null>(null);

  const columns: ColumnDef<CatalogProductRow>[] = [
    {
      id: "image",
      header: "",
      cell: ({ row }) =>
        row.original.images[0] ? (
          // biome-ignore lint/performance/noImgElement: imagens externas do Bling
          <img src={row.original.images[0]} alt="" className="size-10 rounded object-cover" />
        ) : (
          <div className="grid size-10 place-items-center rounded bg-muted">
            <PackageIcon className="size-4 text-muted-foreground" />
          </div>
        ),
    },
    {
      accessorKey: "name",
      header: "Produto",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">{row.original.catalogItem?.title || row.original.name}</div>
          <div className="text-muted-foreground text-xs">{row.original.sku ?? "sem código"}</div>
        </div>
      ),
    },
    {
      accessorKey: "price",
      header: "Preço (Bling)",
      cell: ({ row }) => <span className="tabular-nums">{formatBRL(row.original.price)}</span>,
    },
    {
      accessorKey: "stock",
      header: "Estoque",
      cell: ({ row }) => <span className="tabular-nums">{row.original.stock}</span>,
    },
    {
      id: "blingStatus",
      accessorFn: (p) => (p.blingStatus === "active" ? "Ativo" : "Inativo"),
      header: "Bling",
      cell: ({ row }) =>
        row.original.blingStatus === "active" ? (
          <Badge variant="secondary">Ativo</Badge>
        ) : (
          <Badge variant="destructive">Inativo</Badge>
        ),
    },
    {
      id: "published",
      header: "No site",
      cell: ({ row }) => <PublishSwitch orgSlug={orgSlug} product={row.original} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setEditing(row.original)}>
          {row.original.catalogItem ? "Editar ficha" : "Publicar"}
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={products}
        searchColumn="name"
        searchPlaceholder="Buscar produto..."
        stateKey={`catalogo:${orgSlug}`}
        empty={
          <EmptyState
            icon={PackageIcon}
            title="Nenhum produto sincronizado"
            description="Conecte o Bling para trazer seus produtos."
            action={
              <Button nativeButton={false} render={<Link href={`/app/${orgSlug}/settings/integracoes/bling`} />}>
                Conectar Bling
              </Button>
            }
          />
        }
      />
      {editing && (
        <ProductPublishDialog
          orgSlug={orgSlug}
          product={editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Passo 4: Diálogo de publicação e ficha técnica**

`app/(app)/app/[orgSlug]/catalogo/_components/product-publish-dialog.tsx`:

```tsx
"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveCatalogProductAction } from "@/lib/catalog/actions";
import { APPLICATION_OPTIONS, type ApplicationValue, STONE_OPTIONS, type StoneValue } from "@/lib/catalog/options";
import type { CatalogProductRow, CategoryRow } from "@/lib/catalog/queries";
import { slugifyCatalog } from "@/lib/catalog/slug";

type Props = {
  orgSlug: string;
  product: CatalogProductRow;
  categories: CategoryRow[];
  onClose: () => void;
};

function toggle<T>(list: T[], value: T, checked: boolean): T[] {
  return checked ? [...list, value] : list.filter((v) => v !== value);
}

export function ProductPublishDialog({ orgSlug, product, categories, onClose }: Props) {
  const item = product.catalogItem;
  const [slug, setSlug] = useState(item?.slug ?? slugifyCatalog(product.name));
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [stones, setStones] = useState<StoneValue[]>((item?.stones ?? []) as StoneValue[]);
  const [applications, setApplications] = useState<ApplicationValue[]>((item?.applications ?? []) as ApplicationValue[]);
  const [grit, setGrit] = useState(item?.grit ?? "");
  const [diameter, setDiameter] = useState(item?.diameterMm ? String(item.diameterMm) : "");
  const [machines, setMachines] = useState((item?.machines ?? []).join(", "));
  const [isFeatured, setIsFeatured] = useState(item?.isFeatured ?? false);
  const [isPublished, setIsPublished] = useState(item?.isPublished ?? true);
  const [seoTitle, setSeoTitle] = useState(item?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(item?.seoDescription ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveCatalogProductAction({
        orgSlug,
        blingProductId: product.blingProductId,
        slug,
        categoryId: categoryId || null,
        title: title.trim() || null,
        description: description.trim() || null,
        stones,
        applications,
        grit: grit.trim() || null,
        diameterMm: diameter ? Number(diameter) : null,
        machines: machines
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
        isFeatured,
        isPublished,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isPublished ? "Produto publicado no site." : "Ficha salva (não publicada).");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        <form id="publish-product-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pp-title">Nome no site (opcional)</Label>
            <Input id="pp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={product.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-slug">Endereço (slug)</Label>
            <Input id="pp-slug" value={slug} onChange={(e) => setSlug(slugifyCatalog(e.target.value))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-category">Categoria</Label>
            <select
              id="pp-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pp-description">Descrição comercial (opcional)</Label>
            <Textarea
              id="pp-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={product.description ?? ""}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="font-medium text-sm">Pedras indicadas</legend>
            {STONE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm" htmlFor={`pp-stone-${o.value}`}>
                <Checkbox
                  id={`pp-stone-${o.value}`}
                  checked={stones.includes(o.value)}
                  onCheckedChange={(checked: boolean) => setStones((s) => toggle(s, o.value, checked))}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="font-medium text-sm">Aplicação</legend>
            {APPLICATION_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm" htmlFor={`pp-app-${o.value}`}>
                <Checkbox
                  id={`pp-app-${o.value}`}
                  checked={applications.includes(o.value)}
                  onCheckedChange={(checked: boolean) => setApplications((s) => toggle(s, o.value, checked))}
                />
                {o.label}
              </label>
            ))}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="pp-grit">Grana</Label>
            <Input id="pp-grit" value={grit} onChange={(e) => setGrit(e.target.value)} placeholder="ex: 50, 400, 3000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-diameter">Diâmetro (mm)</Label>
            <Input
              id="pp-diameter"
              type="number"
              min={1}
              max={2000}
              value={diameter}
              onChange={(e) => setDiameter(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pp-machines">Máquinas compatíveis (separe por vírgula)</Label>
            <Input
              id="pp-machines"
              value={machines}
              onChange={(e) => setMachines(e.target.value)}
              placeholder="Serra ponte, Lixadeira angular, Politriz"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-seo-title">Título no Google (opcional)</Label>
            <Input id="pp-seo-title" maxLength={70} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pp-seo-description">Descrição no Google (opcional)</Label>
            <Input
              id="pp-seo-description"
              maxLength={160}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm" htmlFor="pp-featured">
            <Checkbox id="pp-featured" checked={isFeatured} onCheckedChange={(c: boolean) => setIsFeatured(c)} />
            Destacar na home
          </label>
          <label className="flex items-center gap-2 text-sm" htmlFor="pp-published">
            <Checkbox
              id="pp-published"
              checked={isPublished}
              disabled={product.blingStatus === "inactive"}
              onCheckedChange={(c: boolean) => setIsPublished(c)}
            />
            Publicar no site
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="publish-product-form" disabled={isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Passo 5: Página de categorias**

`app/(app)/app/[orgSlug]/catalogo/categorias/page.tsx`:

```tsx
import { requireOrgRole } from "@/lib/auth/guards";
import { getCategories } from "@/lib/catalog/queries";
import { CatalogNav } from "../_components/catalog-nav";
import { CategoriesManager } from "./_components/categories-manager";

type Props = { params: Promise<{ orgSlug: string }> };

export default async function CatalogCategoriesPage({ params }: Props) {
  const { orgSlug } = await params;
  const { org } = await requireOrgRole({ orgSlug, roles: ["owner", "admin"] });
  const categories = await getCategories(org.id);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="label-mono">/ catálogo / categorias</span>
        <h1 className="font-semibold text-3xl tracking-tight">Categorias</h1>
        <p className="text-muted-foreground text-sm">Como os produtos aparecem agrupados no site.</p>
      </div>
      <CatalogNav orgSlug={orgSlug} />
      <CategoriesManager orgSlug={orgSlug} categories={categories} />
    </div>
  );
}
```

`app/(app)/app/[orgSlug]/catalogo/categorias/_components/categories-manager.tsx`:

```tsx
"use client";

import { Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "@/lib/catalog/actions";
import type { CategoryRow } from "@/lib/catalog/queries";
import { slugifyCatalog } from "@/lib/catalog/slug";

type Props = { orgSlug: string; categories: CategoryRow[] };

type Draft = { id: string | null; name: string; slug: string; description: string; sortOrder: string };

const EMPTY_DRAFT: Draft = { id: null, name: "", slug: "", description: "", sortOrder: "0" };

export function CategoriesManager({ orgSlug, categories }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [slugTouched, setSlugTouched] = useState(false);
  const [isPending, startTransition] = useTransition();

  function edit(category: CategoryRow) {
    setDraft({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      sortOrder: String(category.sortOrder),
    });
    setSlugTouched(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const base = {
        orgSlug,
        name: draft.name,
        slug: draft.slug,
        description: draft.description.trim() || null,
        sortOrder: Number(draft.sortOrder) || 0,
      };
      const result = draft.id
        ? await updateCategoryAction({ ...base, categoryId: draft.id })
        : await createCategoryAction(base);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(draft.id ? "Categoria salva." : "Categoria criada.");
      setDraft(EMPTY_DRAFT);
      setSlugTouched(false);
    });
  }

  function handleDelete(category: CategoryRow) {
    startTransition(async () => {
      const result = await deleteCategoryAction({ orgSlug, categoryId: category.id });
      if (result.ok) toast.success(`Categoria "${category.name}" excluída. Os produtos ficam sem categoria.`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardContent className="divide-y p-0">
          {categories.length === 0 && (
            <p className="p-6 text-muted-foreground text-sm">Nenhuma categoria ainda. Crie a primeira ao lado.</p>
          )}
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium">{category.name}</div>
                <div className="text-muted-foreground text-xs">
                  /{category.slug} · ordem {category.sortOrder}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label={`Editar ${category.name}`} onClick={() => edit(category)}>
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir ${category.name}`}
                  onClick={() => handleDelete(category)}
                  disabled={isPending}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="font-medium">{draft.id ? "Editar categoria" : "Nova categoria"}</h2>
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    name: e.target.value,
                    slug: slugTouched ? d.slug : slugifyCatalog(e.target.value),
                  }))
                }
                placeholder="Discos diamantados"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">Endereço (slug)</Label>
              <Input
                id="cat-slug"
                value={draft.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setDraft((d) => ({ ...d, slug: slugifyCatalog(e.target.value) }));
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-description">Descrição (opcional)</Label>
              <Input
                id="cat-description"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-order">Ordem</Label>
              <Input
                id="cat-order"
                type="number"
                min={0}
                value={draft.sortOrder}
                onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2Icon className="animate-spin" />}
                {draft.id ? "Salvar" : "Criar"}
              </Button>
              {draft.id && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraft(EMPTY_DRAFT);
                    setSlugTouched(false);
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Passo 6: Verificar tipos, lint e build**

Run: `npx tsc --noEmit && npm run check && npm run build`
Esperado: sem erros. Se `Switch`/`Checkbox` tiverem assinatura de `onCheckedChange` diferente de `(checked: boolean) => void`, ajustar a tipagem do parâmetro conforme `components/ui/switch.tsx` e `components/ui/checkbox.tsx`.

- [ ] **Passo 7: Teste manual**

1. `npm run dev`, logar como owner → menu **Catálogo**.
2. Esperado: lista com produtos do Bling, preço e estoque; busca por nome funciona.
3. **Categorias** → criar "Discos diamantados" e "Lixas".
4. Voltar a **Produtos** → **Publicar** num disco → marcar Granito + Quartzito, Corte, diâmetro 350, categoria Discos → Salvar.
5. Esperado: toast "Produto publicado no site."; o switch "No site" aparece ligado; no Supabase existe linha em `catalog_items` com `is_published = true`.
6. Desligar o switch → toast sem erro e `is_published = false`.

- [ ] **Passo 8: Commit**

```bash
git add lib/catalog/format.ts "app/(app)/app/[orgSlug]/catalogo"
git commit -m "feat(catalogo): telas de produtos (publicação e ficha técnica) e categorias"
```

---

### Tarefa 10: Kits — schemas, consultas, actions e montador

**Arquivos:**
- Modificar: `lib/catalog/schemas.ts` (acrescentar schemas de kit)
- Criar: `lib/catalog/kit-queries.ts`, `lib/catalog/kit-actions.ts`
- Criar: `app/(app)/app/[orgSlug]/catalogo/kits/page.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/kits/novo/page.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/kits/[kitId]/page.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/kits/_components/kit-form.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/kits/_components/kit-publish-switch.tsx`
- Teste: `tests/catalog-kit-actions.test.ts`

**Interfaces:**
- Consome: `KIT_SELECT`, `KitRow`, `toKitComponents` (Tarefa 5); `computeKitPrice`, `computeKitAvailability`, `findKitProblems`, `describeKitProblems`, `KitComponent` (Tarefa 2); `enforceKitIntegrity` (Tarefa 5); `getCatalogProducts`, `getCategories`, `CategoryRow`, `setCatalogItemPublishedAction` (Tarefa 8); `CatalogNav`, `formatBRL` de `lib/catalog/format.ts` (Tarefa 9); `slugifyCatalog` (Tarefa 2).
- Produz:
  ```ts
  // schemas.ts (acréscimo)
  export const saveKitSchema; export type SaveKitInput = {
    orgSlug: string; kitId: string | null; name: string; description: string | null; imageUrl: string | null;
    discountPct: number; slug: string; categoryId: string | null; items: { blingProductId: string; quantity: number }[];
  };
  export const deleteKitSchema; export type DeleteKitInput = { orgSlug: string; kitId: string };
  // kit-queries.ts
  export type KitSummary = {
    id: string; name: string; slug: string | null; catalogItemId: string | null; isPublished: boolean;
    hiddenReason: string | null; discountPct: number; itemCount: number; price: number; availability: number; problems: string | null;
  };
  export type KitDetail = {
    id: string; name: string; description: string | null; imageUrl: string | null; discountPct: number;
    slug: string; categoryId: string | null; catalogItemId: string; isPublished: boolean; hiddenReason: string | null;
    items: { blingProductId: string; quantity: number }[];
  };
  export type KitProductOption = { id: string; name: string; sku: string | null; price: number; stock: number;
    blingStatus: "active" | "inactive"; published: boolean };
  export function getKits(orgId: string): Promise<KitSummary[]>;
  export function getKit(orgId: string, kitId: string): Promise<KitDetail | null>;
  export function getKitProductOptions(orgId: string): Promise<KitProductOption[]>;
  // kit-actions.ts
  export function saveKitAction(input: SaveKitInput): Promise<ActionResult<{ kitId: string }>>;
  export function deleteKitAction(input: DeleteKitInput): Promise<ActionResult>;
  ```

- [ ] **Passo 1: Escrever o teste que falha**

`tests/catalog-kit-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({ requireOrgRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/catalog/kit-guard", () => ({ enforceKitIntegrity: vi.fn(async () => ({ unpublished: 0 })) }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireOrgRole } from "@/lib/auth/guards";
import { saveKitAction } from "@/lib/catalog/kit-actions";
import { saveKitSchema } from "@/lib/catalog/schemas";
import { createClient } from "@/lib/supabase/server";

const mockedRole = requireOrgRole as unknown as ReturnType<typeof vi.fn>;
const mockedCreate = createClient as unknown as ReturnType<typeof vi.fn>;

const P1 = "0b8e7c1e-3a54-4a57-9a0b-6f6b6c6d6e61";
const P2 = "0b8e7c1e-3a54-4a57-9a0b-6f6b6c6d6e62";

const baseInput = {
  orgSlug: "m10",
  kitId: null,
  name: "Kit Polimento Granito",
  description: null,
  imageUrl: null,
  discountPct: 10,
  slug: "kit-polimento-granito",
  categoryId: null,
  items: [
    { blingProductId: P1, quantity: 1 },
    { blingProductId: P2, quantity: 7 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedRole.mockResolvedValue({ user: { id: "u1" }, org: { id: "org-1", slug: "m10" }, role: "owner" });
});

describe("saveKitSchema", () => {
  it("exige ao menos um item e recusa produto repetido", () => {
    expect(saveKitSchema.safeParse({ ...baseInput, items: [] }).error?.issues[0]?.message).toBe(
      "Adicione pelo menos um produto",
    );
    const dup = saveKitSchema.safeParse({
      ...baseInput,
      items: [
        { blingProductId: P1, quantity: 1 },
        { blingProductId: P1, quantity: 2 },
      ],
    });
    expect(dup.error?.issues[0]?.message).toBe("O mesmo produto aparece duas vezes");
  });

  it("recusa desconto acima de 100%", () => {
    expect(saveKitSchema.safeParse({ ...baseInput, discountPct: 120 }).success).toBe(false);
  });
});

describe("saveKitAction", () => {
  it("recusa produtos que não pertencem à organização", async () => {
    mockedCreate.mockResolvedValue({
      from: () => ({
        select: () => ({ eq: () => ({ in: async () => ({ data: [{ id: P1 }], error: null }) }) }),
      }),
    });
    await expect(saveKitAction(baseInput)).resolves.toEqual({
      ok: false,
      error: "Algum produto do kit não foi encontrado. Recarregue a página.",
    });
    expect(mockedRole).toHaveBeenCalledWith({ orgSlug: "m10", roles: ["owner", "admin"] });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/catalog-kit-actions.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/catalog/kit-actions"`.

- [ ] **Passo 3: Acrescentar os schemas de kit**

No fim de `lib/catalog/schemas.ts`:

```ts
const kitItemSchema = z.object({
  blingProductId: uuid,
  quantity: z.number().int().min(1, "Quantidade mínima é 1").max(1000),
});

export const saveKitSchema = z.object({
  orgSlug,
  kitId: uuid.nullable(),
  name: z.string().trim().min(1, "Informe o nome do kit").max(120),
  description: optionalText(4000),
  imageUrl: z.string().trim().url("Link de imagem inválido").max(2000).nullable(),
  discountPct: z.number().min(0, "Desconto não pode ser negativo").max(100, "Desconto máximo é 100%"),
  slug: catalogSlug,
  categoryId: uuid.nullable(),
  items: z
    .array(kitItemSchema)
    .min(1, "Adicione pelo menos um produto")
    .max(50)
    .refine((items) => new Set(items.map((i) => i.blingProductId)).size === items.length, {
      message: "O mesmo produto aparece duas vezes",
    }),
});
export type SaveKitInput = z.infer<typeof saveKitSchema>;

export const deleteKitSchema = z.object({ orgSlug, kitId: uuid });
export type DeleteKitInput = z.infer<typeof deleteKitSchema>;
```

- [ ] **Passo 4: Consultas de kit**

`lib/catalog/kit-queries.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { computeKitAvailability, computeKitPrice, describeKitProblems, findKitProblems } from "./kit-pricing";
import { KIT_SELECT, type KitRow, toKitComponents } from "./kit-rows";
import { getCatalogProducts } from "./queries";

export type KitSummary = {
  id: string;
  name: string;
  slug: string | null;
  catalogItemId: string | null;
  isPublished: boolean;
  hiddenReason: string | null;
  discountPct: number;
  itemCount: number;
  price: number;
  availability: number;
  problems: string | null;
};

export type KitDetail = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  discountPct: number;
  slug: string;
  categoryId: string | null;
  catalogItemId: string;
  isPublished: boolean;
  hiddenReason: string | null;
  items: { blingProductId: string; quantity: number }[];
};

export type KitProductOption = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  blingStatus: "active" | "inactive";
  published: boolean;
};

export async function getKits(orgId: string): Promise<KitSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("kits").select(KIT_SELECT).eq("organization_id", orgId).order("name");
  if (error) throw error;

  return ((data ?? []) as unknown as KitRow[]).map((row) => {
    const components = toKitComponents(row);
    const problems = findKitProblems(components);
    const catalogItem = row.catalog_items[0] ?? null;
    return {
      id: row.id,
      name: row.name,
      slug: catalogItem?.slug ?? null,
      catalogItemId: catalogItem?.id ?? null,
      isPublished: catalogItem?.is_published ?? false,
      hiddenReason: row.hidden_reason,
      discountPct: Number(row.discount_pct),
      itemCount: components.length,
      price: computeKitPrice(components, Number(row.discount_pct)),
      availability: computeKitAvailability(components),
      problems: problems.length > 0 ? describeKitProblems(problems) : null,
    };
  });
}

export async function getKit(orgId: string, kitId: string): Promise<KitDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kits")
    .select(KIT_SELECT)
    .eq("organization_id", orgId)
    .eq("id", kitId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as KitRow;
  const catalogItem = row.catalog_items[0];
  if (!catalogItem) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    discountPct: Number(row.discount_pct),
    slug: catalogItem.slug,
    categoryId: catalogItem.category_id,
    catalogItemId: catalogItem.id,
    isPublished: catalogItem.is_published,
    hiddenReason: row.hidden_reason,
    items: row.kit_items.flatMap((i) =>
      i.bling_products ? [{ blingProductId: i.bling_products.id, quantity: i.quantity }] : [],
    ),
  };
}

export async function getKitProductOptions(orgId: string): Promise<KitProductOption[]> {
  const products = await getCatalogProducts(orgId);
  return products.map((p) => ({
    id: p.blingProductId,
    name: p.catalogItem?.title || p.name,
    sku: p.sku,
    price: p.price,
    stock: p.stock,
    blingStatus: p.blingStatus,
    published: p.catalogItem?.isPublished ?? false,
  }));
}
```

- [ ] **Passo 5: Actions de kit**

`lib/catalog/kit-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireOrgRole } from "@/lib/auth/guards";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { enforceKitIntegrity } from "./kit-guard";
import { type DeleteKitInput, deleteKitSchema, type SaveKitInput, saveKitSchema } from "./schemas";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const ADMIN_ROLES: ("owner" | "admin")[] = ["owner", "admin"];
const GENERIC_ERROR = "Erro ao salvar o kit. Tente novamente.";

export async function saveKitAction(input: SaveKitInput): Promise<ActionResult<{ kitId: string }>> {
  const parsed = saveKitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const v = parsed.data;
  const { org } = await requireOrgRole({ orgSlug: v.orgSlug, roles: ADMIN_ROLES });
  const supabase = await createClient();

  const productIds = v.items.map((i) => i.blingProductId);
  const { data: owned, error: ownedError } = await supabase
    .from("bling_products")
    .select("id")
    .eq("organization_id", org.id)
    .in("id", productIds);
  if (ownedError || (owned ?? []).length !== productIds.length) {
    if (ownedError) logError("catalog.kit.products", ownedError);
    return { ok: false, error: "Algum produto do kit não foi encontrado. Recarregue a página." };
  }

  const kitValues = {
    organization_id: org.id,
    name: v.name,
    description: v.description || null,
    image_url: v.imageUrl || null,
    discount_pct: v.discountPct,
  };

  let kitId = v.kitId;
  if (kitId) {
    const { error } = await supabase.from("kits").update(kitValues).eq("id", kitId).eq("organization_id", org.id);
    if (error) {
      logError("catalog.kit.update", error);
      return { ok: false, error: GENERIC_ERROR };
    }
    const { error: itemError } = await supabase
      .from("catalog_items")
      .update({ slug: v.slug, category_id: v.categoryId })
      .eq("kit_id", kitId)
      .eq("organization_id", org.id);
    if (itemError?.code === "23505") return { ok: false, error: "Já existe um item com esse endereço (slug)." };
    if (itemError) {
      logError("catalog.kit.update-item", itemError);
      return { ok: false, error: GENERIC_ERROR };
    }
    const { error: deleteError } = await supabase.from("kit_items").delete().eq("kit_id", kitId);
    if (deleteError) {
      logError("catalog.kit.clear-items", deleteError);
      return { ok: false, error: GENERIC_ERROR };
    }
  } else {
    const { data: kit, error } = await supabase.from("kits").insert(kitValues).select("id").single();
    if (error || !kit) {
      logError("catalog.kit.insert", error);
      return { ok: false, error: GENERIC_ERROR };
    }
    kitId = kit.id;
    const { error: itemError } = await supabase.from("catalog_items").insert({
      organization_id: org.id,
      kind: "kit",
      kit_id: kitId,
      slug: v.slug,
      category_id: v.categoryId,
      is_published: false,
    });
    if (itemError) {
      await supabase.from("kits").delete().eq("id", kitId);
      if (itemError.code === "23505") return { ok: false, error: "Já existe um item com esse endereço (slug)." };
      logError("catalog.kit.insert-item", itemError);
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  const { error: itemsError } = await supabase.from("kit_items").insert(
    v.items.map((i) => ({
      organization_id: org.id,
      kit_id: kitId,
      bling_product_id: i.blingProductId,
      quantity: i.quantity,
    })),
  );
  if (itemsError) {
    logError("catalog.kit.insert-items", itemsError);
    return { ok: false, error: GENERIC_ERROR };
  }

  // A nova composição pode ter quebrado um kit publicado.
  await enforceKitIntegrity(org.id);
  revalidatePath(`/app/${v.orgSlug}/catalogo`, "layout");
  return { ok: true, data: { kitId } };
}

export async function deleteKitAction(input: DeleteKitInput): Promise<ActionResult> {
  const parsed = deleteKitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { org } = await requireOrgRole({ orgSlug: parsed.data.orgSlug, roles: ADMIN_ROLES });
  const supabase = await createClient();

  const { error } = await supabase.from("kits").delete().eq("id", parsed.data.kitId).eq("organization_id", org.id);
  if (error) {
    logError("catalog.kit.delete", error);
    return { ok: false, error: "Erro ao excluir o kit. Tente novamente." };
  }
  revalidatePath(`/app/${parsed.data.orgSlug}/catalogo`, "layout");
  return { ok: true };
}
```

- [ ] **Passo 6: Rodar e ver passar**

Run: `npx vitest run tests/catalog-kit-actions.test.ts && npx tsc --noEmit`
Esperado: PASS; `tsc` sem erros.

- [ ] **Passo 7: Lista de kits**

`app/(app)/app/[orgSlug]/catalogo/kits/_components/kit-publish-switch.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setCatalogItemPublishedAction } from "@/lib/catalog/actions";

type Props = { orgSlug: string; catalogItemId: string; isPublished: boolean };

export function KitPublishSwitch({ orgSlug, catalogItemId, isPublished }: Props) {
  const [isPending, startTransition] = useTransition();
  return (
    <Switch
      checked={isPublished}
      disabled={isPending}
      aria-label={isPublished ? "Despublicar kit" : "Publicar kit"}
      onCheckedChange={(checked: boolean) =>
        startTransition(async () => {
          const result = await setCatalogItemPublishedAction({ orgSlug, catalogItemId, isPublished: checked });
          if (!result.ok) toast.error(result.error);
          else toast.success(checked ? "Kit publicado no site." : "Kit retirado do site.");
        })
      }
    />
  );
}
```

`app/(app)/app/[orgSlug]/catalogo/kits/page.tsx`:

```tsx
import { BoxesIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrgRole } from "@/lib/auth/guards";
import { getKits } from "@/lib/catalog/kit-queries";
import { formatBRL } from "@/lib/catalog/format";
import { CatalogNav } from "../_components/catalog-nav";
import { KitPublishSwitch } from "./_components/kit-publish-switch";

type Props = { params: Promise<{ orgSlug: string }> };

export default async function CatalogKitsPage({ params }: Props) {
  const { orgSlug } = await params;
  const { org } = await requireOrgRole({ orgSlug, roles: ["owner", "admin"] });
  const kits = await getKits(org.id);
  const newHref = `/app/${orgSlug}/catalogo/kits/novo`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <span className="label-mono">/ catálogo / kits</span>
          <h1 className="font-semibold text-3xl tracking-tight">Kits</h1>
          <p className="text-muted-foreground text-sm">
            Combinações de produtos com desconto. O preço acompanha o Bling automaticamente.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href={newHref} />}>
          <PlusIcon />
          Novo kit
        </Button>
      </div>
      <CatalogNav orgSlug={orgSlug} />

      {kits.length === 0 ? (
        <EmptyState icon={BoxesIcon} title="Nenhum kit ainda" description="Monte o primeiro kit com produtos do Bling." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kit</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Preço do kit</TableHead>
              <TableHead>Disponíveis</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>No site</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kits.map((kit) => (
              <TableRow key={kit.id}>
                <TableCell>
                  <Link href={`/app/${orgSlug}/catalogo/kits/${kit.id}`} className="font-medium hover:underline">
                    {kit.name}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{kit.itemCount}</TableCell>
                <TableCell className="tabular-nums">{kit.discountPct}%</TableCell>
                <TableCell className="tabular-nums">{formatBRL(kit.price)}</TableCell>
                <TableCell className="tabular-nums">{kit.availability}</TableCell>
                <TableCell>
                  {kit.problems ? (
                    <Badge variant="destructive" title={kit.hiddenReason ?? kit.problems}>
                      Com problema
                    </Badge>
                  ) : kit.isPublished ? (
                    <Badge>Publicado</Badge>
                  ) : (
                    <Badge variant="outline">Rascunho</Badge>
                  )}
                  {kit.problems && <p className="mt-1 max-w-xs text-destructive text-xs">{kit.problems}</p>}
                </TableCell>
                <TableCell>
                  {kit.catalogItemId && (
                    <KitPublishSwitch orgSlug={orgSlug} catalogItemId={kit.catalogItemId} isPublished={kit.isPublished} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Passo 8: Montador de kit**

`app/(app)/app/[orgSlug]/catalogo/kits/_components/kit-form.tsx`:

```tsx
"use client";

import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL } from "@/lib/catalog/format";
import { deleteKitAction, saveKitAction } from "@/lib/catalog/kit-actions";
import {
  computeKitAvailability,
  computeKitPrice,
  describeKitProblems,
  findKitProblems,
  type KitComponent,
} from "@/lib/catalog/kit-pricing";
import type { KitDetail, KitProductOption } from "@/lib/catalog/kit-queries";
import type { CategoryRow } from "@/lib/catalog/queries";
import { slugifyCatalog } from "@/lib/catalog/slug";

type Props = {
  orgSlug: string;
  kit: KitDetail | null;
  products: KitProductOption[];
  categories: CategoryRow[];
};

type Line = { blingProductId: string; quantity: number };

export function KitForm({ orgSlug, kit, products, categories }: Props) {
  const router = useRouter();
  const [name, setName] = useState(kit?.name ?? "");
  const [slug, setSlug] = useState(kit?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(kit));
  const [description, setDescription] = useState(kit?.description ?? "");
  const [imageUrl, setImageUrl] = useState(kit?.imageUrl ?? "");
  const [discount, setDiscount] = useState(String(kit?.discountPct ?? 0));
  const [categoryId, setCategoryId] = useState(kit?.categoryId ?? "");
  const [lines, setLines] = useState<Line[]>(kit?.items ?? []);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const listPath = `/app/${orgSlug}/catalogo/kits`;

  const components: KitComponent[] = lines.flatMap((line) => {
    const p = byId.get(line.blingProductId);
    if (!p) return [];
    return [
      {
        blingProductId: p.id,
        name: p.name,
        quantity: line.quantity,
        price: p.price,
        stock: p.stock,
        blingStatus: p.blingStatus,
        productPublished: p.published,
      },
    ];
  });
  const discountPct = Math.min(100, Math.max(0, Number(discount) || 0));
  const problems = findKitProblems(components);

  const results = search.trim()
    ? products
        .filter((p) => !lines.some((l) => l.blingProductId === p.id))
        .filter((p) => `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  function addProduct(id: string) {
    setLines((current) => [...current, { blingProductId: id, quantity: 1 }]);
    setSearch("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveKitAction({
        orgSlug,
        kitId: kit?.id ?? null,
        name,
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        discountPct,
        slug,
        categoryId: categoryId || null,
        items: lines,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Kit salvo. Publique na lista de kits quando estiver pronto.");
      router.push(listPath);
    });
  }

  function handleDelete() {
    if (!kit) return;
    startTransition(async () => {
      const result = await deleteKitAction({ orgSlug, kitId: kit.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Kit excluído.");
      router.push(listPath);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados do kit</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="kit-name">Nome</Label>
              <Input
                id="kit-name"
                value={name}
                required
                placeholder="Kit Polimento Granito"
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugifyCatalog(e.target.value));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kit-slug">Endereço (slug)</Label>
              <Input
                id="kit-slug"
                value={slug}
                required
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugifyCatalog(e.target.value));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kit-category">Categoria</Label>
              <select
                id="kit-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="kit-description">Descrição</Label>
              <Textarea id="kit-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kit-image">Link da foto (opcional)</Label>
              <Input id="kit-image" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kit-discount">Desconto (%)</Label>
              <Input
                id="kit-discount"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos do kit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kit-search">Adicionar produto</Label>
              <Input
                id="kit-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou código..."
                autoComplete="off"
              />
              {results.length > 0 && (
                <ul className="divide-y rounded-md border">
                  {results.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {p.name} <span className="text-muted-foreground">{p.sku}</span>
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => addProduct(p.id)}>
                        <PlusIcon />
                        Adicionar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length === 0 && <p className="text-muted-foreground text-sm">Nenhum produto adicionado.</p>}
            <ul className="divide-y">
              {lines.map((line) => {
                const p = byId.get(line.blingProductId);
                return (
                  <li key={line.blingProductId} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p?.name ?? "Produto removido do Bling"}</div>
                      <div className="flex flex-wrap gap-1 text-muted-foreground text-xs">
                        {p && `${formatBRL(p.price)} · estoque ${p.stock}`}
                        {p?.blingStatus === "inactive" && <Badge variant="destructive">Inativo no Bling</Badge>}
                        {p && !p.published && <Badge variant="outline">Não publicado</Badge>}
                      </div>
                    </div>
                    <Label htmlFor={`qty-${line.blingProductId}`} className="sr-only">
                      Quantidade
                    </Label>
                    <Input
                      id={`qty-${line.blingProductId}`}
                      type="number"
                      min={1}
                      max={1000}
                      className="w-20"
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((l) =>
                            l.blingProductId === line.blingProductId
                              ? { ...l, quantity: Math.max(1, Number(e.target.value) || 1) }
                              : l,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover produto"
                      onClick={() => setLines((current) => current.filter((l) => l.blingProductId !== line.blingProductId))}
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Prévia (só no CRM)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Soma dos itens</span>
              <span className="tabular-nums">{formatBRL(computeKitPrice(components, 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Desconto</span>
              <span className="tabular-nums">{discountPct}%</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>Preço do kit</span>
              <span className="tabular-nums">{formatBRL(computeKitPrice(components, discountPct))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kits disponíveis</span>
              <span className="tabular-nums">{computeKitAvailability(components)}</span>
            </div>
            {problems.length > 0 && lines.length > 0 && (
              <p className="text-destructive text-xs">Não poderá ser publicado: {describeKitProblems(problems)}.</p>
            )}
            {kit?.hiddenReason && <p className="text-destructive text-xs">Retirado do site: {kit.hiddenReason}</p>}
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="animate-spin" />}
            Salvar kit
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(listPath)}>
            Cancelar
          </Button>
          {kit && (
            <Button type="button" variant="ghost" onClick={handleDelete} disabled={isPending}>
              Excluir kit
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Passo 9: Páginas de novo kit e edição**

`app/(app)/app/[orgSlug]/catalogo/kits/novo/page.tsx`:

```tsx
import { requireOrgRole } from "@/lib/auth/guards";
import { getKitProductOptions } from "@/lib/catalog/kit-queries";
import { getCategories } from "@/lib/catalog/queries";
import { CatalogNav } from "../../_components/catalog-nav";
import { KitForm } from "../_components/kit-form";

type Props = { params: Promise<{ orgSlug: string }> };

export default async function NewKitPage({ params }: Props) {
  const { orgSlug } = await params;
  const { org } = await requireOrgRole({ orgSlug, roles: ["owner", "admin"] });
  const [products, categories] = await Promise.all([getKitProductOptions(org.id), getCategories(org.id)]);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="label-mono">/ catálogo / kits / novo</span>
        <h1 className="font-semibold text-3xl tracking-tight">Novo kit</h1>
      </div>
      <CatalogNav orgSlug={orgSlug} />
      <KitForm orgSlug={orgSlug} kit={null} products={products} categories={categories} />
    </div>
  );
}
```

`app/(app)/app/[orgSlug]/catalogo/kits/[kitId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireOrgRole } from "@/lib/auth/guards";
import { getKit, getKitProductOptions } from "@/lib/catalog/kit-queries";
import { getCategories } from "@/lib/catalog/queries";
import { CatalogNav } from "../../_components/catalog-nav";
import { KitForm } from "../_components/kit-form";

type Props = { params: Promise<{ orgSlug: string; kitId: string }> };

export default async function EditKitPage({ params }: Props) {
  const { orgSlug, kitId } = await params;
  const { org } = await requireOrgRole({ orgSlug, roles: ["owner", "admin"] });
  const [kit, products, categories] = await Promise.all([
    getKit(org.id, kitId),
    getKitProductOptions(org.id),
    getCategories(org.id),
  ]);
  if (!kit) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="label-mono">/ catálogo / kits</span>
        <h1 className="font-semibold text-3xl tracking-tight">{kit.name}</h1>
      </div>
      <CatalogNav orgSlug={orgSlug} />
      <KitForm orgSlug={orgSlug} kit={kit} products={products} categories={categories} />
    </div>
  );
}
```

- [ ] **Passo 10: Verificar e testar manualmente**

Run: `npx tsc --noEmit && npm run check && npm run build`
Esperado: sem erros.

Roteiro manual:
1. **Catálogo → Kits → Novo kit**: nome "Kit Polimento Granito", adicionar 3 lixas publicadas (quantidade 1) e desconto 10 → a prévia mostra soma, preço com 10% e disponibilidade → **Salvar kit**.
2. Na lista, o kit aparece como **Rascunho**; ligar o switch → "Kit publicado no site."
3. Em **Produtos**, despublicar uma das lixas → voltar a **Kits**: o kit aparece **Com problema**, o switch desligado, e existe tarefa "Kit retirado do site: Kit Polimento Granito" em **Tarefas**.
4. Tentar ligar o switch de novo → toast "Não dá para publicar: … não está publicado no catálogo."

- [ ] **Passo 11: Commit**

```bash
git add lib/catalog/schemas.ts lib/catalog/kit-queries.ts lib/catalog/kit-actions.ts "app/(app)/app/[orgSlug]/catalogo/kits" tests/catalog-kit-actions.test.ts
git commit -m "feat(catalogo): montador de kits com preço calculado e publicação protegida"
```

---

### Tarefa 11: Chave e API pública do catálogo (sem preço)

**Arquivos:**
- Criar: `lib/catalog/public-key.ts`, `lib/catalog/settings-actions.ts`, `lib/catalog/public-queries.ts`
- Modificar: `lib/catalog/queries.ts` (acrescentar `getCatalogKeyInfo`)
- Criar: `app/api/public/catalog/_lib/auth.ts`
- Criar: `app/api/public/catalog/categories/route.ts`, `app/api/public/catalog/items/route.ts`, `app/api/public/catalog/items/[slug]/route.ts`
- Criar: `app/(app)/app/[orgSlug]/catalogo/api-do-site/page.tsx`
- Criar: `app/(app)/app/[orgSlug]/catalogo/api-do-site/_components/public-key-card.tsx`
- Modificar: `middleware.ts`
- Teste: `tests/catalog-public-key.test.ts`, `tests/catalog-public-queries.test.ts`

**Interfaces:**
- Consome: `ServiceClient` (Tarefa 4); `CatalogNav` (Tarefa 9). (`public-queries.ts` não importa `queries.ts` para não puxar o client SSR nas rotas públicas.)
- Produz:
  ```ts
  // public-key.ts
  export const PUBLIC_KEY_PREFIX = "m10cat_";
  export function generatePublicKey(): { key: string; hash: string; prefix: string };
  export function hashPublicKey(key: string): string;
  // queries.ts (acréscimo)
  export type CatalogKeyInfo = { prefix: string; createdAt: string } | null;
  export function getCatalogKeyInfo(orgId: string): Promise<CatalogKeyInfo>;
  // settings-actions.ts
  export function generateCatalogPublicKeyAction(input: { orgSlug: string }): Promise<ActionResult<{ key: string }>>;
  // public-queries.ts
  export const PUBLIC_ITEM_COLUMNS: string;
  export type PublicCatalogItem = {
    slug: string; kind: "product" | "kit"; title: string; description: string | null; images: string[];
    category: { name: string; slug: string } | null; stones: string[]; applications: string[]; grit: string | null;
    diameterMm: number | null; machines: string[]; specs: Record<string, unknown>; isFeatured: boolean;
    seoTitle: string | null; seoDescription: string | null; updatedAt: string;
    components: { title: string; slug: string | null; quantity: number }[];
  };
  export type PublicCategory = { name: string; slug: string; description: string | null; imageUrl: string | null };
  export function isPubliclyVisible(row: PublicItemRow): boolean;
  export function toPublicItem(row: PublicItemRow): PublicCatalogItem;
  export function listPublicItems(orgId: string, filters: { category?: string; featured?: boolean; q?: string }, supabase?: ServiceClient): Promise<PublicCatalogItem[]>;
  export function getPublicItem(orgId: string, slug: string, supabase?: ServiceClient): Promise<PublicCatalogItem | null>;
  export function listPublicCategories(orgId: string, supabase?: ServiceClient): Promise<PublicCategory[]>;
  // app/api/public/catalog/_lib/auth.ts
  export function authenticateCatalogRequest(req: Request): Promise<{ orgId: string } | null>;
  export function unauthorizedResponse(): Response;
  export const PUBLIC_CACHE_HEADERS: Record<string, string>;
  ```
- Contrato HTTP (usado pelo site na Etapa 4): header `x-catalog-key: <chave>`; respostas JSON `{ data: ... }`; 401 `{ error: "Chave da API inválida." }`; 404 `{ error: "Item não encontrado." }`.

- [ ] **Passo 1: Escrever os testes que falham**

`tests/catalog-public-key.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generatePublicKey, hashPublicKey, PUBLIC_KEY_PREFIX } from "@/lib/catalog/public-key";

describe("chave pública do catálogo", () => {
  it("gera chave com prefixo, hash SHA-256 e prefixo de exibição", () => {
    const { key, hash, prefix } = generatePublicKey();
    expect(key.startsWith(PUBLIC_KEY_PREFIX)).toBe(true);
    expect(key.length).toBeGreaterThanOrEqual(PUBLIC_KEY_PREFIX.length + 32);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashPublicKey(key));
    expect(prefix).toBe(key.slice(0, 12));
  });

  it("cada chave é diferente", () => {
    expect(generatePublicKey().key).not.toBe(generatePublicKey().key);
  });
});
```

`tests/catalog-public-queries.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  isPubliclyVisible,
  PUBLIC_ITEM_COLUMNS,
  type PublicItemRow,
  toPublicItem,
} from "@/lib/catalog/public-queries";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

function productRow(overrides: Partial<PublicItemRow> = {}): PublicItemRow {
  return {
    kind: "product",
    slug: "disco-turbo-350",
    is_published: true,
    title: null,
    description: null,
    stones: ["granito"],
    applications: ["corte"],
    grit: null,
    diameter_mm: 350,
    machines: ["Serra ponte"],
    specs: {},
    is_featured: true,
    sort_order: 0,
    seo_title: null,
    seo_description: null,
    updated_at: "2026-09-17T12:00:00Z",
    category: { name: "Discos", slug: "discos" },
    bling_products: {
      name: "Disco Diamantado Turbo 350mm",
      description: "Corte limpo",
      images: ["https://cdn/img.jpg"],
      bling_status: "active",
    },
    kits: null,
    ...overrides,
  };
}

describe("PUBLIC_ITEM_COLUMNS", () => {
  it("não seleciona preço, estoque nem desconto", () => {
    expect(PUBLIC_ITEM_COLUMNS).not.toMatch(/price|stock|discount|sku/);
  });
});

describe("isPubliclyVisible", () => {
  it("só itens publicados e com produto ativo no Bling", () => {
    expect(isPubliclyVisible(productRow())).toBe(true);
    expect(isPubliclyVisible(productRow({ is_published: false }))).toBe(false);
    expect(
      isPubliclyVisible(
        productRow({
          bling_products: { name: "x", description: null, images: [], bling_status: "inactive" },
        }),
      ),
    ).toBe(false);
  });
});

describe("toPublicItem", () => {
  it("usa textos do Bling quando não há texto comercial e nunca expõe preço", () => {
    const withPrice = {
      ...productRow(),
      bling_products: { ...productRow().bling_products, price: 289.9, stock: 4 },
    } as unknown as PublicItemRow;

    const item = toPublicItem(withPrice);
    expect(item).toMatchObject({
      slug: "disco-turbo-350",
      kind: "product",
      title: "Disco Diamantado Turbo 350mm",
      description: "Corte limpo",
      images: ["https://cdn/img.jpg"],
      category: { name: "Discos", slug: "discos" },
      diameterMm: 350,
      isFeatured: true,
    });
    const json = JSON.stringify(item);
    expect(json).not.toContain("289.9");
    expect(json).not.toMatch(/"price"|"stock"/);
  });

  it("kit usa nome, descrição e foto do kit e lista a composição", () => {
    const item = toPublicItem(
      productRow({
        kind: "kit",
        slug: "kit-polimento",
        bling_products: null,
        kits: {
          name: "Kit Polimento Granito",
          description: "Sequência completa",
          image_url: "https://cdn/kit.jpg",
          kit_items: [
            {
              quantity: 2,
              bling_products: { name: "Lixa 50", catalog_items: [{ slug: "lixa-50", title: null, is_published: true }] },
            },
          ],
        },
      }),
    );
    expect(item).toMatchObject({
      title: "Kit Polimento Granito",
      images: ["https://cdn/kit.jpg"],
      components: [{ title: "Lixa 50", slug: "lixa-50", quantity: 2 }],
    });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/catalog-public-key.test.ts tests/catalog-public-queries.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/catalog/public-key"`.

- [ ] **Passo 3: Implementar chave e consultas públicas**

`lib/catalog/public-key.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";

export const PUBLIC_KEY_PREFIX = "m10cat_";

export function hashPublicKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** A chave completa só é mostrada uma vez; o banco guarda apenas o hash. */
export function generatePublicKey(): { key: string; hash: string; prefix: string } {
  const key = `${PUBLIC_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashPublicKey(key), prefix: key.slice(0, 12) };
}
```

`lib/catalog/public-queries.ts`:

```ts
import type { ServiceClient } from "@/lib/bling/tokens";
import { createServiceClient } from "@/lib/supabase/service";

function toImageList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Colunas liberadas para o site. NUNCA incluir preço, estoque, SKU ou desconto. */
export const PUBLIC_ITEM_COLUMNS =
  "kind, slug, is_published, title, description, stones, applications, grit, diameter_mm, machines, specs, " +
  "is_featured, sort_order, seo_title, seo_description, updated_at, " +
  "category:product_categories(name, slug), " +
  "bling_products(name, description, images, bling_status), " +
  "kits(name, description, image_url, kit_items(quantity, bling_products(name, catalog_items(slug, title, is_published))))";

export type PublicItemRow = {
  kind: "product" | "kit";
  slug: string;
  is_published: boolean;
  title: string | null;
  description: string | null;
  stones: string[];
  applications: string[];
  grit: string | null;
  diameter_mm: number | null;
  machines: string[];
  specs: unknown;
  is_featured: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
  category: { name: string; slug: string } | null;
  bling_products: { name: string; description: string | null; images: unknown; bling_status: "active" | "inactive" } | null;
  kits: {
    name: string;
    description: string | null;
    image_url: string | null;
    kit_items?: {
      quantity: number;
      bling_products: {
        name: string;
        catalog_items: { slug: string; title: string | null; is_published: boolean }[];
      } | null;
    }[];
  } | null;
};

export type PublicCatalogItem = {
  slug: string;
  kind: "product" | "kit";
  title: string;
  description: string | null;
  images: string[];
  category: { name: string; slug: string } | null;
  stones: string[];
  applications: string[];
  grit: string | null;
  diameterMm: number | null;
  machines: string[];
  specs: Record<string, unknown>;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  components: { title: string; slug: string | null; quantity: number }[];
};

export type PublicCategory = { name: string; slug: string; description: string | null; imageUrl: string | null };

export function isPubliclyVisible(row: PublicItemRow): boolean {
  if (!row.is_published) return false;
  if (row.kind === "product") return row.bling_products?.bling_status === "active";
  return row.kits !== null;
}

export function toPublicItem(row: PublicItemRow): PublicCatalogItem {
  const isKit = row.kind === "kit";
  const baseName = isKit ? (row.kits?.name ?? "") : (row.bling_products?.name ?? "");
  const baseDescription = isKit ? (row.kits?.description ?? null) : (row.bling_products?.description ?? null);
  const images = isKit ? (row.kits?.image_url ? [row.kits.image_url] : []) : toImageList(row.bling_products?.images);

  const components = isKit
    ? (row.kits?.kit_items ?? []).flatMap((ki) => {
        if (!ki.bling_products) return [];
        const published = ki.bling_products.catalog_items.find((ci) => ci.is_published);
        return [
          {
            title: published?.title || ki.bling_products.name,
            slug: published?.slug ?? null,
            quantity: ki.quantity,
          },
        ];
      })
    : [];

  return {
    slug: row.slug,
    kind: row.kind,
    title: row.title || baseName,
    description: row.description || baseDescription,
    images,
    category: row.category ? { name: row.category.name, slug: row.category.slug } : null,
    stones: row.stones,
    applications: row.applications,
    grit: row.grit,
    diameterMm: row.diameter_mm,
    machines: row.machines,
    specs: row.specs && typeof row.specs === "object" ? (row.specs as Record<string, unknown>) : {},
    isFeatured: row.is_featured,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    updatedAt: row.updated_at,
    components,
  };
}

export async function listPublicItems(
  orgId: string,
  filters: { category?: string; featured?: boolean; q?: string },
  supabase: ServiceClient = createServiceClient(),
): Promise<PublicCatalogItem[]> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select(PUBLIC_ITEM_COLUMNS)
    .eq("organization_id", orgId)
    .eq("is_published", true)
    .order("sort_order")
    .order("slug");
  if (error) throw error;

  const q = filters.q?.trim().toLowerCase();
  return ((data ?? []) as unknown as PublicItemRow[])
    .filter(isPubliclyVisible)
    .map(toPublicItem)
    .filter((item) => !filters.category || item.category?.slug === filters.category)
    .filter((item) => !filters.featured || item.isFeatured)
    .filter((item) => !q || `${item.title} ${item.description ?? ""}`.toLowerCase().includes(q))
    .map((item) => ({ ...item, components: [] }));
}

export async function getPublicItem(
  orgId: string,
  slug: string,
  supabase: ServiceClient = createServiceClient(),
): Promise<PublicCatalogItem | null> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select(PUBLIC_ITEM_COLUMNS)
    .eq("organization_id", orgId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  const row = data as unknown as PublicItemRow | null;
  if (!row || !isPubliclyVisible(row)) return null;
  return toPublicItem(row);
}

export async function listPublicCategories(
  orgId: string,
  supabase: ServiceClient = createServiceClient(),
): Promise<PublicCategory[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("name, slug, description, image_url")
    .eq("organization_id", orgId)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.image_url,
  }));
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run tests/catalog-public-key.test.ts tests/catalog-public-queries.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Action e consulta da chave**

No fim de `lib/catalog/queries.ts`:

```ts
export type CatalogKeyInfo = { prefix: string; createdAt: string } | null;

export async function getCatalogKeyInfo(orgId: string): Promise<CatalogKeyInfo> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_settings")
    .select("public_key_prefix, public_key_created_at")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.public_key_prefix || !data.public_key_created_at) return null;
  return { prefix: data.public_key_prefix, createdAt: data.public_key_created_at };
}
```

`lib/catalog/settings-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth/guards";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { generatePublicKey } from "./public-key";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const inputSchema = z.object({ orgSlug: z.string().min(1).max(80) });

export async function generateCatalogPublicKeyAction(input: { orgSlug: string }): Promise<ActionResult<{ key: string }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { org } = await requireOrgRole({ orgSlug: parsed.data.orgSlug, roles: ["owner", "admin"] });
  const supabase = await createClient();

  const { key, hash, prefix } = generatePublicKey();
  const { error } = await supabase.from("catalog_settings").upsert(
    {
      organization_id: org.id,
      public_key_hash: hash,
      public_key_prefix: prefix,
      public_key_created_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) {
    logError("catalog.public-key.generate", error);
    return { ok: false, error: "Erro ao gerar a chave. Tente novamente." };
  }
  revalidatePath(`/app/${parsed.data.orgSlug}/catalogo/api-do-site`);
  return { ok: true, data: { key } };
}
```

- [ ] **Passo 6: Rotas públicas e middleware**

`app/api/public/catalog/_lib/auth.ts`:

```ts
import { hashPublicKey, PUBLIC_KEY_PREFIX } from "@/lib/catalog/public-key";
import { logError } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";

export const PUBLIC_CACHE_HEADERS: Record<string, string> = { "Cache-Control": "private, max-age=60" };

export async function authenticateCatalogRequest(req: Request): Promise<{ orgId: string } | null> {
  const key = req.headers.get("x-catalog-key");
  if (!key || !key.startsWith(PUBLIC_KEY_PREFIX) || key.length > 200) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("catalog_settings")
    .select("organization_id")
    .eq("public_key_hash", hashPublicKey(key))
    .maybeSingle();
  if (error) {
    logError("catalog.public.auth", error);
    return null;
  }
  return data ? { orgId: data.organization_id } : null;
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: "Chave da API inválida." }, { status: 401 });
}
```

`app/api/public/catalog/categories/route.ts`:

```ts
import { listPublicCategories } from "@/lib/catalog/public-queries";
import { logError } from "@/lib/logger";
import { authenticateCatalogRequest, PUBLIC_CACHE_HEADERS, unauthorizedResponse } from "../_lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticateCatalogRequest(req);
  if (!auth) return unauthorizedResponse();
  try {
    const data = await listPublicCategories(auth.orgId);
    return Response.json({ data }, { headers: PUBLIC_CACHE_HEADERS });
  } catch (err) {
    logError("catalog.public.categories", err);
    return Response.json({ error: "Erro ao carregar categorias." }, { status: 500 });
  }
}
```

`app/api/public/catalog/items/route.ts`:

```ts
import { listPublicItems } from "@/lib/catalog/public-queries";
import { logError } from "@/lib/logger";
import { authenticateCatalogRequest, PUBLIC_CACHE_HEADERS, unauthorizedResponse } from "../_lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await authenticateCatalogRequest(req);
  if (!auth) return unauthorizedResponse();

  const params = new URL(req.url).searchParams;
  try {
    const data = await listPublicItems(auth.orgId, {
      category: params.get("category")?.slice(0, 80) || undefined,
      featured: params.get("featured") === "true",
      q: params.get("q")?.slice(0, 100) || undefined,
    });
    return Response.json({ data }, { headers: PUBLIC_CACHE_HEADERS });
  } catch (err) {
    logError("catalog.public.items", err);
    return Response.json({ error: "Erro ao carregar o catálogo." }, { status: 500 });
  }
}
```

`app/api/public/catalog/items/[slug]/route.ts`:

```ts
import { getPublicItem } from "@/lib/catalog/public-queries";
import { logError } from "@/lib/logger";
import { authenticateCatalogRequest, PUBLIC_CACHE_HEADERS, unauthorizedResponse } from "../../_lib/auth";

export const runtime = "nodejs";

type Context = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Context) {
  const auth = await authenticateCatalogRequest(req);
  if (!auth) return unauthorizedResponse();

  const { slug } = await params;
  try {
    const data = await getPublicItem(auth.orgId, slug.slice(0, 80));
    if (!data) return Response.json({ error: "Item não encontrado." }, { status: 404 });
    return Response.json({ data }, { headers: PUBLIC_CACHE_HEADERS });
  } catch (err) {
    logError("catalog.public.item", err);
    return Response.json({ error: "Erro ao carregar o item." }, { status: 500 });
  }
}
```

Em `middleware.ts`, dentro de `const isPublic =`, logo abaixo da linha de `/api/cron/`:

```ts
    // API pública do catálogo (site M10) — handlers validam a chave x-catalog-key.
    pathname.startsWith("/api/public/") ||
```

- [ ] **Passo 7: Tela "API do site"**

`app/(app)/app/[orgSlug]/catalogo/api-do-site/page.tsx`:

```tsx
import { requireOrgRole } from "@/lib/auth/guards";
import { getCatalogKeyInfo } from "@/lib/catalog/queries";
import { CatalogNav } from "../_components/catalog-nav";
import { PublicKeyCard } from "./_components/public-key-card";

type Props = { params: Promise<{ orgSlug: string }> };

export default async function CatalogApiPage({ params }: Props) {
  const { orgSlug } = await params;
  const { org } = await requireOrgRole({ orgSlug, roles: ["owner", "admin"] });
  const keyInfo = await getCatalogKeyInfo(org.id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <span className="label-mono">/ catálogo / api do site</span>
        <h1 className="font-semibold text-3xl tracking-tight">API do site</h1>
        <p className="text-muted-foreground text-sm">
          O site da M10 lê o catálogo publicado por aqui. A API nunca devolve preço nem estoque.
        </p>
      </div>
      <CatalogNav orgSlug={orgSlug} />
      <PublicKeyCard orgSlug={orgSlug} keyInfo={keyInfo} baseUrl={baseUrl} />
    </div>
  );
}
```

`app/(app)/app/[orgSlug]/catalogo/api-do-site/_components/public-key-card.tsx`:

```tsx
"use client";

import { CopyIcon, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CatalogKeyInfo } from "@/lib/catalog/queries";
import { generateCatalogPublicKeyAction } from "@/lib/catalog/settings-actions";

type Props = { orgSlug: string; keyInfo: CatalogKeyInfo; baseUrl: string };

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function PublicKeyCard({ orgSlug, keyInfo, baseUrl }: Props) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateCatalogPublicKeyAction({ orgSlug });
      if (!result.ok || !result.data) {
        toast.error(result.ok ? "Erro ao gerar a chave." : result.error);
        return;
      }
      setNewKey(result.data.key);
      toast.success("Chave gerada. Copie agora: ela não aparece de novo.");
    });
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" />
            Chave de acesso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {keyInfo ? (
            <p>
              Chave ativa começando com <code className="font-mono">{keyInfo.prefix}…</code>, criada em{" "}
              {dateTime.format(new Date(keyInfo.createdAt))}.
            </p>
          ) : (
            <p className="text-muted-foreground">Nenhuma chave gerada ainda.</p>
          )}

          {newKey && (
            <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
              <p className="font-medium">Nova chave (só aparece agora):</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{newKey}</code>
                <Button variant="outline" size="icon" aria-label="Copiar chave" onClick={() => copy(newKey)}>
                  <CopyIcon />
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Coloque no servidor do site como CATALOG_API_KEY. A chave anterior parou de funcionar.
              </p>
            </div>
          )}

          <Button onClick={handleGenerate} disabled={isPending} variant={keyInfo ? "outline" : "default"}>
            {isPending && <Loader2Icon className="animate-spin" />}
            {keyInfo ? "Gerar nova chave (invalida a atual)" : "Gerar chave"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como o site usa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">Todas as chamadas levam o header <code>x-catalog-key</code>.</p>
          <ul className="space-y-1 font-mono text-xs">
            <li>GET {baseUrl}/api/public/catalog/categories</li>
            <li>GET {baseUrl}/api/public/catalog/items?category=discos&amp;featured=true&amp;q=turbo</li>
            <li>GET {baseUrl}/api/public/catalog/items/[slug]</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Passo 8: Verificar e testar manualmente**

Run: `npx tsc --noEmit && npm run check && npx vitest run tests/catalog-*.test.ts`
Esperado: sem erros; PASS.

Roteiro manual (com `npm run dev` e ao menos um produto publicado):
1. **Catálogo → API do site → Gerar chave** e copiar.
2. `curl -s http://localhost:3000/api/public/catalog/items -H "x-catalog-key: <chave>"` → `{"data":[...]}` com o produto publicado.
3. Esperado: a resposta **não contém** `price`, `stock` nem `sku` — conferir com `curl ... | grep -E "price|stock|sku"` (sem saída).
4. Sem header → HTTP 401 `{"error":"Chave da API inválida."}`.
5. `curl .../items/slug-que-nao-existe -H "x-catalog-key: <chave>"` → 404.
6. Gerar nova chave → a antiga passa a devolver 401.

- [ ] **Passo 9: Commit**

```bash
git add lib/catalog/public-key.ts lib/catalog/public-queries.ts lib/catalog/settings-actions.ts lib/catalog/queries.ts app/api/public "app/(app)/app/[orgSlug]/catalogo/api-do-site" middleware.ts tests/catalog-public-key.test.ts tests/catalog-public-queries.test.ts
git commit -m "feat(catalogo): API pública do catálogo sem preço, com chave por organização"
```

---

### Tarefa 12: Aviso ao site, documentação e verificação final

**Arquivos:**
- Criar: `lib/catalog/notify-site.ts`
- Modificar: `lib/catalog/actions.ts`, `lib/catalog/kit-actions.ts`, `lib/bling/sync.ts`
- Modificar: `tests/catalog-actions-permissions.test.ts`, `tests/catalog-kit-actions.test.ts`, `tests/bling-sync.test.ts` (mock do aviso)
- Criar: `lib/catalog/CLAUDE.md`, `lib/bling/CLAUDE.md`
- Teste: `tests/catalog-notify-site.test.ts`

**Interfaces:**
- Produz:
  ```ts
  export type NotifySiteDeps = { fetchImpl?: typeof fetch; env?: Record<string, string | undefined> };
  export function notifySiteCatalogChanged(deps?: NotifySiteDeps): Promise<void>; // nunca lança
  ```
- Contrato com o site (Etapa 4): `POST ${SITE_REVALIDATE_URL}` com `Authorization: Bearer ${SITE_REVALIDATE_SECRET}` e corpo `{"tag":"catalog"}`; o site chama `revalidateTag("catalog")`. Sem as duas variáveis, não faz nada.

- [ ] **Passo 1: Escrever o teste que falha**

`tests/catalog-notify-site.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { notifySiteCatalogChanged } from "@/lib/catalog/notify-site";

vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

describe("notifySiteCatalogChanged", () => {
  it("não faz nada sem configuração", async () => {
    const fetchImpl = vi.fn();
    await notifySiteCatalogChanged({ fetchImpl, env: {} });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("envia a tag catalog com o segredo", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    await notifySiteCatalogChanged({
      fetchImpl,
      env: { SITE_REVALIDATE_URL: "https://m10.com.br/api/revalidate", SITE_REVALIDATE_SECRET: "s3cr3t" },
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://m10.com.br/api/revalidate");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer s3cr3t");
    expect(init.body).toBe(JSON.stringify({ tag: "catalog" }));
  });

  it("engole falhas de rede (site fora do ar não quebra o CRM)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      notifySiteCatalogChanged({ fetchImpl, env: { SITE_REVALIDATE_URL: "https://x", SITE_REVALIDATE_SECRET: "y" } }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run tests/catalog-notify-site.test.ts`
Esperado: FAIL com `Failed to resolve import "@/lib/catalog/notify-site"`.

- [ ] **Passo 3: Implementar**

`lib/catalog/notify-site.ts`:

```ts
import { logError } from "@/lib/logger";

export type NotifySiteDeps = { fetchImpl?: typeof fetch; env?: Record<string, string | undefined> };

/** Pede ao site para revalidar o catálogo. Nunca lança: o site fora do ar não pode quebrar o CRM. */
export async function notifySiteCatalogChanged(deps: NotifySiteDeps = {}): Promise<void> {
  const env = deps.env ?? process.env;
  const url = env.SITE_REVALIDATE_URL;
  const secret = env.SITE_REVALIDATE_SECRET;
  if (!url || !secret) return;

  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tag: "catalog" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) logError("catalog.notify-site", new Error(`Site respondeu HTTP ${res.status}`));
  } catch (err) {
    logError("catalog.notify-site", err);
  }
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run tests/catalog-notify-site.test.ts`
Esperado: PASS.

- [ ] **Passo 5: Ligar o aviso nas actions e no sync**

1. Em `lib/catalog/actions.ts`, importar `import { notifySiteCatalogChanged } from "./notify-site";` e trocar a função `revalidateCatalog` por:
```ts
function revalidateCatalog(orgSlug: string) {
  revalidatePath(`/app/${orgSlug}/catalogo`, "layout");
  void notifySiteCatalogChanged();
}
```
2. Em `lib/catalog/kit-actions.ts`, importar o mesmo e acrescentar `void notifySiteCatalogChanged();` logo depois de cada `revalidatePath(...)` (em `saveKitAction` e `deleteKitAction`).
3. Em `lib/bling/sync.ts`, importar `import { notifySiteCatalogChanged } from "@/lib/catalog/notify-site";` e, logo antes de `return { ok: true, stats };`, acrescentar:
```ts
    void notifySiteCatalogChanged();
```
4. Nos testes `tests/catalog-actions-permissions.test.ts`, `tests/catalog-kit-actions.test.ts` e `tests/bling-sync.test.ts`, acrescentar junto dos outros mocks:
```ts
vi.mock("@/lib/catalog/notify-site", () => ({ notifySiteCatalogChanged: vi.fn(async () => {}) }));
```

Run: `npx vitest run tests/catalog-*.test.ts tests/bling-*.test.ts`
Esperado: PASS.

- [ ] **Passo 6: Documentação dos módulos**

`lib/bling/CLAUDE.md`:

```markdown
# CLAUDE.md — lib/bling

## Responsabilidade

Integração com a API v3 do Bling (ERP): OAuth2, espelho de produtos (`bling_products`) e sincronização.

## Arquivos

- `constants.ts` — URLs e limites (3 req/s, 100 itens/página, sync a cada 15 min)
- `errors.ts` / `error-map.ts` — `BlingError` com `publicMessage` em PT-BR
- `client.ts` — `createBlingClient(token)`: limitador de 350 ms entre chamadas e retry de 429
- `oauth.ts` — URL de autorização, troca de código e refresh (Basic auth + form)
- `oauth-state.ts` — state do OAuth em cookie httpOnly
- `tokens.ts` — tokens em `bling_integrations` (sem policies: só service role); `getValidAccessToken` renova 5 min antes de expirar
- `map-product.ts` — produto do Bling → linha de `bling_products`
- `sync.ts` — `syncOrganizationProducts` (paginado, lock por organização, desativa não vistos, chama a guarda de kits, avisa o site) e `syncAllConnectedOrganizations` (job)
- `queries.ts` — status seguro para a UI (nunca tokens)
- `actions.ts` — "Sincronizar agora" e "Desconectar"

## Variáveis de ambiente

- `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET` — app criado em https://developer.bling.com.br/aplicativos
- URL de callback no app do Bling: `${NEXT_PUBLIC_APP_URL}/api/integrations/bling/callback`

## Regras absolutas

- Tokens nunca vão para o browser nem para tabelas legíveis por membros.
- Refresh token do Bling é trocado a cada renovação: sempre gravar o novo antes de usar o access token.
- Nunca chamar `/oauth/token` em loop (bloqueio de IP após 20 chamadas em 60 s).
- Se o Bling devolver zero produtos, **não** desativar o catálogo.
- O agendamento é o job de `lib/jobs/index.ts` (Easypanel). Não usar pg_cron/pg_net (removido por segurança em `20260525000018`).

## Teste manual

Ver Tarefa 7 do plano `ias/site/docs/superpowers/plans/2026-09-17-etapa-1-catalogo-bling-kits.md`.
```

`lib/catalog/CLAUDE.md`:

```markdown
# CLAUDE.md — lib/catalog

## Responsabilidade

Catálogo do site M10 Abrasivos: produtos publicados (a partir do espelho do Bling), categorias, kits e API pública **sem preço**.

## Modelo

- `catalog_items` — o que aparece no site. `kind = product` aponta para `bling_products`; `kind = kit` aponta para `kits`.
- `product_categories` — categorias do site.
- `kits` + `kit_items` — composição com quantidade e `discount_pct`.
- `catalog_settings` — hash da chave da API pública (a chave completa só é exibida ao gerar).

## Regras de negócio

- Preço do kit = Σ(preço Bling × quantidade) × (1 − desconto/100), em centavos (`kit-pricing.ts`).
- Disponibilidade do kit = mín(⌊estoque ÷ quantidade⌋).
- Kit só pode ser publicado se todos os itens estiverem ativos no Bling **e** publicados como produto.
- `enforceKitIntegrity` roda após cada sync, ao despublicar produto e ao salvar kit: retira do ar kits quebrados, grava `kits.hidden_reason` e cria tarefa de prioridade alta.
- Preço e estoque aparecem **só dentro do CRM**. `public-queries.ts` tem a lista de colunas liberadas, coberta por teste.

## API pública (`app/api/public/catalog/*`)

- Header `x-catalog-key`; 401 sem chave válida.
- `GET /categories`, `GET /items?category=&featured=true&q=`, `GET /items/[slug]`.
- Alterações disparam `notifySiteCatalogChanged()` → `POST SITE_REVALIDATE_URL` com `{"tag":"catalog"}` (opcional; sem as variáveis não faz nada).

## Variáveis de ambiente

- `SITE_REVALIDATE_URL`, `SITE_REVALIDATE_SECRET` — opcionais até o site existir (Etapa 4).
```

- [ ] **Passo 7: Verificação completa**

Run:
```bash
npx tsc --noEmit
npm run check
npm run test
npm run build
```
Esperado: os quatro sem erros; todos os testes (antigos e novos) PASS.

Roteiro manual final (ponta a ponta):
1. Conectar o Bling → produtos aparecem em **Catálogo**.
2. Criar categoria, publicar 3 produtos com ficha técnica.
3. Montar kit com os 3, desconto 10%, publicar.
4. Gerar chave → `curl` em `/api/public/catalog/items` lista 4 itens (3 produtos + kit) sem preço.
5. Inativar um dos produtos **no Bling** → **Sincronizar agora** → o kit sai do ar, aparece tarefa "Kit retirado do site", e o `curl` passa a listar 2 itens.

- [ ] **Passo 8: Commit e pergunta sobre o push**

```bash
git add lib/catalog/notify-site.ts lib/catalog/actions.ts lib/catalog/kit-actions.ts lib/bling/sync.ts lib/catalog/CLAUDE.md lib/bling/CLAUDE.md tests/catalog-notify-site.test.ts tests/catalog-actions-permissions.test.ts tests/catalog-kit-actions.test.ts tests/bling-sync.test.ts
git commit -m "feat(catalogo): aviso de revalidação ao site e documentação dos módulos"
```

**Perguntar ao usuário** antes de `git push -u origin feat/catalogo-bling` e antes de abrir PR ou fazer merge na `main`.
