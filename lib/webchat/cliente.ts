import type {
  Bolha,
  ContextoDaPagina,
  EstadoDoChat,
  FonteDeEventos,
  MensagemPublica,
} from "./tipos";

/** Prefixo que `lib/agent/run.ts`, no CRM, procura para injetar o resumo do site no prompt do WhatsApp. */
const PREFIXO_DO_SITE = "Oi! Vim do site.";
const TAMANHO_MAXIMO = 1000;

export type DepsDoChat = {
  crmUrl: string;
  chave: string;
  numeroFallback: string;
  fetchImpl?: typeof fetch;
  criarFonte?: (url: string) => FonteDeEventos;
  armazenamento?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

function linkDoWhatsapp(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(PREFIXO_DO_SITE)}`;
}

export class ClienteWebchat {
  estado: EstadoDoChat;

  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly criarFonte: (url: string) => FonteDeEventos;
  private readonly armazenamento: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  private readonly chaveGuardada: string;

  private token: string | null = null;
  private numero: string;
  private fonte: FonteDeEventos | null = null;
  private ouvintes = new Set<(estado: EstadoDoChat) => void>();
  /** Ids de mensagem já mostrados: o cursor do CRM é inclusivo e repete a última. */
  private vistas = new Set<string>();
  /** `msg_<clientMessageId>` dos envios desta aba, para o eco não duplicar a bolha. */
  private ecosEsperados = new Set<string>();
  private ultimoInstante: string | null = null;

  constructor(private readonly deps: DepsDoChat) {
    this.base = `${deps.crmUrl.replace(/\/+$/, "")}/api/public/webchat`;
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.criarFonte =
      deps.criarFonte ?? ((url: string) => new EventSource(url) as unknown as FonteDeEventos);
    this.armazenamento = deps.armazenamento ?? globalThis.localStorage;
    this.chaveGuardada = `webchat_token_${deps.chave}`;
    this.numero = deps.numeroFallback;
    this.estado = {
      fase: "fechado",
      bolhas: [],
      digitando: false,
      vendedorEntrou: false,
      linkDoWhatsapp: linkDoWhatsapp(deps.numeroFallback),
      ofereceuWhatsapp: false,
      aviso: null,
    };
  }

  aoMudar(ouvinte: (estado: EstadoDoChat) => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  private mudar(parcial: Partial<EstadoDoChat>): void {
    this.estado = { ...this.estado, ...parcial };
    for (const ouvinte of this.ouvintes) ouvinte(this.estado);
  }

  /**
   * Abre (ou retoma) a sessão. `reabrindo` existe para o 401 tentar exatamente
   * uma vez com a chave pública: sem isso, um segredo girado no canal viraria
   * laço infinito de sessão.
   */
  async abrir(turnstileToken: string | null = null, reabrindo = false): Promise<void> {
    this.mudar({ fase: "abrindo", aviso: null });
    this.token = this.token ?? this.armazenamento.getItem(this.chaveGuardada);

    const cabecalhos: Record<string, string> = { "content-type": "application/json" };
    if (this.token) cabecalhos["x-webchat-token"] = this.token;
    else cabecalhos["x-webchat-key"] = this.deps.chave;

    let resposta: Response;
    try {
      resposta = await this.fetchImpl(`${this.base}/session`, {
        method: "POST",
        headers: cabecalhos,
        body: JSON.stringify({ turnstileToken }),
      });
    } catch {
      this.cairParaWhatsapp("Não consegui falar com o atendimento agora. Continue pelo WhatsApp.");
      return;
    }

    if (resposta.status === 401 && this.token && !reabrindo) {
      this.esquecerToken();
      return this.abrir(turnstileToken, true);
    }
    if (!resposta.ok) {
      this.cairParaWhatsapp("O atendimento do site está indisponível. Continue pelo WhatsApp.");
      return;
    }

    const { data } = (await resposta.json()) as {
      data: { token: string; whatsappNumber: string | null; messages: MensagemPublica[] };
    };
    this.token = data.token;
    this.armazenamento.setItem(this.chaveGuardada, data.token);
    if (data.whatsappNumber) this.numero = data.whatsappNumber;

    this.mudar({
      fase: "pronto",
      linkDoWhatsapp: linkDoWhatsapp(this.numero),
      aviso: null,
    });
    for (const mensagem of data.messages) this.receber(mensagem);
  }

  private esquecerToken(): void {
    this.armazenamento.removeItem(this.chaveGuardada);
    this.token = null;
  }

  private cairParaWhatsapp(aviso: string): void {
    this.mudar({ fase: "degradado", aviso, linkDoWhatsapp: linkDoWhatsapp(this.numero) });
  }

  /** Transforma a mensagem do servidor em bolha, sem repetir nem ecoar o próprio envio. */
  private receber(mensagem: MensagemPublica): void {
    if (mensagem.createdAt && (!this.ultimoInstante || mensagem.createdAt > this.ultimoInstante)) {
      this.ultimoInstante = mensagem.createdAt;
    }
    if (mensagem.event === "handoff_whatsapp") {
      this.mudar({ ofereceuWhatsapp: true, linkDoWhatsapp: linkDoWhatsapp(this.numero) });
    }
    if (this.vistas.has(mensagem.id)) return;
    this.vistas.add(mensagem.id);
    // Evento puro não tem texto: só liga o botão, não vira bolha.
    if (mensagem.body === "") return;
    if (mensagem.externalId && this.ecosEsperados.has(mensagem.externalId)) return;

    this.mudar({
      bolhas: [
        ...this.estado.bolhas,
        { id: mensagem.id, de: mensagem.from, texto: mensagem.body, situacao: "entregue" },
      ],
    });
  }

  private marcar(id: string, situacao: Bolha["situacao"]): void {
    this.mudar({
      bolhas: this.estado.bolhas.map((bolha) => (bolha.id === id ? { ...bolha, situacao } : bolha)),
    });
  }

  async enviar(texto: string, contexto: ContextoDaPagina): Promise<void> {
    const limpo = texto.trim();
    if (!limpo || limpo.length > TAMANHO_MAXIMO) {
      this.mudar({ aviso: `A mensagem precisa ter de 1 a ${TAMANHO_MAXIMO} caracteres.` });
      return;
    }
    if (!this.token) {
      this.mudar({ aviso: "O chat ainda está abrindo. Tente de novo em instantes." });
      return;
    }

    const clientMessageId = crypto.randomUUID();
    const idLocal = `local_${clientMessageId}`;
    this.ecosEsperados.add(`msg_${clientMessageId}`);
    this.mudar({
      aviso: null,
      bolhas: [
        ...this.estado.bolhas,
        { id: idLocal, de: "cliente", texto: limpo, situacao: "enviando" },
      ],
    });

    let resposta: Response;
    try {
      resposta = await this.fetchImpl(`${this.base}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-webchat-token": this.token },
        body: JSON.stringify({ clientMessageId, body: limpo, pageContext: contexto }),
      });
    } catch {
      this.marcar(idLocal, "falhou");
      this.cairParaWhatsapp("Sua mensagem não chegou. Continue pelo WhatsApp.");
      return;
    }

    if (resposta.status === 429) {
      const espera = resposta.headers.get("retry-after");
      this.marcar(idLocal, "falhou");
      this.mudar({
        aviso: espera
          ? `Muitas mensagens seguidas. Aguarde ${espera} s e tente de novo.`
          : "Muitas mensagens seguidas. Aguarde um instante.",
      });
      return;
    }
    if (resposta.status === 401) {
      this.marcar(idLocal, "falhou");
      this.esquecerToken();
      await this.abrir();
      // O aviso vai DEPOIS de reabrir: `abrir` limpa o aviso, e a mensagem
      // realmente não foi entregue.
      this.mudar({ aviso: "Sua sessão foi reaberta. Envie a mensagem de novo." });
      return;
    }
    if (!resposta.ok) {
      this.marcar(idLocal, "falhou");
      this.mudar({ aviso: "Não consegui enviar agora. Tente de novo." });
      return;
    }

    this.marcar(idLocal, "entregue");
  }

  conectar(): void {
    if (!this.token) return;
    this.desconectar();

    let url = `${this.base}/stream?token=${encodeURIComponent(this.token)}`;
    if (this.ultimoInstante) url += `&after=${encodeURIComponent(this.ultimoInstante)}`;

    const fonte = this.criarFonte(url);
    this.fonte = fonte;
    fonte.addEventListener("mensagem", (evento) =>
      this.receber(JSON.parse(evento.data) as MensagemPublica),
    );
    fonte.addEventListener("digitando", (evento) =>
      this.mudar({ digitando: (JSON.parse(evento.data) as { digitando: boolean }).digitando }),
    );
    fonte.addEventListener("vendedor_entrou", () => this.mudar({ vendedorEntrou: true }));
    fonte.addEventListener("handoff_whatsapp", () =>
      this.mudar({ ofereceuWhatsapp: true, linkDoWhatsapp: linkDoWhatsapp(this.numero) }),
    );
    fonte.addEventListener("reconectar", () => this.conectar());
  }

  desconectar(): void {
    this.fonte?.close();
    this.fonte = null;
  }

  /** Leitura pontual (reabrir o painel, voltar de aba escondida). Nunca em laço: gasta cota. */
  async sincronizar(): Promise<void> {
    if (!this.token) return;
    const consulta = this.ultimoInstante ? `?after=${encodeURIComponent(this.ultimoInstante)}` : "";
    try {
      const resposta = await this.fetchImpl(`${this.base}/messages${consulta}`, {
        headers: { "x-webchat-token": this.token },
      });
      if (!resposta.ok) return;
      const { data } = (await resposta.json()) as {
        data: { messages: MensagemPublica[]; typing: boolean };
      };
      for (const mensagem of data.messages) this.receber(mensagem);
      this.mudar({ digitando: data.typing });
    } catch {
      // Silêncio de propósito: a sincronização é oportunista, o SSE é o caminho principal.
    }
  }

  encerrar(): void {
    this.desconectar();
    this.ouvintes.clear();
  }
}
