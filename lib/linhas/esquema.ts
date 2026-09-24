import { z } from "zod";

const texto = z.string().trim().min(1);

export const esquemaVideoCurto = z.object({
  celular: texto,
  computador: texto,
  capa: texto,
  descricao: texto,
});

export const esquemaFoto = z.object({
  caminho: texto,
  alt: texto,
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
});

/** Nada inventado: depoimento só com autorização registrada. */
export const esquemaDepoimento = z.object({
  video: z.object({ arquivo: texto, capa: texto }),
  nome: texto,
  cidade: texto,
  marmoraria: texto,
  autorizado: z.literal(true),
});

/** Nada inventado: número só com a fonte anotada. */
export const esquemaNumero = z.object({ valor: texto, rotulo: texto, fonte: texto });

export const esquemaLinha = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  nome: texto,
  /** Rascunho não vai ao ar (só com MOSTRAR_RASCUNHOS=1) e mostra os marcadores "Aguardando material". */
  rascunho: z.boolean(),
  /** Categoria do catálogo desta linha: a grade "Linhas M10" troca o link da categoria pela página de vendas. */
  categoriaSlug: z.string().nullable(),
  seo: z.object({ titulo: texto, descricao: texto, imagem: esquemaFoto.nullable() }),
  ia: z.object({ contexto: texto, balao: texto }),
  topo: z.object({
    selo: texto,
    titulo: texto,
    subtitulo: texto,
    cta: texto,
    video: esquemaVideoCurto.nullable(),
  }),
  faixa: z.object({
    titulo: texto,
    graos: z.array(texto).min(2),
    fotoEspelhado: esquemaFoto.nullable(),
  }),
  dor: z.object({ titulo: texto, texto: texto }),
  razoes: z.object({
    titulo: texto,
    itens: z
      .array(z.object({ titulo: texto, texto: texto, video: esquemaVideoCurto.nullable() }))
      .min(1),
  }),
  especialista: z.object({ titulo: texto, perguntasProntas: z.array(texto).min(1).max(6) }),
  depoimentos: z.array(esquemaDepoimento),
  numeros: z.array(esquemaNumero),
  oferta: z.object({
    titulo: texto,
    texto: texto,
    cta: texto,
    kitSlug: z.string().nullable(),
    avulsosSlugs: z.array(z.string()),
  }),
  duvidas: z.array(z.object({ pergunta: texto, resposta: texto })),
  fechamento: z.object({ titulo: texto, cta: texto }),
});

export type Linha = z.infer<typeof esquemaLinha>;
export type VideoCurto = z.infer<typeof esquemaVideoCurto>;
export type Foto = z.infer<typeof esquemaFoto>;
export type Depoimento = z.infer<typeof esquemaDepoimento>;
export type Numero = z.infer<typeof esquemaNumero>;
