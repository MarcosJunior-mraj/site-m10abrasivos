"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type LinhaDoMenu = { slug: string; nome: string };
export type CategoriaDoMenu = { nome: string; slug: string };

/**
 * `<details>/<summary>` funciona sem JS (o menu abre/fecha nativamente); o
 * JS só adiciona o que o navegador não dá de graça: fechar ao clicar fora,
 * ao apertar Esc (devolvendo o foco ao `<summary>`) e ao trocar de rota —
 * sem isso o menu ficava aberto por cima do conteúdo da próxima página.
 */
export function MenuDeLinhas({
  linhas,
  categorias,
}: {
  linhas: LinhaDoMenu[];
  categorias: CategoriaDoMenu[];
}) {
  const detalhesRef = useRef<HTMLDetailsElement>(null);
  const resumoRef = useRef<HTMLElement>(null);
  const caminho = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: `caminho` é só o gatilho (fecha ao trocar de rota); o efeito não lê o valor.
  useEffect(() => {
    const detalhes = detalhesRef.current;
    if (detalhes) detalhes.open = false;
  }, [caminho]);

  useEffect(() => {
    function aoClicarFora(evento: PointerEvent) {
      const detalhes = detalhesRef.current;
      if (!detalhes?.open) return;
      if (evento.target instanceof Node && detalhes.contains(evento.target)) return;
      detalhes.open = false;
    }
    function aoTeclar(evento: KeyboardEvent) {
      const detalhes = detalhesRef.current;
      if (!detalhes?.open || evento.key !== "Escape") return;
      detalhes.open = false;
      resumoRef.current?.focus();
    }
    document.addEventListener("pointerdown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  return (
    <li className="relative">
      <details ref={detalhesRef} className="group">
        <summary
          ref={resumoRef}
          className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm uppercase tracking-wide text-texto-secundario hover:text-texto"
        >
          Linhas <span aria-hidden>▾</span>
        </summary>
        <ul className="absolute left-0 z-50 mt-2 min-w-56 rounded-tecnico border border-borda bg-azul p-2 shadow-xl">
          {linhas.map((linha) => (
            <li key={linha.slug}>
              <Link
                href={`/linhas/${linha.slug}`}
                className="block min-h-11 px-3 py-2 text-sm text-laranja hover:bg-superficie"
              >
                {linha.nome}
              </Link>
            </li>
          ))}
          {categorias.map((categoria) => (
            <li key={categoria.slug}>
              <Link
                href={`/${categoria.slug}`}
                className="block min-h-11 px-3 py-2 text-sm hover:bg-superficie"
              >
                {categoria.nome}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
