import { describe, expect, it, vi } from "vitest";
import { ClienteWebchat } from "@/lib/webchat/cliente";
import type { FonteDeEventos, MensagemPublica } from "@/lib/webchat/tipos";

const CRM = "https://crm.exemplo";
const CHAVE = "m10chat_abc";
const NUMERO = "5511999999999";

function mensagem(parcial: Partial<MensagemPublica>): MensagemPublica {
  return {
    id: "m1",
    from: "especialista",
    by: "ia",
    body: "Olá!",
    createdAt: "2026-09-21T10:00:00.000Z",
    externalId: null,
    event: null,
    ...parcial,
  };
}

class FonteFalsa implements FonteDeEventos {
  ouvintes = new Map<string, (evento: { data: string }) => void>();
  fechada = false;
  onerror: ((evento: unknown) => void) | null = null;

  addEventListener(tipo: string, ouvinte: (evento: { data: string }) => void): void {
    this.ouvintes.set(tipo, ouvinte);
  }
  close(): void {
    this.fechada = true;
  }
  emitir(tipo: string, dados: unknown): void {
    this.ouvintes.get(tipo)?.({ data: JSON.stringify(dados) });
  }
}

function memoria() {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
    removeItem: (chave: string) => void dados.delete(chave),
  };
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function montar(
  respostas: Response[],
  armazenamento: Pick<Storage, "getItem" | "setItem" | "removeItem"> = memoria(),
) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const fontes: FonteFalsa[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init: init ?? {} });
    return respostas.shift() ?? json({ error: "sem resposta preparada" }, 500);
  }) as unknown as typeof fetch;

  const cliente = new ClienteWebchat({
    crmUrl: CRM,
    chave: CHAVE,
    numeroFallback: NUMERO,
    fetchImpl,
    armazenamento,
    criarFonte: (url: string) => {
      const fonte = new FonteFalsa();
      fontes.push(Object.assign(fonte, { url }));
      return fonte;
    },
  });

  return { cliente, chamadas, fontes, armazenamento };
}

const SESSAO_OK = {
  data: {
    token: "token-1",
    expiresAt: "2026-10-21T10:00:00.000Z",
    whatsappNumber: NUMERO,
    messages: [mensagem({ id: "antiga", body: "Bem-vindo" })],
  },
};

describe("abertura de sessão", () => {
  it("abre com a chave pública e carrega o histórico", async () => {
    const { cliente, chamadas, armazenamento } = montar([json(SESSAO_OK)]);
    await cliente.abrir();

    const cabecalhos = chamadas[0]?.init.headers as Record<string, string>;
    expect(chamadas[0]?.url).toBe(`${CRM}/api/public/webchat/session`);
    expect(cabecalhos["x-webchat-key"]).toBe(CHAVE);
    expect(cabecalhos["x-webchat-token"]).toBeUndefined();
    expect(cliente.estado.fase).toBe("pronto");
    expect(cliente.estado.bolhas.map((b) => b.texto)).toEqual(["Bem-vindo"]);
    expect(armazenamento.getItem(`webchat_token_${CHAVE}`)).toBe("token-1");
  });

  it("retoma com o token guardado", async () => {
    const guardado = memoria();
    guardado.setItem(`webchat_token_${CHAVE}`, "token-velho");
    const { cliente, chamadas } = montar([json(SESSAO_OK)], guardado);
    await cliente.abrir();

    const cabecalhos = chamadas[0]?.init.headers as Record<string, string>;
    expect(cabecalhos["x-webchat-token"]).toBe("token-velho");
  });

  it("token vencido: joga fora e reabre pela chave, uma vez só", async () => {
    const guardado = memoria();
    guardado.setItem(`webchat_token_${CHAVE}`, "token-velho");
    const { cliente, chamadas } = montar(
      [json({ error: "expirado" }, 401), json(SESSAO_OK)],
      guardado,
    );

    await cliente.abrir();

    expect(chamadas).toHaveLength(2);
    expect((chamadas[1]?.init.headers as Record<string, string>)["x-webchat-key"]).toBe(CHAVE);
    expect(cliente.estado.fase).toBe("pronto");
  });

  it("401 em série não vira laço infinito", async () => {
    const guardado = memoria();
    guardado.setItem(`webchat_token_${CHAVE}`, "token-velho");
    const { cliente, chamadas } = montar([json({}, 401), json({}, 401)], guardado);

    await cliente.abrir();

    expect(chamadas).toHaveLength(2);
    expect(cliente.estado.fase).toBe("degradado");
  });

  it("CRM fora do ar: modo degradado com o número de reserva", async () => {
    const quebrado = vi.fn(async () => {
      throw new Error("falha de rede");
    }) as unknown as typeof fetch;
    const cliente = new ClienteWebchat({
      crmUrl: CRM,
      chave: CHAVE,
      numeroFallback: NUMERO,
      fetchImpl: quebrado,
      armazenamento: memoria(),
      criarFonte: () => new FonteFalsa(),
    });

    await cliente.abrir();

    expect(cliente.estado.fase).toBe("degradado");
    expect(cliente.estado.linkDoWhatsapp).toBe(
      `https://wa.me/${NUMERO}?text=Oi!%20Vim%20do%20site.`,
    );
    expect(cliente.estado.aviso).toMatch(/WhatsApp/i);
  });
});

describe("envio", () => {
  it("mostra a bolha na hora e não duplica quando o eco volta", async () => {
    const { cliente, chamadas, fontes } = montar([
      json(SESSAO_OK),
      json({ data: { ok: true } }, 202),
    ]);
    await cliente.abrir();
    cliente.conectar();

    await cliente.enviar("Preciso de disco para quartzito", {
      url: "https://site/produto/gt-50",
      item: "GT #50",
    });

    const corpo = JSON.parse(String(chamadas[1]?.init.body)) as {
      clientMessageId: string;
      body: string;
      pageContext: { url: string; item: string };
    };
    expect(corpo.body).toBe("Preciso de disco para quartzito");
    expect(corpo.pageContext.item).toBe("GT #50");
    expect(cliente.estado.bolhas.at(-1)).toMatchObject({ de: "cliente", situacao: "entregue" });

    const eco = mensagem({
      id: "servidor-1",
      from: "cliente",
      by: "cliente",
      body: "Preciso de disco para quartzito",
      externalId: `msg_${corpo.clientMessageId}`,
    });
    fontes[0]?.emitir("mensagem", eco);

    expect(cliente.estado.bolhas.filter((b) => b.texto.includes("quartzito"))).toHaveLength(1);
  });

  it("429 avisa a cota sem repetir o envio", async () => {
    const { cliente, chamadas } = montar([
      json(SESSAO_OK),
      new Response(JSON.stringify({ error: "muitas" }), {
        status: 429,
        headers: { "retry-after": "30" },
      }),
    ]);
    await cliente.abrir();

    await cliente.enviar("oi", { url: "https://site", item: null });

    expect(chamadas).toHaveLength(2);
    expect(cliente.estado.aviso).toMatch(/30 s|aguarde/i);
    expect(cliente.estado.bolhas.at(-1)?.situacao).toBe("falhou");
  });

  it("401 reabre a sessão e pede para enviar de novo", async () => {
    const { cliente } = montar([
      json(SESSAO_OK),
      json({ error: "expirado" }, 401),
      json(SESSAO_OK),
    ]);
    await cliente.abrir();

    await cliente.enviar("oi", { url: "https://site", item: null });

    expect(cliente.estado.aviso).toMatch(/envie a mensagem de novo/i);
    expect(cliente.estado.bolhas.at(-1)?.situacao).toBe("falhou");
  });

  it("recusa texto vazio ou acima de 1000 caracteres antes de gastar cota", async () => {
    const { cliente, chamadas } = montar([json(SESSAO_OK)]);
    await cliente.abrir();

    await cliente.enviar("   ", { url: "https://site", item: null });
    await cliente.enviar("x".repeat(1001), { url: "https://site", item: null });

    expect(chamadas).toHaveLength(1);
    expect(cliente.estado.aviso).toMatch(/1000/);
  });
});

describe("fluxo de eventos", () => {
  it("liga e desliga o indicador de digitação e anuncia o vendedor", async () => {
    const { cliente, fontes } = montar([json(SESSAO_OK)]);
    await cliente.abrir();
    cliente.conectar();

    fontes[0]?.emitir("digitando", { digitando: true });
    expect(cliente.estado.digitando).toBe(true);
    fontes[0]?.emitir("digitando", { digitando: false });
    expect(cliente.estado.digitando).toBe(false);

    fontes[0]?.emitir("vendedor_entrou", { em: "2026-09-21T10:05:00.000Z" });
    expect(cliente.estado.vendedorEntrou).toBe(true);
  });

  it("handoff não vira bolha e liga o botão do WhatsApp com o prefixo exato", async () => {
    const { cliente, fontes } = montar([json(SESSAO_OK)]);
    await cliente.abrir();
    cliente.conectar();

    const antes = cliente.estado.bolhas.length;
    fontes[0]?.emitir("mensagem", mensagem({ id: "evento", body: "", event: "handoff_whatsapp" }));
    fontes[0]?.emitir("handoff_whatsapp", { mensagemId: "evento" });

    expect(cliente.estado.bolhas).toHaveLength(antes);
    expect(cliente.estado.ofereceuWhatsapp).toBe(true);
    expect(cliente.estado.linkDoWhatsapp).toBe(
      `https://wa.me/${NUMERO}?text=Oi!%20Vim%20do%20site.`,
    );
  });

  it("evento reconectar fecha a fonte e abre outra", async () => {
    const { cliente, fontes } = montar([json(SESSAO_OK)]);
    await cliente.abrir();
    cliente.conectar();

    fontes[0]?.emitir("reconectar", {});

    expect(fontes[0]?.fechada).toBe(true);
    expect(fontes).toHaveLength(2);
  });

  it("sincronizar descarta a mensagem do cursor, que sempre volta", async () => {
    const jaVista = mensagem({ id: "m1", body: "Bem-vindo" });
    const { cliente } = montar([
      json({ data: { token: "t", expiresAt: "", whatsappNumber: NUMERO, messages: [jaVista] } }),
      json({ data: { messages: [jaVista, mensagem({ id: "m2", body: "Nova" })], typing: false } }),
    ]);
    await cliente.abrir();

    await cliente.sincronizar();

    expect(cliente.estado.bolhas.map((b) => b.texto)).toEqual(["Bem-vindo", "Nova"]);
  });

  it("onerror do EventSource cai para o WhatsApp em vez de ficar mudo", async () => {
    const { cliente, fontes } = montar([json(SESSAO_OK)]);
    await cliente.abrir();
    cliente.conectar();

    fontes[0]?.onerror?.(new Event("error"));

    expect(cliente.estado.fase).toBe("degradado");
    expect(cliente.estado.aviso).toMatch(/whatsapp/i);
  });

  it("mensagem malformada no SSE não derruba o cliente nem some sem rastro", async () => {
    const { cliente, fontes } = montar([json(SESSAO_OK)]);
    await cliente.abrir();
    cliente.conectar();

    expect(() =>
      fontes[0]?.ouvintes.get("mensagem")?.({ data: "{ isto não é json" }),
    ).not.toThrow();
    expect(cliente.estado.fase).toBe("pronto");

    expect(() =>
      fontes[0]?.ouvintes.get("digitando")?.({ data: "{ isto também não é json" }),
    ).not.toThrow();
    expect(cliente.estado.digitando).toBe(false);
  });

  it("rajada de eventos reconectar não abre várias conexões seguidas", async () => {
    vi.useFakeTimers();
    try {
      const { cliente, fontes } = montar([json(SESSAO_OK)]);
      await cliente.abrir();
      cliente.conectar();

      fontes[0]?.emitir("reconectar", {});
      fontes[1]?.emitir("reconectar", {});
      fontes[1]?.emitir("reconectar", {});

      expect(fontes).toHaveLength(2);

      vi.advanceTimersByTime(15_000);
      fontes[1]?.emitir("reconectar", {});

      expect(fontes).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("depois de várias tentativas seguidas de reconectar, desiste e oferece o WhatsApp", async () => {
    vi.useFakeTimers();
    try {
      const { cliente, fontes } = montar([json(SESSAO_OK)]);
      await cliente.abrir();
      cliente.conectar();

      // O teto é 5 tentativas seguidas; a 6ª rajada (já espaçada pelo piso de 15 s) desiste.
      for (let tentativa = 0; tentativa < 6; tentativa += 1) {
        vi.advanceTimersByTime(15_000);
        fontes.at(-1)?.emitir("reconectar", {});
      }

      expect(cliente.estado.fase).toBe("degradado");
      expect(cliente.estado.aviso).toMatch(/whatsapp/i);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("reentrância de abrir()", () => {
  it("duas chamadas sem esperar uma acabar geram uma única requisição de sessão", async () => {
    const { cliente, chamadas } = montar([json(SESSAO_OK)]);

    const p1 = cliente.abrir();
    const p2 = cliente.abrir();
    await Promise.all([p1, p2]);

    expect(chamadas).toHaveLength(1);
    expect(cliente.estado.fase).toBe("pronto");
  });
});

describe("armazenamento indisponível", () => {
  function armazenamentoQuebrado(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
    return {
      getItem: (): string | null => {
        throw new Error("armazenamento bloqueado");
      },
      setItem: (): void => {
        throw new Error("armazenamento bloqueado");
      },
      removeItem: (): void => {
        throw new Error("armazenamento bloqueado");
      },
    };
  }

  it("getItem/setItem que lançam não travam o widget em 'abrindo'", async () => {
    const { cliente } = montar([json(SESSAO_OK)], armazenamentoQuebrado());

    await cliente.abrir();

    expect(cliente.estado.fase).not.toBe("abrindo");
    expect(["pronto", "degradado"]).toContain(cliente.estado.fase);
  });
});
