import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NaoEncontrada from "@/app/not-found";

describe("NaoEncontrada", () => {
  it("tem um botão com data-abrir-chat vazio", () => {
    const { container } = render(<NaoEncontrada />);
    const button = container.querySelector("button[data-abrir-chat]");
    expect(button).toBeTruthy();
    expect(button?.getAttribute("data-abrir-chat")).toBe("");
  });

  it("tem um link para a home", () => {
    const { container } = render(<NaoEncontrada />);
    const link = container.querySelector("a[href='/']");
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain("Voltar ao início");
  });

  it("tem um h1 único", () => {
    const { container } = render(<NaoEncontrada />);
    const h1Elements = container.querySelectorAll("h1");
    expect(h1Elements).toHaveLength(1);
    expect(h1Elements[0]?.textContent).toBe("Esta página saiu de linha");
  });
});
