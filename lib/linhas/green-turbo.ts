import type { Linha } from "./esquema";

/**
 * Linha piloto. Textos das seções vêm do design aprovado (spec 2026-09-23, seção 4);
 * a copy final passa pela aprovação do usuário antes de `rascunho: false`.
 * Mídia, depoimentos e números ficam vazios até o material chegar — nada inventado.
 */
export const GREEN_TURBO: Linha = {
  slug: "green-turbo",
  nome: "Green Turbo",
  rascunho: true,
  categoriaSlug: "abrasivos-para-poliborda",
  seo: {
    titulo: "Green Turbo — brilho espelhado direto da poliborda",
    descricao:
      "Abrasivo M10 Green Turbo para poliborda: brilho espelhado em granito, mármore, quartzito e quartzo, sem retrabalho. Fale com um especialista.",
    imagem: null,
  },
  ia: {
    contexto: "Linha Green Turbo",
    balao: "Qual pedra você está polindo hoje na poliborda?",
  },
  topo: {
    selo: "Abrasivo M10 Green Turbo",
    titulo: "Sai da poliborda com brilho de espelho.",
    subtitulo: "Direto para o cliente. Sem retrabalho.",
    cta: "Pergunte ao especialista",
    video: null,
  },
  faixa: {
    titulo: "Saia do fosco e chegue ao espelhado",
    graos: ["#50", "#100", "#200", "#400", "#800", "#1500", "#3000"],
    fotoEspelhado: null,
  },
  dor: {
    titulo: "Quanto custa voltar a peça para a bancada?",
    texto:
      "Pedra que sai fosca da poliborda vira retrabalho manual, atraso na entrega e cliente reclamando. Cada peça que volta é hora de produção perdida.",
  },
  razoes: {
    titulo: "Por que marmorarias trocam para o Green Turbo",
    itens: [
      {
        titulo: "Brilho espelhado",
        texto: "Acabamento que sai pronto da poliborda, sem deixar a pedra fosca.",
        video: null,
      },
      {
        titulo: "Velocidade na produção",
        texto: "A sequência trabalha rápido e a linha não para esperando acabamento.",
        video: null,
      },
      {
        titulo: "Economia de tempo e dinheiro",
        texto: "Sem retrabalho, cada peça sai uma vez só — e o tempo da equipe vira produção.",
        video: null,
      },
      {
        titulo: "Satisfação do cliente",
        texto: "A peça chega com o brilho que o cliente espera, sem retoque na obra.",
        video: null,
      },
    ],
  },
  especialista: {
    titulo: "Pergunte ao especialista",
    perguntasProntas: [
      "Serve para quartzito?",
      "Qual sequência para mármore?",
      "Minha poliborda tem 6 cabeças",
      "Quanto custa o kit?",
    ],
  },
  depoimentos: [],
  numeros: [],
  oferta: {
    titulo: "Kit Green Turbo para Poliborda · 7 grãos",
    texto:
      "Do #50 ao #3000, uma peça de cada: a sequência completa para sair da poliborda com brilho de espelho.",
    cta: "Quero o valor do kit",
    kitSlug: "kit-gt-para-poliborda",
    avulsosSlugs: [
      "abrasivo-m10-green-turbo-50",
      "abrasivo-m10-green-turbo-100",
      "abrasivo-m10-green-turbo-200",
      "abrasivo-m10-green-turbo-400",
      "abrasivo-m10-green-turbo-800",
      "abrasivo-m10-green-turbo-1500",
      "abrasivo-m10-green-turbo-3000",
    ],
  },
  duvidas: [
    {
      pergunta: "Serve na minha poliborda?",
      resposta:
        "O especialista confere o modelo e o número de cabeças da sua máquina e indica a montagem certa.",
    },
    {
      pergunta: "Trabalha com água?",
      resposta: "Sim. O Green Turbo trabalha com água na poliborda.",
    },
    {
      pergunta: "Serve para quais pedras?",
      resposta: "Granito, mármore, quartzito e quartzo (pedra industrializada).",
    },
  ],
  fechamento: {
    titulo: "Sua próxima peça sai pronta da poliborda.",
    cta: "Falar com especialista",
  },
};
