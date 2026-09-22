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
    await screen.findByRole("dialog", { name: /conversa com o especialista/i });

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

  it("StrictMode remonta o efeito de reconexão automática sem reaproveitar o cliente morto", async () => {
    // Visitante que já tem sessão salva: o efeito de "religar sozinho" cria o
    // cliente já na montagem, que é exatamente o caso que o StrictMode duplica.
    localStorage.setItem(CHAVE_LGPD, "1");
    localStorage.setItem("webchat_token_", "token-existente");
    const usuario = userEvent.setup();

    render(
      <StrictMode>
        <Widget />
      </StrictMode>,
    );

    // Se o cliente morto da primeira montagem fosse reaproveitado sem
    // reassinar `aoMudar`, o painel nunca chegaria a aparecer aqui.
    await usuario.click(screen.getByTestId("botao-chat"));
    await screen.findByRole("dialog", { name: /conversa com o especialista/i });

    expect(ClienteWebchatFalso.instancias.length).toBeGreaterThanOrEqual(2);
  });
});
