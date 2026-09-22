import { createServer } from "node:http";

const PORTA = 3101;

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-webchat-key, x-webchat-token, x-catalog-key",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
};

/** JPEG de 1×1 pixel, o bastante para o `next/image` e para a rota de imagem. */
const FOTO = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
    "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

function item(
  slug: string,
  title: string,
  grit: string | null,
  stones: string[],
  applications: string[],
  kind: "product" | "kit" = "product",
) {
  return {
    slug,
    kind,
    title,
    description: null,
    images: [`http://localhost:${PORTA}/foto.jpg`],
    category: { name: "Abrasivos para poliborda", slug: "abrasivos-para-poliborda" },
    stones,
    applications,
    grit,
    diameterMm: 125,
    machines: ["Poliborda"],
    specs: {},
    isFeatured: true,
    seoTitle: null,
    seoDescription: null,
    updatedAt: "2026-09-20T10:00:00.000Z",
    components: kind === "kit" ? [{ title: "Green Turbo #50", slug: "gt-50", quantity: 2 }] : [],
  };
}

const ITENS = [
  item("gt-50", "Green Turbo #50", "50", ["granito"], ["desbaste"]),
  item("gt-400", "Green Turbo #400", "400", ["marmore"], ["polimento"]),
  item("kit-gt", "Kit GT para poliborda", null, [], [], "kit"),
];

const CATEGORIAS = [
  {
    name: "Abrasivos para poliborda",
    slug: "abrasivos-para-poliborda",
    description: null,
    imageUrl: null,
  },
];

type MensagemArmazenada = {
  id: string;
  from: "cliente" | "especialista";
  by: "cliente" | "ia" | "vendedor";
  body: string;
  createdAt: string;
  externalId: string | null;
  event: "handoff_whatsapp" | null;
};

/**
 * Estado mutável do CRM falso, para as verificações adiadas (Tarefa 13):
 * contagem de requisições por rota (varredura de cache do catálogo) e o
 * histórico da conversa (para a sessão sobreviver a um `location.reload()`).
 * Fica tudo num processo único, compartilhado pelo build e por todos os
 * testes — por isso os testes de chat zeram esse estado no `beforeEach`.
 */
const contagem: Record<string, number> = {};
const mensagensDaConversa: MensagemArmazenada[] = [];
let contadorDeMensagens = 0;
let catalogoDesligado = false;

function registrar(caminho: string): void {
  contagem[caminho] = (contagem[caminho] ?? 0) + 1;
}

const servidor = createServer((requisicao, resposta) => {
  const url = new URL(requisicao.url ?? "/", `http://localhost:${PORTA}`);
  const json = (corpo: unknown, status = 200) => {
    resposta.writeHead(status, { "content-type": "application/json", ...CORS });
    resposta.end(JSON.stringify(corpo));
  };

  if (requisicao.method === "OPTIONS") {
    resposta.writeHead(204, CORS);
    return resposta.end();
  }

  // Rotas de diagnóstico ficam fora do prefixo `/api/public` de propósito:
  // não fazem parte do contrato com o CRM de verdade, só existem para o
  // teste enxergar o que aconteceu do lado de dentro do dublê.
  if (url.pathname === "/_contagem" && requisicao.method === "GET") {
    return json({ data: contagem });
  }
  if (url.pathname === "/_zerar" && requisicao.method === "POST") {
    for (const chave of Object.keys(contagem)) delete contagem[chave];
    mensagensDaConversa.length = 0;
    contadorDeMensagens = 0;
    catalogoDesligado = false;
    return json({ data: { ok: true } });
  }
  if (url.pathname === "/_desligar_catalogo" && requisicao.method === "POST") {
    catalogoDesligado = true;
    return json({ data: { ok: true } });
  }

  // Inclui a query string: `/items` e `/items?category=X` são URLs (e
  // portanto entradas de cache) diferentes — contar só o caminho juntaria
  // as duas.
  if (url.pathname !== "/foto.jpg") registrar(url.pathname + url.search);

  if (url.pathname === "/foto.jpg") {
    resposta.writeHead(200, { "content-type": "image/jpeg" });
    return resposta.end(FOTO);
  }

  if (url.pathname.startsWith("/api/public/catalog/") && catalogoDesligado) {
    return json({ error: "CRM fora do ar (simulado)" }, 500);
  }

  if (url.pathname === "/api/public/catalog/items") {
    const categoria = url.searchParams.get("category");
    return json({
      data: ITENS.filter((linha) => !categoria || linha.category.slug === categoria).map(
        (linha) => ({
          ...linha,
          components: [],
        }),
      ),
    });
  }

  if (url.pathname.startsWith("/api/public/catalog/items/")) {
    const slug = url.pathname.split("/").pop();
    const achado = ITENS.find((linha) => linha.slug === slug);
    return achado ? json({ data: achado }) : json({ error: "Item não encontrado." }, 404);
  }

  if (url.pathname === "/api/public/catalog/categories") return json({ data: CATEGORIAS });

  if (url.pathname === "/api/public/webchat/session") {
    // Devolve o histórico acumulado: é o que deixa a conversa sobreviver a
    // um recarregamento de página dentro do mesmo teste.
    return json({
      data: {
        token: "token-de-teste",
        expiresAt: "2026-10-21T10:00:00.000Z",
        whatsappNumber: "5511999999999",
        messages: [...mensagensDaConversa],
      },
    });
  }

  if (url.pathname === "/api/public/webchat/messages" && requisicao.method === "POST") {
    let corpo = "";
    requisicao.on("data", (parte) => {
      corpo += parte;
    });
    requisicao.on("end", () => {
      const texto = String((JSON.parse(corpo) as { body?: string }).body ?? "");
      contadorDeMensagens += 1;
      mensagensDaConversa.push({
        id: `msg_srv_${contadorDeMensagens}`,
        from: "cliente",
        by: "cliente",
        body: texto,
        createdAt: new Date().toISOString(),
        externalId: null,
        event: null,
      });
      json({ data: { ok: true, clientMessageId: "x" } }, 202);
    });
    return undefined;
  }

  if (url.pathname === "/api/public/webchat/messages") {
    return json({ data: { messages: [], typing: false } });
  }

  if (url.pathname === "/api/public/webchat/stream") {
    resposta.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      ...CORS,
    });
    resposta.write("retry: 15000\n\n");

    const enviar = (evento: string, dados: unknown) =>
      resposta.write(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`);

    const temporizadores = [
      setTimeout(() => enviar("digitando", { digitando: true }), 200),
      setTimeout(() => {
        enviar("digitando", { digitando: false });
        enviar("mensagem", {
          id: `m_${Date.now()}`,
          from: "especialista",
          by: "ia",
          body: "Posso te ajudar a escolher a grana certa.",
          createdAt: new Date().toISOString(),
          externalId: null,
          event: null,
        });
        // Lida no momento em que o temporizador dispara (não na abertura da
        // conexão): a mensagem que decide o handoff pode chegar depois que o
        // SSE já está conectado.
        const ultimaMensagem = mensagensDaConversa.at(-1)?.body ?? "";
        if (/whatsapp/i.test(ultimaMensagem)) {
          enviar("mensagem", {
            id: `evento_${Date.now()}`,
            from: "especialista",
            by: "ia",
            body: "",
            createdAt: new Date().toISOString(),
            externalId: null,
            event: "handoff_whatsapp",
          });
          enviar("handoff_whatsapp", { mensagemId: `evento_${Date.now()}` });
        }
      }, 600),
    ];

    requisicao.on("close", () => {
      for (const temporizador of temporizadores) clearTimeout(temporizador);
    });
    return undefined;
  }

  return json({ error: "rota não prevista no CRM falso" }, 404);
});

servidor.listen(PORTA, () => process.stdout.write(`CRM falso em http://localhost:${PORTA}\n`));
