import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Painel } from "@/components/chat/painel";
import type { EstadoDoChat } from "@/lib/webchat/tipos";

function estado(parcial: Partial<EstadoDoChat>): EstadoDoChat {
  return {
    fase: "pronto",
    bolhas: [],
    digitando: false,
    vendedorEntrou: false,
    linkDoWhatsapp: "https://wa.me/5511999999999?text=Oi!%20Vim%20do%20site.",
    ofereceuWhatsapp: false,
    aviso: null,
    ...parcial,
  };
}

const acoes = { aoEnviar: vi.fn(), aoFechar: vi.fn() };

beforeEach(() => {
  acoes.aoEnviar.mockReset();
  acoes.aoFechar.mockReset();
});

describe("Painel", () => {
  it("envia o que foi digitado e limpa o campo", async () => {
    const usuario = userEvent.setup();
    render(<Painel estado={estado({})} {...acoes} />);

    const campo = screen.getByRole("textbox", { name: /mensagem/i });
    await usuario.type(campo, "Preciso de disco para quartzito");
    await usuario.click(screen.getByRole("button", { name: /enviar/i }));

    expect(acoes.aoEnviar).toHaveBeenCalledWith("Preciso de disco para quartzito");
    await waitFor(() => expect((campo as HTMLTextAreaElement).value).toBe(""));
  });

  it("anuncia mensagens novas para leitor de tela", () => {
    render(
      <Painel
        estado={estado({
          bolhas: [{ id: "1", de: "especialista", texto: "Olá!", situacao: "entregue" }],
        })}
        {...acoes}
      />,
    );
    const lista = screen.getByRole("log");
    expect(lista.getAttribute("aria-live")).toBe("polite");
    expect(lista.textContent).toContain("Olá!");
  });

  it("mostra o indicador de digitação e o aviso de vendedor", () => {
    render(<Painel estado={estado({ digitando: true, vendedorEntrou: true })} {...acoes} />);
    expect(screen.getByText(/digitando/i)).toBeDefined();
    expect(screen.getByText(/especialista entrou/i)).toBeDefined();
  });

  it("mostra o botão do WhatsApp com o texto certo depois do handoff", () => {
    render(<Painel estado={estado({ ofereceuWhatsapp: true })} {...acoes} />);
    const botao = screen.getByRole("link", { name: /continuar no whatsapp/i });
    expect(botao.getAttribute("href")).toBe(
      "https://wa.me/5511999999999?text=Oi!%20Vim%20do%20site.",
    );
  });

  it("no modo degradado some o campo e fica só o WhatsApp", () => {
    render(
      <Painel
        estado={estado({ fase: "degradado", aviso: "Continue pelo WhatsApp." })}
        {...acoes}
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("link", { name: /whatsapp/i })).toBeDefined();
    expect(screen.getByText(/continue pelo whatsapp/i)).toBeDefined();
  });

  it("fecha com Esc", async () => {
    const usuario = userEvent.setup();
    render(<Painel estado={estado({})} {...acoes} />);
    await usuario.keyboard("{Escape}");
    expect(acoes.aoFechar).toHaveBeenCalled();
  });

  it("prende o foco dentro do painel: Tab e Shift+Tab dão a volta nas pontas", async () => {
    const usuario = userEvent.setup();
    render(<Painel estado={estado({ ofereceuWhatsapp: true })} {...acoes} />);

    const fechar = screen.getByRole("button", { name: /fechar conversa/i });
    const enviar = screen.getByRole("button", { name: /enviar/i });

    enviar.focus();
    await usuario.tab();
    expect(document.activeElement).toBe(fechar);

    fechar.focus();
    await usuario.tab({ shift: true });
    expect(document.activeElement).toBe(enviar);
  });
});
