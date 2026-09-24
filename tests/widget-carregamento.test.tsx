import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Widget } from "@/components/chat/widget";

// Simula o pedaço do chat que não chegou (rede caiu, deploy novo trocou os arquivos).
vi.mock("@/components/chat/chat-completo", () => {
  throw new Error("falha ao carregar o chunk do chat");
});

describe("Widget — código do chat não carregou", () => {
  it("o clique ainda mostra o painel com a saída pelo WhatsApp", async () => {
    const silenciar = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const usuario = userEvent.setup();
    render(<Widget />);

    await usuario.click(screen.getByTestId("botao-chat"));

    const link = await screen.findByRole("link", { name: /continuar no whatsapp/i });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\//);
    expect(screen.getByRole("dialog", { name: /conversa com o especialista/i })).toBeDefined();
    silenciar.mockRestore();
  });
});
