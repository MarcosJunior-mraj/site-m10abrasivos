"use client";

import type { OpcaoDeFiltro, SelecaoDeFiltros } from "@/lib/catalog/apresentacao";

type Grupo = { chave: keyof SelecaoDeFiltros; titulo: string; opcoes: OpcaoDeFiltro[] };

export function Filtros({
  grupos,
  selecao,
  aoEscolher,
  aoLimpar,
}: {
  grupos: Grupo[];
  selecao: SelecaoDeFiltros;
  aoEscolher: (chave: keyof SelecaoDeFiltros, valor: string) => void;
  aoLimpar: () => void;
}) {
  const temEscolha = Object.values(selecao).some(Boolean);

  return (
    <div className="flex flex-col gap-5">
      {grupos
        .filter((grupo) => grupo.opcoes.length > 0)
        .map((grupo) => (
          <fieldset key={grupo.chave} className="flex flex-col gap-2">
            <legend className="text-xs uppercase tracking-wider text-texto-secundario">
              {grupo.titulo}
            </legend>
            <div className="flex flex-wrap gap-2">
              {grupo.opcoes.map((opcao) => {
                const escolhida = selecao[grupo.chave] === opcao.valor;
                return (
                  <button
                    key={opcao.valor}
                    type="button"
                    aria-pressed={escolhida}
                    onClick={() => aoEscolher(grupo.chave, opcao.valor)}
                    className={`rounded-tecnico border px-3 py-1.5 text-sm ${
                      escolhida
                        ? "border-laranja bg-laranja text-azul"
                        : "border-borda text-texto-secundario"
                    }`}
                  >
                    {opcao.rotulo}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      {temEscolha ? (
        <button
          type="button"
          onClick={aoLimpar}
          className="self-start text-sm text-laranja underline"
        >
          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}
