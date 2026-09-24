# Páginas de vendas por linha de produto — design

**Data:** 2026-09-23 · **Status:** aprovado em conversa, aguardando revisão do documento
**Piloto:** linha Abrasivo M10 Green Turbo · **Repositórios:** site (`site-m10abrasivos`) e CRM (`crm_m10`)

## 1. Objetivo e conceito

O site deixa de ser uma vitrine de itens e passa a **vender linhas de produto**. Cada linha
ganha uma página de vendas longa, com vídeo, prova e a IA vendedora convertendo. O catálogo
técnico continua existindo por trás, para quem quer ver item a item e para o Google.

Começamos por **uma linha piloto (Green Turbo)** construída sobre um **molde reutilizável**. As
próximas linhas são, em boa parte, um arquivo de conteúdo mais o material de cada uma.

**Público e tráfego:** marmoristas que chegam por anúncio (Meta/Instagram), Google, Instagram
orgânico e link enviado por vendedor/WhatsApp. O topo precisa fisgar quem chega frio; o corpo
precisa ter profundidade técnica para quem já está decidido.

**Conversão principal:** conversar com a IA na própria página. WhatsApp é alternativa.

**Continua valendo (spec de 2026-09-16):** sem preço no site; preço só na conversa, com as
regras e limites do agente (R$ 2.000 / 20 un.); persona da IA; handoff para o WhatsApp.

## 2. A linha Green Turbo (fatos confirmados pelo usuário)

- **Máquina:** poliborda (automática).
- **Pedras:** granito, mármore, quartzito, quartzo/pedra industrializada.
- **Promessa:** brilho espelhado, sai da poliborda direto para o cliente, sem retrabalho, não
  deixa a pedra fosca, velocidade de trabalho, economia de tempo de produção, trabalha com água.
- **Produtos (catálogo, todos publicados):** GT50, GT100, GT200, GT400, GT800, GT1500, GT3000
  (`abrasivo-m10-green-turbo-<grão>`). Existe também "Abrasivo Green Turbo 125mm" (sem código,
  fora do catálogo); ele não entra na página.
- **Oferta:** kit da sequência completa, **7 peças, 1 de cada grão**. O "Kit GT para Poliborda",
  que já existe no CRM com 3 itens, passa a ter os 7. O desconto é definido pelo usuário.
  Os grãos avulsos aparecem como reposição.

## 3. Estrutura do site

- **Home:** topo destacando o Green Turbo (trecho de vídeo + "Conheça a linha") e a grade
  **"Linhas M10"**. Green Turbo leva à página de vendas; as demais linhas (Colmeia, Lixas M10,
  Jet, Black, Fresas…) levam por enquanto à categoria delas no catálogo.
- **Menu:** Linhas ▾ · Catálogo · botão "Falar com especialista".
- **Página de vendas:** `/linhas/[linha]`; piloto em `/linhas/green-turbo`.
- **Catálogo:** permanece como está (categorias, página técnica, filtros). As páginas técnicas
  dos itens de uma linha com página de vendas ganham o aviso "Conheça a linha Green Turbo".
- **Nenhum endereço atual sai do ar.**

## 4. A página de vendas: 10 seções

| # | Seção | Conteúdo |
|---|---|---|
| 1 | Topo cinema | Vídeo da poliborda em tela cheia, sem som, em loop. Título "Sai da poliborda com brilho de espelho." Subtítulo "Direto para o cliente. Sem retrabalho." CTA "Pergunte ao especialista". Balão proativo da IA. |
| 2 | Saia do fosco e chegue ao espelhado | Barra dos 7 grãos (#50→#3000) que se preenche com a rolagem. No #3000, revela **uma foto real do brilho espelhado**, com um reflexo de luz passando. Nenhuma versão "fosca" artificial da foto. |
| 3 | A dor | "Quanto custa voltar a peça para a bancada?": fosco, retrabalho manual, atraso, cliente reclamando. Texto curto. |
| 4 | 4 razões | Brilho espelhado · velocidade na produção · economia de tempo e dinheiro · satisfação do cliente. Cada uma com um trecho curto de vídeo. |
| 5 | Pergunte ao especialista | Chat embutido na página, com perguntas prontas clicáveis (ex.: "Serve para quartzito?", "Qual sequência para mármore?", "Quanto custa o kit?"). |
| 6 | Quem usa | Depoimentos em vídeo de marmoristas reais, com autorização. |
| 7 | Os números | Dados técnicos e comparativos **somente do material do usuário, cada um com fonte**. |
| 8 | A oferta | Kit Green Turbo para Poliborda, 7 grãos. "Quero o valor do kit" (valor só na conversa). Os 7 grãos avulsos em cartões pequenos, levando à página técnica de cada um. |
| 9 | Dúvidas | Objeções: serve na minha poliborda, durabilidade, precisa trocar o que uso hoje, **trabalha com água**, entrega, pagamento. |
| 10 | Fechamento | "Sua próxima peça sai pronta da poliborda." CTA "Falar com especialista" + WhatsApp. |

O botão flutuante do chat fica visível em toda a página.

**Visual:** identidade M10 (Azul M10 `#20233A`, Laranja M10 `#F97709`, Poppins/Montserrat,
direção Carrara Noturno). Protótipos aprovados: topo "Cinema" + faixa dos grãos da opção
"Sequência" (em `.superpowers/brainstorm/`).

## 5. O molde

### 5.1 Peças

Cada uma das 10 seções é um componente do site. A página de uma linha é a lista ordenada de
peças mais o conteúdo daquela linha. **Peça sem material é omitida**, nunca renderizada vazia.

### 5.2 Conteúdo por linha

Um arquivo de conteúdo tipado por linha (ex.: `conteudo/linhas/green-turbo.ts`), validado por
schema, com:

- metadados: slug, nome, título/descrição de SEO, imagem de compartilhamento;
- textos de cada seção;
- mídia: trechos curtos (URLs das versões celular/computador + capa), foto do espelhado,
  depoimentos (vídeo, capa, nome, cidade, marmoraria, **marca de autorização**);
- números: valor, rótulo e **fonte obrigatória**;
- perguntas prontas do chat, texto do balão proativo e dúvidas;
- produtos: slugs do kit e dos avulsos no catálogo.

### 5.3 Regras

- **Nada inventado:** número sem `fonte` e depoimento sem autorização **falham na validação**
  (teste + build). A copy passa pela aprovação do usuário antes de publicar.
- **Sem preço:** a trava existente (`lib/catalog/sem-preco.ts`) cobre os textos do molde; a
  oferta sempre termina em "peça o valor na conversa".
- **Produtos vivos:** nomes e fotos vêm do catálogo do CRM (fotos próprias > fotos em alta do
  Bling > miniatura). Produto que sair do catálogo some da página, sem link quebrado. Kit
  despublicado faz a oferta cair para "monte sua sequência com o especialista".

## 6. Mídia

- **Tudo hospedado por nós** (sem YouTube), num **bucket próprio de mídia do site** no Supabase
  (separado de `produtos-fotos`), leitura pública, escrita só por service role.
- **Entrada:** o usuário coloca os vídeos brutos numa pasta. Os trechos são cortados,
  comprimidos e aprovados antes de publicar.
- **Trechos curtos** (topo, 4 razões): 5–15 s, sem som, loop, H.264 MP4 com versão leve para
  celular e maior para computador, mais imagem de capa. Seções abaixo do topo carregam o vídeo
  só quando a pessoa se aproxima.
- **Depoimentos/vídeos longos:** 720p, preparados para começar a tocar antes de baixar inteiros
  (faststart). Mostram só a capa com ▶ e **não baixam nada antes do clique**; player nativo.
- **Economia de dados e menos animação:** com `prefers-reduced-motion` ou economia de dados,
  mostra só a capa; vídeos com controle de pausa.
- **Custo:** tráfego conta no Supabase (5 GB/mês no plano gratuito; o Pro inclui 250 GB). Com
  anúncios rodando, pode exigir o plano Pro. O serviço de vídeo pode ser trocado sem mexer no
  molde.

## 7. A IA na página

- **Contexto:** todo botão e o chat da página enviam `pageContext` com `item = "Linha Green
  Turbo"` e a URL. A inbox mostra a origem.
- **Balão proativo:** aparece após ~8 s ou ao chegar na seção 2, o que vier primeiro. **Uma vez
  por visita**; some se fechado; pequeno no celular. Ao clicar, abre o chat com a pergunta do
  balão como primeira fala da IA.
- **Pergunta de abertura (mudança no CRM):** o `pageContext` ganha o campo `abertura` (texto do
  balão ou da pergunta pronta, higienizado e com teto de tamanho), guardado com o contexto e
  apresentado ao agente como contexto de sistema. Assim a IA sabe o que "ela" perguntou.
  Nunca entra como mensagem `role: user`.
- **Chat embutido:** a mesma sessão/conversa do widget flutuante, renderizada na seção 5. As
  perguntas prontas enviam a mensagem com um clique.
- **Conhecimento:** documento "Linha Green Turbo" na base de conhecimento do agente do canal
  Site, feito só com o material do usuário e aprovado por ele. Sem tabela de preço (trechos com
  "R$ número" já são descartados no site).
- **Kit:** "Kit GT para Poliborda" com os 7 grãos, 1 de cada; desconto definido pelo usuário.
- **Preço e fechamento:** sem mudança. Nome e WhatsApp antes do valor; valor dentro de
  R$ 2.000 / 20 un.; acima disso, vendedor; WhatsApp sempre como alternativa.

## 8. Desempenho, SEO, acessibilidade e medição

- **Meta:** LCP ≤ 2,5 s em celular 4G. A capa do topo é o elemento de LCP (prioridade alta); o
  vídeo entra depois.
- **SEO:** título, descrição e imagem de compartilhamento por linha; entrada no `sitemap.xml`;
  dados estruturados de linha de produto (`ProductGroup`/`ItemList`) apontando para as páginas
  técnicas dos grãos, sem preço.
- **Acessibilidade:** contraste de texto sobre vídeo (degradê por baixo), vídeos pausáveis,
  respeito a `prefers-reduced-motion`, balão e chat navegáveis por teclado.
- **Medição:** encaixe pronto para Pixel da Meta e GA4 (com aviso de cookies/LGPD), **desligado
  até o usuário decidir**. Até lá, a origem de cada conversa fica registrada no CRM.

## 9. Testes

- **Unitários:** schema do conteúdo (número sem fonte e depoimento sem autorização falham);
  peça sem material é omitida; nenhuma peça mostra preço; `pageContext` com item e `abertura`;
  produto fora do catálogo some da oferta.
- **CRM:** `abertura` higienizada, com teto, entregue ao agente como contexto e nunca como
  mensagem do usuário.
- **Navegador (e2e):** balão aparece uma vez por visita e não volta depois de fechado; pergunta
  pronta envia a mensagem; chat embutido e flutuante são a mesma conversa; faixa dos grãos
  revela a foto; vídeos não baixam antes da hora.
- **Velocidade:** Lighthouse da página de vendas antes de publicar.

## 10. Ordem de entrega

0. **Arrumar a casa:** retomar as fotos próprias (`feat/fotos-do-site` no CRM: migration
   `20260923000001` antes do deploy, merge, publicação); corrigir `IMAGENS_HOSTS_EXTRAS` no
   Easypanel; juntar `feat/site-vitrine-widget` na `main` do site.
1. **Construção:** molde + 10 peças, home e menu novos, página do Green Turbo com espaços
   "aguardando material", balão + chat embutido + perguntas prontas no widget, `abertura` no
   CRM. Nada vai ao ar.
2. **Conteúdo:** processar vídeos, escrever a copy (com aprovação), documento da IA e kit de 7
   grãos.
3. **Lançamento:** publicação e **teste ponta a ponta da IA**, agora obrigatório.

## 11. Material do usuário

1. Vídeo da poliborda trabalhando (topo).
2. Vídeos curtos das 4 razões: brilho, velocidade na produção, economia de tempo e dinheiro,
   satisfação do cliente.
3. Uma foto do brilho espelhado.
4. Depoimentos em vídeo, com autorização de cada cliente.
5. Dados técnicos e comparativos, com a fonte.
6. Respostas das dúvidas (durabilidade, entrega, pagamento…).
7. Percentual de desconto do kit.

## 12. Fora do escopo agora

- Páginas de vendas das outras linhas (usam o molde depois do piloto).
- Edição das páginas pelo CRM (o conteúdo fica no código nesta fase).
- Pixel/GA4 ligados e aviso de cookies (só o encaixe).
- Checkout ou preço no site.
- Tela no CRM para subir fotos produto a produto.
