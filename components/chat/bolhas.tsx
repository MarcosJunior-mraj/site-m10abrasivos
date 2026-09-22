import type { Bolha } from "@/lib/webchat/tipos";

/**
 * Região `role="log"` com `aria-live="polite"`: cada bolha nova é anunciada
 * para leitor de tela sem interromper o que está sendo lido.
 */
export function Bolhas({
  bolhas,
  digitando,
  vendedorEntrou,
}: {
  bolhas: Bolha[];
  digitando: boolean;
  vendedorEntrou: boolean;
}) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      className="flex-1 space-y-3 overflow-y-auto p-4"
    >
      {vendedorEntrou ? (
        <p className="text-center text-xs text-texto-secundario">
          Um especialista entrou na conversa.
        </p>
      ) : null}
      {bolhas.map((bolha) => (
        <p
          key={bolha.id}
          className={`max-w-[85%] rounded-tecnico px-3 py-2 text-sm ${
            bolha.de === "cliente"
              ? "ml-auto bg-laranja text-azul"
              : "border border-borda bg-azul text-texto"
          } ${bolha.situacao === "falhou" ? "opacity-60" : ""}`}
        >
          {bolha.texto}
        </p>
      ))}
      {digitando ? <p className="text-xs text-texto-secundario">digitando…</p> : null}
    </div>
  );
}
