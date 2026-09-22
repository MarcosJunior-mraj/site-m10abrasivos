import type { EstadoDoChat } from "@/lib/webchat/tipos";

type DepsFalsas = { crmUrl: string; chave: string; numeroFallback: string };

function estadoInicial(): EstadoDoChat {
  return {
    fase: "fechado",
    bolhas: [],
    digitando: false,
    vendedorEntrou: false,
    linkDoWhatsapp: "https://wa.me/5511999999999?text=Oi!%20Vim%20do%20site.",
    ofereceuWhatsapp: false,
    aviso: null,
  };
}

/**
 * Dublê de `ClienteWebchat` (Tarefa 11) para testar `Widget` sem tocar rede.
 * Reproduz só o que o widget usa: `estado`, `aoMudar`, `abrir`, `enviar`,
 * `conectar`, `desconectar`, `sincronizar`, `encerrar` — e `emitir`, um
 * auxiliar de teste que simula uma atualização vinda do núcleo (SSE, resposta
 * do especialista etc.), sem existir na classe real.
 */
export class ClienteWebchatFalso {
  static instancias: ClienteWebchatFalso[] = [];

  estado: EstadoDoChat;
  chamadasDeSincronizar = 0;

  private ouvintesDeMudanca: Array<(estado: EstadoDoChat) => void> = [];

  constructor(_deps: DepsFalsas) {
    this.estado = estadoInicial();
    ClienteWebchatFalso.instancias.push(this);
  }

  aoMudar(ouvinte: (estado: EstadoDoChat) => void): () => void {
    this.ouvintesDeMudanca.push(ouvinte);
    return () => {
      this.ouvintesDeMudanca = this.ouvintesDeMudanca.filter((atual) => atual !== ouvinte);
    };
  }

  private mudar(parcial: Partial<EstadoDoChat>): void {
    this.estado = { ...this.estado, ...parcial };
    for (const ouvinte of this.ouvintesDeMudanca) ouvinte(this.estado);
  }

  async abrir(_turnstileToken: string | null = null): Promise<void> {
    this.mudar({ fase: "pronto" });
  }

  async enviar(_texto: string, _contexto: unknown): Promise<void> {
    // Sem efeito de propósito: os testes acionam a contingência simulando o
    // núcleo diretamente via `emitir`, não através de um envio de verdade.
  }

  conectar(): void {}

  desconectar(): void {}

  async sincronizar(): Promise<void> {
    this.chamadasDeSincronizar += 1;
  }

  /** Espelha `ClienteWebchat.encerrar()`: solta todos os ouvintes. */
  encerrar(): void {
    this.ouvintesDeMudanca = [];
  }

  /** Auxiliar de teste: simula uma atualização vinda do núcleo. */
  emitir(parcial: Partial<EstadoDoChat>): void {
    this.mudar(parcial);
  }
}
