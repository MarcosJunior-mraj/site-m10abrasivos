/** Caminhos que são páginas de verdade ou rotas do site — nunca categoria. */
export const RESERVADOS = new Set([
  "produto",
  "privacidade",
  "api",
  "imagens",
  "sitemap.xml",
  "robots.txt",
  "linhas",
  "catalogo",
]);

/** Verifica se um slug colide com rotas reservadas. */
export function ehSlugReservado(slug: string): boolean {
  return RESERVADOS.has(slug);
}
