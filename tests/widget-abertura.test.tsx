import { render, screen, waitFor } from "@testing-library/react";
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

beforeEach(() => {
  enviar.mockClear();
  localStorage.setItem("m10_lgpd_aceito", "1");
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
});
