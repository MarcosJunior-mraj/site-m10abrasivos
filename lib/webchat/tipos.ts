/** Igual ao `PublicMessage` do CRM (`lib/webchat/queries.ts`). */
export type MensagemPublica = {
  id: string;
  from: "cliente" | "especialista";
  by: "cliente" | "ia" | "vendedor";
  body: string;
  createdAt: string;
  externalId: string | null;
  event: "handoff_whatsapp" | null;
};

/** Bolha na tela: mensagem do servidor ou envio ainda em trânsito. */
export type Bolha = {
  id: string;
  de: "cliente" | "especialista";
  texto: string;
  situacao: "enviando" | "entregue" | "falhou";
};

export type EstadoDoChat = {
  fase: "fechado" | "abrindo" | "pronto" | "degradado";
  bolhas: Bolha[];
  digitando: boolean;
  vendedorEntrou: boolean;
  /** Link do WhatsApp; existe sempre (fallback), vira o botão em destaque depois do handoff. */
  linkDoWhatsapp: string;
  ofereceuWhatsapp: boolean;
  aviso: string | null;
};

export type ContextoDaPagina = { url: string; item: string | null };

/** O que o cliente precisa de um `EventSource` — só isto, para o teste poder fingir. */
export interface FonteDeEventos {
  addEventListener(tipo: string, ouvinte: (evento: { data: string }) => void): void;
  close(): void;
  onerror: ((evento: unknown) => void) | null;
  /**
   * Espelha `readyState === EventSource.CLOSED`: diz se a fonte desistiu de
   * vez, em vez de estar só oscilando e prestes a reconectar sozinha.
   */
  estaFechada(): boolean;
}
