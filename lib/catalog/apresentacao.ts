import type { ItemCatalogo } from "./schemas";
import { textoSemPreco } from "./sem-preco";

/**
 * O CRM guarda os valores sem acento (vêm de listas fixas da tela de catálogo).
 * Aqui eles viram texto de gente. Valor desconhecido passa direto, em minúsculas
 * — nunca some da tela.
 */
const ROTULOS_DE_PEDRA: Record<string, string> = {
  marmore: "mármore",
  granito: "granito",
  quartzito: "quartzito",
  quartzo: "quartzo",
  porcelanato: "porcelanato",
  travertino: "travertino",
  ardosia: "ardósia",
  basalto: "basalto",
};

const ROTULOS_DE_APLICACAO: Record<string, string> = {
  desbaste: "desbaste",
  polimento: "polimento",
  lustro: "lustro",
  "acabamento-borda": "acabamento de borda",
  corte: "corte",
  rebaixo: "rebaixo",
};

export function rotuloDePedra(valor: string): string {
  return ROTULOS_DE_PEDRA[valor] ?? valor.replace(/[-_]+/g, " ");
}

export function rotuloDeAplicacao(valor: string): string {
  return ROTULOS_DE_APLICACAO[valor] ?? valor.replace(/[-_]+/g, " ");
}

export function comInicialMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "a", "b" e "c" — do jeito que se lê em voz alta. */
function listar(valores: string[]): string {
  if (valores.length <= 1) return valores[0] ?? "";
  return `${valores.slice(0, -1).join(", ")} e ${valores[valores.length - 1]}`;
}

/**
 * Frase montada SÓ com o que está na ficha. Nada de prazo, estoque, desempenho
 * ou preço: o que não está no dado não entra no texto.
 */
function frasePelaFicha(item: ItemCatalogo): string {
  if (item.kind === "kit") {
    const quantidade = item.components.length;
    if (quantidade === 0) return "Kit montado pela equipe M10.";
    const palavra = quantidade === 1 ? "item selecionado" : "itens selecionados";
    return `Kit com ${quantidade} ${palavra} para trabalhar em conjunto.`;
  }

  const medidas = ["Abrasivo M10"];
  if (item.grit) medidas.push(`grana ${item.grit}`);
  if (item.diameterMm) medidas.push(`Ø ${item.diameterMm} mm`);

  const aplicacoes = listar(item.applications.map(rotuloDeAplicacao));
  const pedras = listar(item.stones.map(rotuloDePedra));

  if (medidas.length === 1 && !aplicacoes && !pedras) return "Abrasivo M10 para marmorarias.";

  let frase = medidas.join(", ");
  if (aplicacoes) frase += `, para ${aplicacoes}`;
  if (pedras) frase += ` em ${pedras}`;
  return `${frase}.`;
}

/**
 * Descrição exibida (página, cartão, meta description e JSON-LD): a do CRM
 * sem as frases que falam de preço; se não sobrar nada, a frase da ficha.
 */
export function descricaoDoItem(item: ItemCatalogo): string {
  const doCrm = textoSemPreco(item.description?.trim() ?? "");
  return doCrm ? doCrm : frasePelaFicha(item);
}

/** Campo de SEO vindo do CRM, sem frase de preço; vazio vira `null` (o chamador usa o padrão). */
export function textoDeSeo(texto: string | null): string | null {
  const limpo = textoSemPreco(texto?.trim() ?? "");
  return limpo ? limpo : null;
}

function granaNumerica(item: ItemCatalogo): number {
  if (!item.grit) return Number.POSITIVE_INFINITY;
  const numero = Number(item.grit);
  return Number.isFinite(numero) ? numero : Number.POSITIVE_INFINITY;
}

/** Ordem estável: grana crescente, e quem não tem grana fica no fim na ordem em que chegou. */
export function ordenarPorGrana(itens: ItemCatalogo[]): ItemCatalogo[] {
  return [...itens].sort((a, b) => granaNumerica(a) - granaNumerica(b));
}

export type SelecaoDeFiltros = {
  pedra?: string;
  aplicacao?: string;
  grana?: string;
  diametro?: string;
};

export type OpcaoDeFiltro = { valor: string; rotulo: string; quantidade: number };

const CHAVES_DE_FILTRO = ["pedra", "aplicacao", "grana", "diametro"] as const;

function contar(
  itens: ItemCatalogo[],
  valores: (item: ItemCatalogo) => string[],
  rotulo: (valor: string) => string,
): OpcaoDeFiltro[] {
  const contagem = new Map<string, number>();
  for (const item of itens) {
    for (const valor of valores(item)) {
      contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
    }
  }
  return [...contagem.entries()]
    .map(([valor, quantidade]) => ({ valor, rotulo: rotulo(valor), quantidade }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Só entra no filtro o valor que existe em algum item da lista — nada de opção vazia. */
export function filtrosDisponiveis(itens: ItemCatalogo[]): {
  pedras: OpcaoDeFiltro[];
  aplicacoes: OpcaoDeFiltro[];
  granas: OpcaoDeFiltro[];
  diametros: OpcaoDeFiltro[];
} {
  const granas = contar(
    itens,
    (item) => (item.grit ? [item.grit] : []),
    (valor) => `#${valor}`,
  ).sort((a, b) => Number(a.valor) - Number(b.valor));

  return {
    pedras: contar(
      itens,
      (item) => item.stones,
      (valor) => comInicialMaiuscula(rotuloDePedra(valor)),
    ),
    aplicacoes: contar(
      itens,
      (item) => item.applications,
      (valor) => comInicialMaiuscula(rotuloDeAplicacao(valor)),
    ),
    granas,
    diametros: contar(
      itens,
      (item) => (item.diameterMm ? [String(item.diameterMm)] : []),
      (valor) => `Ø ${valor} mm`,
    ).sort((a, b) => Number(a.valor) - Number(b.valor)),
  };
}

export function aplicarFiltros(itens: ItemCatalogo[], selecao: SelecaoDeFiltros): ItemCatalogo[] {
  return itens.filter((item) => {
    if (selecao.pedra && !item.stones.includes(selecao.pedra)) return false;
    if (selecao.aplicacao && !item.applications.includes(selecao.aplicacao)) return false;
    if (selecao.grana && item.grit !== selecao.grana) return false;
    if (selecao.diametro && String(item.diameterMm ?? "") !== selecao.diametro) return false;
    return true;
  });
}

export function lerSelecaoDaUrl(parametros: URLSearchParams): SelecaoDeFiltros {
  const selecao: SelecaoDeFiltros = {};
  for (const chave of CHAVES_DE_FILTRO) {
    const valor = parametros.get(chave)?.trim();
    if (valor) selecao[chave] = valor.slice(0, 60);
  }
  return selecao;
}

export function escreverSelecaoNaUrl(selecao: SelecaoDeFiltros): string {
  const parametros = new URLSearchParams();
  for (const chave of CHAVES_DE_FILTRO) {
    const valor = selecao[chave];
    if (valor) parametros.set(chave, valor);
  }
  const texto = parametros.toString();
  return texto ? `?${texto}` : "";
}
