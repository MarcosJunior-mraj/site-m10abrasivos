# CLAUDE.md — m10-site

## O que este site é

Vitrine da M10 Abrasivos para marmorarias: catálogo de produtos (com foto,
ficha técnica, kits) e um widget de chat que conecta o visitante ao CRM da
empresa, onde um agente de IA (ou um vendedor humano) atende. Next.js 16, App
Router, `output: "standalone"`. Etapa 4a da spec (site + widget); o agente
vendedor em si é a Etapa 3, implementada no repositório do CRM.

## O que este site NÃO faz

- **Não mostra preço.** Nenhuma tela, nenhuma rota da API pública do CRM que
  este site consome devolve preço ou estoque — é filtro do lado do CRM
  (`public-queries.ts` lá), reforçado aqui por nunca pedir esses campos.
- **Não tem banco de dados próprio.** Todo o catálogo vem do CRM a cada
  build/revalidação; não há Postgres, Supabase nem qualquer armazenamento
  próprio neste repositório.
- **Não tem login nem conta de usuário.** Não existe área logada, sessão de
  cliente ou painel — é site público, só leitura, mais o chat anônimo.
- **Não usa preço nem catálogo com dados sensíveis no HTML.** As URLs de foto
  que o Bling devolve são links assinados do S3 com validade curta; elas não
  aparecem em lugar nenhum do HTML servido (ver seção seguinte).

## Como o catálogo entra

- `lib/catalog/client.ts` é o cliente HTTP para
  `${CRM_URL}/api/public/catalog/*` (`buscarItens`, `buscarItem`,
  `buscarCategorias`), autenticado com o cabeçalho `x-catalog-key:
  ${CATALOG_KEY}`. Toda leitura usa `fetch` com `next: { tags: ["catalog"] }`
  — a mesma tag que `POST /api/revalidate` (`app/api/revalidate/route.ts`)
  derruba via `revalidateTag("catalog", "max")` quando o CRM avisa que algo
  mudou (`Authorization: Bearer ${SITE_REVALIDATE_SECRET}`).
- **Por que existe a rota `/imagens/[slug]/[indice]`
  (`app/imagens/[slug]/[indice]/route.ts`)**: as fotos que o CRM devolve são
  URLs assinadas do S3/Bling com validade de ~24 h. Se essas URLs fossem
  parar direto no HTML (ex.: `<img src={item.images[0]}>`), a página estática
  (`revalidate: 3600`) ficaria com foto quebrada assim que a assinatura
  expirasse, bem antes da próxima revalidação. Em vez disso, o site expõe uma
  URL **estável e própria** (`/imagens/{slug}/{indice}`) que, a cada
  requisição, busca o item de novo, pega a URL assinada corrente e faz proxy
  do binário (`cache-control: public, max-age=86400,
  stale-while-revalidate=604800` — a resposta ESTÁVEL é cacheada, não a URL
  volátil de origem). `revalidateTag("catalog")` também derruba essa rota,
  então foto trocada no Bling aparece na revalidação seguinte. O
  caminho leva `?v=<hash da URL de origem sem a query>` (`urlDaImagem`):
  foto nova = caminho novo, então o navegador e o otimizador do Next não
  ficam presos à cópia antiga pelo `max-age` de 1 dia. A rota ignora a query.
- **A rota de imagem é um proxy no servidor — por isso é fechada**: só busca
  em hosts da lista única de `lib/catalog/origem-de-imagem.ts` (armazenamento
  do Bling, a origem do próprio `CRM_URL` e `IMAGENS_HOSTS_EXTRAS`),
  `https:` obrigatório fora do CRM, `redirect: "error"`, só
  jpeg/png/webp/avif/gif (SVG nunca), teto de 5 MB, e responde com
  `nosniff` + `content-security-policy: default-src 'none'; sandbox`. Se o
  Bling mudar de armazenamento, as fotos passam a dar 404 — o conserto é
  naquela lista.
- **Preço também é barrado aqui** (segunda trava, depois da do CRM): spec,
  descrição e campos de SEO são texto livre digitado no CRM, então
  `lib/catalog/sem-preco.ts` tira da tela o par de spec ou a frase que fala
  de preço (exige contexto de moeda — `\d+,\d{2}` sozinho pegaria medidas como
  "12,50 mm").

## Como o widget fala com o CRM

- `lib/webchat/cliente.ts` (`ClienteWebchat`) fala **direto do navegador**
  com `${NEXT_PUBLIC_CRM_URL}/api/public/webchat/{session,messages,stream}`,
  autenticado com `NEXT_PUBLIC_WEBCHAT_KEY` (chave pública, não é segredo —
  identifica o canal, igual à `x-catalog-key` do catálogo) e depois com o
  token de sessão HMAC que o CRM devolve.
- **Por que direto do navegador, e não via rota própria do site como
  proxy**: o CRM aplica limite por IP nas rotas públicas do webchat (20
  requisições/min e 200/dia por sessão E por IP — ver
  `lib/webchat/CLAUDE.md` no CRM). Se o site fizesse de intermediário
  (navegador → API do site → CRM), todo tráfego chegaria ao CRM com o **IP
  do servidor do site**, não o do visitante — o limite por IP deixaria de
  discriminar visitantes e um único abusador (ou um pico de tráfego legítimo)
  esgotaria a cota de todo mundo que usa o chat ao mesmo tempo. Falando
  direto, o `TRUST_PROXY=1` do CRM enxerga o IP real de cada visitante.
- Streaming de mensagens novas é por SSE (`EventSource`,
  `GET .../stream?token=...`), com reconexão limitada (piso de 15 s entre
  tentativas, teto de 5 tentativas seguidas antes de cair para o link de
  WhatsApp — ver `RECONEXAO_INTERVALO_MINIMO_MS` /
  `RECONEXAO_TENTATIVAS_MAXIMAS` em `lib/webchat/cliente.ts`).
- Queda do SSE (fonte `CLOSED`, ex.: 502) não degrada na hora: espera o
  piso, sincroniza e religa pelo mesmo freio. Aba escondida por mais de 60 s
  desliga o fluxo; só nesse caso a volta à aba sincroniza e religa.
- Sem sessão, IP bloqueado, CRM fora do ar, resposta fora do formato
  (validada com `zod/mini` em `lib/webchat/esquemas.ts`) ou Turnstile com
  problema, o widget degrada para um botão de link direto ao WhatsApp
  (`NEXT_PUBLIC_WHATSAPP_FALLBACK`) — nunca trava numa tela sem saída. O
  painel aparece já em "abrindo", com o WhatsApp à mão.
- **Carga sob demanda (spec 7.4)**: `components/chat/widget.tsx` é só o botão
  e a casca do painel; aviso de LGPD, painel, Turnstile e o cliente vêm de
  `components/chat/chat-completo.tsx` por `React.lazy` no primeiro clique.
  Quem volta com sessão salva não abre sessão nem SSE até clicar. O teste
  `tests/fronteira-do-cliente.test.ts` segue os imports estáticos do widget e
  do rodapé e falha se algum alcançar Zod, `server-only` ou o chat pesado.
- **Configuração em dois arquivos**: `lib/config.ts` é de servidor (Zod +
  `import "server-only"` — importar num componente de cliente quebra o
  build); `lib/config-publica.ts` tem só as `NEXT_PUBLIC_*`, sem Zod.

## Páginas de vendas por linha

- **Conteúdo em `lib/linhas/`**: cada linha (ex.: `lib/linhas/green-turbo.ts`) é um
  objeto validado por `esquemaLinha` (`lib/linhas/esquema.ts`, Zod) — conteúdo
  quebrado derruba o **build**, nunca a página em produção. `lib/linhas/index.ts`
  expõe `buscarLinha`, `linhasVisiveis` (para `generateStaticParams`) e
  `linhasPublicadas` (home, menu, sitemap).
- **Rascunho (`linha.rascunho: true`) não vai ao ar** — `podeMostrar()` só deixa
  passar com a variável de servidor `MOSTRAR_RASCUNHOS=1`. Fora isso, a rota
  `/linhas/[slug]` de uma linha em rascunho dá 404 (ver `.env.example`: **só
  desenvolvimento/e2e, nunca em produção** — é assim que se mostra uma linha em
  progresso para revisão sem publicá-la para o visitante).
- **Mídia (fotos e vídeos) vem de fora do repositório**: o conteúdo de uma linha
  guarda só o caminho relativo (ex.: `"green-turbo/topo-celular.mp4"`);
  `urlDaMidia()` (`lib/midia.ts`) monta a URL final prefixando
  `NEXT_PUBLIC_MIDIA_URL` (base pública do bucket `site-midia`). Trocar de
  serviço de hospedagem de mídia não exige tocar no conteúdo das linhas.
- **"Nada inventado"**: `esquemaDepoimento` exige `autorizado: z.literal(true)`
  (depoimento só entra com autorização registrada) e `esquemaNumero` exige o
  campo `fonte` em todo número exibido (`lib/linhas/esquema.ts`). Um depoimento
  ou número sem essa procedência não passa da validação do schema — não é para
  ser contornado escrevendo o dado direto na página.
- **Atributos do chat, para qualquer seção da página de uma linha abrir o
  widget sem importar nada de `components/chat/`**: qualquer elemento com
  `data-abrir-chat` abre o painel quando clicado (ouvido por um listener
  único em `document`, montado por `components/chat/widget.tsx`). Junto dele:
  - `data-item`: texto do contexto da linha enviado ao CRM (`pageContext.item`)
    — ex.: `linha.ia.contexto` ("Linha Green Turbo").
  - `data-abertura`: a fala da IA (balão) mostrada como 1ª bolha da conversa;
    ausente/`null` quando o gatilho não carrega uma abertura (ex.: reabrir
    pelo botão flutuante depois de uma conversa já iniciada não apaga a
    abertura anterior se ela já foi respondida).
  - `data-mensagem`: pergunta pronta enviada automaticamente assim que a
    sessão abrir (usada pelos chips de "Pergunte ao especialista").
  - Se o gatilho estiver dentro de um elemento com `[data-chat-embutido]`, o
    painel monta **dentro da página** (via `createPortal`, variante
    "embutido", `role="region"`) no `[data-chat-alvo]` daquele mesmo bloco, em
    vez de flutuar (variante "flutuante", `role="dialog"`) — mas é sempre a
    **mesma conversa** (mesmo `ClienteWebchat`, só muda onde o `Painel`
    aparece). Um CSS em `app/globals.css`
    (`[data-chat-alvo]:not(:empty) + [data-chat-previa]`) esconde a prévia com
    os chips assim que o painel entra no alvo.

## Contratos do CRM (resumo — a fonte completa é lá)

Este repositório só consome; a implementação, as regras de limite, o modelo
de dados e as decisões de segurança vivem no repositório do CRM:

- **Catálogo**: `lib/catalog/CLAUDE.md` no CRM — modelo (`catalog_items`,
  `product_categories`, `kits`), colunas liberadas para a API pública (sem
  preço/estoque, coberto por teste lá), e como a escrita no CRM aciona
  `notifySiteCatalogChanged` → `POST ${SITE_URL}/api/revalidate`.
- **Webchat**: `lib/webchat/CLAUDE.md` no CRM — autenticação por chave/token,
  todos os limites de abuso (por sessão, por IP, por canal, por conexão
  SSE), por que o SSE consulta o banco em vez do Supabase Realtime, e por
  que `TRUST_PROXY=1` é obrigatório em produção.

Antes de mudar qualquer coisa que toque nesses contratos (formato de
resposta, cabeçalhos, limites), leia o `CLAUDE.md` correspondente no CRM
primeiro — mudar um lado sem o outro quebra em produção sem aviso em build.

## Variáveis de ambiente

Servidor (nunca viram `NEXT_PUBLIC_*`, nunca em arquivo versionado com valor
real — só `.env.example` com placeholder).

**No Easypanel, cada variável de servidor precisa existir DUAS vezes**: como
variável de ambiente de **runtime** do serviço (o `node server.js` lê o
catálogo, a rota de imagem e `/api/revalidate` em execução) **e** como
**build arg** (o `npm run build` dentro do `Dockerfile` já lê o catálogo do
CRM para gerar as páginas estáticas e valida a configuração). Faltando no
build, o build falha; faltando só em runtime, o site sobe e quebra na
primeira revalidação ou foto.

| Variável | Uso |
|---|---|
| `CRM_URL` | Base da API do CRM, lida só no servidor |
| `CATALOG_KEY` | Enviada em `x-catalog-key` ao ler o catálogo |
| `SITE_REVALIDATE_SECRET` | Comparado com o `Authorization: Bearer` de `POST /api/revalidate` |
| `SITE_URL` | URL pública do site (metadata, sitemap, dados estruturados) |
| `EMPRESA_RAZAO_SOCIAL` | Exibida em `/privacidade` |
| `EMPRESA_CNPJ` | Exibida em `/privacidade` |
| `EMPRESA_EMAIL_ENCARREGADO` | E-mail do encarregado LGPD, exibido em `/privacidade` |
| `IMAGENS_HOSTS_EXTRAS` | Opcional. Hosts (vírgula) além do Bling de onde `/imagens` pode buscar foto — ex.: foto de kit hospedada fora |
| `MOSTRAR_RASCUNHOS` | Opcional, `"1"` mostra páginas de linha em rascunho (`lib/linhas/`). **Só desenvolvimento/e2e; nunca em produção** |

Navegador (gravadas no pacote do navegador **durante o build** — por isso
precisam existir como `ARG` no `Dockerfile` e como variável no momento de
`npm run build`, não só em runtime):

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_CRM_URL` | URL do CRM usada pelo navegador para falar com o webchat |
| `NEXT_PUBLIC_WEBCHAT_KEY` | Chave pública do webchat (`x-webchat-key`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key do Cloudflare Turnstile |
| `NEXT_PUBLIC_WHATSAPP_FALLBACK` | Número (só dígitos) do botão de contingência do chat. **Obrigatório: vazio derruba o build** (`lib/conferir-build.ts`, chamado pelo `next.config.ts`) |
| `NEXT_PUBLIC_MIDIA_URL` | Base pública do bucket `site-midia`: fotos e vídeos das páginas de vendas por linha (`lib/midia.ts`) |

Ver `.env.example` para os comentários de cada uma.

## Comandos

- `npm run dev` — servidor de desenvolvimento, porta 3001
- `npm run build` / `npm run start` — build e start de produção (`start`
  emite um aviso inofensivo por causa de `output: "standalone"`; em produção
  real o contêiner roda `node server.js`, não `next start`)
- `npm run check` — `biome check --write .`
- `npm run types` — `tsc --noEmit`
- `npm test` — `vitest run` (testes de unidade)
- `npm run test:e2e` — `playwright test` (ponta a ponta, contra
  `tests/e2e/crm-falso.ts`, um CRM falso que sobe na porta 3101)

## Lições desta etapa (poupam tempo de quem vier depois)

- **Caminho do disco com maiúsculas exatas.** O caminho real deste worktree
  no Windows é `C:\Users\Marcos Junior\IAS\Site\...` (maiúsculo em `IAS` e
  `Site`). Rodar comandos a partir de um `cd` com capitalização diferente
  (ex.: `...\ias\site\...`) faz o `vite-tsconfig-paths` — usado pelo Vitest
  para resolver o alias `@/*` — comparar caminhos de forma sensível a
  maiúsculas/minúsculas contra a raiz "errada" do projeto, e o alias para de
  bater. O sintoma é enganoso: `Cannot find module '@/lib/config'` mesmo com
  o arquivo existindo e a configuração correta. Não é bug de código nem de
  `tsconfig.json`/`vitest.config.ts` — é só entrar sempre pelo caminho com a
  capitalização real.
- **Nunca criar `declare module` para calar o compilador.** Um `.d.ts` com
  `declare module "next/cache"` (por exemplo) substitui a tipagem inteira do
  módulo, não só a assinatura que mudou — esconde uma mudança de API real do
  Next e quebra silenciosamente outros imports do mesmo módulo. Se o
  TypeScript reclama de uma API que mudou de verdade, corrija a chamada; não
  finja que o tipo é outro.
- **`useSearchParams()` numa página estática tira o conteúdo do HTML.**
  Envolver o componente num `<Suspense>` faz o `next build` passar, mas o
  que fica no `.next/server/.../*.html` pré-renderizado é o **fallback** do
  `Suspense`, não o conteúdo real — a grade de itens em `/[categoria]`
  desapareceu do HTML servido, mesmo passando no build. A saída certa é não
  usar `useSearchParams()` em componente que precisa aparecer no HTML
  estático: ler o estado inicial como vazio (igual ao servidor) e, só depois
  da montagem, ler `window.location.search`/escutar `popstate` num
  `useEffect` comum, que não é hook do Next e não provoca bail-out.
- **`fetch` guardado em campo precisa de `bind`.** `this.fetchImpl = deps.fetchImpl ?? fetch`
  guarda a função sem o `this` correto; ao chamar `this.fetchImpl(...)`, o
  `this` da chamada é a instância da classe, não `window`. O `fetch` nativo
  do navegador exige que o `this` seja a própria `Window`, senão lança
  `Illegal invocation` — silenciosamente, sem nenhuma requisição aparecendo
  no DevTools, então o sintoma parece "a rede não está sendo usada", não
  "deu erro". Correção: `fetch.bind(globalThis)` no valor padrão. Testes de
  unidade que sempre injetam seu próprio `fetchImpl` não pegam essa
  regressão — se for escrever um teste de guarda, ele precisa exercitar o
  `fetch` padrão (sem injeção) e checar o `this` recebido, não só "não
  lançou".
- **Cabeçalho do `next.config.ts` sobrescreve o da rota.** Um
  `Content-Security-Policy` em `headers()` com `source: "/:path*"` apagava a
  CSP com `sandbox` que a rota `/imagens` manda — só aparece rodando o
  servidor de produção e olhando o cabeçalho (`curl -D -`), não em teste de
  unidade. Por isso a CSP da config usa `/((?!imagens/).*)`.
- **`.next/cache` guarda o Data Cache entre builds.** Um `npm run build`
  novo reaproveita as respostas do catálogo gravadas pelo anterior (a
  revalidação é de 1 h): mudar o CRM falso e rodar a e2e sem apagar `.next`
  testa o catálogo VELHO. Antes de uma rodada de `npm run test:e2e` que
  dependa de mudança no `tests/e2e/crm-falso.ts`, apague `.next`.
- **Prop de componente de cliente vai inteira no HTML.** O payload RSC que o
  Next embute na página leva TODAS as props de um componente `"use client"`,
  não só o que ele mostra. A página de categoria passava o item cru para
  `GradeDeItens` e o HTML carregava as URLs assinadas do Bling e a spec
  "Preço". Antes de passar dado do CRM para componente de cliente, reduza-o
  (`lib/catalog/para-o-navegador.ts`).
- **`zod/mini` só encolhe com importação nomeada.** `import { z } from
  "zod/mini"` levou o pacote inteiro para o chunk do chat (385 KB);
  `import { object, string, ... } from "zod/mini"` levou 68 KB.
