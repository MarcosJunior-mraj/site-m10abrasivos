/**
 * Vídeo que substitui a foto no cartão de um item do catálogo. Os arquivos
 * ficam em `public/videos` (servidos pelo próprio site). Chave = slug do item.
 */
export type VideoDoItem = { video: string; capa: string; descricao: string };

const VIDEOS: Record<string, VideoDoItem> = {
  "kit-gt-para-poliborda": {
    video: "/videos/kit-gt-para-poliborda.mp4",
    capa: "/videos/kit-gt-para-poliborda.jpg",
    descricao: "Abrasivos Green Turbo trabalhando na poliborda",
  },
};

export function videoDoItem(slug: string): VideoDoItem | null {
  return VIDEOS[slug] ?? null;
}
