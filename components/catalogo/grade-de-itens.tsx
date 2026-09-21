"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CartaoItem } from "@/components/catalogo/cartao-item";
import { Filtros } from "@/components/catalogo/filtros";
import {
  aplicarFiltros,
  escreverSelecaoNaUrl,
  filtrosDisponiveis,
  lerSelecaoDaUrl,
  ordenarPorGrana,
  type SelecaoDeFiltros,
} from "@/lib/catalog/apresentacao";
import type { ItemCatalogo } from "@/lib/catalog/schemas";

export function GradeDeItens({ itens }: { itens: ItemCatalogo[] }) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const [selecao, setSelecao] = useState<SelecaoDeFiltros>(() =>
    lerSelecaoDaUrl(new URLSearchParams(parametros.toString())),
  );

  // A URL manda: se a pessoa navega para um link com filtro (voltar, avançar,
  // link compartilhado), a seleção acompanha em vez de ficar presa ao estado
  // do primeiro render.
  useEffect(() => {
    setSelecao(lerSelecaoDaUrl(new URLSearchParams(parametros.toString())));
  }, [parametros]);

  const ordenados = useMemo(() => ordenarPorGrana(itens), [itens]);
  const grupos = useMemo(() => {
    const disponiveis = filtrosDisponiveis(ordenados);
    return [
      { chave: "pedra" as const, titulo: "Pedra", opcoes: disponiveis.pedras },
      { chave: "aplicacao" as const, titulo: "Aplicação", opcoes: disponiveis.aplicacoes },
      { chave: "grana" as const, titulo: "Grana", opcoes: disponiveis.granas },
      { chave: "diametro" as const, titulo: "Diâmetro", opcoes: disponiveis.diametros },
    ];
  }, [ordenados]);

  const visiveis = useMemo(() => aplicarFiltros(ordenados, selecao), [ordenados, selecao]);

  function atualizar(nova: SelecaoDeFiltros) {
    setSelecao(nova);
    // `replace` com `scroll: false`: a URL vira link compartilhável sem a
    // página pular para o topo a cada clique.
    router.replace(`${caminho}${escreverSelecaoNaUrl(nova)}`, { scroll: false });
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[16rem_1fr]">
      <aside aria-label="Filtros">
        <Filtros
          grupos={grupos}
          selecao={selecao}
          aoEscolher={(chave, valor) =>
            atualizar({ ...selecao, [chave]: selecao[chave] === valor ? undefined : valor })
          }
          aoLimpar={() => atualizar({})}
        />
      </aside>
      <div>
        <div role="status" aria-live="polite">
          <p className="font-mono text-sm text-texto-secundario">
            {visiveis.length} {visiveis.length === 1 ? "item" : "itens"}
          </p>
          {visiveis.length === 0 ? (
            <p className="mt-8 text-texto-secundario">
              Nenhum item com essa combinação. Limpe os filtros ou fale com um especialista.
            </p>
          ) : null}
        </div>
        {visiveis.length > 0 ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visiveis.map((item) => (
              <CartaoItem key={item.slug} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
