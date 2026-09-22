import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Widget } from "@/components/chat/widget";
import { ClienteWebchatFalso } from "./duplos/cliente-webchat-falso";

const CHAVE_LGPD = "m10_lgpd_aceito";

vi.mock("@/lib/webchat/cliente", async () => {
  const { ClienteWebchatFalso: Falso } = await import("./duplos/cliente-webchat-falso");
  return { ClienteWebchat: Falso };
});

beforeEach(() => {
  localStorage.clear();
  ClienteWebchatFalso.instancias = [];
  ClienteWebchatFalso.modoDeAbrir = "normal";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Widget — montagem", () => {
  it("clique no botão flutuante com o painel aberto fecha sem chamar sincronizar (cota de 200 req/dia)", async () => {
    localStorage.setItem(CHAVE_LGPD, "1");
    const usuario = userEvent.setup();
    render(<Widget />);

    await usuario.click(screen.getByTestId("botao-chat"));
    // O painel de verdade (com o campo) — a casca provisória aparece antes,
    // enquanto o código do chat ainda carrega.
    await screen.findByRole("textbox", { name: /mensagem/i });

    const instancia = ClienteWebchatFalso.instancias.at(-1);
    expect(instancia).toBeDefined();
    const chamadasAntes = instancia?.chamadasDeSincronizar ?? 0;

    await usuario.click(screen.getByTestId("botao-chat"));

    expect(screen.queryByRole("dialog", { name: /conversa com o especialista/i })).toBeNull();
    expect(instancia?.chamadasDeSincronizar).toBe(chamadasAntes);
  });

  it("a contingência de 45 s não é apagada por uma atualização do núcleo sem bolha nova (ex.: digitando)", async () => {
    localStorage.setItem(CHAVE_LGPD, "1");
    const usuario = userEvent.setup();
    render(<Widget />);

    await usuario.click(screen.getByTestId("botao-chat"));
    const campo = await screen.findByRole("textbox", { name: /mensagem/i });

    const instancia = ClienteWebchatFalso.instancias.at(-1);
    if (!instancia) throw new Error("cliente falso não foi criado");

    vi.useFakeTimers();

    fireEvent.change(campo, { target: { value: "Preciso de disco para granito" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    // Deixa a promessa de `cliente.enviar` (resolvida na hora, no dublê)
    // drenar antes de avançar o relógio, senão o `setTimeout` da contingência
    // ainda não teria sido agendado.
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    expect(screen.getByRole("link", { name: /continuar no whatsapp/i })).toBeDefined();

    // Um "digitando" chegando depois do timer não pode apagar a oferta de
    // WhatsApp: é exatamente o bug de fonte de verdade que este teste cobre.
    act(() => {
      instancia.emitir({ digitando: true });
    });

    expect(screen.getByRole("link", { name: /continuar no whatsapp/i })).toBeDefined();
  });

  it("StrictMode remonta o chat sem reaproveitar o cliente morto", async () => {
    localStorage.setItem(CHAVE_LGPD, "1");
    const usuario = userEvent.setup();

    render(
      <StrictMode>
        <Widget />
      </StrictMode>,
    );

    await usuario.click(screen.getByTestId("botao-chat"));
    await screen.findByRole("textbox", { name: /mensagem/i });

    // Se o cliente morto da primeira montagem fosse reaproveitado sem
    // reassinar `aoMudar`, a bolha emitida pelo cliente vivo nunca apareceria.
    const vivo = ClienteWebchatFalso.instancias.at(-1);
    if (!vivo) throw new Error("cliente falso não foi criado");
    act(() => {
      vivo.emitir({
        bolhas: [{ id: "1", de: "cliente", texto: "Olá de novo", situacao: "entregue" }],
      });
    });
    expect(await screen.findByText("Olá de novo")).toBeDefined();
  });

  it("visitante que volta com sessão salva não abre sessão nem SSE antes de clicar (I2)", async () => {
    localStorage.setItem(CHAVE_LGPD, "1");
    localStorage.setItem("webchat_token_", "token-existente");
    const usuario = userEvent.setup();

    render(<Widget />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(ClienteWebchatFalso.instancias).toHaveLength(0);

    await usuario.click(screen.getByTestId("botao-chat"));
    await screen.findByRole("textbox", { name: /mensagem/i });
    expect(ClienteWebchatFalso.instancias.length).toBeGreaterThanOrEqual(1);
  });

  it("enquanto a sessão abre, o painel já aparece com indicador e o link do WhatsApp (I3)", async () => {
    localStorage.setItem(CHAVE_LGPD, "1");
    ClienteWebchatFalso.modoDeAbrir = "pendurada";
    const usuario = userEvent.setup();
    render(<Widget />);

    await usuario.click(screen.getByTestId("botao-chat"));

    // Espera o painel de verdade (o cliente já existe e a abertura está pendurada).
    await vi.waitFor(() => expect(ClienteWebchatFalso.instancias.length).toBeGreaterThan(0));
    const painel = await screen.findByRole("dialog", { name: /conversa com o especialista/i });
    expect(painel.textContent).toMatch(/conectando/i);
    expect(screen.getByRole("link", { name: /whatsapp/i }).getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\//,
    );
  });

  it("abertura que lança degrada para o WhatsApp em vez de ficar sem saída (I3)", async () => {
    localStorage.setItem(CHAVE_LGPD, "1");
    ClienteWebchatFalso.modoDeAbrir = "lanca";
    const usuario = userEvent.setup();
    render(<Widget />);

    await usuario.click(screen.getByTestId("botao-chat"));

    expect(await screen.findByRole("link", { name: /continuar no whatsapp/i })).toBeDefined();
    expect(ClienteWebchatFalso.instancias.at(-1)?.estado.fase).toBe("degradado");
  });
});
