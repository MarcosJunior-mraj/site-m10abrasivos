import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enviar = vi.fn().mockResolvedValue(undefined);
const sincronizar = vi.fn().mockResolvedValue(undefined);
/** Controle do cliente falso: histórico que a sessão traz e uma abertura de sessão que o teste segura. */
const controle = vi.hoisted(() => ({
  historico: [] as {
    id: string;
    de: "cliente" | "especialista";
    texto: string;
    situacao: string;
  }[],
  abrir: null as Promise<void> | null,
}));
vi.mock("@/lib/webchat/cliente", () => ({
  ClienteWebchat: class {
    estado = {
      fase: "pronto",
      bolhas: [...controle.historico],
      digitando: false,
      vendedorEntrou: false,
      linkDoWhatsapp: "https://wa.me/1",
      ofereceuWhatsapp: false,
      aviso: null,
    };
    private ouvintes: ((e: unknown) => void)[] = [];
    aoMudar(cb: (e: unknown) => void) {
      this.ouvintes.push(cb);
      cb(this.estado);
    }
    abrir = vi.fn(() => controle.abrir ?? Promise.resolve());
    conectar = vi.fn();
    sincronizar = sincronizar;
    /** Como o de verdade: a mensagem do visitante vira bolha — a conversa deixa de estar vazia. */
    enviar = (texto: string, contexto: unknown) => {
      this.estado = {
        ...this.estado,
        bolhas: [
          ...this.estado.bolhas,
          { id: `local_${texto}`, de: "cliente", texto, situacao: "entregue" },
        ],
      };
      for (const ouvinte of this.ouvintes) ouvinte(this.estado);
      return enviar(texto, contexto);
    };
    encerrar = vi.fn();
    desconectar = vi.fn();
    cairParaWhatsapp = vi.fn();
  },
}));
vi.mock("@/components/chat/turnstile", () => ({
  resolverTurnstile: vi.fn().mockResolvedValue(null),
}));

import { Widget } from "@/components/chat/widget";

/** Ouvintes que um teste pendura em `window`: saem no `afterEach`, sem vazar para o próximo. */
const limpezas: Array<() => void> = [];

beforeEach(() => {
  enviar.mockClear();
  sincronizar.mockClear();
  controle.historico = [];
  controle.abrir = null;
  localStorage.setItem("m10_lgpd_aceito", "1");
});

afterEach(() => {
  for (const limpar of limpezas.splice(0)) limpar();
});

describe("Widget — abertura e mensagem pronta", () => {
  it("abertura aparece como primeira fala da IA e vai no contexto do envio", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <button
          type="button"
          data-abrir-chat=""
          data-item="Linha Green Turbo"
          data-abertura="Qual pedra você está polindo hoje?"
        >
          balão
        </button>
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("balão"));
    expect(await screen.findByText("Qual pedra você está polindo hoje?")).toBeTruthy();
    await usuario.type(await screen.findByRole("textbox", { name: /mensagem/i }), "Granito{Enter}");
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith("Granito", {
        url: expect.any(String),
        item: "Linha Green Turbo",
        abertura: "Qual pedra você está polindo hoje?",
      }),
    );
  });

  it("mensagem pronta é enviada sozinha ao abrir", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <button
          type="button"
          data-abrir-chat=""
          data-item="Linha Green Turbo"
          data-mensagem="Serve para quartzito?"
        >
          chip
        </button>
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("chip"));
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith("Serve para quartzito?", {
        url: expect.any(String),
        item: "Linha Green Turbo",
        abertura: null,
      }),
    );
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("botão sem abertura não inventa fala da IA", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <button type="button" data-abrir-chat="">
          abrir
        </button>
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("abrir"));
    await screen.findByRole("dialog");
    expect(screen.getByRole("log").textContent).toBe("");
  });

  it("fecha sem enviar e reabre pelo botão flutuante: a abertura abandonada não vaza", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <button
          type="button"
          data-abrir-chat=""
          data-item="Linha Green Turbo"
          data-abertura="Qual pedra você está polindo hoje?"
        >
          balão
        </button>
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("balão"));
    expect(await screen.findByText("Qual pedra você está polindo hoje?")).toBeTruthy();

    await usuario.click(screen.getByRole("button", { name: /fechar conversa/i }));
    await usuario.click(screen.getByTestId("botao-chat"));
    await screen.findByRole("textbox", { name: /mensagem/i });

    expect(screen.queryByText("Qual pedra você está polindo hoje?")).toBeNull();

    await usuario.type(screen.getByRole("textbox", { name: /mensagem/i }), "Oi{Enter}");
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith("Oi", {
        url: expect.any(String),
        item: "Linha Green Turbo",
        abertura: null,
      }),
    );
  });

  it("depois de enviar durante a abertura, reabrir pelo botão flutuante mantém a bolha (é histórico)", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <button
          type="button"
          data-abrir-chat=""
          data-item="Linha Green Turbo"
          data-abertura="Qual pedra você está polindo hoje?"
        >
          balão
        </button>
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("balão"));
    expect(await screen.findByText("Qual pedra você está polindo hoje?")).toBeTruthy();

    await usuario.type(await screen.findByRole("textbox", { name: /mensagem/i }), "Granito{Enter}");
    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));

    await usuario.click(screen.getByRole("button", { name: /fechar conversa/i }));
    await usuario.click(screen.getByTestId("botao-chat"));
    await screen.findByRole("textbox", { name: /mensagem/i });

    expect(screen.getByText("Qual pedra você está polindo hoje?")).toBeTruthy();
  });

  it("abre com abertura A, fecha, abre de novo com abertura B: só B aparece", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <button
          type="button"
          data-abrir-chat=""
          data-item="Linha Green Turbo"
          data-abertura="Abertura A"
        >
          gatilho A
        </button>
        <button
          type="button"
          data-abrir-chat=""
          data-item="Linha Green Turbo"
          data-abertura="Abertura B"
        >
          gatilho B
        </button>
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("gatilho A"));
    expect(await screen.findByText("Abertura A")).toBeTruthy();

    await usuario.click(screen.getByRole("button", { name: /fechar conversa/i }));
    await usuario.click(screen.getByText("gatilho B"));
    await screen.findByRole("textbox", { name: /mensagem/i });

    expect(screen.queryByText("Abertura A")).toBeNull();
    expect(screen.getByText("Abertura B")).toBeTruthy();
  });

  it("dispara evento m10:chat-aberto ao abrir", async () => {
    const usuario = userEvent.setup();
    const eventos: Event[] = [];
    const anotar = (e: Event) => eventos.push(e);
    window.addEventListener("m10:chat-aberto", anotar);
    limpezas.push(() => window.removeEventListener("m10:chat-aberto", anotar));
    render(
      <>
        <button
          type="button"
          data-abrir-chat=""
          data-item="Linha Green Turbo"
          data-abertura="Qual pedra você está polindo hoje?"
        >
          balão
        </button>
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("balão"));
    expect(await screen.findByText("Qual pedra você está polindo hoje?")).toBeTruthy();
    expect(eventos.length).toBe(1);
    expect(eventos[0].type).toBe("m10:chat-aberto");
  });
});

describe("Widget — contexto padrão da página (data-contexto-chat)", () => {
  it("gatilho sem data-item (ex.: botão do cabeçalho) usa o contexto da página", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <button type="button" data-abrir-chat="">
          cabeçalho
        </button>
        <main data-contexto-chat="Linha Green Turbo" />
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("cabeçalho"));
    await usuario.type(await screen.findByRole("textbox", { name: /mensagem/i }), "Oi{Enter}");
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith("Oi", {
        url: expect.any(String),
        item: "Linha Green Turbo",
        abertura: null,
      }),
    );
  });

  it("botão flutuante como primeiro clique também usa o contexto da página", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <main data-contexto-chat="Linha Green Turbo" />
        <Widget />
      </>,
    );
    await usuario.click(screen.getByTestId("botao-chat"));
    await usuario.type(await screen.findByRole("textbox", { name: /mensagem/i }), "Oi{Enter}");
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith("Oi", {
        url: expect.any(String),
        item: "Linha Green Turbo",
        abertura: null,
      }),
    );
  });

  it("data-item do gatilho vence o contexto da página", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <main data-contexto-chat="Linha Green Turbo">
          <button type="button" data-abrir-chat="" data-item="Kit GT">
            item
          </button>
        </main>
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("item"));
    await usuario.type(await screen.findByRole("textbox", { name: /mensagem/i }), "Oi{Enter}");
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith("Oi", expect.objectContaining({ item: "Kit GT" })),
    );
  });

  it("fora de uma página com contexto, continua sem item", async () => {
    const usuario = userEvent.setup();
    render(<Widget />);
    await usuario.click(screen.getByTestId("botao-chat"));
    await usuario.type(await screen.findByRole("textbox", { name: /mensagem/i }), "Oi{Enter}");
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith("Oi", expect.objectContaining({ item: null })),
    );
  });
});

describe("Widget — abertura só em conversa vazia", () => {
  const BALAO = "Qual pedra você está polindo hoje?";
  function Gatilhos() {
    return (
      <button type="button" data-abrir-chat="" data-item="Linha Green Turbo" data-abertura={BALAO}>
        balão
      </button>
    );
  }

  it("sessão retomada com mensagens: a abertura não aparece nem vai no contexto", async () => {
    controle.historico = [
      {
        id: "m1",
        de: "especialista",
        texto: "Oi de novo! Como foi o polimento?",
        situacao: "entregue",
      },
    ];
    const usuario = userEvent.setup();
    render(
      <>
        <Gatilhos />
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("balão"));
    expect(await screen.findByText("Oi de novo! Como foi o polimento?")).toBeTruthy();
    expect(screen.queryByText(BALAO)).toBeNull();
    await usuario.type(await screen.findByRole("textbox", { name: /mensagem/i }), "Granito{Enter}");
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith("Granito", {
        url: expect.any(String),
        item: "Linha Green Turbo",
        abertura: null,
      }),
    );
  });

  it("conversa já começada nesta página: um gatilho com abertura não a acrescenta", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <Gatilhos />
        <Widget />
      </>,
    );
    await usuario.click(screen.getByTestId("botao-chat"));
    await usuario.type(await screen.findByRole("textbox", { name: /mensagem/i }), "Oi{Enter}");
    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
    await usuario.click(screen.getByRole("button", { name: /fechar conversa/i }));

    await usuario.click(screen.getByText("balão"));
    await screen.findByRole("textbox", { name: /mensagem/i });
    expect(screen.queryByText(BALAO)).toBeNull();
    await usuario.type(screen.getByRole("textbox", { name: /mensagem/i }), "Granito{Enter}");
    await waitFor(() =>
      expect(enviar).toHaveBeenLastCalledWith(
        "Granito",
        expect.objectContaining({ abertura: null }),
      ),
    );
  });
});

describe("Widget — segundo clique enquanto a sessão ainda abre", () => {
  it("não sincroniza nem envia antes da sessão; a pergunta pronta sai quando ela abre", async () => {
    let liberar: () => void = () => {};
    controle.abrir = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    const usuario = userEvent.setup();
    render(
      <>
        <button type="button" data-abrir-chat="" data-item="Linha Green Turbo">
          primeiro
        </button>
        <button
          type="button"
          data-abrir-chat=""
          data-item="Linha Green Turbo"
          data-mensagem="Serve para quartzito?"
        >
          chip
        </button>
        <Widget />
      </>,
    );
    await usuario.click(screen.getByText("primeiro"));
    await usuario.click(screen.getByText("chip"));
    // Dá tempo a qualquer promessa pendente: nada pode ter ido para a rede.
    await new Promise((resolver) => setTimeout(resolver, 20));
    expect(sincronizar).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();

    liberar();
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith(
        "Serve para quartzito?",
        expect.objectContaining({ item: "Linha Green Turbo" }),
      ),
    );
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});
