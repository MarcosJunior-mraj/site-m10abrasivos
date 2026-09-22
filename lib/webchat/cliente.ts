import type {
  Bolha,
  ContextoDaPagina,
  EstadoDoChat,
  FonteDeEventos,
  MensagemPublica,
} from "./tipos";
import { linkDoWhatsapp } from "./whatsapp";

const TAMANHO_MAXIMO = 1000;
/** Piso entre reconexões: o mesmo intervalo que o CRM manda no campo `retry:` do SSE. */
const RECONEXAO_INTERVALO_MINIMO_MS = 15_000;
/** Depois de tantas tentativas seguidas, desiste e oferece o WhatsApp em vez de girar gastando cota. */
const RECONEXAO_TENTATIVAS_MAXIMAS = 5;

export type DepsDoChat = {
  crmUrl: string;
  chave: string;
  numeroFallback: string;
  fetchImpl?: typeof fetch;
  criarFonte?: (url: string) => FonteDeEventos;
  armazenamento?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

/**
 * Adapta o `EventSource` real para `FonteDeEventos`, sem casting: a assinatura
 * de `onerror` do DOM não bate com a da interface, então guardamos o tratador
 * numa variável e expomos um par get/set com o tipo que a interface pede.
 */
function criarFonteViaEventSource(url: string): FonteDeEventos {
  const eventSource = new EventSource(url);
  let tratadorDeErro: ((evento: unknown) => void) | null = null;
  eventSource.onerror = (evento) => tratadorDeErro?.(evento);

  return {
    addEventListener(tipo: string, ouvinte: (evento: { data: string }) => void): void {
      eventSource.addEventListener(tipo, (evento: MessageEvent) => ouvinte({ data: evento.data }));
    },
    close(): void {
      eventSource.close();
    },
    estaFechada(): boolean {
      return eventSource.readyState === EventSource.CLOSED;
    },
    get onerror(): ((evento: unknown) => void) | null {
      return tratadorDeErro;
    },
    set onerror(ouvinte: ((evento: unknown) => void) | null) {
      tratadorDeErro = ouvinte;
    },
  };
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
  /** Segura chamadas concorrentes de `abrir()` na mesma promessa: dois cliques não abrem duas sessões. */
  private aberturaEmAndamento: Promise<void> | null = null;
  private ultimaReconexaoEm = 0;
  private tentativasDeReconexaoSeguidas = 0;

  constructor(private readonly deps: DepsDoChat) {
    this.base = `${deps.crmUrl.replace(/\/+$/, "")}/api/public/webchat`;
    // `.bind(globalThis)`: todo uso real chama `this.fetchImpl(...)`, ou
    // seja, com `this` apontando para a instância — e o `fetch` nativo do
    // navegador exige que o `this` da chamada seja a própria `Window`
    // (senão lança "Illegal invocation"). Sem o bind, a conversa nunca sai
    // do modo degradado num navegador de verdade; só não apareceu antes
    // porque todo teste de unidade injeta seu próprio `fetchImpl`.
    this.fetchImpl = deps.fetchImpl ?? fetch.bind(globalThis);
    this.criarFonte = deps.criarFonte ?? criarFonteViaEventSource;
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

  /** Lê o token guardado; armazenamento bloqueado (ex.: navegação anônima) vira "sem token", não exceção. */
  private lerTokenGuardado(): string | null {
    try {
      return this.armazenamento.getItem(this.chaveGuardada);
    } catch {
      return null;
    }
  }

  /** Guarda o token; se não der, a sessão desta aba segue normal, só não será retomável depois. */
  private guardarToken(token: string): void {
    try {
      this.armazenamento.setItem(this.chaveGuardada, token);
    } catch {
      // Silêncio de propósito: armazenamento indisponível não pode derrubar a abertura da sessão.
    }
  }

  private esquecerToken(): void {
    this.token = null;
    try {
      this.armazenamento.removeItem(this.chaveGuardada);
    } catch {
      // Sem armazenamento, não há o que de fato esquecer.
    }
  }

  /**
   * Abre (ou retoma) a sessão. Chamadas concorrentes recebem a mesma promessa
   * em vez de abrir uma segunda sessão — dois cliques rápidos (ou um efeito
   * que dispara duas vezes) não podem queimar cota nem criar uma corrida
   * sobre qual token vence.
   */
  async abrir(turnstileToken: string | null = null): Promise<void> {
    if (this.aberturaEmAndamento) return this.aberturaEmAndamento;

    const promessa = this.abrirFluxo(turnstileToken, false);
    this.aberturaEmAndamento = promessa;
    try {
      await promessa;
    } finally {
      this.aberturaEmAndamento = null;
    }
  }

  /**
   * `reabrindo` existe para o 401 tentar exatamente uma vez com a chave
   * pública: sem isso, um segredo girado no canal viraria laço infinito de
   * sessão. A recursão chama a si mesma diretamente (não `abrir`), para não
   * disputar com a própria promessa que `abrir` está montando.
   */
  private async abrirFluxo(turnstileToken: string | null, reabrindo: boolean): Promise<void> {
    this.mudar({ fase: "abrindo", aviso: null });
    this.token = this.token ?? this.lerTokenGuardado();

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
      return this.abrirFluxo(turnstileToken, true);
    }
    if (!resposta.ok) {
      this.cairParaWhatsapp("O atendimento do site está indisponível. Continue pelo WhatsApp.");
      return;
    }

    const { data } = (await resposta.json()) as {
      data: { token: string; whatsappNumber: string | null; messages: MensagemPublica[] };
    };
    this.token = data.token;
    this.guardarToken(data.token);
    if (data.whatsappNumber) this.numero = data.whatsappNumber;

    this.mudar({
      fase: "pronto",
      linkDoWhatsapp: linkDoWhatsapp(this.numero),
      aviso: null,
    });
    for (const mensagem of data.messages) this.receber(mensagem);
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
    fonte.addEventListener("mensagem", (evento) => this.tratarMensagemRecebida(evento));
    fonte.addEventListener("digitando", (evento) => this.tratarDigitando(evento));
    fonte.addEventListener("vendedor_entrou", () => {
      this.marcarConexaoSaudavel();
      this.mudar({ vendedorEntrou: true });
    });
    fonte.addEventListener("handoff_whatsapp", () => {
      this.marcarConexaoSaudavel();
      this.mudar({ ofereceuWhatsapp: true, linkDoWhatsapp: linkDoWhatsapp(this.numero) });
    });
    fonte.addEventListener("reconectar", () => this.tentarReconectar());
    fonte.onerror = () => {
      // Oscilação passageira (readyState ainda CONNECTING): o próprio
      // EventSource já vai reconectar sozinho, não há nada a fazer aqui.
      if (!fonte.estaFechada()) return;
      this.desconectar();
      this.cairParaWhatsapp("A conexão com o atendimento caiu. Continue pelo WhatsApp.");
    };
  }

  /** Payload malformado não pode derrubar o listener nem sumir sem rastro: ignora só aquele evento. */
  private tratarMensagemRecebida(evento: { data: string }): void {
    this.marcarConexaoSaudavel();
    try {
      const mensagem = JSON.parse(evento.data) as MensagemPublica;
      this.receber(mensagem);
    } catch {
      // Mesma tolerância do parse abaixo: um evento ruim não é motivo para travar o chat.
    }
  }

  private tratarDigitando(evento: { data: string }): void {
    this.marcarConexaoSaudavel();
    try {
      const dados = JSON.parse(evento.data) as { digitando: boolean };
      this.mudar({ digitando: dados.digitando });
    } catch {
      // Ignora o evento malformado; o indicador simplesmente não muda desta vez.
    }
  }

  /** Um evento de verdade prova que a conexão está viva: zera o contador do freio de reconexão. */
  private marcarConexaoSaudavel(): void {
    this.tentativasDeReconexaoSeguidas = 0;
  }

  /**
   * Freio contra rajada: piso de `RECONEXAO_INTERVALO_MINIMO_MS` entre
   * tentativas (o `retry:` que o CRM manda no SSE) e teto de tentativas
   * seguidas, depois do qual desiste e oferece o WhatsApp em vez de girar
   * gastando a cota de 20 requisições/minuto.
   */
  private tentarReconectar(): void {
    const agora = Date.now();
    if (agora - this.ultimaReconexaoEm < RECONEXAO_INTERVALO_MINIMO_MS) return;

    if (this.tentativasDeReconexaoSeguidas >= RECONEXAO_TENTATIVAS_MAXIMAS) {
      this.desconectar();
      this.cairParaWhatsapp(
        "Perdi a conexão com o atendimento depois de várias tentativas. Continue pelo WhatsApp.",
      );
      return;
    }

    this.ultimaReconexaoEm = agora;
    this.tentativasDeReconexaoSeguidas += 1;
    this.conectar();
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
