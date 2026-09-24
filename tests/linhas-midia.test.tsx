import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AguardandoMaterial } from "@/components/linhas/aguardando-material";
import { VideoComSom } from "@/components/linhas/video-com-som";
import { VideoCurto } from "@/components/linhas/video-curto";

const VIDEO = {
  celular: "gt/topo-720.mp4",
  computador: "gt/topo-1080.mp4",
  capa: "gt/topo.jpg",
  descricao: "Poliborda polindo granito",
};

let aoCruzar: ((entradas: { isIntersecting: boolean }[]) => void) | null = null;
beforeEach(() => {
  aoCruzar = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        aoCruzar = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
});
afterEach(() => vi.unstubAllGlobals());

describe("VideoCurto", () => {
  it("mostra a capa e só põe o vídeo quando chega perto da tela", () => {
    const { container } = render(<VideoCurto video={VIDEO} />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("gt/topo.jpg");
    expect(container.querySelector("video")).toBeNull();
    act(() => aoCruzar?.([{ isIntersecting: true }]));
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.hasAttribute("playsinline")).toBe(true);
    expect(
      [...(video?.querySelectorAll("source") ?? [])].map((s) => s.getAttribute("src")),
    ).toEqual([
      expect.stringContaining("gt/topo-720.mp4"),
      expect.stringContaining("gt/topo-1080.mp4"),
    ]);
  });

  it("com menos animação pedida, fica só a capa", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q }));
    const { container } = render(<VideoCurto video={VIDEO} />);
    act(() => aoCruzar?.([{ isIntersecting: true }]));
    expect(container.querySelector("video")).toBeNull();
  });

  it("tem botão pausável para WCAG 2.2.2: antes de chegar não há botão; depois há; clique alterna pause/play", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<VideoCurto video={VIDEO} />);
    expect(screen.queryByRole("button", { name: /pausar vídeo/i })).toBeNull();
    act(() => aoCruzar?.([{ isIntersecting: true }]));
    let btn = screen.getByRole("button", { name: /pausar vídeo/i });
    expect(btn).toBeTruthy();
    await userEvent.click(btn);
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /retomar vídeo/i })).toBeTruthy();
    btn = screen.getByRole("button", { name: /retomar vídeo/i });
    await userEvent.click(btn);
    expect(play).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /pausar vídeo/i })).toBeTruthy();
  });
});

describe("VideoComSom", () => {
  it("não baixa nada antes do clique; no clique toca com controles", async () => {
    const tocar = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container } = render(
      <VideoComSom arquivo="gt/dep.mp4" capa="gt/dep.jpg" titulo="Depoimento de João" />,
    );
    expect(container.querySelector("video")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /assistir.*depoimento de joão/i }));
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toContain("gt/dep.mp4");
    expect(video?.hasAttribute("controls")).toBe(true);
    expect(tocar).toHaveBeenCalled();
  });
});

describe("AguardandoMaterial", () => {
  it("diz o que falta", () => {
    render(<AguardandoMaterial oque="vídeo do topo" />);
    expect(screen.getByText(/aguardando material: vídeo do topo/i)).toBeTruthy();
  });
});
