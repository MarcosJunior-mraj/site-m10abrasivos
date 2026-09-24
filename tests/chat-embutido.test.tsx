import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enviar = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/webchat/cliente", () => ({
  ClienteWebchat: class {
    estado = {
      fase: "pronto",
      bolhas: [],
      digitando: false,
      vendedorEntrou: false,
      linkDoWhatsapp: "https://wa.me/1",
      ofereceuWhatsapp: false,
      aviso: null,
    };
    aoMudar(cb: (e: unknown) => void) {
      cb(this.estado);
    }
    abrir = vi.fn().mockResolvedValue(undefined);
    conectar = vi.fn();
    sincronizar = vi.fn().mockResolvedValue(undefined);
    enviar = enviar;
    encerrar = vi.fn();
    desconectar = vi.fn();
    cairParaWhatsapp = vi.fn();
  },
}));
vi.mock("@/components/chat/turnstile", () => ({
  resolverTurnstile: vi.fn().mockResolvedValue(null),
}));

import { Widget } from "@/components/chat/widget";
import { PergunteAoEspecialista } from "@/components/linhas/pergunte-ao-especialista";
import { GREEN_TURBO } from "@/lib/linhas/green-turbo";

beforeEach(() => localStorage.setItem("m10_lgpd_aceito", "1"));

describe("chat embutido", () => {
  it("pergunta pronta abre o painel dentro da seção e envia a mensagem", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <PergunteAoEspecialista linha={GREEN_TURBO} />
        <Widget />
      </>,
    );
    await usuario.click(screen.getByRole("button", { name: "Serve para quartzito?" }));
    const secao = screen.getByTestId("chat-embutido");
    const painel = await within(secao).findByRole("region", {
      name: /conversa com o especialista/i,
    });
    expect(painel).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(enviar).toHaveBeenCalledWith(
        "Serve para quartzito?",
        expect.objectContaining({ item: "Linha Green Turbo" }),
      ),
    );
  });

  it("depois, o botão flutuante mostra a mesma conversa como janela", async () => {
    const usuario = userEvent.setup();
    render(
      <>
        <PergunteAoEspecialista linha={GREEN_TURBO} />
        <Widget />
      </>,
    );
    await usuario.click(screen.getByRole("button", { name: "Serve para quartzito?" }));
    await within(screen.getByTestId("chat-embutido")).findByRole("region");
    await usuario.click(screen.getByTestId("botao-chat"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(within(screen.getByTestId("chat-embutido")).queryByRole("region")).toBeNull();
  });

  it("antes de qualquer clique, a seção mostra a prévia com as perguntas prontas", () => {
    render(<PergunteAoEspecialista linha={GREEN_TURBO} />);
    for (const p of GREEN_TURBO.especialista.perguntasProntas) {
      const botao = screen.getByRole("button", { name: p });
      expect(botao.getAttribute("data-mensagem")).toBe(p);
      expect(botao.getAttribute("data-item")).toBe("Linha Green Turbo");
    }
  });
});
